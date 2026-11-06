// The taste model lives in Walrus Memory as plain sentences with a machine-readable "tags:" tail.
// Recall returns those sentences; this module turns them back into weights. No hidden local state:
// if recall returns nothing, the agent genuinely knows nothing.
import type { Drama, Rating, TasteWeight } from "./contract.ts";
import { slug } from "./util.ts";

export type Bucket = "day" | "evening" | "late";

export function kickBucket(localHour: number): Bucket {
  if (localHour >= 17) return "evening";
  if (localHour < 6) return "late";
  return "day";
}

export const RATING_VALUE: Record<Rating, number> = { loved: 1, fine: 0.35, bailed: -0.8, skipped: 0 };
export const RATING_WORD: Record<Rating, string> = { loved: "Loved", fine: "Watched (fine)", bailed: "Bailed on", skipped: "Skipped" };

export function compKey(compId: string) {
  return `comp:${compId}`;
}
export function teamKey(name: string) {
  return `team:${slug(name)}`;
}

// ---------- builders (what we write to Walrus) ----------

export function ratingMemory(o: {
  date: string;
  rating: Rating;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  competition: string;
  compId: string;
  stage: string | null;
  drama: Drama | null;
  localKick: string; // "02:45"
  bucket: Bucket;
}): string {
  const score = o.homeScore !== null && o.awayScore !== null ? ` ${o.homeScore}–${o.awayScore} ` : " v ";
  const where = o.stage ? `${o.competition} · ${o.stage}` : o.competition;
  const drama = o.drama ? ` Drama ${o.drama.score}/100: ${summary(o.drama)}.` : "";
  const v = RATING_VALUE[o.rating];
  const tags = [
    `verdict=${v.toFixed(2)}`,
    `comp=${o.compId}`,
    `team=${slug(o.home)}`,
    `team=${slug(o.away)}`,
    ...(o.drama?.tags ?? []).map((t) => `signal=${t}`),
    `kick=${o.bucket}`,
  ];
  if (o.rating === "skipped") {
    return `[rating] ${o.date} · Skipped ${o.home}${score}${o.away} (${where}); kicked off ${o.localKick} my time.${drama} tags: verdict=0 comp=${o.compId} kick=${o.bucket}${o.drama && o.drama.score >= 60 ? " missed=1" : ""}`;
  }
  return `[rating] ${o.date} · ${RATING_WORD[o.rating]} ${o.home}${score}${o.away} (${where}); kicked off ${o.localKick} my time.${drama} tags: ${tags.join(" ")}`;
}

function summary(d: Drama) {
  const p = [`${d.goals} goals`];
  if (d.lateGoals) p.push(`${d.lateGoals} after 75'`);
  if (d.leadChanges) p.push(`${d.leadChanges} lead changes`);
  if (d.comeback) p.push("comeback");
  return p.join(", ");
}

export function preferenceMemory(date: string, sentence: string, tags: string[], sign: 1 | -1): string {
  return `[preference] ${date} · ${sentence} tags: verdict=${sign === 1 ? "0.80" : "-0.80"} ${tags.join(" ")}`.trim();
}

export function limitMemory(date: string, sentence: string, bucket: Bucket): string {
  return `[limit] ${date} · ${sentence} tags: verdict=-0.80 kick=${bucket}`;
}

export function lessonMemory(date: string, sentence: string): string {
  // Lessons are narrative: they are recalled and shown, but carry no weight tags (no double counting).
  return `[lesson] ${date} · ${sentence}`;
}

// ---------- parser (what we read back from recall) ----------

export interface ParsedMemory {
  blobId: string;
  kind: string;
  date: string | null;
  verdict: number;
  keys: string[]; // comp:..., team:..., signal:..., kick:...
  cals: { key: string; value: number }[]; // cal:<compId> with its own value (league form, from night reports)
  text: string;
}

