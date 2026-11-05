import { proofView } from "@/lib/views.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    return Response.json(await proofView(), { headers: { "cache-control": "public, s-maxage=120, stale-while-revalidate=86400" } });
  } catch {
    return Response.json({ error: "proof unavailable" }, { status: 503 });
  }
}
