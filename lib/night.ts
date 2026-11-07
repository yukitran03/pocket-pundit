// Night report: once a viewer's watch window has closed, rank every match in it that finished with full data by
// what actually happened (drama from the public timeline) and see where that night's picks landed. Stored once per
// night, written to Walrus as a [night] memory after the fact (the picks themselves were locked there before
// kick-off), and opened in the next brief. The record counts the nights it missed too.
import { q, one } from "./db.ts";
import { fixturesBetween, timeline, type Fixture } from "./feed.ts";
import { computeDrama } from "./drama.ts";
import { enqueueMemory } from "./memory.ts";
import { compLabel } from "./picker.ts";
import { localToUtc } from "./util.ts";

/** Other formats score differently (a 5–3 futsal game isn't a better watch than a 2–1 league game). */
export const OTHER_FORMAT = /futsal|beach|e-?football|esports|e-sports/i;

/** Results land a while after the last kick-off in the window. */
const READY_AFTER_MS = 150 * 60_000;
const MAX_TIMELINES = 30;

export interface NightMatch {
  matchId: string;
  home: string;
  away: string;
  competition: string;
  homeScore: number;
  awayScore: number;
  drama: number;
}

export interface NightPick {
  matchId: string;
  arm: "memory" | "control";
  home: string;
  away: string;
  rank: number | null; // 1 = best of the night (ties share a rank); null = no result in the feed
  drama: number | null;
}

export interface NightReport {
  date: string;
  scheduled: number; // matches in the window
  scored: number; // of those, finished with a result
  best: NightMatch | null; // when a pick shares the top drama, that pick (so "best … one of my picks" is true)
  tiedBest?: NightMatch[]; // the other matches level with `best` on drama
  picks: NightPick[];
  caughtBest: boolean; // a pick was the night's best (or tied for it)
  top3: number; // picks ranked in the night's top three
  form?: LeagueForm; // what the night said about each competition (written to Walrus as a [form] memory)
}

type Scored = Pick<Fixture, "matchId" | "compId" | "home" | "away" | "competition" | "kickoff"> & { homeScore: number; awayScore: number; drama: number };

// ---------- league form: the learning half of a night report ----------

export interface FormEntry {
  compId: string;
  competition: string;
  n: number; // finished matches from this competition in the window
  mean: number; // their average drama
  value: number; // -1..1: above (+) or below (-) the night's average, shrunk towards 0 for small samples
}

export interface LeagueForm {
  mean: number; // the night's average drama
  matches: number;
  entries: FormEntry[];
}

const FORM_MIN_MATCHES = 3; // fewer finished matches than this and the night says nothing about leagues
const FORM_SCALE = 40; // 40 drama points above the night's average = +1 before shrinkage
const FORM_MIN_VALUE = 0.05;
const FORM_MAX_ENTRIES = 12;

/**
 * Pure: how each competition did against the rest of the night. One match is weak evidence, so a competition's
 * value is shrunk by n / (n + 1): a single 87 against a night averaging 61 counts as +0.33, not +0.65.
 */
export function leagueForm(scored: Pick<Scored, "compId" | "competition" | "drama">[]): LeagueForm | null {
  if (scored.length < FORM_MIN_MATCHES) return null;
  const mean = scored.reduce((s, m) => s + m.drama, 0) / scored.length;
  const by = new Map<string, { competition: string; sum: number; n: number }>();
  for (const m of scored) {
    const e = by.get(m.compId) ?? { competition: m.competition, sum: 0, n: 0 };
    e.sum += m.drama;
    e.n++;
    by.set(m.compId, e);
  }
  const entries: FormEntry[] = [];
  for (const [compId, e] of by) {
    const avg = e.sum / e.n;
    const value = Math.max(-1, Math.min(1, (avg - mean) / FORM_SCALE)) * (e.n / (e.n + 1));
    if (Math.abs(value) >= FORM_MIN_VALUE) entries.push({ compId, competition: e.competition, n: e.n, mean: Math.round(avg), value: Math.round(value * 100) / 100 });
  }
  entries.sort((a, b) => Math.abs(b.value) - Math.abs(a.value) || a.compId.localeCompare(b.compId));
  return { mean: Math.round(mean), matches: scored.length, entries: entries.slice(0, FORM_MAX_ENTRIES) };
}

const signed = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;

