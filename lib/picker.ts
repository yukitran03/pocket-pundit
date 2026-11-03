// Builds tonight's three picks: two from the memory-driven agent, one from the same agent with memory OFF.
import type { Cite } from "./contract.ts";
import { fixturesBetween, teamForm, type Fixture, type TeamForm } from "./feed.ts";
import { buildTaste, compKey, kickBucket, teamKey, type Taste } from "./taste.ts";
import { recallTaste } from "./memory.ts";
import { localParts, localToUtc, fmtLocalTime, shortId, clamp } from "./util.ts";
import { q } from "./db.ts";
import { coverageFactor, coverageMap } from "./coverage.ts";

export interface UserRow {
  id: number;
  chat_id: number;
  name: string;
  tz: string;
  brief_hour: number;
  window_start: number;
  window_end: number;
  namespace: string;
  created_at: string;
}

// Prior interest of a competition for a neutral fan (memory OFF). Keyed by the data provider's competition id.
const PRIOR: Record<string, number> = {
  "2000001032": 0.95, // UEFA Champions League
  "2000000000": 0.9, // Premier League (ENG)
  "2000000037": 0.85, // LaLiga (ESP)
  "2000000026": 0.8, // Serie A (ITA)
  "2000000019": 0.8, // Bundesliga (GER)
  "2000001041": 0.72, // UEFA Europa League
  "2000000018": 0.7, // Ligue 1 (FRA)
  "504": 0.7, // UEFA Nations League
  c7b8o53flg36wbuevfzy3lb10: 0.58, // UEFA Conference League
  "2000001033": 0.6, // AFC Champions League Elite
  "2000000022": 0.6, // Eredivisie
  "2000000033": 0.6, // Primeira Liga
  "7ntvbsyq31jnzoqoa8850b9b8": 0.55, // Championship (ENG)
  "2000000128": 0.55, // Liga Profesional Argentina
  "2000000103": 0.5, // MLS
  "2000000104": 0.5, // Liga MX
  "2000000091": 0.5, // Saudi League
  "2000000085": 0.5, // J1 League
  "2000000088": 0.48, // K League 1
  "2000000092": 0.48, // V.League 1
  "2000001043": 0.45, // AFC Champions League Two
  cu0rmpyff5692eo06ltddjo8a: 0.45, // Concacaf Nations League
  cesdwwnxbc5fmajgroc0hqzy2: 0.45, // International friendlies
  "516": 0.5, // U-17 Women's World Cup
  er5745q30wnr8jv9nr863omzg: 0.5, // Copa do Brasil
  "2000000086": 0.42, // A-League Men
  iu1vi94p4p28oozl1h9bvplr: 0.38, // Thai League 1
  "400171208": 0.38, // Indian Super League
};

/** Futsal, beach soccer and esports share the calendar but aren't what people mean by "a match tonight". */
export const NOT_ELEVEN_A_SIDE = /futsal|beach soccer|efootball|[a-z]e (?:world cup|nations cup|club world cup|continental cup|club series)|esports/i;

function prior(f: Fixture): number {
  if (NOT_ELEVEN_A_SIDE.test(f.competition)) return 0.02;
  if (PRIOR[f.compId] !== undefined) return PRIOR[f.compId];
  if (/women|femenina|frauen|féminine/i.test(f.competition)) return 0.3;
  if (/u-?1\d|u-?2\d|youth|olympic/i.test(f.competition)) return 0.28;
  if (/cup|copa|coupe|pokal|coppa/i.test(f.competition)) return 0.3;
  return 0.22;
}

export const PRIOR_OF = prior;

const BIG_STAGE = /final|semi|quarter|round of 16|knockout|play-?off/i;

export function compLabel(f: Fixture): string {
  const domestic = PRIOR[f.compId] === undefined || !/UEFA|AFC|Concacaf|Friendl|World Cup/i.test(f.competition);
  return domestic && f.country && !/UEFA|AFC|Concacaf|Friendl|World Cup|Nations/i.test(f.competition) ? `${f.competition} (${f.country})` : f.competition;
}

