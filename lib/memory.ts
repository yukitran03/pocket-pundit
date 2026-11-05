// The only module that talks to Walrus Memory. Writes go through a durable queue (memory_jobs) so a
// confirmed rating is never lost and never written twice; reads go straight to the relayer's recall.
import { MemWal } from "@mysten-incubation/memwal";
import { env } from "./env.ts";
import { q, one } from "./db.ts";
import { hmac, sha256, sleep } from "./util.ts";
import type { MemoryKind } from "./contract.ts";
import { parseMemory, type ParsedMemory } from "./taste.ts";

const clients = new Map<string, MemWal>();
let override: MemWal | null = null;

/** Tests swap in the SDK's in-memory MemWalMock so end-to-end runs never write to mainnet. */
export function useMemWalClient(c: unknown) {
  override = c as MemWal;
}

/**
 * A client for one Walrus Memory account: Pocket Pundit's shared account by default, or the viewer's own
 * account once they have added our delegate key to it (see lib/own.ts). Same key, different account.
 */
export function memwal(accountId?: string | null): MemWal {
  if (override) return override;
  const id = accountId || env.memwalAccountId();
  let c = clients.get(id);
  if (!c) {
    c = MemWal.create({ key: env.memwalKey(), accountId: id, serverUrl: env.memwalServerUrl(), recallTimeoutMs: 20_000 });
    clients.set(id, c);
  }
  return c;
}

/** The account a viewer's memories live in (null = the shared account). */
export async function accountFor(userId: number | null): Promise<string | null> {
  if (!userId) return null;
  const r = await one<{ memwal_account: string | null }>(`select memwal_account from users where id = $1`, [userId]);
  return r?.memwal_account ?? null;
}

/** Namespace names are public on-chain (Blob metadata), so derive them with an HMAC instead of exposing ids. */
export function namespaceFor(userId: number | string): string {
  return `mf:${hmac(env.appSecret(), `ns:${userId}`).slice(0, 14)}`;
}

const SECRET_PATTERNS = [
  /\b(sk|pk|rk)[-_][A-Za-z0-9]{16,}/g,
  /\bt-[0-9a-f]{24}-[0-9a-f]{32}\b/gi, // Tatum keys
  /\b\d{8,10}:[A-Za-z0-9_-]{30,}\b/g, // Telegram bot tokens
  /\b0x[0-9a-f]{64}\b/gi, // 32-byte hex (private keys)
  /\b[0-9a-f]{64}\b/gi,
  /[\w.+-]+@[\w-]+\.[\w.]+/g, // emails
];

/** Strip anything credential-shaped before it can reach the relayer (which processes plaintext). */
export function redact(text: string): { text: string; removed: number } {
  let removed = 0;
  let out = text;
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, () => {
      removed++;
      return "[removed]";
    });
  }
  return { text: out.slice(0, 1200), removed };
}

export interface EnqueueOpts {
  userId: number | null;
  namespace: string;
  kind: MemoryKind;
  text: string;
  idem?: string;
  supersedes?: string | null;
  notifyChat?: number | null;
  notifyMessage?: number | null;
}

export async function enqueueMemory(o: EnqueueOpts): Promise<{ id: number; duplicate: boolean; removed: number }> {
  const { text, removed } = redact(o.text);
  const idem = `mf:${o.idem ?? sha256(`${o.namespace}|${text}`).slice(0, 24)}`;
  const existing = await one<{ id: number }>(`select id from memory_jobs where idem_key = $1`, [idem]);
  if (existing) return { id: Number(existing.id), duplicate: true, removed };
  const account = await accountFor(o.userId);
  const row = await one<{ id: number }>(
    `insert into memory_jobs (user_id, namespace, kind, text, idem_key, supersedes, notify_chat, notify_message, account_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (idem_key) do nothing returning id`,
    [o.userId, o.namespace, o.kind, text, idem, o.supersedes ?? null, o.notifyChat ?? null, o.notifyMessage ?? null, account],
  );
  return { id: Number(row?.id ?? 0), duplicate: !row, removed };
}

export interface StoredJob {
  id: number;
  blobId: string;
  notifyChat: number | null;
  notifyMessage: number | null;
  kind: string;
}

/** Write attempts before a memory is marked failed. Retries back off 1, 2, 4… minutes (capped at 6 hours), so
 * a relayer outage of about a day loses nothing. */
export const MAX_ATTEMPTS = 12;
/** SQL condition: a queued write whose next attempt is due. */
export const DUE_QUEUED = `status = 'queued' and attempts < ${MAX_ATTEMPTS} and (attempts = 0 or updated_at < now() - least(interval '6 hours', interval '1 minute' * power(2, attempts)))`;

/**
 * Submit queued writes (paced under the relayer's ~12/min per-key limit) and settle pending ones.
 * Returns the jobs that reached `stored` in this pass so callers can notify users.
 */