/** The Walrus sentence for league form. Its `cal=` tags are what the memory-on picks read back. */
export function formMemory(date: string, windowLabel: string, form: LeagueForm | null): string | null {
  if (!form || !form.entries.length) return null;
  const said = form.entries.slice(0, 3).map((e) => `${e.competition} ${e.mean} (${e.value >= 0 ? "above" : "below"}${e.n > 1 ? `, ${e.n} matches` : ""})`);
  const tags = form.entries.map((e) => `cal=${e.compId}:${signed(e.value)}`).join(" ");
  return `[form] ${date} · League form in my ${windowLabel} window, from ${form.matches} finished matches averaging drama ${form.mean}: ${said.join("; ")}. tags: kind=form ${tags}`;
}

const asMatch = (m: Scored): NightMatch => ({ matchId: m.matchId, home: m.home, away: m.away, competition: m.competition, homeScore: m.homeScore, awayScore: m.awayScore, drama: m.drama });

/**
 * Pure: rank the scored matches and place the picks. Ties share a rank (competition ranking). When a pick is level
 * on top, the report names that pick as the best and lists the others it shares the top with, so the sentence
 * "Best: X, one of my picks" is always about a match that was picked.
 */
export function rankNight(date: string, scheduled: number, scored: Scored[], picks: { match_id: string; arm: string; home: string; away: string }[]): NightReport {
  const order = [...scored].sort((a, b) => b.drama - a.drama || b.homeScore + b.awayScore - (a.homeScore + a.awayScore) || a.kickoff.localeCompare(b.kickoff));
  const rankOf = (drama: number) => 1 + order.filter((m) => m.drama > drama).length;
  const byId = new Map(order.map((m) => [m.matchId, m]));
  const placed: NightPick[] = picks.map((p) => {
    const m = byId.get(p.match_id);
    return { matchId: p.match_id, arm: p.arm === "control" ? "control" : "memory", home: p.home, away: p.away, rank: m ? rankOf(m.drama) : null, drama: m ? m.drama : null };
  });
  const picked = new Set(placed.filter((p) => p.rank === 1).map((p) => p.matchId));
  const level = order.filter((m) => m.drama === order[0]?.drama);
  const top = level.find((m) => picked.has(m.matchId)) ?? level[0];
  const tied = level.filter((m) => m !== top).map(asMatch);
  return {
    date,
    scheduled,
    scored: order.length,
    best: top ? asMatch(top) : null,
    ...(tied.length ? { tiedBest: tied } : {}),
    picks: placed,
    caughtBest: placed.some((p) => p.rank === 1),
    top3: placed.filter((p) => p.rank !== null && p.rank <= 3).length,
  };
}

export function windowOf(user: { tz: string; window_start: number; window_end: number }, date: string) {
  const start = localToUtc(date, user.window_start, user.tz);
  const end = localToUtc(date, user.window_end <= user.window_start ? user.window_end + 24 : user.window_end, user.tz);
  return { start, end };
}

const ordinal = (ranks: number[]) => {
  const s = ranks.map((r) => `#${r}`);
  return s.length <= 1 ? s.join("") : `${s.slice(0, -1).join(", ")} and ${s[s.length - 1]}`;
};

/** The Walrus sentence. No arms in it: which pick ran with memory off stays sealed until the viewer has rated. */
export function nightMemory(r: NightReport, windowLabel: string): string | null {
  if (!r.best) return null;
  const b = r.best;
  const ranks = r.picks.map((p) => p.rank).filter((x): x is number => x !== null).sort((a, c) => a - c);
  const unranked = r.picks.length - ranks.length;
  const mine = ranks.length
    ? ` My picks ranked ${ordinal(ranks)}${unranked ? ` (${unranked} had no result in the feed)` : ""}.`
    : " None of my picks had a result in the feed.";
  return `[night] ${r.date} · Night report for my ${windowLabel} window: ${r.scored} of ${r.scheduled} matches finished with full data. Best: ${b.home} ${b.homeScore}–${b.awayScore} ${b.away} (${b.competition}), drama ${b.drama}, ${r.caughtBest ? "one of my picks" : "not one of my picks"}${jointWith(r)}.${mine} tags: kind=night`;
}

/** ", joint best with X 2–1 Y (Comp)" or ", joint best with 3 other matches"; empty when the best stood alone. */
function jointWith(r: NightReport): string {
  const t = r.tiedBest ?? [];
  if (!t.length) return "";
  if (t.length === 1) return `, joint best with ${t[0].home} ${t[0].homeScore}–${t[0].awayScore} ${t[0].away} (${t[0].competition})`;
  return `, joint best with ${t.length} other matches`;
}

const hh = (h: number) => `${String(h % 24).padStart(2, "0")}:00`;

type NightUser = { id: number; namespace: string; tz: string; window_start: number; window_end: number };

const windowLabel = (u: NightUser) => `${hh(u.window_start)} to ${hh(u.window_end)}`;

