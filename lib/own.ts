// "Own your memory": a viewer can move their taste memory into a Walrus Memory account they own.
// They add Pocket Pundit's delegate key to their account with their own wallet; we verify that on Sui through
// Tatum, copy their existing memories across, and write every new memory there. They can remove our key at any
// time from their wallet, which cuts us off from anything saved afterwards.
import { env, MEMWAL_PACKAGE } from "./env.ts";
import { q, one } from "./db.ts";
import { memwalAccount } from "./tatum.ts";
import { enqueueMemory } from "./memory.ts";
import { ed25519 } from "@noble/curves/ed25519.js";
import { hmac } from "./util.ts";

export const MEMWAL_REGISTRY = "0x8bf82c9e09e36b8d1c38298f68b7cb68e7b8762887e7592add9986d5e9cf199f"; // relayer /config, mainnet
export const DELEGATE_LABEL = "Pocket Pundit";

let derivedPub: string | null = null;
/** Our delegate public key: from the environment, or derived from the delegate private key (Ed25519). */
function delegatePublicKeyHex(): string {
  const fromEnv = (process.env.MEMWAL_PUBLIC_KEY || "").toLowerCase();
  if (fromEnv) return fromEnv;
  if (!derivedPub) {
    const priv = process.env.MEMWAL_PRIVATE_KEY || "";
    derivedPub = /^[0-9a-f]{64}$/i.test(priv) ? Buffer.from(ed25519.getPublicKey(Buffer.from(priv, "hex"))).toString("hex") : "";
  }
  return derivedPub;
}

/**
 * The label our key carries on a viewer's account, unique to that viewer. Our public key is the same for everyone,
 * so the label is what proves the key was added from this viewer's own /own link (by the account owner's wallet).
 */
export function viewerLabel(userId: number): string {
  return `${DELEGATE_LABEL} ${hmac(env.appSecret(), `own-label:${userId}`).replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase()}`;
}

export function ownConfig(userId?: number | null) {
  return {
    network: "mainnet" as const,
    packageId: MEMWAL_PACKAGE,
    registryId: MEMWAL_REGISTRY,
    publicKeyHex: delegatePublicKeyHex(),
    label: userId ? viewerLabel(userId) : DELEGATE_LABEL,
    appAccountId: process.env.MEMWAL_ACCOUNT_ID || null,
  };
}

type Verifier = (accountId: string) => Promise<{ owner: string; active: boolean; keys: { pub: string; label: string }[] }>;
let verifier: Verifier = async (accountId) => {
  const a = await memwalAccount(accountId);
  return { owner: a.owner, active: a.active, keys: a.delegateKeys.map((k) => ({ pub: k.publicKeyHex.toLowerCase(), label: k.label })) };
};
/** Tests replace the on-chain read. */
export function setOwnershipVerifier(v: Verifier) {
  verifier = v;
}

/**
 * Does this account exist, is it active, and does it hold our delegate key? (read via Tatum gRPC GetObject)
 * With a viewer, the key must also carry that viewer's label (or the viewer has written there before), so nobody
 * can claim someone else's account just because it trusts Pocket Pundit.
 */
export async function checkAccount(accountId: string, userId?: number): Promise<{ ok: boolean; owner: string | null; reason?: string }> {
  if (!/^0x[0-9a-f]{64}$/i.test(accountId)) return { ok: false, owner: null, reason: "That isn't a Sui object id." };
  if (accountId.toLowerCase() === (process.env.MEMWAL_ACCOUNT_ID || "").toLowerCase()) return { ok: false, owner: null, reason: "That is Pocket Pundit's shared account, not yours." };
  try {
    const a = await verifier(accountId);
    if (!a.active) return { ok: false, owner: a.owner, reason: "The account is not active." };
    const ours = a.keys.filter((k) => k.pub === ownConfig().publicKeyHex);
    if (!ours.length) return { ok: false, owner: a.owner, reason: "Pocket Pundit's key isn't on the account yet." };
    if (userId != null && !ours.some((k) => k.label === viewerLabel(userId))) {
      const before = await one(`select 1 from memory_jobs where user_id = $1 and account_id = $2 limit 1`, [userId, accountId]);
      if (!before) return { ok: false, owner: a.owner, reason: "Pocket Pundit's key on this account was added from another link. Remove it, then add it again from this page." };
    }
    return { ok: true, owner: a.owner };
  } catch {
    return { ok: false, owner: null, reason: "Couldn't read that account on Sui." };
  }
}

