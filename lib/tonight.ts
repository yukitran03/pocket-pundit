// Public "tonight" board: the same agent with memory OFF, for anyone (no login, no memory).
// Upcoming/live matches in the next 12 hours, ranked; plus last night's best matches, spoiler-free.
import type { ReplayMatch, TonightMatch, TonightResponse } from "./contract.ts";
import { cached } from "./db.ts";
import { fixturesBetween, liveNow, teamForm, timeline, type Fixture, type TeamForm } from "./feed.ts";
import { computeDrama } from "./drama.ts";
import { explain, NOT_ELEVEN_A_SIDE, PRIOR_OF, scoreCandidates } from "./picker.ts";

// Drama tags that tell you a match was worth it without telling you how it ended.
const VIBE: Record<string, string> = {
  "late-goals": "late drama",
  "high-scoring": "goals",
  "shot-fest": "end to end",
  tense: "tense",
  "lead-changes": "it swings",
};

export async function tonightView(tz: string, now = new Date()): Promise<TonightResponse> {
  const bucket = Math.floor(now.getTime() / 600_000); // 10-minute buckets
  return cached(`view:tonight:${tz}:${bucket}`, 900, async () => {
    const [tonight, scanned] = await upcoming(tz, now);
    const replays = await lastNight(now).catch(() => [] as ReplayMatch[]);
    return { tz, scanned, tonight, replays, updatedAt: new Date().toISOString() };
  });
}

async function upcoming(tz: string, now: Date): Promise<[TonightMatch[], number]> {
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
      reasons: explain(c, null, "control").neutral.slice(0, 2),
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
    }));
}
