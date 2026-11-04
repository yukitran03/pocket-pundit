// Self-scheduling heartbeat on Vercel Queues. Hobby crons run once a day and GitHub's scheduler proved
// unreliable, so the platform's own durable queue keeps the clock:
//   /api/cron/tick (current production) runs a tick and schedules the next beat, pinned to itself;
//   the beat's consumer calls the production URL's /api/cron/tick again, and so on.
// Because each beat goes back through the production alias, the chain moves to a new deployment on its own.
// One message per 5-minute slot (idempotency key), so extra seeders (webhook, GitHub, local runner) can't fork it.
//
// Pacing: every 5 minutes while there is work (a brief, a match to settle, an alert window). When nothing is due
// the beat waits for the next :00 or :30 boundary instead, so the database can scale to zero between beats. Idle
// beats only ever land on those two boundaries, which is what lets every seeder converge on the same slots.
import { send } from "@vercel/queue";

export const HEARTBEAT_TOPIC = "pundit-heartbeat";
const PERIOD_S = 300;
const IDLE_S = 1800;

/**
 * The 5-minute slot (seconds since epoch / 300) for the next beat. `dueAt` (ms) is when work is next due: now means
 * the next 5-minute boundary, null means nothing is due. Either way the beat is never later than the first :00/:30
 * boundary at least 10 minutes out.
 */
export function beatSlot(nowMs: number, dueAt: number | null): number {
  const t = nowMs / 1000;
  const idle = (Math.ceil((t + 600) / IDLE_S) * IDLE_S) / PERIOD_S;
  const soonest = Math.floor(t / PERIOD_S) + 1;
  let slot = dueAt == null ? idle : Math.min(idle, Math.max(soonest, Math.ceil(dueAt / 1000 / PERIOD_S)));
  if (slot * PERIOD_S - t < 20) slot++;
  return slot;
}

/** Schedule the next beat. Safe to call from anywhere, any number of times: one message per slot. */
export async function scheduleNextBeat(now = Date.now(), dueAt: number | null = now): Promise<{ slot: number; delay: number; messageId?: string } | null> {
  if (!process.env.VERCEL) return null; // only on Vercel (OIDC auth); local dev uses scripts/local-runner.ts
  const slot = beatSlot(now, dueAt);
  const delay = Math.max(1, Math.round(slot * PERIOD_S - now / 1000));
  const r: any = await send(HEARTBEAT_TOPIC, { slot }, { delaySeconds: delay, idempotencyKey: `beat:${slot}`, retentionSeconds: 3600 });
  return { slot, delay, messageId: r?.messageId };
}