interface Expect {
  "high-scoring": number;
  goalless: number;
  tense: number;
  "one-sided": number;
  "late-goals": number;
  "lead-changes": number;
  comeback: number;
}

function expectations(h: TeamForm | null, a: TeamForm | null): { e: Expect; known: boolean; g: number | null } {
  if (!h || !a || !h.played || !a.played) {
    return { e: { "high-scoring": 0.3, goalless: 0.1, tense: 0.4, "one-sided": 0.2, "late-goals": 0.35, "lead-changes": 0.2, comeback: 0.12 }, known: false, g: null };
  }
  const g = ((h.goalsFor + h.goalsAgainst) / h.played + (a.goalsFor + a.goalsAgainst) / a.played) / 2;
  const ppg = (t: TeamForm) => (3 * t.wins + t.draws) / t.played;
  const gap = Math.abs(ppg(h) - ppg(a));
  const high = clamp((g - 2.0) / 2.0, 0, 1);
  const tense = clamp(1 - gap / 1.5, 0, 1) * 0.8;
  return {
    e: {
      "high-scoring": high,
      goalless: clamp((2.2 - g) / 1.5, 0, 1) * 0.6,
      tense,
      "one-sided": clamp(gap / 2, 0, 1) * 0.7,
      "late-goals": clamp((g - 1.8) / 3, 0, 0.8),
      "lead-changes": Math.min(tense, high) * 0.6,
      comeback: Math.min(tense, high) * 0.45,
    },
    known: true,
    g,
  };
}

const formStr = (t: TeamForm | null) => (t ? `W${t.wins} D${t.draws} L${t.losses}` : null);

export interface Candidate {
  f: Fixture;
  label: string;
  base: number;
  mem: number;
  bucket: ReturnType<typeof kickBucket>;
  localKick: string;
  exp: Expect;
  formKnown: boolean;
  avgGoals: number | null;
  hForm: TeamForm | null;
  aForm: TeamForm | null;
  contribs: { key: string; value: number }[];
}

export function scoreCandidates(fixtures: Fixture[], forms: Map<string, TeamForm | null>, taste: Taste | null, tz: string, windowEndUtc: Date): Candidate[] {
  return fixtures.map((f) => {
    const hForm = f.homeId ? forms.get(f.homeId) ?? null : null;
    const aForm = f.awayId ? forms.get(f.awayId) ?? null : null;
    const { e, known, g } = expectations(hForm, aForm);
    const lp = localParts(new Date(f.kickoff), tz);
    const bucket = kickBucket(lp.hour);
    const bigStage = f.stage && BIG_STAGE.test(f.stage) ? 1 : 0;
    const expectedDrama = 0.5 * e["high-scoring"] + 0.3 * e.tense + 0.2 * e["late-goals"];
    const fit = Date.parse(f.kickoff) + 105 * 60_000 <= windowEndUtc.getTime() ? 1 : 0.55; // can you see the whole match?
    const base = 100 * (0.45 * prior(f) + 0.12 * bigStage + 0.28 * expectedDrama + 0.15 * fit);

    const contribs: { key: string; value: number }[] = [];
    if (taste) {
      const add = (key: string, factor: number) => {
        const w = taste.weights.get(key);
        if (w && factor) contribs.push({ key, value: w.w * factor });
      };
      add(compKey(f.compId), 1);
      add(teamKey(f.home), 0.7);
      add(teamKey(f.away), 0.7);
      for (const [sig, p] of Object.entries(e)) add(`signal:${sig}`, p);
      add(`kick:${bucket}`, 1);
    }
    const mem = clamp(base + 30 * contribs.reduce((s, c) => s + c.value, 0), 0, 100);
    return { f, label: compLabel(f), base: clamp(base, 0, 100), mem, bucket, localKick: fmtLocalTime(f.kickoff, tz), exp: e, formKnown: known, avgGoals: g, hForm, aForm, contribs };
  });
}