/** Every match in the window (other formats left out), and the finished ones with their drama. */
async function scoreWindow(user: NightUser, date: string, pickIds: Set<string>): Promise<{ all: Fixture[]; scored: Scored[] }> {
  const { start, end } = windowOf(user, date);
  const all = (await fixturesBetween(start, end)).filter((f) => !OTHER_FORMAT.test(f.competition));
  const done = all.filter((f) => f.status === 0 && f.homeScore !== null && f.awayScore !== null);
  // Full drama needs the timeline. Fetch it for the likeliest contenders by score (and every pick); on a very busy
  // night the long tail keeps the score-only estimate.
  const rough = done.map((f) => ({ f, d: computeDrama(null, f.homeScore, f.awayScore).score }));
  rough.sort((a, b) => b.d - a.d);
  const deep = new Set([...rough.slice(0, MAX_TIMELINES).map((x) => x.f.matchId), ...pickIds]);
  const scored: Scored[] = [];
  for (const { f, d } of rough) {
    let drama = d;
    if (deep.has(f.matchId)) {
      const ev = await timeline(f.matchId);
      if (ev && ev.length) drama = computeDrama(ev, f.homeScore, f.awayScore).score;
    }
    // compLabel adds the country, as on the picks: "Premier League (ARM)", not a bare "Premier League".
    scored.push({ matchId: f.matchId, compId: f.compId, home: f.home, away: f.away, competition: compLabel(f), kickoff: f.kickoff, homeScore: f.homeScore!, awayScore: f.awayScore!, drama });
  }
  return { all, scored };
}

const enqueueForm = (user: NightUser, date: string, form: LeagueForm | null) => {
  const text = formMemory(date, windowLabel(user), form);
  return text ? enqueueMemory({ userId: user.id, namespace: user.namespace, kind: "form", text, idem: `form:${user.id}:${date}` }) : null;
};

/** Compute and store one night (idempotent). Returns null until the window has closed and results had time to land. */
export async function ensureNight(user: NightUser, date: string, now = new Date()): Promise<NightReport | null> {
  const have = await one<any>(`select report from nights where user_id = $1 and brief_date = $2`, [user.id, date]);
  if (have) return have.report as NightReport;
  const { end } = windowOf(user, date);
  if (now.getTime() < end.getTime() + READY_AFTER_MS) return null;
  const picks = await q<any>(`select match_id, arm, home, away from picks where user_id = $1 and brief_date = $2 order by slot`, [user.id, date]);
  if (!picks.length) return null;
  const { all, scored } = await scoreWindow(user, date, new Set(picks.map((p) => p.match_id)));
  const report: NightReport = { ...rankNight(date, all.length, scored, picks), form: leagueForm(scored) ?? { mean: 0, matches: scored.length, entries: [] } };
  const inserted = await q(`insert into nights (user_id, brief_date, report) values ($1, $2, $3::jsonb) on conflict do nothing returning user_id`, [user.id, date, JSON.stringify(report)]);
  if (inserted.length) {
    const text = nightMemory(report, windowLabel(user));
    if (text) await enqueueMemory({ userId: user.id, namespace: user.namespace, kind: "night", text, idem: `night:${user.id}:${date}` });
    await enqueueForm(user, date, report.form ?? null);
  }
  return report;
}

