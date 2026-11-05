import { ownConfig } from "@/lib/own.ts";
import { verifyUserToken } from "@/lib/auth.ts";

export const runtime = "nodejs";

/** What the /own page needs to build the two Move calls (package, registry, our delegate public key, and with the
 * viewer's link the key label that ties the key to them). */
export async function GET(req: Request) {
  const uid = verifyUserToken(new URL(req.url).searchParams.get("t"));
  return Response.json(ownConfig(uid), { headers: { "cache-control": uid ? "private, no-store" : "public, s-maxage=3600" } });
}
