// /duo: pair with a friend and get one "watch together" match a night that suits both tastes and both
// watch windows. Neither side sees the other's memories, only the shared pick.
import { env } from "./env.ts";
import { q, one, cacheGet, cacheSet } from "./db.ts";
import { hmac, safeEqual, localParts, localToUtc, fmtLocalTime, clamp } from "./util.ts";
import { fixturesBetween, teamForm, type TeamForm } from "./feed.ts";
import { scoreCandidates, NOT_ELEVEN_A_SIDE, type UserRow } from "./picker.ts";
import { ledgerTaste } from "./extras.ts";
import { coverageFactor, coverageMap } from "./coverage.ts";

/** Telegram deep-link payload: duo_<base64url uid>_<sig>. Only [A-Za-z0-9_-], under 64 chars. */
export function duoCode(userId: number): string {
  const body = Buffer.from(String(userId)).toString("base64url");
  return `duo_${body}_${hmac(env.appSecret(), `duo:${body}`).slice(0, 12).replace(/[^A-Za-z0-9]/g, "x")}`;
}

export function parseDuoCode(code: string | undefined): number | null {
  const m = /^duo_([A-Za-z0-9-]+)_([A-Za-z0-9]{12})$/.exec(code ?? "");
  if (!m) return null;
  const expect = hmac(env.appSecret(), `duo:${m[1]}`).slice(0, 12).replace(/[^A-Za-z0-9]/g, "x");
  if (!safeEqual(m[2], expect)) return null;
  const uid = Number(Buffer.from(m[1], "base64url").toString());
  return Number.isFinite(uid) && uid > 0 ? uid : null;
}

/** Remember who invited this user until they finish onboarding. */
export async function holdInvite(newUserId: number, inviterId: number) {
  await cacheSet(`duo:pending:${newUserId}`, inviterId, 7 * 86_400);
}

export async function takeInvite(userId: number): Promise<number | null> {
  const v = await cacheGet<number>(`duo:pending:${userId}`);
  if (v) await q(`delete from kv where k = $1`, [`duo:pending:${userId}`]);
  return v ?? null;
}

/** Pair two users (one partner each; a new pairing releases any old one). */
export async function pair(a: number, b: number): Promise<boolean> {
  if (a === b) return false;
  await q(`update users set duo_partner = null where duo_partner in ($1, $2) or id in ($1, $2)`, [a, b]);
  await q(`update users set duo_partner = $2 where id = $1`, [a, b]);
  await q(`update users set duo_partner = $1 where id = $2`, [a, b]);
  return true;
}

export async function unpair(a: number): Promise<number | null> {
  const r = await one<any>(`select duo_partner from users where id = $1`, [a]);
  const b = r?.duo_partner ? Number(r.duo_partner) : null;
  await q(`update users set duo_partner = null where id = $1 or (id = $2 and duo_partner = $1)`, [a, b]);
  return b;
}

export interface DuoPick {
  partnerName: string;
  home: string;
  away: string;
  competition: string;
  kickoff: string;
  mineLocal: string;
  theirsLocal: string;
  together: number; // 0..100, the lower of the two memory scores (both should enjoy it)
}

function windowOf(u: any, now: Date): [number, number] {
  const lp = localParts(now, u.tz);
  const s = localToUtc(lp.date, u.window_start, u.tz).getTime();
  const e = localToUtc(lp.date, u.window_end <= u.window_start ? u.window_end + 24 : u.window_end, u.tz).getTime();
  return [s, e];
}

/** Tonight's best match for both partners: inside both watch windows, scored by both tastes. */
export async function duoPick(user: UserRow & { duo_partner?: number | string | null }, now = new Date()): Promise<DuoPick | null> {
  if (!user.duo_partner) return null;
  const p = await one<any>(`select * from users where id = $1 and active and onboard_step = 'done'`, [Number(user.duo_partner)]);
  if (!p) return null;
  const [aS, aE] = windowOf(user, now);
  const [bS, bE] = windowOf(p, now);
  const from = Math.max(aS, bS, now.getTime() + 10 * 60_000);
  const to = Math.min(aE, bE);
  if (to - from < 90 * 60_000) return null; // no shared evening tonight
  const fx = (await fixturesBetween(new Date(from), new Date(to))).filter((f) => f.status === 1 && !NOT_ELEVEN_A_SIDE.test(f.competition));
  if (!fx.length) return null;
  const today = localParts(now, user.tz).date;
  const [ta, tb, cov] = await Promise.all([ledgerTaste(user.id, today), ledgerTaste(Number(p.id), today), coverageMap(now).catch(() => null)]);
  const pre = scoreCandidates(fx, new Map(), null, user.tz, new Date(to)).sort((x, y) => y.base - x.base).slice(0, 14);
  const forms = new Map<string, TeamForm | null>();
  const ids = new Set<string>();
  for (const c of pre) [c.f.homeId, c.f.awayId].forEach((id) => id && ids.add(id));
  await Promise.all([...ids].map(async (id) => forms.set(id, await teamForm(id))));
  const list = pre.map((c) => c.f);
  const A = scoreCandidates(list, forms, ta, user.tz, new Date(to));
  const B = new Map(scoreCandidates(list, forms, tb, p.tz, new Date(to)).map((c) => [c.f.matchId, c]));
  let best: { c: (typeof A)[number]; s: number } | null = null;
  for (const c of A) {
    const b = B.get(c.f.matchId);
    if (!b) continue;
    const s = Math.min(clamp(c.mem, 0, 100), clamp(b.mem, 0, 100)) * coverageFactor(cov, c.f.compId);
    if (!best || s > best.s) best = { c, s };
  }
  if (!best) return null;
  return {
    partnerName: String(p.name || "your friend").split(" ")[0],
    home: best.c.f.home,
    away: best.c.f.away,
    competition: best.c.label,
    kickoff: best.c.f.kickoff,
    mineLocal: fmtLocalTime(best.c.f.kickoff, user.tz),
    theirsLocal: fmtLocalTime(best.c.f.kickoff, p.tz),
    together: Math.round(best.s),
  };
}
