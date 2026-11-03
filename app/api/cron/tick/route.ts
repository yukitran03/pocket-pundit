import { tick } from "@/lib/tick.ts";
import { env } from "@/lib/env.ts";
import { safeEqual } from "@/lib/util.ts";
import { scheduleNextBeat } from "@/lib/heartbeat.ts";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

async function run(req: Request) {
  const secret = env.cronSecret();
  const auth = req.headers.get("authorization") || "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return new Response("forbidden", { status: 403 });
  // Any external tick also (re)seeds the queue heartbeat; duplicates per slot are dropped by the queue.
  const beat = await scheduleNextBeat().catch((e) => ({ error: String(e?.message || e).slice(0, 160) }));
  const report = await tick();
  return Response.json({ ...(report ?? { skipped: "another tick is running" }), beat });
}

export const GET = run;
export const POST = run;
