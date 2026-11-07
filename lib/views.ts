// Assembles the JSON the web UI renders (see lib/contract.ts).
import type { ArmStats, MeResponse, MemoryRow, Pick, ProofResponse, Rating, StatsResponse, SwitchNight, SwitchRow, WriteStatus, MemoryKind } from "./contract.ts";
import type { MemorySwitch } from "./picker.ts";
import type { NightReport } from "./night.ts";
import { q, one, cached } from "./db.ts";
import { env } from "./env.ts";
import { buildTaste, parseMemory, tasteToContract } from "./taste.ts";
import { localParts, walruscan, suiscanObject, suiscanAccount, blobIdToU256, slug } from "./util.ts";
import { chainInfo, memwalAccount, objectLastWrite, ownedBlobs, type ChainBlob } from "./tatum.ts";
import { memwal } from "./memory.ts";
import { formLabels, nightStats } from "./night.ts";

type Lock = { blobId: string | null; storedAt: string };

function toPick(p: any, now = Date.now(), locks?: Map<string, Lock>): Pick {
  const lk = locks?.get(p.brief_date);
  const lockMins = lk ? Math.round((new Date(p.kickoff).getTime() - Date.parse(lk.storedAt)) / 60_000) : null;
  const k = new Date(p.kickoff).getTime();
  const settled = !!p.settled_at;
  const status = settled ? "finished" : k > now ? "upcoming" : "live";
  // Blind until rated or settled: the score and the up-front reasons would otherwise give away the memory-off pick
  // (memory picks score with memory and lead with a memory reason). The cited memories stay behind a warned fold.
  const blind = !p.rating && !settled;
  return {
    id: p.id,
    briefDate: p.brief_date,
    slot: p.slot,
    arm: p.rating || settled ? p.arm : null,
    kickoff: new Date(p.kickoff).toISOString(),
    competition: p.competition,
    stage: p.stage,
    home: p.home,
    away: p.away,
    homeScore: p.home_score,
    awayScore: p.away_score,
    status,
    score: blind ? null : Math.round(Number(p.score)),
    reasons: blind ? (p.features?.neutral ?? []) : (p.reasons ?? []),
    cites: p.cites ?? [],
    rating: p.rating,
    drama: p.drama,
    form: p.features?.form ?? null,
    logos: env.officialCrests() ? p.features?.logos ?? null : null,
    lock: lk && lockMins !== null && lockMins > 0 ? { blobId: lk.blobId, lockedAt: lk.storedAt, minutesBeforeKickoff: lockMins } : null,
  };
}

/** Stored brief locks for a user, keyed by brief date (idem key mf:brief:<uid>:<date>). */
async function briefLocks(userId: number): Promise<Map<string, Lock>> {
  const rows = await q<any>(`select idem_key, blob_id, updated_at from memory_jobs where user_id = $1 and kind = 'brief' and status = 'stored'`, [userId]);
  return new Map(rows.map((r) => [String(r.idem_key).split(":").pop()!, { blobId: r.blob_id, storedAt: new Date(r.updated_at).toISOString() }]));
}

function armStats(rows: any[]): ArmStats {
  const rated = rows.filter((r) => r.rating && r.rating !== "skipped");
  const val = (r: string) => (r === "loved" ? 2 : r === "fine" ? 1 : 0);
  const dramas = rows.map((r) => r.drama?.score).filter((x) => typeof x === "number");
  return {
    n: rows.filter((r) => r.rating).length,
    loved: rows.filter((r) => r.rating === "loved").length,
    fine: rows.filter((r) => r.rating === "fine").length,
    bailed: rows.filter((r) => r.rating === "bailed").length,
    skipped: rows.filter((r) => r.rating === "skipped").length,
    avgDrama: dramas.length ? Math.round(dramas.reduce((a, b) => a + b, 0) / dramas.length) : null,
    score: rated.length ? Number((rated.reduce((s, r) => s + val(r.rating), 0) / rated.length).toFixed(2)) : null,
  };
}

const STATUS: Record<string, WriteStatus> = { queued: "queued", pending: "pending", stored: "stored", failed: "failed" };

/**
 * The memory switch for a viewer's recent briefs, newest first. A night stays sealed (no lists in the response)
 * while any of its picks is still open, because the memory-off list would point at the memory-off pick.
 */
