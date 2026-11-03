import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function slug(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function hmac(secret: string, s: string): string {
  return createHmac("sha256", secret).update(s).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function shortId(): string {
  return randomBytes(6).toString("base64url");
}

/** Local calendar parts for an instant in an IANA time zone. */
export function localParts(d: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const hour = Number(p.hour) % 24;
  return { date: `${p.year}-${p.month}-${p.day}`, hour, minute: Number(p.minute) };
}

/** Offset (minutes) of a time zone at a given instant, e.g. +420 for Asia/Ho_Chi_Minh. */
export function tzOffsetMinutes(d: Date, tz: string): number {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" });
  const name = f.formatToParts(d).find((x) => x.type === "timeZoneName")?.value || "GMT";
  const m = name.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] || 0));
}

/** UTC instant for a local date (YYYY-MM-DD) + hour in tz. Hours may exceed 24 (= next day). */
export function localToUtc(date: string, hour: number, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hour, 0, 0));
  const off = tzOffsetMinutes(guess, tz);
  return new Date(guess.getTime() - off * 60_000);
}

export function fmtLocalTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

export function isValidTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

/** Walrus blob ids: relayer returns base64url (32 bytes), Sui stores the same bytes as a little-endian u256. */
export function blobIdToU256(b64: string): string {
  const bytes = Buffer.from(b64, "base64url");
  let n = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(bytes[i]);
  return n.toString();
}

export function u256ToBlobId(dec: string): string {
  let n = BigInt(dec);
  const out = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return out.toString("base64url");
}

export const walruscan = (blobId: string) => `https://walruscan.com/mainnet/blob/${blobId}`;
export const suiscanObject = (id: string) => `https://suiscan.xyz/mainnet/object/${id}`;
export const suiscanAccount = (addr: string) => `https://suiscan.xyz/mainnet/account/${addr}`;
