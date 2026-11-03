import { verifyUserToken } from "@/lib/auth.ts";
import { releaseAccount } from "@/lib/own.ts";

export const runtime = "nodejs";

/** Signed-in viewer: go back to Pocket Pundit's shared account (their own account keeps what it holds). */
export async function POST(req: Request) {
  const uid = verifyUserToken(new URL(req.url).searchParams.get("t"));
  if (!uid) return Response.json({ error: "invalid link" }, { status: 401 });
  return Response.json(await releaseAccount(uid));
}
