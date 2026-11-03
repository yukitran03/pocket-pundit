import { verifyUserToken } from "@/lib/auth.ts";
import { meView } from "@/lib/views.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const uid = verifyUserToken(new URL(req.url).searchParams.get("t"));
  if (!uid) return Response.json({ error: "This link is invalid or expired. Send /me to the bot for a fresh one." }, { status: 401 });
  const view = await meView(uid);
  if (!view) return Response.json({ error: "unknown user" }, { status: 404 });
  return Response.json(view, { headers: { "cache-control": "private, no-store" } });
}
