import { handleCallback } from "@vercel/queue";
import { tick } from "@/lib/tick.ts";
import { scheduleNextBeat } from "@/lib/heartbeat.ts";
import { cacheSet } from "@/lib/db.ts";

export const runtime = "nodejs";
export const maxDuration = 300;

// Delivered by Vercel Queues (topic "pundit-heartbeat", see vercel.json). Schedule the next beat first, so a
// failing tick never breaks the chain; the tick itself runs under a lease and is safe to repeat.
export const POST = handleCallback(
  async (message: { slot?: number }, meta) => {
    await cacheSet("heartbeat:last", { at: new Date().toISOString(), slot: message?.slot ?? null, delivery: meta.deliveryCount }, 86_400).catch(() => {});
    await scheduleNextBeat().catch((e) => console.error("heartbeat: could not schedule next beat", String(e).slice(0, 200)));
    const report = await tick();
    if (report?.errors.length) console.error("tick errors", report.errors.join(" | ").slice(0, 500));
  },
  { retry: (_e, m) => (m.deliveryCount > 2 ? { acknowledge: true } : { afterSeconds: 30 }) },
);
