import { ownConfig } from "@/lib/own.ts";

export const runtime = "nodejs";

/** Public: what the /own page needs to build the two Move calls (package, registry, our delegate public key). */
export async function GET() {
  return Response.json(ownConfig(), { headers: { "cache-control": "public, s-maxage=3600" } });
}
