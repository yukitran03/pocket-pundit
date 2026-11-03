import { verifyUserToken } from "@/lib/auth.ts";
import { claimAccount } from "@/lib/own.ts";
import { processMemoryQueue } from "@/lib/memory.ts";
import { one } from "@/lib/db.ts";
import { send } from "@/lib/telegram.ts";
import { suiscanObject } from "@/lib/util.ts";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Signed-in viewer: switch to their own account once Tatum confirms our key is on it. */
export async function POST(req: Request) {
  const uid = verifyUserToken(new URL(req.url).searchParams.get("t"));
  if (!uid) return Response.json({ error: "This link is invalid or expired. Send /own to the bot for a fresh one." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { accountId?: string };
  const r = await claimAccount(uid, String(body.accountId || ""));
  if (!r.ok) return Response.json({ error: r.reason }, { status: 400 });
  if (!r.already) {
    await processMemoryQueue(4).catch(() => {});
    const u = await one<any>(`select chat_id from users where id = $1`, [uid]);
    if (u) await send(Number(u.chat_id), `🔑 Your memory now lives in your own Walrus Memory account (<a href="${suiscanObject(String(body.accountId))}">on Sui</a>). I'm copying your ${r.copied} existing memories across now. Remove Pocket Pundit's key from your account at any time to cut me off.`).catch(() => {});
  }
  return Response.json({ ok: true, owner: r.owner, copied: r.copied });
}
