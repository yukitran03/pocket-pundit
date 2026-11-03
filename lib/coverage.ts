// The public football feed has results and timelines for some competitions and not others (e.g. it fills in
// Premier League and Ligue 1 but leaves several big leagues "scheduled" forever). A pick we can't settle can't
// teach the agent much, so measure coverage per competition from the last week and prefer covered ones.
import { cached } from "./db.ts";
import { fixturesBetween } from "./feed.ts";

export interface Coverage {
  n: number; // finished-by-now fixtures seen in the last 7 days
  done: number; // of those, how many the feed marked played with a score
}

export async function coverageMap(now = new Date()): Promise<Map<string, Coverage>> {
  const bucket = Math.floor(now.getTime() / (6 * 3600_000));
  const rows: [string, Coverage][] = await cached(`feed:coverage:v1:${bucket}`, 7 * 3600, async () => {
    const fx = await fixturesBetween(new Date(now.getTime() - 7 * 86_400_000), new Date(now.getTime() - 3 * 3600_000));
    const by = new Map<string, Coverage>();
    for (const f of fx) {
      const e = by.get(f.compId) ?? { n: 0, done: 0 };
      e.n++;
      if (f.status === 0 && f.homeScore !== null && f.awayScore !== null) e.done++;
      by.set(f.compId, e);
    }
    return [...by.entries()];
  });
  return new Map(rows);
}

/** Multiplier for a competition's pick score: covered = 1, rarely covered = 0.7, unknown = 1. */
export function coverageFactor(cov: Map<string, Coverage> | null, compId: string): number {
  const c = cov?.get(compId);
  if (!c || c.n < 3) return 1;
  const rate = c.done / c.n;
  return rate < 0.3 ? 0.7 : rate < 0.7 ? 0.88 : 1;
}