export async function processMemoryQueue(maxSubmit = 8): Promise<{ submitted: number; stored: StoredJob[]; failed: number }> {
  let submitted = 0;
  let failed = 0;
  // A submitted write the relayer never reports back on goes round again (same idempotency key) after an hour.
  await q(`update memory_jobs set status = 'queued', error = 'no answer from the relayer after an hour', updated_at = now() where status = 'pending' and updated_at < now() - interval '1 hour'`);
  const queued = await q(`select * from memory_jobs where ${DUE_QUEUED} order by id asc limit $1`, [maxSubmit]);
  for (const j of queued) {
    try {
      const acc = await memwal(j.account_id).remember(j.text, j.namespace, { idempotencyKey: j.idem_key });
      await q(`update memory_jobs set status='pending', job_id=$2, attempts=attempts+1, error=null, updated_at=now() where id=$1`, [j.id, acc.job_id]);
      submitted++;
    } catch (e: any) {
      const msg = String(e?.message || e).slice(0, 300);
      const rateLimited = /429|rate/i.test(msg);
      await q(`update memory_jobs set attempts=attempts+1, error=$2, updated_at=now(), status = case when attempts + 1 >= $3 then 'failed' else status end where id=$1`, [j.id, msg, MAX_ATTEMPTS]);
      if (Number(j.attempts) + 1 >= MAX_ATTEMPTS) failed++;
      if (rateLimited) break;
    }
    await sleep(350);
  }

  const stored: StoredJob[] = [];
  const pending = await q(`select * from memory_jobs where status = 'pending' and job_id is not null order by id asc limit 50`);
  const groups = new Map<string, any[]>();
  for (const p of pending) groups.set(p.account_id ?? "", [...(groups.get(p.account_id ?? "") ?? []), p]);
  for (const [account, group] of groups) {
    try {
      const st = await memwal(account || null).getRememberBulkStatus(group.map((p) => p.job_id));
      const byJob = new Map(st.results.map((r) => [r.job_id, r]));
      const pending = group;
      for (const p of pending) {
        const r = byJob.get(p.job_id);
        if (!r) continue;
        if (r.status === "done" && r.blob_id) {
          await q(`update memory_jobs set status='stored', blob_id=$2, error=null, updated_at=now() where id=$1`, [p.id, r.blob_id]);
          stored.push({ id: Number(p.id), blobId: r.blob_id, notifyChat: p.notify_chat ? Number(p.notify_chat) : null, notifyMessage: p.notify_message ? Number(p.notify_message) : null, kind: p.kind });
        } else if (r.status === "failed" || r.status === "not_found") {
          // Re-queue once more; the idempotency key makes the retry safe.
          const giveUp = Number(p.attempts) >= MAX_ATTEMPTS - 1;
          await q(`update memory_jobs set status=$3, error=$2, updated_at=now() where id=$1`, [p.id, r.error || r.status, giveUp ? "failed" : "queued"]);
          if (giveUp) failed++;
        }
      }
    } catch {
      // status endpoint hiccup: try again next tick
    }
  }
  return { submitted, stored, failed };
}

/** Recall a user's taste memories (two queries, merged). Logged as recall events for traceability. */
export async function recallTaste(userId: number, namespace: string): Promise<{ memories: ParsedMemory[]; ok: boolean; latencyMs: number }> {
  const mw = memwal(await accountFor(userId));
  const t0 = Date.now();
  const queries: { query: string; sort: "recent" | "relevance"; limit: number }[] = [
    { query: "football matches I rated, loved or bailed on", sort: "recent", limit: 60 },
    { query: "which leagues, teams, kick-off times and match styles I enjoy or avoid", sort: "relevance", limit: 40 },
  ];
  const merged = new Map<string, ParsedMemory>();
  let ok = true;
  // Both queries at once (well inside the relayer's per-key limit): the brief waits for one round trip, not two.
  const runs = queries.map(async (qq) => {
    const t = Date.now();
    try {
      let res = await mw.recall({ query: qq.query, namespace, limit: qq.limit, sort: qq.sort, timeoutMs: 20_000 });
      if (!res.results.length && (res.dropped_count ?? 0) > 0) {
        await sleep(800);
        res = await mw.recall({ query: qq.query, namespace, limit: qq.limit, sort: qq.sort, timeoutMs: 20_000 });
      }
      for (const r of res.results) merged.set(r.blob_id, parseMemory(r.blob_id, r.text));
      await q(`insert into recall_events (user_id, purpose, query, namespace, blob_ids, latency_ms, ok) values ($1,'picks',$2,$3,$4::jsonb,$5,true)`, [userId, qq.query, namespace, JSON.stringify(res.results.map((r) => r.blob_id)), Date.now() - t]);
    } catch (e) {
      ok = false;
      await q(`insert into recall_events (user_id, purpose, query, namespace, blob_ids, latency_ms, ok) values ($1,'picks',$2,$3,'[]'::jsonb,$4,false)`, [userId, qq.query, namespace, Date.now() - t]);
    }
  });
  await Promise.all(runs);
  return { memories: [...merged.values()], ok, latencyMs: Date.now() - t0 };
}

export async function searchMemories(namespace: string, query: string, limit = 12, accountId: string | null = null) {
  const t0 = Date.now();
  const res = await memwal(accountId).recall({ query, namespace, limit, sort: "relevance", timeoutMs: 20_000 });
  return { hits: res.results.map((r) => ({ blobId: r.blob_id, text: r.text, distance: r.distance, createdAt: r.created_at ?? null })), latencyMs: Date.now() - t0 };
}

/** Relayer-side listing (blob ids, agent ids, expiry) for one namespace. */
export async function listNamespaceMemories(namespace: string) {
  const out: Awaited<ReturnType<MemWal["listMemories"]>>["memories"] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 10; i++) {
    const page = await memwal().listMemories({ namespace, limit: 100, cursor });
    out.push(...page.memories.filter((m) => m.namespace_id === namespace));
    if (!page.has_more || !page.next_cursor) break;
    cursor = page.next_cursor;
  }
  return out;
}
