import { verifyUserToken } from "@/lib/auth.ts";
import { one } from "@/lib/db.ts";
import { searchMemories } from "@/lib/memory.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const uid = verifyUserToken(url.searchParams.get("t"));
  if (!uid) return Response.json({ error: "invalid link" }, { status: 401 });
  const query = (url.searchParams.get("q") || "").trim().slice(0, 200);
  if (query.length < 2) return Response.json({ hits: [], latencyMs: 0 });
  const u = await one<any>(`select namespace, memwal_account from users where id = $1`, [uid]);
  if (!u) return Response.json({ error: "unknown user" }, { status: 404 });
  try {
    return Response.json(await searchMemories(u.namespace, query, 12, u.memwal_account ?? null));
  } catch {
    return Response.json({ error: "Memory search is unavailable right now." }, { status: 503 });
  }
}
