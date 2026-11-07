// Brief locks: tonight's picks are written to Walrus before kick-off, so they can't be edited afterwards.
// Which pick is the memory-off control stays sealed (a sha256 commit) until every pick has settled,
// so the A/B remains blind even to someone reading their own memory wall.
import { env } from "./env.ts";
import { hmac, sha256, fmtLocalTime, blobIdToU256, localParts } from "./util.ts";
import { enqueueMemory } from "./memory.ts";
import { one, cacheGet, cacheSet } from "./db.ts";
import { objectLastWrite, ownedBlobs } from "./tatum.ts";
import { chainBlobMap } from "./views.ts";
import type { BriefResult, MemorySwitch, UserRow } from "./picker.ts";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export interface SuiCert {
  objectId: string;
  checkpoint: string | null;
  at: string; // when the Blob object last changed on Sui: its certification (a later extension only makes it later)
}

/**
 * When Sui certified a memory's Walrus Blob, read through Tatum gRPC (ListOwnedObjects → GetObject →
 * GetTransaction). Cached once found: a certification never moves.
 */
export async function suiCertification(blobId: string): Promise<SuiCert | null> {
  const key = `sui:cert:${blobId}`;
  const hit = await cacheGet<SuiCert>(key);
  if (hit) return hit;
  const u256 = blobIdToU256(blobId);
  const { owner, blobs } = await chainBlobMap();
  let c = blobs.get(u256);
  if (!c && owner) {
    // A blob certified in the last few minutes isn't in the cached listing yet.
    const fresh = await ownedBlobs(owner);
    await cacheSet("proof:chainblobs", { owner, blobs: fresh }, 300);
    c = fresh.find((b) => b.blobIdU256 === u256);
  }
  if (!c) return null;
  const w = await objectLastWrite(c.objectId);
  if (!w?.at) return null;
  const out: SuiCert = { objectId: c.objectId, checkpoint: w.checkpoint, at: w.at };
  await cacheSet(key, out, 30 * 86_400);
  return out;
}

const hhmm = (iso: string, tz: string) => {
  const p = localParts(new Date(iso), tz);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};
const groupDigits = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const ago = (mins: number) => (mins >= 120 ? `${Math.round(mins / 60)} h` : `${mins} min`);

/** The brief's lock, once Walrus has stored it: the blob, and when Sui certified it against the first kick-off. */
export function lockedText(o: { blobId: string; walruscanUrl: string; cert: SuiCert | null; firstKickoff: string | null; tz: string }): string {
  const short = `${o.blobId.slice(0, 6)}…${o.blobId.slice(-4)}`;
  const head = `🔒 Tonight's picks are locked on Walrus · <a href="${o.walruscanUrl}">${short}</a>`;
  if (!o.cert) return head;
  const mins = o.firstKickoff ? Math.round((Date.parse(o.firstKickoff) - Date.parse(o.cert.at)) / 60_000) : null;
  const cp = o.cert.checkpoint ? `, checkpoint ${groupDigits(o.cert.checkpoint)}` : "";
  return `${head}\nCertified on Sui at ${hhmm(o.cert.at, o.tz)} your time${cp}${mins !== null && mins > 0 ? `, ${ago(mins)} before the first kick-off` : ""}. Read back through Tatum.`;
}

/** Once a night's picks have all finished: what the memory switch changed, in plain words. */
export async function switchLine(userId: number, date: string): Promise<string> {
  const r = await one<any>(`select switch from scans where user_id = $1 and brief_date = $2`, [userId, date]);
  const sw = r?.switch as MemorySwitch | undefined;
  if (!sw?.on?.length) return "";
  const names = (es: MemorySwitch["on"]) => {
    const s = es.map((e) => `${esc(e.home)} v ${esc(e.away)}`);
    return s.length <= 1 ? s.join("") : `${s.slice(0, -1).join(", ")} and ${s[s.length - 1]}`;
  };
  if (!sw.changed) return "🧠 Memory switch: with memory off, tonight's top three would have been the same.";
  const offIds = new Set(sw.off.map((e) => e.matchId));
  const added = sw.on.filter((e) => !offIds.has(e.matchId));
  return `🧠 Memory switch: with memory off, tonight's top three would have been ${names(sw.off)}. Your memories brought in ${names(added)}.`;
}

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
  const kick = new Date(p.kickoff).getTime();
  const parts: string[] = [];
  // Sui's certification time (read through Tatum) when we have it; otherwise when Walrus confirmed the write.
  const cert = lock.blobId ? await suiCertification(lock.blobId).catch(() => null) : null;
  if (cert) {
    const mins = Math.round((kick - Date.parse(cert.at)) / 60_000);
    if (mins > 0) parts.push(`🔒 Certified on Sui ${ago(mins)} before kick-off${cert.checkpoint ? ` (checkpoint ${groupDigits(cert.checkpoint)}, via Tatum)` : ""}`);
  } else {
    const mins = Math.round((kick - Date.parse(lock.storedAt)) / 60_000);
    if (mins > 0) parts.push(`🔒 Locked on Walrus ${ago(mins)} before kick-off`);
  }
  const open = await one<any>(`select count(*)::int n from picks where user_id = $1 and brief_date = $2 and rating is null and settled_at is null`, [uid, p.brief_date]);
  const control = await one<any>(`select match_id from picks where user_id = $1 and brief_date = $2 and arm = 'control'`, [uid, p.brief_date]);
  if (!open?.n && control) {
    const s = sealCheck(uid, p.brief_date, control.match_id);
    parts.push(`Seal check: seal ✓ <code>${s.commit}</code> = <code>${s.formula}</code>`);
    const sw = await switchLine(uid, p.brief_date).catch(() => "");
    if (sw) parts.push(sw);
  }
  return parts.join("\n");
}

/** The reveal line once all of a day's picks have settled: salt + control match id, so the commit can be checked. */
export function sealCheck(userId: number, date: string, controlMatchId: string): { commit: string; salt: string; formula: string } {
  const salt = lockSalt(userId, date);
  return { commit: lockCommit(date, controlMatchId, salt), salt, formula: `sha256("${date}|control=${controlMatchId}|${salt}")` };
}
