import { verifyPurposeKey } from "@/lib/auth.ts";
import { calendarFeed } from "@/lib/extras2.ts";
import { BRAND } from "@/lib/brand.ts";
import { env } from "@/lib/env.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Subscribable calendar of your picks (Google/Apple/Outlook), with a 20-minute reminder on each. */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const uid = verifyPurposeKey("cal", (await ctx.params).key);
  if (!uid) return new Response("not found", { status: 404 });
  const body = await calendarFeed(uid, BRAND.name, env.appUrl());
  if (!body) return new Response("not found", { status: 404 });
  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `inline; filename="picks.ics"`,
      "cache-control": "private, max-age=600",
    },
  });
}
