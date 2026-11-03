// Time-savers on top of the nightly brief: kick-off reminders, "worth switching on" live alerts,
// and a spoiler-free "you missed a good one" line. All of them are steered by the taste learned from memory.
import { q } from "./db.ts";
import { fixturesBetween, liveNow, timeline, type Fixture } from "./feed.ts";
import { computeDrama } from "./drama.ts";
import { buildTaste, parseMemory, compKey, type Taste } from "./taste.ts";
import { localParts, localToUtc } from "./util.ts";
import { PRIOR_OF } from "./picker.ts";

/** Taste rebuilt from the user's stored memories (the ledger mirrors exactly what was written to Walrus). */
export async function ledgerTaste(userId: number, today: string): Promise<Taste> {
  const rows = await q<any>(`select blob_id, text from memory_jobs where user_id = $1 and status = 'stored' order by id`, [userId]);
  return buildTaste(rows.map((r) => parseMemory(r.blob_id, r.text)), today);
}

const w = (t: Taste, key: string) => t.weights.get(key)?.w ?? 0;
const ev = (t: Taste, key: string) => t.weights.get(key)?.evidence ?? 0;

export interface LiveAlert {
  f: Fixture & { minute: number };
  kind: "tense-late" | "goal-fest";
  signals: string[];
  why: string;
}

/**
 * Should this user be told to switch on a live match right now? Thresholds move with memory:
 * someone who loves late drama hears about tight games from 60'; someone who bails on them never does.
 */
export function judgeLive(f: Fixture & { minute: number }, taste: Taste, isPick: boolean): LiveAlert | null {
  const hs = f.homeScore ?? 0;
  const as = f.awayScore ?? 0;
  const goals = hs + as;
  const diff = Math.abs(hs - as);
  const compW = w(taste, compKey(f.compId));
  const relevant = isPick || compW > 0.15 || (PRIOR_OF(f) >= 0.6 && compW > -0.2);
  if (!relevant || compW < -0.3) return null;
  const late = w(taste, "signal:late-goals");
  const tense = w(taste, "signal:tense");
  const high = w(taste, "signal:high-scoring");
  const lateFrom = late > 0.3 || tense > 0.3 ? 60 : 68;
  if (f.minute >= lateFrom && f.minute <= 88 && diff <= 1 && goals >= 1 && tense > -0.3 && late > -0.3) {
    const n = ev(taste, "signal:late-goals") + ev(taste, "signal:tense");
    const why = late > 0.3 || tense > 0.3 ? `Tight and late, your kind of game (${n} memor${n === 1 ? "y" : "ies"}).` : "Within one goal with the end in sight.";
    return { f, kind: "tense-late", signals: ["tense", "late-goals"], why };
  }
  if (goals >= 4 && f.minute <= 72 && high > -0.3) {
    const n = ev(taste, "signal:high-scoring");
    const why = high > 0.3 ? `Goals keep coming, and you love those (${n} memor${n === 1 ? "y" : "ies"}).` : "Goals keep coming in this one.";
    return { f, kind: "goal-fest", signals: ["high-scoring"], why };
  }
  return null;
}

export async function liveAlertsFor(user: any, now: Date, live: (Fixture & { minute: number })[]): Promise<LiveAlert[]> {
  if (!user.alerts || !live.length) return [];
  const lp = localParts(now, user.tz);
  const start = localToUtc(lp.date, user.window_start - 1, user.tz).getTime();
  const end = localToUtc(lp.date, user.window_end <= user.window_start ? user.window_end + 24 : user.window_end, user.tz).getTime();
  // also allow the tail of yesterday's window (after midnight)
  const yStart = start - 86_400_000;
  const yEnd = end - 86_400_000;
  const t = now.getTime();
  if (!((t >= start && t <= end) || (t >= yStart && t <= yEnd))) return [];
  const [{ n }] = await q<any>(`select count(*)::int n from alerts where user_id = $1 and sent_at > now() - interval '20 hours'`, [user.id]);
  if (n >= 2) return [];
  const sent = new Set((await q<any>(`select match_id from alerts where user_id = $1 and sent_at > now() - interval '2 days'`, [user.id])).map((r) => r.match_id));
  const picks = new Set((await q<any>(`select match_id from picks where user_id = $1 and brief_date >= $2`, [user.id, lp.date])).map((r) => r.match_id));
  const taste = await ledgerTaste(user.id, lp.date);
  const out: LiveAlert[] = [];
  for (const f of live) {
    if (sent.has(f.matchId)) continue;
    const a = judgeLive(f, taste, picks.has(f.matchId));
    if (a) out.push(a);
  }
  return out.sort((a, b) => PRIOR_OF(b.f) - PRIOR_OF(a.f)).slice(0, 2 - n);
}

/** The best match from last night's window that the user didn't get as a pick (spoiler-free line for the brief). */
export async function missedLastNight(user: any, now: Date): Promise<{ home: string; away: string; competition: string; drama: number } | null> {
  const lp = localParts(now, user.tz);
  const y = localParts(new Date(now.getTime() - 86_400_000), user.tz).date;
  const from = localToUtc(y, user.window_start, user.tz);
  const to = localToUtc(y, user.window_end <= user.window_start ? user.window_end + 24 : user.window_end, user.tz);
  if (to.getTime() > now.getTime()) return null;
  const taste = await ledgerTaste(user.id, lp.date);
  const picked = new Set((await q<any>(`select match_id from picks where user_id = $1 and brief_date = $2`, [user.id, y])).map((r) => r.match_id));
  const fx = (await fixturesBetween(from, to)).filter((f) => f.status === 0 && !picked.has(f.matchId));
  const ranked = fx
    .map((f) => ({ f, s: PRIOR_OF(f) + 0.5 * w(taste, compKey(f.compId)) }))
    .filter((x) => x.s >= 0.55)
    .sort((a, b) => b.s - a.s)
    .slice(0, 6);
  let best: { home: string; away: string; competition: string; drama: number } | null = null;
  for (const { f } of ranked) {
    const d = computeDrama(await timeline(f.matchId), f.homeScore, f.awayScore);
    if (d.score >= 65 && (!best || d.score > best.drama)) best = { home: f.home, away: f.away, competition: f.competition, drama: d.score };
  }
  return best;
}

/** Picks kicking off within the next ~35 minutes that haven't had a reminder. */
export async function dueReminders() {
  return q<any>(
    `select p.*, u.chat_id, u.tz from picks p join users u on u.id = p.user_id
     where p.reminded_at is null and p.rating is null and u.active
       and p.kickoff > now() and p.kickoff <= now() + interval '35 minutes'`,
  );
}

export { liveNow };
