// Small user-facing outputs built from data we already hold: the shareable taste card, the calendar feed,
// and answers to "/ask" from the user's own Walrus memory.
import { q, one } from "./db.ts";
import { ledgerTaste } from "./extras.ts";
import { humanKey } from "./taste.ts";
import { KNOWN_COMPS } from "./views.ts";
import { localParts } from "./util.ts";
import { accountFor, searchMemories } from "./memory.ts";

export interface CardData {
  name: string;
  dayIndex: number;
  memories: number;
  pulls: { label: string; w: number; n: number }[];
  pushes: { label: string; w: number; n: number }[];
  ab: { memory: number | null; control: number | null; n: number };
}

function label(key: string, comps: Map<string, string>): string {
  if (key.startsWith("comp:")) return comps.get(key.slice(5)) ?? KNOWN_COMPS[key.slice(5)] ?? "A competition";
  return humanKey(key);
}

export async function cardData(userId: number): Promise<CardData | null> {
  const u = await one<any>(`select * from users where id = $1`, [userId]);
  if (!u) return null;
  const today = localParts(new Date(), u.tz).date;
  const taste = await ledgerTaste(userId, today);
  const comps = new Map<string, string>((await q<any>(`select distinct comp_id, competition from picks where user_id = $1`, [userId])).map((r) => [String(r.comp_id), r.competition]));
  const ranked = [...taste.weights.entries()].map(([k, v]) => ({ label: label(k, comps), w: v.w, n: v.evidence, team: k.startsWith("team:") }));
  const pulls = ranked.filter((x) => x.w > 0.05).sort((a, b) => b.w - a.w).slice(0, 4);
  const pushes = ranked.filter((x) => x.w < -0.05).sort((a, b) => a.w - b.w).slice(0, 2);
  const [m] = await q<any>(`select count(*)::int n from memory_jobs where user_id = $1 and status = 'stored' and not archived`, [userId]);
  const ab = await q<any>(
    `select arm, count(*)::int n, avg(case rating when 'loved' then 2 when 'fine' then 1 when 'bailed' then 0 end)::float s
     from picks where user_id = $1 and rating is not null and rating <> 'skipped' group by arm`,
    [userId],
  );
  const arm = (a: string) => ab.find((x) => x.arm === a);
  return {
    name: String(u.name || "You").split(" ")[0].slice(0, 18),
    dayIndex: Math.max(1, Math.floor((Date.now() - new Date(u.created_at).getTime()) / 86_400_000) + 1),
    memories: m.n,
    pulls: pulls.map(({ label, w, n }) => ({ label, w, n })),
    pushes: pushes.map(({ label, w, n }) => ({ label, w, n })),
    ab: { memory: arm("memory") ? Number(arm("memory").s) : null, control: arm("control") ? Number(arm("control").s) : null, n: ab.reduce((s, r) => s + r.n, 0) },
  };
}

// ---------- calendar feed (RFC 5545) ----------

const icsEsc = (s: string) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsTime = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Fold long lines at 75 octets as the spec asks. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 74) {
    let cut = 74;
    while (Buffer.byteLength(rest.slice(0, cut)) > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  out.push(rest);
  return out.join("\r\n");
}

export async function calendarFeed(userId: number, appName: string, appUrl: string): Promise<string | null> {
  const u = await one<any>(`select * from users where id = $1`, [userId]);
  if (!u) return null;
  const picks = await q<any>(`select * from picks where user_id = $1 and kickoff > now() - interval '10 days' order by kickoff asc limit 120`, [userId]);
  const now = icsTime(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${appName}//picks//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEsc(`${appName} picks`)}`,
    "X-WR-CALDESC:Matches picked for you each evening. Updates on its own.",
    "REFRESH-INTERVAL;VALUE=DURATION:PT2H",
    "X-PUBLISHED-TTL:PT2H",
  ];
  for (const p of picks) {
    const start = new Date(p.kickoff);
    const end = new Date(start.getTime() + 115 * 60_000);
    const why = (p.features?.neutral ?? p.reasons ?? []).slice(0, 2).join(" ");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${p.id}@${new URL(appUrl).host}`,
      `DTSTAMP:${now}`,
      `DTSTART:${icsTime(start)}`,
      `DTEND:${icsTime(end)}`,
      `SUMMARY:${icsEsc(`⚽ ${p.home} v ${p.away}`)}`,
      `DESCRIPTION:${icsEsc(`${p.competition}. ${why} Rate it in Telegram after full time.`)}`,
      `URL:${appUrl}/me`,
      p.status === "void" ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsEsc(`${p.home} v ${p.away} kicks off in 20 minutes`)}`,
      "TRIGGER:-PT20M",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

// ---------- /ask: answer from your own memory ----------

export async function askMemory(user: { id: number; namespace: string; tz: string }, question: string) {
  const res = await searchMemories(user.namespace, question, 8, await accountFor(user.id));
  const hits = res.hits.filter((h) => !/^\[system\]/.test(h.text)).slice(0, 5);
  const taste = await ledgerTaste(user.id, localParts(new Date(), user.tz).date);
  const comps = new Map<string, string>((await q<any>(`select distinct comp_id, competition from picks where user_id = $1`, [user.id])).map((r) => [String(r.comp_id), r.competition]));
  const ranked = [...taste.weights.entries()].map(([k, v]) => ({ label: label(k, comps), w: v.w, n: v.evidence }));
  const pulls = ranked.filter((x) => x.w > 0.1).sort((a, b) => b.w - a.w).slice(0, 3);
  const pushes = ranked.filter((x) => x.w < -0.1).sort((a, b) => a.w - b.w).slice(0, 2);
  return { hits, latencyMs: res.latencyMs, pulls, pushes };
}
