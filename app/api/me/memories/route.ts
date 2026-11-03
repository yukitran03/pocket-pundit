import { verifyUserToken } from "@/lib/auth.ts";
import { one } from "@/lib/db.ts";
import { enqueueMemory, processMemoryQueue } from "@/lib/memory.ts";
import { preferenceMemory } from "@/lib/taste.ts";
import { localParts } from "@/lib/util.ts";
import type { MemoryRow, NewMemoryBody } from "@/lib/contract.ts";

export const runtime = "nodejs";
export const maxDuration = 60;

const NEGATIVE = /\b(hate|dont|don't|do not|never|avoid|boring|skip|dislike)\b/i;

export async function POST(req: Request) {
  const uid = verifyUserToken(new URL(req.url).searchParams.get("t"));
  if (!uid) return Response.json({ error: "invalid link" }, { status: 401 });
  const b = ((await req.json().catch(() => ({}))) ?? {}) as NewMemoryBody;
  const text = String(b.text || "").trim();
  if (text.length < 4 || text.length > 400) return Response.json({ error: "Write between 4 and 400 characters." }, { status: 400 });
  const u = await one<any>(`select * from users where id = $1`, [uid]);
  if (!u) return Response.json({ error: "unknown user" }, { status: 404 });
  const date = localParts(new Date(), u.tz).date;
  const supersedes = typeof b.supersedes === "string" && /^[A-Za-z0-9_-]{20,64}$/.test(b.supersedes) ? b.supersedes : null;
  const body = supersedes ? `${text} (corrects ${supersedes})` : text;
  const memText = preferenceMemory(date, body, supersedes ? [`supersedes=${supersedes}`] : [], NEGATIVE.test(text) ? -1 : 1);
  const r = await enqueueMemory({ userId: uid, namespace: u.namespace, kind: "preference", text: memText, supersedes });
  await processMemoryQueue(2).catch(() => {});
  const row = await one<any>(`select * from memory_jobs where id = $1`, [r.id]);
  const status = row?.status === "pending" || row?.status === "stored" || row?.status === "failed" ? row.status : "queued";
  const out: MemoryRow = {
    blobId: row?.blob_id ?? null,
    kind: "preference",
    text: row?.text ?? memText,
    createdAt: new Date(row?.created_at ?? Date.now()).toISOString(),
    status,
    namespace: u.namespace,
    suiObjectId: null,
    endEpoch: null,
    walruscanUrl: null,
    suiscanUrl: null,
  };
  return Response.json(out, { status: 202 });
}
