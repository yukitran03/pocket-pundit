// Check drama scoring + rating memory text on real finished matches (no writes).
import { fixturesBetween, timeline } from "../lib/feed.ts";
import { computeDrama, dramaSummary } from "../lib/drama.ts";
import { ratingMemory, parseMemory, buildTaste, kickBucket } from "../lib/taste.ts";
import { localParts } from "../lib/util.ts";
process.env.PGLITE_DIR = process.env.PGLITE_DIR || "./data/pglite-dry";
const fx = (await fixturesBetween(new Date("2026-10-21T16:00:00Z"), new Date("2026-10-21T22:00:00Z"))).filter((f) => f.compId === "2000001032" && f.status === 0).slice(0, 5);
const mems = [];
for (const f of fx) {
  const ev = await timeline(f.matchId);
  const d = computeDrama(ev, f.homeScore, f.awayScore);
  const lp = localParts(new Date(f.kickoff), "Asia/Ho_Chi_Minh");
  const rating = d.score >= 55 ? "loved" : d.score >= 30 ? "fine" : "bailed";
  const text = ratingMemory({ date: "2026-10-22", rating, home: f.home, away: f.away, homeScore: f.homeScore, awayScore: f.awayScore, competition: "UEFA Champions League", compId: f.compId, stage: f.stage, drama: d, localKick: `${lp.hour}:${String(lp.minute).padStart(2,"0")}`, bucket: kickBucket(lp.hour) });
  console.log(`${f.home} ${f.homeScore}-${f.awayScore} ${f.away}: drama ${d.score} [${d.tags.join(",")}] — ${dramaSummary(d)} (events: ${ev?.length ?? 0})`);
  mems.push(parseMemory("blob" + mems.length, text));
  if (mems.length === 1) console.log("  memory text:", text);
}
const t = buildTaste(mems, "2026-11-03");
console.log("taste:", [...t.weights.entries()].map(([k, v]) => `${k}=${v.w.toFixed(2)}`).join("  "));
process.exit(0);
