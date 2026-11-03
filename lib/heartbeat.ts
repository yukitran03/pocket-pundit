// Self-scheduling heartbeat on Vercel Queues: every pass schedules the next one 5 minutes out.
// Hobby crons run once a day and GitHub's scheduler proved unreliable, so the platform's own durable queue
// keeps the clock. One message per 5-minute slot (idempotency key), so any number of seeders can't fork it.
import { QueueClient } from "@vercel/queue";

export const HEARTBEAT_TOPIC = "pundit-heartbeat";
const PERIOD_S = 300;

let client: QueueClient | null = null;
function queue(): QueueClient {
  // Unpinned: the next beat goes to whichever deployment is current, not the one that sent it.
  client ??= new QueueClient({ deploymentId: null });
  return client;
}

/** Schedule the beat for the next 5-minute slot. Safe to call from anywhere, any number of times. */
export async function scheduleNextBeat(now = Date.now()): Promise<{ slot: number; delay: number } | null> {
  if (!process.env.VERCEL) return null; // only on Vercel (OIDC auth); local dev uses scripts/local-runner.ts
  const t = Math.floor(now / 1000);
  const slot = Math.floor(t / PERIOD_S) + 1;
  const delay = Math.max(20, slot * PERIOD_S - t);
  await queue().send(HEARTBEAT_TOPIC, { slot }, { delaySeconds: delay, idempotencyKey: `beat:${slot}`, retentionSeconds: 3600 });
  return { slot, delay };
}
