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
  const fail = (e: any) => ({ error: String(e?.message || e).slice(0, 160) });
  // First a fallback beat on the idle grid, so the chain survives even if this tick dies; then, once the tick
  // knows what's due, the real next beat. Duplicates per slot are dropped by the queue.
  const fallback = await scheduleNextBeat(Date.now(), null).catch(fail);
  const report = await tick();
  const due = report ? (report.next ? Date.parse(report.next) : null) : null;
  const beat = report ? await scheduleNextBeat(Date.now(), due).catch(fail) : fallback;
  return Response.json({ ...(report ?? { skipped: "another tick is running" }), beat, fallback });
}

export const GET = run;
export const POST = run;