export async function switchNights(userId: number, picks: any[], limit = 7): Promise<SwitchNight[]> {
  const rows = await q<any>(`select brief_date, considered, switch from scans where user_id = $1 and switch is not null order by brief_date desc limit $2`, [userId, limit]);
  if (!rows.length) return [];
  const nights = new Map<string, NightReport>(
    (await q<any>(`select brief_date, report from nights where user_id = $1 and brief_date = any($2::text[])`, [userId, rows.map((r) => r.brief_date)])).map((n) => [n.brief_date, n.report]),
  );
  return rows.map((r) => {
    const sw = r.switch as MemorySwitch;
    const mine = picks.filter((p) => p.brief_date === r.brief_date);
    const sealed = mine.some((p) => !p.rating && !p.settled_at);
    const night = nights.get(r.brief_date);
    const placed = new Map((night?.switch ?? []).map((x) => [x.matchId, x]));
    const row = (e: MemorySwitch["on"][number]): SwitchRow => {
      const p = mine.find((x) => x.match_id === e.matchId);
      const pl = placed.get(e.matchId);
      return { ...e, picked: !!p, rating: p?.rating ?? null, drama: pl?.drama ?? null, nightRank: pl?.rank ?? null };
    };
    return {
      date: r.brief_date,
      sealed,
      changed: sw.changed,
      considered: sw.considered ?? Number(r.considered),
      scored: night ? night.scored : null,
      on: sealed ? [] : sw.on.map(row),
      off: sealed ? [] : sw.off.map(row),
    };
  });
}

/** On-chain Blob objects for the account owner, keyed by u256 blob id. Cached: the chain is slow-moving. */
export async function chainBlobMap(): Promise<{ owner: string | null; blobs: Map<string, ChainBlob> }> {
  const data = await cached("proof:chainblobs", 300, async () => {
    const acct = await memwalAccount();
    const blobs = await ownedBlobs(acct.owner);
    return { owner: acct.owner, blobs };
  }).catch(() => ({ owner: null, blobs: [] as ChainBlob[] }));
  return { owner: data.owner, blobs: new Map(data.blobs.map((b: ChainBlob) => [b.blobIdU256, b])) };
}

export async function meView(userId: number): Promise<MeResponse | null> {
  const u = await one<any>(`select * from users where id = $1`, [userId]);
  if (!u) return null;
  const today = localParts(new Date(), u.tz).date;
  const picks = await q<any>(`select * from picks where user_id = $1 order by brief_date desc, slot asc limit 120`, [userId]);
  const jobs = await q<any>(`select * from memory_jobs where user_id = $1 and not archived order by id desc limit 400`, [userId]);
  const { blobs } = await chainBlobMap();
  const locks = await briefLocks(userId);
  const memories: MemoryRow[] = jobs.map((j) => {
    const chain = j.blob_id ? blobs.get(blobIdToU256(j.blob_id)) : undefined;
    return {
      blobId: j.blob_id,
      kind: j.kind as MemoryKind,
      text: j.text,
      createdAt: new Date(j.created_at).toISOString(),
      status: STATUS[j.status] ?? "queued",
      namespace: j.namespace,
      suiObjectId: chain?.objectId ?? null,
      endEpoch: chain?.endEpoch ?? null,
      walruscanUrl: j.blob_id ? walruscan(j.blob_id) : null,
      suiscanUrl: chain ? suiscanObject(chain.objectId) : null,
    };
  });
  const stored = jobs.filter((j) => j.status === "stored" && j.blob_id);
  const taste = buildTaste(stored.map((j) => parseMemory(j.blob_id, j.text)), today);
  const labels = new Map<string, string>();
  for (const p of picks) {
    labels.set(`comp:${p.comp_id}`, p.competition);
    labels.set(`team:${slug(p.home)}`, p.home);
    labels.set(`team:${slug(p.away)}`, p.away);
  }
  for (const [id, label] of Object.entries(KNOWN_COMPS)) if (!labels.has(`comp:${id}`)) labels.set(`comp:${id}`, label);
  // League form covers competitions the viewer never had as a pick; the night reports carry their names.
  for (const [id, label] of await formLabels(userId)) if (!labels.has(`comp:${id}`)) labels.set(`comp:${id}`, label);
  const dayIndex = Math.max(1, Math.floor((Date.now() - new Date(u.created_at).getTime()) / 86_400_000) + 1);
  return {
    user: { name: u.name, tz: u.tz, briefHour: u.brief_hour, windowStart: u.window_start, windowEnd: u.window_end, namespace: u.namespace, joinedAt: new Date(u.created_at).toISOString(), dayIndex },
    today: picks.filter((p) => p.brief_date === today).map((p) => toPick(p, Date.now(), locks)),
    history: picks.filter((p) => p.brief_date !== today).slice(0, 14 * 3).map((p) => toPick(p, Date.now(), locks)),
    taste: tasteToContract(taste, labels),
    memories,
    ab: { memory: armStats(picks.filter((p) => p.arm === "memory")), control: armStats(picks.filter((p) => p.arm === "control")) },
    memorySwitch: await switchNights(userId, picks).catch(() => []),
    shares: [],
    currentWalrusEpoch: [...blobs.values()].reduce((m, b) => Math.max(m, b.certifiedEpoch ?? 0), 0) || undefined,
  };
}