/** Nights reported before league form existed: score the window again and add the form (once; idempotent). */
async function addForm(user: NightUser, date: string): Promise<boolean> {
  const picks = await q<any>(`select match_id from picks where user_id = $1 and brief_date = $2`, [user.id, date]);
  const { scored } = await scoreWindow(user, date, new Set(picks.map((p) => p.match_id)));
  const form = leagueForm(scored);
  // An empty form is still recorded, so the night isn't scored again on every pass.
  const done = await q(`update nights set report = report || jsonb_build_object('form', $3::jsonb) where user_id = $1 and brief_date = $2 and not (report ? 'form') returning user_id`, [
    user.id,
    date,
    JSON.stringify(form ?? { mean: 0, matches: scored.length, entries: [] }),
  ]);
  if (done.length) await enqueueForm(user, date, form);
  return done.length > 0;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The brief's opening line about last night (no arms; the score only for viewers who opted into scores). */
export function nightLine(r: NightReport | null, record: { nights: number; caught: number } | null, showScores: boolean): string | null {
  if (!r?.best) return null;
  const b = r.best;
  const match = showScores ? `${esc(b.home)} ${b.homeScore}–${b.awayScore} ${esc(b.away)}` : `${esc(b.home)} v ${esc(b.away)}`;
  const tally = record && record.nights >= 2 ? `\n<i>Best of the night in your picks: ${record.caught} of ${record.nights} nights so far.</i>` : "";
  const joint = r.tiedBest?.length ? " (joint best)" : "";
  if (r.caughtBest) return `🏆 Last night's best in your window was one of your picks: <b>${match}</b> · drama ${b.drama}${joint}${tally}`;
  const ranked = r.picks.some((p) => p.rank !== null);
  return `📼 Last night's best in your window: <b>${match}</b> · drama ${b.drama}${joint}. ${ranked ? "Not one of your picks; worth the highlights." : "Worth the highlights."}${tally}`;
}

/** The brief date before `date` (YYYY-MM-DD). */
export const dayBefore = (date: string) => new Date(Date.parse(`${date}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

/** Tick stage: every recent night whose window has closed and has no report yet (at most a few per pass). */
export async function runNights(now = new Date(), max = 6): Promise<number> {
  const due = await q<any>(
    `select distinct p.user_id, p.brief_date, u.namespace, u.tz, u.window_start, u.window_end
     from picks p join users u on u.id = p.user_id
     left join nights n on n.user_id = p.user_id and n.brief_date = p.brief_date
     where n.user_id is null and p.kickoff > $1::timestamptz - interval '4 days' and p.kickoff < $1::timestamptz - interval '150 minutes'
     order by p.brief_date limit 24`,
    [now.toISOString()],
  );
  let made = 0;
  for (const r of due) {
    if (made >= max) break;
    const rep = await ensureNight({ id: Number(r.user_id), namespace: r.namespace, tz: r.tz, window_start: r.window_start, window_end: r.window_end }, r.brief_date, now);
    if (rep) made++;
  }
  const older = await q<any>(
    `select n.user_id, n.brief_date, u.namespace, u.tz, u.window_start, u.window_end from nights n join users u on u.id = n.user_id
     where not (n.report ? 'form') and n.created_at > $1::timestamptz - interval '4 days' order by n.brief_date limit 6`,
    [now.toISOString()],
  );
  for (const r of older) {
    if (made >= max) break;
    if (await addForm({ id: Number(r.user_id), namespace: r.namespace, tz: r.tz, window_start: r.window_start, window_end: r.window_end }, r.brief_date)) made++;
  }
  return made;
}

/** Competition names seen in this viewer's league form (compId → name), for labelling learned weights. */
export async function formLabels(userId: number): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const r of await q<any>(`select report from nights where user_id = $1 order by brief_date`, [userId])) {
    for (const e of (r.report as NightReport).form?.entries ?? []) out.set(e.compId, e.competition);
  }
  return out;
}

/** The viewer's record so far: nights with a ranked result, and how many had the night's best among the picks. */
export async function nightRecord(userId: number): Promise<{ nights: number; caught: number; top3Nights: number }> {
  const rows = await q<any>(`select report from nights where user_id = $1`, [userId]);
  const ranked = rows.map((r) => r.report as NightReport).filter((r) => r.best && r.picks.some((p) => p.rank !== null));
  return { nights: ranked.length, caught: ranked.filter((r) => r.caughtBest).length, top3Nights: ranked.filter((r) => r.top3 > 0).length };
}

/**
 * Everyone's record, for the public stats. By arm only for nights whose picks have all been answered (or that are
 * three days old), so the aggregate can't tell a viewer which open pick ran with memory off.
 */
export async function nightStats(): Promise<{ nights: number; caught: number; top3Nights: number; byArm: { nights: number; memory: number; control: number } }> {
  const rows = await q<any>(
    `select n.report, n.brief_date, n.created_at,
            (select count(*)::int from picks p where p.user_id = n.user_id and p.brief_date = n.brief_date and p.rating is null) as open
     from nights n`,
  );
  let nights = 0, caught = 0, top3Nights = 0;
  const byArm = { nights: 0, memory: 0, control: 0 };
  for (const r of rows) {
    const rep = r.report as NightReport;
    if (!rep.best || !rep.picks.some((p) => p.rank !== null)) continue;
    nights++;
    if (rep.caughtBest) caught++;
    if (rep.top3 > 0) top3Nights++;
    const sealed = r.open > 0 && Date.now() - new Date(r.created_at).getTime() < 3 * 86_400_000;
    if (sealed) continue;
    byArm.nights++;
    if (rep.picks.some((p) => p.rank === 1 && p.arm === "memory")) byArm.memory++;
    if (rep.picks.some((p) => p.rank === 1 && p.arm === "control")) byArm.control++;
  }
  return { nights, caught, top3Nights, byArm };
}
