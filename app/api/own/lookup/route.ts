import { accountOfOwner } from "@/lib/tatum.ts";
import { checkAccount } from "@/lib/own.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public: does this wallet already have a Walrus Memory account, and does it hold our key? (Tatum GraphQL + gRPC) */
export async function GET(req: Request) {
  const address = (new URL(req.url).searchParams.get("address") || "").toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(address)) return Response.json({ error: "bad address" }, { status: 400 });
  try {
    const accountId = await accountOfOwner(address);
    if (!accountId) return Response.json({ accountId: null, hasKey: false });
    const c = await checkAccount(accountId);
    return Response.json({ accountId, hasKey: c.ok, reason: c.ok ? null : c.reason ?? null }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "Couldn't read Sui right now." }, { status: 503 });
  }
}
