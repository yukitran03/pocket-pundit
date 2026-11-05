// Public "tonight" board: the same agent with memory OFF, for anyone (no login, no memory).
// Upcoming/live matches in the next 12 hours, ranked; plus last night's best matches, spoiler-free.
import type { ReplayMatch, TonightMatch, TonightResponse } from "./contract.ts";
import { cacheGet, cacheSet, cached, one } from "./db.ts";
import { env } from "./env.ts";
import { fixturesBetween, liveNow, teamForm, timeline, type Fixture, type TeamForm } from "./feed.ts";
import { computeDrama } from "./drama.ts";
import { NOT_ELEVEN_A_SIDE, PRIOR_OF, scoreCandidates, type Candidate } from "./picker.ts";

// Drama tags that tell you a match was worth it without telling you how it ended.
const VIBE: Record<string, string> = {
  "late-goals": "late drama",
  "high-scoring": "goals",
  "shot-fest": "end to end",
  tense: "tense",
  "lead-changes": "it swings",
};

/**
 * The ranking doesn't depend on the viewer's time zone (the browser formats kick-off times), so it is computed
 * once per 10 minutes for everyone, and the scheduler warms it.
 */
export async function tonightView(tz: string, now = new Date()): Promise<TonightResponse> {
  const bucket = Math.floor(now.getTime() / 600_000);
  const variant = env.officialCrests() ? "crests" : "plain";
  const last = `view:tonight:last:${variant}`;
  try {
    const v = await cached(`view:tonight:v2:${variant}:${bucket}`, 900, async () => {
      const [tonight, scanned] = await upcoming(now);
      const replays = await lastNight(now).catch(() => [] as ReplayMatch[]);
      const fresh = { scanned, tonight, replays, updatedAt: new Date().toISOString() };
      await cacheSet(last, fresh, 2 * 86_400).catch(() => {});
      return fresh;
    });
    return { tz, ...v };
  } catch (e) {
    // Feed outage: show the last board we built, minus matches that must be over by now.
    const v =
      (await cacheGet<Omit<TonightResponse, "tz">>(last)) ??
      (await one<{ v: Omit<TonightResponse, "tz"> }>(`select v from kv where k like $1 order by k desc limit 1`, [`view:tonight:v2:${variant}:%`]))?.v;
    if (!v) throw e;
    const tonight = v.tonight.filter((m) => Date.parse(m.kickoff) > now.getTime() - 2 * 3600_000);
    return { tz, ...v, tonight };
  }
}

/** Short, factual reasons for a neutral fan. The row already shows competition and kick-off, so don't repeat them. */
function publicReasons(c: Candidate): string[] {
  const out: string[] = [];
  if (c.f.stage && /final|semi|quarter|round of 16|knockout|play-?off/i.test(c.f.stage)) out.push(`${c.f.stage}: something is on the line.`);
  if (c.avgGoals !== null && c.avgGoals >= 2.8) out.push(`Both sides average ${c.avgGoals.toFixed(1)} goals a game lately.`);
  else if (c.hForm && c.aForm && c.exp.tense >= 0.6) out.push("Evenly matched on recent form.");
  if (c.hForm && c.aForm) {
    const unbeaten = [c.hForm, c.aForm].filter((t) => t.played >= 4 && t.losses === 0).length;
    if (unbeaten === 2) out.push("Neither side has lost lately.");
    else if (c.hForm.wins >= 4 || c.aForm.wins >= 4) out.push(`${c.hForm.wins >= c.aForm.wins ? c.f.home : c.f.away} arrive on a winning run.`);
  }
  return out.slice(0, 2);
}

async function upcoming(now: Date): Promise<[TonightMatch[], number]> {
  const tz = "UTC"; // only affects memory-driven fields, which the public board doesn't use
  const end = new Date(now.getTime() + 12 * 3600_000);
  const soon = (await fixturesBetween(new Date(now.getTime() + 60_000), end)).filter((f) => f.status === 1);
  const live = await liveNow().catch(() => []);
  const minuteOf = new Map(live.map((f) => [f.matchId, f.minute]));
  const pool: Fixture[] = [...live, ...soon].filter((f) => !NOT_ELEVEN_A_SIDE.test(f.competition));

  // Pre-rank without form, fetch form for the shortlist, then rank properly (as the brief does).
  const pre = scoreCandidates(pool, new Map(), null, tz, end).sort((a, b) => b.base - a.base).slice(0, 18);
  const forms = new Map<string, TeamForm | null>();
  const ids = new Set<string>();
  for (const c of pre) [c.f.homeId, c.f.awayId].forEach((id) => id && ids.add(id));
  await Promise.all([...ids].map(async (id) => forms.set(id, await teamForm(id))));
  const ranked = scoreCandidates(pre.map((c) => c.f), forms, null, tz, end).sort((a, b) => b.base - a.base);

  const out: TonightMatch[] = [];
  const seen = new Set<string>();
  for (const c of ranked) {
    if (out.length >= 8 || seen.has(c.f.matchId)) continue;
    seen.add(c.f.matchId);
    const isLive = minuteOf.has(c.f.matchId);
    out.push({
      matchId: c.f.matchId,
      kickoff: c.f.kickoff,
      competition: c.label,
      stage: c.f.stage,
      home: c.f.home,
      away: c.f.away,
      status: isLive ? "live" : "upcoming",
      minute: isLive ? Math.round(minuteOf.get(c.f.matchId) ?? 0) : null,
      score: Math.round(c.base),
      reasons: publicReasons(c),
      form: { home: c.hForm, away: c.aForm },
      logos: env.officialCrests() ? { home: c.f.homeLogo ?? null, away: c.f.awayLogo ?? null } : null,
    });
  }
  return [out, pool.length];
}

async function lastNight(now: Date): Promise<ReplayMatch[]> {
  const done = (await fixturesBetween(new Date(now.getTime() - 26 * 3600_000), new Date(now.getTime() - 100 * 60_000))).filter((f) => f.status === 0 && !NOT_ELEVEN_A_SIDE.test(f.competition));
  const shortlist = done.sort((a, b) => PRIOR_OF(b) - PRIOR_OF(a)).slice(0, 14);
  const scored = await Promise.all(
    shortlist.map(async (f) => {
      const d = computeDrama(await timeline(f.matchId), f.homeScore, f.awayScore);
      return { f, d };
    }),
  );
  return scored
    .filter((x) => x.d.score >= 45)
    .sort((a, b) => b.d.score + 20 * PRIOR_OF(b.f) - (a.d.score + 20 * PRIOR_OF(a.f)))
    .slice(0, 6)
    .map(({ f, d }) => ({
      matchId: f.matchId,
      kickoff: f.kickoff,
      competition: f.competition,
      home: f.home,
      away: f.away,
      drama: d.score,
      vibe: d.tags.map((t) => VIBE[t]).filter(Boolean).slice(0, 3),
      homeScore: f.homeScore,
      awayScore: f.awayScore,
      logos: env.officialCrests() ? { home: f.homeLogo ?? null, away: f.awayLogo ?? null } : null,
    }));
}
