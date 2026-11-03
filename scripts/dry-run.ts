// Dry run: build tonight's brief for a throwaway local user (PGlite), print it, write nothing to Walrus.
import { q } from "../lib/db.ts";
import { buildBrief } from "../lib/picker.ts";
import { briefText } from "../lib/telegram.ts";

process.env.PGLITE_DIR = process.env.PGLITE_DIR || "./data/pglite-dry";
const u = { id: 1, chat_id: 1, name: "Dry run", tz: "Asia/Ho_Chi_Minh", brief_hour: 18, window_start: 19, window_end: 26, namespace: "mf:dryrun-empty", created_at: new Date().toISOString() };
await q(`insert into users (id, chat_id, name, namespace, onboard_step) values (1,1,'Dry run','mf:dryrun-empty','done') on conflict (id) do nothing`);
await q(`delete from picks where user_id = 1`);
const t0 = Date.now();
const b = await buildBrief(u as any);
console.log(briefText(u as any, b, 1).replace(/<[^>]+>/g, ""));
console.log("\narms:", b.picks.map((p) => `${p.slot}:${p.arm}:${Math.round(p.c.base)}/${Math.round(p.c.mem)}`).join("  "), "| considered", b.considered, "| recallOk", b.recallOk, "| ms", Date.now() - t0);
process.exit(0);
