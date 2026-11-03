// Self-scheduling heartbeat on Vercel Queues. Hobby crons run once a day and GitHub's scheduler proved
// unreliable, so the platform's own durable queue keeps the clock:
//   /api/cron/tick (current production) runs a tick and schedules a beat 5 minutes out, pinned to itself;
//   the beat's consumer calls the production URL's /api/cron/tick again, and so on.
// Because each beat goes back through the production alias, the chain moves to a new deployment on its own.
// One message per 5-minute slot (idempotency key), so extra seeders (webhook, local runner) can't fork it.
import { send } from "@vercel/queue";

export const HEARTBEAT_TOPIC = "pundit-heartbeat";
const PERIOD_S = 300;

/** Schedule the beat for the next 5-minute slot. Safe to call from anywhere, any number of times. */
export async function scheduleNextBeat(now = Date.now()): Promise<{ slot: number; delay: number; messageId?: string } | null> {
  if (!process.env.VERCEL) return null; // only on Vercel (OIDC auth); local dev uses scripts/local-runner.ts
  const t = Math.floor(now / 1000);
  const slot = Math.floor(t / PERIOD_S) + 1;
  const delay = Math.max(20, slot * PERIOD_S - t);
  const r: any = await send(HEARTBEAT_TOPIC, { slot }, { delaySeconds: delay, idempotencyKey: `beat:${slot}`, retentionSeconds: 3600 });
  return { slot, delay, messageId: r?.messageId };
}
