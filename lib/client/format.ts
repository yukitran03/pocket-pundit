// Formatting helpers. Every date function takes an explicit time zone so server and client
// render identical strings (no hydration drift).

const nf = new Intl.NumberFormat("en-GB");
export const fmtInt = (n: number) => nf.format(Math.round(n));
export const fmtCompact = (n: number) =>
  n >= 10_000 ? new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(n) : fmtInt(n);
export const fmtPct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;

export function safeTz(tz: string | undefined | null): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

export function fmtTime(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: safeTz(tz), hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

export function fmtDay(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: safeTz(tz), weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
}

export function fmtDateTime(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: safeTz(tz), day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(iso));
}

/** "Wed 28 Oct" from a YYYY-MM-DD brief date (calendar date, no tz shift). */
export function fmtBriefDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Local hour as a fraction (e.g. 19.5) in tz. Hours before `wrapBefore` are shifted +24 so a night reads continuously. */
export function localHour(iso: string, tz: string, wrapBefore = 12) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: safeTz(tz), hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const x = h + m / 60;
  return x < wrapBefore ? x + 24 : x;
}

/** 25 → "01:00" */
export function fmtHour(h: number) {
  const hh = ((Math.floor(h) % 24) + 24) % 24;
  const mm = Math.round((h - Math.floor(h)) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Short relative time. Pass `now` so callers control when it updates (client-only). */
export function fmtAgo(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} d ago`;
}

export function shortId(id: string, head = 6, tail = 4) {
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

export function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(n < 10_240 ? 1 : 0)} KB`;
}

export function tzLabel(tz: string) {
  const city = tz.split("/").pop()?.replaceAll("_", " ");
  return city || tz;
}

/** The visitor's own IANA time zone (browser only; "UTC" on the server or if the browser won't say). */
export function visitorTz(): string {
  try {
    return safeTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return "UTC";
  }
}

/**
 * A short hint next to a kick-off time: "in 35 min", "in 1 h 45 min", "in 6 h", "kicking off".
 * Null when the match is more than a day away or already well past, so the date alone does the talking.
 * Pass `now` from the client so server and client never disagree.
 */
export function fmtUntil(iso: string, now: number): string | null {
  const m = Math.round((new Date(iso).getTime() - now) / 60_000);
  if (m <= 0) return m > -10 ? "kicking off" : null;
  if (m < 60) return `in ${m} min`;
  if (m < 180) {
    let h = Math.floor(m / 60);
    let r = Math.round((m % 60) / 5) * 5;
    if (r === 60) { h += 1; r = 0; }
    return r ? `in ${h} h ${r} min` : `in ${h} h`;
  }
  if (m < 24 * 60) return `in ${Math.round(m / 60)} h`;
  return null;
}

/** 75 → "75 min", 130 → "2 h 10 min", 480 → "8 h". */
export function fmtLead(minutes: number) {
  const raw = Math.max(0, Math.round(minutes));
  if (raw < 90) return `${raw} min`;
  const m = Math.round(raw / 5) * 5;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h >= 4 || r < 5 ? `${Math.round(m / 60)} h` : `${h} h ${r} min`;
}

/**
 * Memories are stored as "[kind] 2026-11-04 · sentence tags: k=v …". People only need the sentence:
 * drop the kind prefix, the date (shown elsewhere) and the machine-readable tag tail.
 */
export function cleanMemoryText(text: string) {
  return text
    .split(" tags: ")[0]
    .replace(/^\[[\w-]+\]\s*/, "")
    .replace(/^\d{4}-\d{2}-\d{2}\s*·\s*/, "")
    .trim();
}

/**
 * Display-only tidy for agent reasons on a crowded row: drops the "(W3 D0 L2 / W3 D1 L1)" form string
 * and any reason that only restates what the row already shows (competition and kick-off time).
 */
export function tidyReasons(reasons: string[], shown: { competition: string }): string[] {
  const comp = shown.competition.toLowerCase();
  return reasons
    .map((r) => r.replace(/\s*\((?:[WDL]\d+\s*){3}\/\s*(?:[WDL]\d+\s*){3}\)/g, "").replace(/\s+\./g, ".").trim())
    .filter((r) => {
      const t = r.toLowerCase();
      const restates = t.startsWith(comp) && /kick-?off/.test(t) && /your time\.?$/.test(t);
      return r.length > 0 && !restates;
    });
}
