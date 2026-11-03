import { tonightView } from "@/lib/tonight.ts";
import { isValidTz } from "@/lib/util.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const tzParam = new URL(req.url).searchParams.get("tz") || "UTC";
  const tz = isValidTz(tzParam) ? tzParam : "UTC";
  try {
    return Response.json(await tonightView(tz), { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=900" } });
  } catch {
    return Response.json({ error: "tonight unavailable" }, { status: 503 });
  }
}
