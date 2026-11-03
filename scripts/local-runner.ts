// Local runner: long-polls Telegram (no webhook needed) and runs the scheduler every minute.
// Use for development or as a stopgap before the Vercel deployment owns the webhook.
//   node --env-file=.env.local scripts/local-runner.ts
import { handleUpdate, tg } from "../lib/telegram.ts";
import { tick } from "../lib/tick.ts";
import { processMemoryQueue } from "../lib/memory.ts";

const info = await tg("getWebhookInfo", {});
if (info.url) {
  console.error(`A webhook is set (${info.url}). The deployed app owns the bot; refusing to steal it. Run with --force to delete it.`);
  if (!process.argv.includes("--force")) process.exit(1);
  await tg("deleteWebhook", { drop_pending_updates: false });
}

let offset = 0;
let lastTick = 0;
console.log("Pocket Pundit local runner: polling Telegram…");
for (;;) {
  try {
    const updates: any[] = await tg("getUpdates", { offset, timeout: 25, allowed_updates: ["message", "callback_query"] });
    for (const u of updates) {
      offset = u.update_id + 1;
      try {
        await handleUpdate(u);
      } catch (e) {
        console.error("update failed:", String(e).slice(0, 200));
      }
    }
    if (updates.length) await processMemoryQueue(4).catch(() => {});
  } catch (e) {
    console.error("poll error:", String(e).slice(0, 200));
    await new Promise((r) => setTimeout(r, 3000));
  }
  if (Date.now() - lastTick > 60_000) {
    lastTick = Date.now();
    const rep = await tick().catch((e) => ({ error: String(e) }));
    if (rep) console.log(new Date().toISOString(), "tick", JSON.stringify(rep));
  }
}
