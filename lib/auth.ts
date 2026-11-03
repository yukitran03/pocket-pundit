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

export function dashboardUrl(userId: number): string {
  return `${env.appUrl()}/me?t=${signUserToken(userId)}`;
}
