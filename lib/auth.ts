// Signed dashboard links (sent by the bot). No passwords, no cookies: the link is the key.
import { env } from "./env.ts";
import { hmac, safeEqual } from "./util.ts";

const DAYS = 45;

export function signUserToken(userId: number, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + DAYS * 86400;
  const body = Buffer.from(`${userId}.${exp}`).toString("base64url");
  return `${body}.${hmac(env.appSecret(), `me:${body}`).slice(0, 32)}`;
}

export function verifyUserToken(token: string | null | undefined): number | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (!safeEqual(sig, hmac(env.appSecret(), `me:${body}`).slice(0, 32))) return null;
  const [uid, exp] = Buffer.from(body, "base64url").toString().split(".");
  if (!uid || !exp || Number(exp) * 1000 < Date.now()) return null;
  return Number(uid);
}

/** Long-lived, single-purpose keys (taste card image, calendar feed). They grant nothing but that one read. */
export function purposeKey(purpose: "card" | "cal", userId: number): string {
  const body = Buffer.from(String(userId)).toString("base64url");
  return `${body}.${hmac(env.appSecret(), `${purpose}:${body}`).slice(0, 24)}`;
}

export function verifyPurposeKey(purpose: "card" | "cal", key: string | null | undefined): number | null {
  const [body, sig] = String(key ?? "").replace(/\.(png|ics)$/, "").split(".");
  if (!body || !sig || !safeEqual(sig, hmac(env.appSecret(), `${purpose}:${body}`).slice(0, 24))) return null;
  const uid = Number(Buffer.from(body, "base64url").toString());
  return Number.isFinite(uid) && uid > 0 ? uid : null;
}

export function dashboardUrl(userId: number): string {
  return `${env.appUrl()}/me?t=${signUserToken(userId)}`;
}
