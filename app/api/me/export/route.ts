import { verifyUserToken } from "@/lib/auth.ts";
import { tastePassport } from "@/lib/passport.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Download the viewer's taste passport (all memories with blob ids, plus learned weights). */
export async function GET(req: Request) {
  const uid = verifyUserToken(new URL(req.url).searchParams.get("t"));
  if (!uid) return Response.json({ error: "This link is invalid or expired. Send /export to the bot for a fresh one." }, { status: 401 });
  const doc = await tastePassport(uid);
  if (!doc) return Response.json({ error: "unknown user" }, { status: 404 });
  return new Response(JSON.stringify(doc, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="pocket-pundit-taste-passport-${doc.generatedAt.slice(0, 10)}.json"`,
      "cache-control": "private, no-store",
    },
  });
}