function signalPhrase(sig: string): string {
  return (
    {
      "high-scoring": "goals",
      "late-goals": "late drama",
      tense: "tight games",
      comeback: "comebacks",
      "lead-changes": "games that swing",
      goalless: "cagey 0–0s",
      "one-sided": "one-sided games",
    } as Record<string, string>
  )[sig] ?? sig;
}

export function explain(c: Candidate, taste: Taste | null, arm: "memory" | "control"): { reasons: string[]; cites: Cite[]; neutral: string[]; memoryReasons: string[] } {
  const reasons: string[] = [];
  const cites: Cite[] = [];
  if (arm === "memory" && taste) {
    const pos = [...c.contribs].filter((x) => x.value > 0.04).sort((a, b) => b.value - a.value);
    for (const p of pos.slice(0, 2)) {
      const w = taste.weights.get(p.key)!;
      const n = w.evidence;
      if (p.key.startsWith("comp:")) reasons.push(`You've enjoyed ${c.label} before (${n} memor${n === 1 ? "y" : "ies"}).`);
      else if (p.key.startsWith("team:")) reasons.push(`${p.key.slice(5).replace(/-/g, " ").replace(/\b\w/g, (x) => x.toUpperCase())} keeps showing up in matches you liked.`);
      else if (p.key.startsWith("signal:")) reasons.push(`You go for ${signalPhrase(p.key.slice(7))} (${n} memor${n === 1 ? "y" : "ies"}), and this one has the profile.`);
      else if (p.key.startsWith("kick:")) reasons.push(`Kick-off ${c.localKick} suits when you actually watch.`);
      for (const b of [...w.blobs].sort((x, y) => Math.abs(y.contrib) - Math.abs(x.contrib)).slice(0, 2)) {
        if (!cites.some((x) => x.blobId === b.blobId) && cites.length < 3) cites.push({ blobId: b.blobId, text: b.text });
      }
    }
    const neg = [...c.contribs].filter((x) => x.value < -0.08).sort((a, b) => a.value - b.value)[0];
    if (neg && reasons.length < 3) reasons.push(`Despite ${neg.key.startsWith("kick:") ? "the kick-off time" : signalPhrase(neg.key.split(":")[1])}, it still ranks high tonight.`);
  }
  // Neutral reasons are shown in the blind Telegram brief for every pick; memory reasons are revealed after rating.
  const memoryReasons = [...reasons];
  const neutral: string[] = [];
  if (c.avgGoals !== null && c.avgGoals >= 2.8) neutral.push(`Both sides average ${c.avgGoals.toFixed(1)} goals a game lately (${formStr(c.hForm)} / ${formStr(c.aForm)}).`);
  else if (c.hForm && c.aForm && c.exp.tense >= 0.6) neutral.push(`Evenly matched on form: ${formStr(c.hForm)} vs ${formStr(c.aForm)}.`);
  if (c.f.stage && BIG_STAGE.test(c.f.stage)) neutral.push(`${c.f.stage}: something is on the line.`);
  if (neutral.length < 2) neutral.push(`${c.label}, kick-off ${c.localKick} your time.`);
  return { reasons: [...memoryReasons, ...neutral].slice(0, 3), cites, neutral: neutral.slice(0, 2), memoryReasons };
}

export interface BriefResult {
  briefDate: string;
  picks: { id: string; slot: number; arm: "memory" | "control"; c: Candidate; reasons: string[]; neutral: string[]; cites: Cite[]; score: number }[];
  considered: number;
  recallOk: boolean;
  memoriesUsed: number;
  recallMs: number;
}

