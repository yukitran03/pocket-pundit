import { handleCallback } from "@vercel/queue";
import { cacheSet } from "@/lib/db.ts";
import { env } from "@/lib/env.ts";

export const runtime = "nodejs";
export const maxDuration = 300;

// Delivered by Vercel Queues (topic "pundit-heartbeat", see vercel.json). The beat doesn't tick here: it calls the
// production URL, so the tick (and the next beat) always run on the current deployment, even after a redeploy.
export const POST = handleCallback(
  async (message: { slot?: number }, meta) => {
    await cacheSet("heartbeat:last", { at: new Date().toISOString(), slot: message?.slot ?? null, delivery: meta.deliveryCount, deployment: process.env.VERCEL_DEPLOYMENT_ID ?? null }, 86_400).catch(() => {});
    const r = await fetch(`${env.appUrl()}/api/cron/tick`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.cronSecret()}` },
      signal: AbortSignal.timeout(280_000),
    });
    if (!r.ok) throw new Error(`tick returned ${r.status}`); // retried by the queue
  },
  { retry: (_e, m) => (m.deliveryCount > 2 ? { acknowledge: true } : { afterSeconds: 30 }) },
);