export function parseMemory(blobId: string, text: string): ParsedMemory {
  const kind = text.match(/^\[(\w+)\]/)?.[1] ?? "note";
  const date = text.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1] ?? null;
  const tail = text.split(" tags: ")[1] ?? "";
  let verdict = 0;
  const keys: string[] = [];
  const cals: ParsedMemory["cals"] = [];
  for (const m of tail.matchAll(/(\w+)=([^\s]+)/g)) {
    const [, k, v] = m;
    if (k === "verdict") verdict = Number(v) || 0;
    else if (k === "comp" || k === "team" || k === "signal" || k === "kick") keys.push(`${k}:${v}`);
    else if (k === "cal") {
      // cal=<compId>:<signed value>; the id may itself contain colons, the value never does
      const i = v.lastIndexOf(":");
      const value = Number(v.slice(i + 1));
      if (i > 0 && Number.isFinite(value)) cals.push({ key: `cal:${v.slice(0, i)}`, value: Math.max(-1, Math.min(1, value)) });
    }
  }
  return { blobId, kind, date, verdict, keys, cals, text };
}

export interface Taste {
  weights: Map<string, { w: number; evidence: number; blobs: { blobId: string; text: string; contrib: number }[] }>;
  memoriesUsed: number;
}

const HALF_LIFE_DAYS = 21;

export function buildTaste(mems: ParsedMemory[], today: string): Taste {
  const raw = new Map<string, { sum: number; evidence: number; blobs: { blobId: string; text: string; contrib: number }[] }>();
  const t0 = Date.parse(today);
  let used = 0;
  const put = (k: string, c: number, m: ParsedMemory) => {
    const e = raw.get(k) ?? { sum: 0, evidence: 0, blobs: [] };
    e.sum += c;
    e.evidence += 1;
    e.blobs.push({ blobId: m.blobId, text: m.text, contrib: c });
    raw.set(k, e);
  };
  for (const m of mems) {
    const age = m.date ? Math.max(0, (t0 - Date.parse(m.date)) / 86_400_000) : 0;
    const decay = Math.pow(0.5, age / HALF_LIFE_DAYS);
    // League form carries one value per competition (how it did against the rest of a night), not one verdict.
    if (m.cals?.length) {
      used++;
      for (const c of m.cals) put(c.key, c.value * decay, m);
      continue;
    }
    if (m.kind === "lesson" || m.kind === "system" || !m.keys.length || m.verdict === 0) continue;
    used++;
    for (const k of m.keys) {
      // teams are weaker evidence than competitions and signals (you can enjoy a match without caring for a club)
      const scale = k.startsWith("team:") ? 0.6 : 1;
      put(k, m.verdict * decay * scale, m);
    }
  }
  const weights: Taste["weights"] = new Map();
  for (const [k, e] of raw) weights.set(k, { w: Math.tanh(e.sum / 1.5), evidence: e.evidence, blobs: e.blobs });
  return { weights, memoriesUsed: used };
}

export function tasteToContract(t: Taste, labels: Map<string, string>): { competitions: TasteWeight[]; teams: TasteWeight[]; signals: TasteWeight[]; limits: TasteWeight[]; form: TasteWeight[] } {
  const out = { competitions: [] as TasteWeight[], teams: [] as TasteWeight[], signals: [] as TasteWeight[], limits: [] as TasteWeight[], form: [] as TasteWeight[] };
  for (const [key, v] of t.weights) {
    const label = labels.get(key) ?? (key.startsWith("cal:") ? labels.get(`comp:${key.slice(4)}`) : undefined) ?? humanKey(key);
    const row: TasteWeight = { key, label, weight: Number(v.w.toFixed(3)), evidence: v.evidence };
    if (key.startsWith("comp:")) out.competitions.push(row);
    else if (key.startsWith("team:")) out.teams.push(row);
    else if (key.startsWith("signal:")) out.signals.push(row);
    else if (key.startsWith("kick:")) out.limits.push(row);
    else if (key.startsWith("cal:")) out.form.push(row);
  }
  for (const list of Object.values(out)) list.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  return out;
}

export function humanKey(key: string): string {
  const [k, v] = key.split(":");
  if (k === "signal") return v.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  if (k === "kick") return v === "late" ? "Kick-offs after midnight" : v === "evening" ? "Evening kick-offs" : "Daytime kick-offs";
  if (k === "team") return v.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  if (k === "cal") return "One competition";
  return v;
}