/** Choose tonight's picks for a user and persist them. Idempotent per (user, date). */
export async function buildBrief(user: UserRow, now = new Date()): Promise<BriefResult> {
  const { date } = localParts(now, user.tz);
  const winStart = localToUtc(date, user.window_start, user.tz);
  const winEnd = localToUtc(date, user.window_end <= user.window_start ? user.window_end + 24 : user.window_end, user.tz);
  const from = new Date(Math.max(winStart.getTime(), now.getTime() + 10 * 60_000));
  const fixtures = (await fixturesBetween(from, winEnd)).filter((f) => f.status === 1);

  const recall = await recallTaste(user.id, user.namespace);
  const taste = recall.memories.length ? buildTaste(recall.memories, date) : null;

  // Cheap pre-ranking, then fetch recent form only for the shortlist.
  const pre = scoreCandidates(fixtures, new Map(), taste, user.tz, winEnd);
  const shortlist = new Map<string, Fixture>();
  [...pre].sort((a, b) => b.base - a.base).slice(0, 24).forEach((c) => shortlist.set(c.f.matchId, c.f));
  [...pre].sort((a, b) => b.mem - a.mem).slice(0, 16).forEach((c) => shortlist.set(c.f.matchId, c.f));
  const forms = new Map<string, TeamForm | null>();
  const teamIds = new Set<string>();
  for (const f of shortlist.values()) [f.homeId, f.awayId].forEach((id) => id && teamIds.add(id));
  await Promise.all([...teamIds].map(async (id) => forms.set(id, await teamForm(id))));
  const cands = scoreCandidates([...shortlist.values()], forms, taste, user.tz, winEnd);
  // Prefer competitions the data feed actually settles (results + timeline), so every pick can be rated
  // against what happened. Applied to both arms alike, so the A/B stays fair.
  const cov = await coverageMap(now).catch(() => null);
  for (const c of cands) {
    const k = coverageFactor(cov, c.f.compId);
    c.base *= k;
    c.mem *= k;
  }

  const chosen: { arm: "memory" | "control"; c: Candidate }[] = [];
  const byMem = [...cands].sort((a, b) => b.mem - a.mem);
  for (const c of byMem) {
    if (chosen.length >= 2) break;
    chosen.push({ arm: "memory", c });
  }
  const control = [...cands].sort((a, b) => b.base - a.base).find((c) => !chosen.some((x) => x.c.f.matchId === c.f.matchId));
  if (control) chosen.push({ arm: "control", c: control });

  // Blind A/B: shuffle display order.
  const order = chosen.map((x, i) => ({ x, r: Math.random() + i * 0 })).sort((a, b) => a.r - b.r).map((y) => y.x);
  const picks: BriefResult["picks"] = [];
  for (let i = 0; i < order.length; i++) {
    const { arm, c } = order[i];
    const { reasons, cites, neutral, memoryReasons } = explain(c, taste, arm);
    const id = shortId();
    const score = Math.round(arm === "memory" ? c.mem : c.base);
    const inserted = await q(
      `insert into picks (id, user_id, brief_date, slot, arm, match_id, comp_id, season_id, stage_id, competition, stage, home, away, home_id, away_id, kickoff, score, reasons, cites, features)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19::jsonb,$20::jsonb)
       on conflict (user_id, brief_date, match_id) do nothing returning id`,
      [id, user.id, date, i + 1, arm, c.f.matchId, c.f.compId, c.f.seasonId, c.f.stageId, c.label, c.f.stage, c.f.home, c.f.away, c.f.homeId, c.f.awayId, c.f.kickoff, score, JSON.stringify(reasons), JSON.stringify(cites), JSON.stringify({ base: Math.round(c.base), mem: Math.round(c.mem), bucket: c.bucket, exp: c.exp, contribs: c.contribs, neutral, memoryReasons })],
    );
    if (inserted.length) picks.push({ id, slot: i + 1, arm, c, reasons, neutral, cites, score });
  }
  await q(`insert into scans (user_id, brief_date, considered) values ($1,$2,$3) on conflict (user_id, brief_date) do update set considered = excluded.considered`, [user.id, date, fixtures.length]);
  return { briefDate: date, picks, considered: fixtures.length, recallOk: recall.ok, memoriesUsed: taste?.memoriesUsed ?? 0, recallMs: recall.latencyMs };
}