export const KNOWN_COMPS: Record<string, string> = {
  "2000001032": "UEFA Champions League",
  "2000000000": "Premier League (ENG)",
  "2000000037": "LaLiga (ESP)",
  "2000000026": "Serie A (ITA)",
  "2000000019": "Bundesliga (GER)",
  "2000000018": "Ligue 1 (FRA)",
  "2000000092": "V.League 1 (VIE)",
  "504": "UEFA Nations League",
  "2000001033": "AFC Champions League Elite",
  "2000000103": "MLS",
  "2000001041": "UEFA Europa League",
};

const VERDICT: [RegExp, Rating, string][] = [
  [/^Loved /, "loved", "Loved"],
  [/^Watched \(fine\) /, "fine", "Fine"],
  [/^Bailed on /, "bailed", "Bailed on"],
  [/^Skipped /, "skipped", "Didn't watch"],
];

/** Turn a stored memory sentence into a friendly, spoiler-free line for the public landing feed. */
export function feedItem(raw: string): { text: string; kind: "rating" | "lesson"; verdict: Rating | null; headline: string; detail: string } {
  const text = raw.split(" tags: ")[0];
  const body = text.replace(/^\[(\w+)\]\s*(\d{4}-\d{2}-\d{2} · )?/, "");
  if (/^\[rating\]/.test(text)) {
    for (const [re, verdict, word] of VERDICT) {
      if (!re.test(body)) continue;
      const rest = body.replace(re, "");
      const m = /^(.+?) (?:\d+–\d+|v) (.+?) \((.+?)\);/.exec(rest);
      const drama = /Drama (\d+)\/100/.exec(rest)?.[1];
      if (m) {
        const comp = m[3].split(" · ")[0];
        return { text, kind: "rating", verdict, headline: `${word} ${m[1]} v ${m[2]}`, detail: `${comp}${drama ? ` · drama ${drama}` : ""}` };
      }
    }
  }
  // Lessons: drop the raw weights and sample sizes older lessons carried.
  const plain = body
    .replace(/\s*\([+-]?\d\.\d{2}\)/g, "")
    .replace(/strongest pulls are/i, "leans towards")
    .replace(/Strongest pushes away:/i, "Cooler on")
    .replace(/Memory picks average ([\d.]+) vs ([\d.]+) for memory-off picks \(n=(\d+)\/(\d+);[^)]*\)\./, (_, a: string, b: string) => `Memory picks rate ${Number(a).toFixed(1)} vs ${Number(b).toFixed(1)} for memory-off picks.`);
  return { text, kind: "lesson", verdict: null, headline: "What the pundit learned", detail: plain };
}

