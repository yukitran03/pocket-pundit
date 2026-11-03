// Brief locks: tonight's picks are written to Walrus before kick-off, so they can't be edited afterwards.
// Which pick is the memory-off control stays sealed (a sha256 commit) until every pick has settled,
// so the A/B remains blind even to someone reading their own memory wall.
import { env } from "./env.ts";
import { hmac, sha256, fmtLocalTime } from "./util.ts";
import { enqueueMemory } from "./memory.ts";
import { one } from "./db.ts";
import type { BriefResult, UserRow } from "./picker.ts";

export function lockSalt(userId: number, date: string): string {
  return hmac(env.appSecret(), `lock:${userId}:${date}`).slice(0, 16);
}

/** sha256("<date>|control=<matchId>|<salt>"), first 16 hex. Recomputable by anyone once salt and match id are revealed. */
export function lockCommit(date: string, controlMatchId: string, salt: string): string {
  return sha256(`${date}|control=${controlMatchId}|${salt}`).slice(0, 16);
}

export function lockIdem(userId: number, date: string) {
  return `brief:${userId}:${date}`;
}

export function briefLockText(user: UserRow, b: BriefResult): string | null {
  if (!b.picks.length) return null;
  const control = b.picks.find((p) => p.arm === "control");
  const list = [...b.picks]
    .sort((a, c) => a.slot - c.slot)
    .map((p) => `${p.c.f.home} v ${p.c.f.away} (${fmtLocalTime(p.c.f.kickoff, user.tz)})`)
    .join("; ");
  const seal = control ? ` Memory-off pick sealed: commit ${lockCommit(b.briefDate, control.c.f.matchId, lockSalt(user.id, b.briefDate))}.` : "";
  return `[brief] ${b.briefDate} · Tonight's picks, locked before kick-off: ${list}.${seal} tags: kind=brief`;
}

export async function lockBrief(user: UserRow, b: BriefResult) {
  const text = briefLockText(user, b);
  if (!text) return null;
  return enqueueMemory({ userId: user.id, namespace: user.namespace, kind: "brief", text, idem: lockIdem(user.id, b.briefDate) });
}

/** The stored lock for a user's brief date, if any (stored time = when Walrus confirmed it). */
export async function lockFor(userId: number, date: string): Promise<{ blobId: string | null; storedAt: string | null; queuedAt: string } | null> {
  const r = await one<any>(`select blob_id, status, created_at, updated_at from memory_jobs where idem_key = $1`, [`mf:${lockIdem(userId, date)}`]);
  if (!r) return null;
  return { blobId: r.blob_id, storedAt: r.status === "stored" ? new Date(r.updated_at).toISOString() : null, queuedAt: new Date(r.created_at).toISOString() };
}

/** Human line for the reveal: how long before kick-off the picks were on Walrus, and the seal check once the day is done. */
export async function lockLine(p: { user_id: number | string; brief_date: string; kickoff: string | Date; match_id: string; arm: string }): Promise<string> {
  const uid = Number(p.user_id);
  const lock = await lockFor(uid, p.brief_date);
  if (!lock?.storedAt) return "";
  const mins = Math.round((new Date(p.kickoff).getTime() - Date.parse(lock.storedAt)) / 60_000);
  const parts: string[] = [];
  if (mins > 0) parts.push(`🔒 Locked on Walrus ${mins >= 120 ? `${Math.round(mins / 60)} h` : `${mins} min`} before kick-off`);
  const open = await one<any>(`select count(*)::int n from picks where user_id = $1 and brief_date = $2 and rating is null and settled_at is null`, [uid, p.brief_date]);
  const control = await one<any>(`select match_id from picks where user_id = $1 and brief_date = $2 and arm = 'control'`, [uid, p.brief_date]);
  if (!open?.n && control) {
    const s = sealCheck(uid, p.brief_date, control.match_id);
    parts.push(`Seal check: seal ✓ <code>${s.commit}</code> = <code>${s.formula}</code>`);
  }
  return parts.join("\n");
}

/** The reveal line once all of a day's picks have settled: salt + control match id, so the commit can be checked. */
export function sealCheck(userId: number, date: string, controlMatchId: string): { commit: string; salt: string; formula: string } {
  const salt = lockSalt(userId, date);
  return { commit: lockCommit(date, controlMatchId, salt), salt, formula: `sha256("${date}|control=${controlMatchId}|${salt}")` };
}