/** Switch a viewer to their own account and copy their stored memories across (queued, paced, idempotent). */
export async function claimAccount(userId: number, accountId: string) {
  const c = await checkAccount(accountId, userId);
  if (!c.ok) return { ok: false as const, reason: c.reason ?? "Not verified." };
  const u = await one<any>(`select * from users where id = $1`, [userId]);
  if (!u) return { ok: false as const, reason: "Unknown viewer." };
  if (u.memwal_account === accountId) return { ok: true as const, owner: c.owner, copied: 0, already: true };
  await q(`update users set memwal_account = $2, memwal_owner = $3, own_since = now() where id = $1`, [userId, accountId, c.owner]);
  // Copy what we know into their account, then archive the shared copies so nothing is counted twice.
  const old = await q<any>(`select id, kind, text from memory_jobs where user_id = $1 and status = 'stored' and not archived and coalesce(account_id, '') <> $2 order by id`, [userId, accountId]);
  let copied = 0;
  for (const j of old) {
    const r = await enqueueMemory({ userId, namespace: u.namespace, kind: j.kind, text: j.text, idem: `own:${accountId.slice(2, 14)}:${j.id}` });
    if (!r.duplicate) copied++;
  }
  if (old.length) await q(`update memory_jobs set archived = true where id = any($1::bigint[])`, [old.map((j) => j.id)]);
  // Claimed before, released, now back: the copies from last time are already there, so bring them back into use.
  await q(`update memory_jobs set archived = false where user_id = $1 and account_id = $2 and idem_key like 'mf:own:%'`, [userId, accountId]);
  return { ok: true as const, owner: c.owner, copied, already: false };
}

/** Back to the shared account (the viewer removed our key, or asked to). Their own account keeps what it has. */
export async function releaseAccount(userId: number) {
  const u = await one<any>(`select memwal_account from users where id = $1`, [userId]);
  if (!u?.memwal_account) return { released: false };
  await q(`update users set memwal_account = null, memwal_owner = null, own_since = null where id = $1`, [userId]);
  // Writes not yet sent to their account would fail there now; send them to the shared account instead.
  await q(`update memory_jobs set account_id = null, status = 'queued', attempts = 0, error = null, updated_at = now() where user_id = $1 and account_id = $2 and status in ('queued', 'failed') and not archived and idem_key not like 'mf:own:%'`, [userId, u.memwal_account]);
  // Memories written to their account stay theirs; the shared copies come back into use for taste.
  await q(`update memory_jobs set archived = false where user_id = $1 and archived and coalesce(account_id, '') = ''`, [userId]);
  // The copies we made into their account go back to archived; memories written there since stay counted.
  await q(`update memory_jobs set archived = true where user_id = $1 and account_id = $2 and idem_key like 'mf:own:%'`, [userId, u.memwal_account]);
  return { released: true, accountId: u.memwal_account as string };
}

/** Daily check: if the viewer removed our key, stop writing there and say so. */
export async function stillOwned(userId: number): Promise<"own" | "shared" | "revoked"> {
  const u = await one<any>(`select memwal_account from users where id = $1`, [userId]);
  if (!u?.memwal_account) return "shared";
  const c = await checkAccount(u.memwal_account);
  if (c.ok) return "own";
  if (c.reason === "Couldn't read that account on Sui.") return "own"; // transient: don't flip on a failed read
  await releaseAccount(userId);
  return "revoked";
}

export const ownUrl = (token: string) => `${env.appUrl()}/own?t=${encodeURIComponent(token)}`;