export async function statsView(): Promise<StatsResponse> {
  return cached("view:stats:v2", 60, async () => {
    const [m] = await q<any>(`select count(*) filter (where status='stored')::int stored from memory_jobs`);
    const [u] = await q<any>(`select count(*)::int n from users where onboard_step = 'done'`);
    const picks = await q<any>(`select arm, rating, drama from picks`);
    const [s] = await q<any>(`select coalesce(sum(considered),0)::int n from scans`);
    // Counts only (no lists), so a night's open picks stay blind.
    const [sw] = await q<any>(
      `select count(*)::int briefs, coalesce(sum((switch->>'changed')::int),0)::int changed, coalesce(sum(jsonb_array_length(switch->'on')),0)::int slots
       from scans where switch is not null`,
    );
    const feedUser = env.publicFeedUser();
    const lessons = feedUser
      ? await q<any>(`select text, created_at, blob_id from memory_jobs where user_id = $1 and kind in ('lesson','rating') and status = 'stored' order by id desc limit 6`, [Number(feedUser)])
      : [];
    return {
      memoriesStored: m.stored,
      users: u.n,
      picksSent: picks.length,
      picksRated: picks.filter((p) => p.rating).length,
      matchesScanned: s.n,
      ab: { memory: armStats(picks.filter((p) => p.arm === "memory")), control: armStats(picks.filter((p) => p.arm === "control")) },
      nights: await nightStats(),
      switch: { briefs: sw.briefs, changed: sw.changed, slots: sw.slots },
      recentLessons: lessons.map((l) => ({ ...feedItem(l.text), createdAt: new Date(l.created_at).toISOString(), blobId: l.blob_id })),
      updatedAt: new Date().toISOString(),
    };
  });
}

export async function proofView(): Promise<ProofResponse> {
  return cached("view:proof", 300, async () => {
    const via: string[] = [];
    let account: ProofResponse["account"] = null;
    let chain = { epoch: null as string | null, checkpoint: null as string | null };
    try {
      const ci = await chainInfo();
      chain = { epoch: ci.epoch, checkpoint: ci.checkpoint };
      via.push("Tatum gRPC · LedgerService/GetServiceInfo");
    } catch {}
    try {
      const a = await memwalAccount();
      account = { id: a.id, owner: a.owner, active: a.active, delegateKeys: a.delegateKeys };
      via.push("Tatum gRPC · LedgerService/GetObject");
    } catch {}
    const { blobs } = await chainBlobMap();
    if (blobs.size) via.push("Tatum gRPC · StateService/ListOwnedObjects");
    const stored = await q<any>(`select blob_id, namespace from memory_jobs where status = 'stored' and blob_id is not null order by id desc`);
    let matched = 0;
    const sample: ProofResponse["blobs"]["sample"] = [];
    for (const s of stored) {
      const c = blobs.get(blobIdToU256(s.blob_id));
      if (c) {
        matched++;
        if (sample.length < 12) sample.push({ objectId: c.objectId, blobId: s.blob_id, namespace: s.namespace, size: c.size, endEpoch: c.endEpoch });
      }
    }
    // Brief locks: when did Sui certify tonight's picks, relative to the first kick-off? (read via Tatum)
    const locks: NonNullable<ProofResponse["locks"]> = [];
    try {
      const rows = await q<any>(
        `select j.idem_key, j.blob_id, j.user_id, min(p.kickoff) first_kickoff
         from memory_jobs j join picks p on p.user_id = j.user_id and p.brief_date = split_part(j.idem_key, ':', 4)
         where j.kind = 'brief' and j.status = 'stored' and j.blob_id is not null
         group by j.id, j.idem_key, j.blob_id, j.user_id order by j.id desc limit 6`,
      );
      for (const r of rows) {
        const c = blobs.get(blobIdToU256(r.blob_id));
        const w = c ? await objectLastWrite(c.objectId).catch(() => null) : null;
        const first = new Date(r.first_kickoff).toISOString();
        locks.push({
          date: String(r.idem_key).split(":").pop()!,
          blobId: r.blob_id,
          objectId: c?.objectId ?? null,
          certifiedAt: w?.at ?? null,
          firstKickoff: first,
          minutesBefore: w?.at ? Math.round((Date.parse(first) - Date.parse(w.at)) / 60_000) : null,
        });
      }
      if (locks.some((l) => l.certifiedAt)) via.push("Tatum gRPC · LedgerService/GetTransaction");
    } catch {}
    let relayer = { memories: stored.length, namespaces: 0 };
    try {
      const ns = await memwal().listNamespaces({ limit: 200 });
      relayer = { memories: ns.namespaces.reduce((s: number, n: any) => s + Number(n.memory_count ?? 0), 0) || stored.length, namespaces: ns.namespaces.length };
    } catch {}
    return {
      network: "mainnet",
      account,
      chain: { ...chain, via },
      blobs: { onChainCount: blobs.size, sample },
      relayer,
      verified: { matched, missing: stored.length - matched },
      locks,
      checkedAt: new Date().toISOString(),
      links: { account: account ? suiscanObject(account.id) : "", owner: account ? suiscanAccount(account.owner) : "" },
    };
  });
}
