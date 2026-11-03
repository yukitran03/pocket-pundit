import { waitUntil } from "@vercel/functions";
import { handleUpdate } from "@/lib/telegram.ts";
import { tick } from "@/lib/tick.ts";
import { processMemoryQueue } from "@/lib/memory.ts";
import { env } from "@/lib/env.ts";
import { safeEqual, sleep } from "@/lib/util.ts";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const secret = env.telegramWebhookSecret();
  const got = req.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!secret || !safeEqual(got, secret)) return new Response("forbidden", { status: 403 });
  const update = await req.json().catch(() => null);
  if (!update) return new Response("bad request", { status: 400 });
  waitUntil(
    (async () => {
      try {
        await handleUpdate(update);
      } catch (e) {
        console.error("update failed", String(e).slice(0, 300));
      }
      // Push fresh memory writes out now, then confirm them ~30s later so the user sees "stored" quickly.
      await processMemoryQueue(4).catch(() => {});
      await sleep(32_000);
      await tick().catch(() => {});
    })(),
  );
  return Response.json({ ok: true });
}
