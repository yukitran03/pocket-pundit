// Tiny SQL adapter: Neon serverless Postgres in production (DATABASE_URL), PGlite (embedded Postgres) locally.
import { env } from "./env.ts";

export type Row = Record<string, any>;
type Exec = (text: string, params: unknown[]) => Promise<Row[]>;

let exec: Exec | null = null;
let schemaReady: Promise<void> | null = null;

async function init(): Promise<Exec> {
  const url = env.databaseUrl();
  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    return async (text, params) => (await sql.query(text, params as any[])) as Row[];
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR || "./data/pglite";
  const { mkdirSync } = await import("node:fs");
  mkdirSync(dir, { recursive: true });
  const db = new PGlite(dir);
  await db.waitReady;
  return async (text, params) => (await db.query(text, params as any[])).rows as Row[];
}

export async function q<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  if (!exec) exec = await init();
  if (!schemaReady) schemaReady = migrate(exec);
  await schemaReady;
  return (await exec(text, params)) as T[];
}

export async function one<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

const SCHEMA = [
  `create table if not exists users (
    id bigint primary key,
    chat_id bigint not null,
    name text not null,
    username text,
    tz text not null default 'Asia/Ho_Chi_Minh',
    brief_hour int not null default 18,
    window_start int not null default 19,
    window_end int not null default 26,
    namespace text not null,
    active boolean not null default true,
    onboard_step text not null default 'tz',
    last_brief_date text,
    last_lesson_date text,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists picks (
    id text primary key,
    user_id bigint not null,
    brief_date text not null,
    slot int not null,
    arm text not null,
    match_id text not null,
    comp_id text, season_id text, stage_id text,
    competition text not null,
    stage text,
    home text not null, away text not null,
    home_id text, away_id text,
    kickoff timestamptz not null,
    score real not null,
    reasons jsonb not null default '[]',
    cites jsonb not null default '[]',
    features jsonb not null default '{}',
    status text not null default 'upcoming',
    home_score int, away_score int,
    drama jsonb,
    rating text,
    rated_at timestamptz,
    asked_at timestamptz,
    settled_at timestamptz,
    ask_message_id bigint,
    created_at timestamptz not null default now(),
    unique (user_id, brief_date, match_id)
  )`,
  `create index if not exists picks_user_date on picks (user_id, brief_date)`,
  `create index if not exists picks_unsettled on picks (settled_at) where settled_at is null`,
  `create table if not exists memory_jobs (
    id bigserial primary key,
    user_id bigint,
    namespace text not null,
    kind text not null,
    text text not null,
    idem_key text not null unique,
    status text not null default 'queued',
    job_id text,
    blob_id text,
    error text,
    attempts int not null default 0,
    supersedes text,
    notify_chat bigint,
    notify_message bigint,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `create index if not exists memory_jobs_status on memory_jobs (status)`,
  `create index if not exists memory_jobs_user on memory_jobs (user_id, created_at desc)`,
  `create table if not exists recall_events (
    id bigserial primary key,
    user_id bigint,
    purpose text not null,
    query text not null,
    namespace text not null,
    blob_ids jsonb not null default '[]',
    latency_ms int,
    ok boolean not null,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists kv (
    k text primary key,
    v jsonb not null,
    expires_at timestamptz
  )`,
  `create table if not exists scans (
    user_id bigint not null,
    brief_date text not null,
    considered int not null,
    created_at timestamptz not null default now(),
    primary key (user_id, brief_date)
  )`,
  `alter table users add column if not exists show_scores boolean not null default false`,
  `alter table users add column if not exists alerts boolean not null default true`,
  `alter table picks add column if not exists reminded_at timestamptz`,
  `alter table memory_jobs add column if not exists notified_at timestamptz`,
  `alter table users add column if not exists duo_partner bigint`,
  `alter table users add column if not exists memwal_account text`,
  `alter table users add column if not exists memwal_owner text`,
  `alter table users add column if not exists own_since timestamptz`,
  `alter table memory_jobs add column if not exists account_id text`,
  `alter table memory_jobs add column if not exists archived boolean not null default false`,
  `alter table scans add column if not exists switch jsonb`, // the memory switch, stored at brief time (lib/picker.ts)
  `create table if not exists alerts (
    user_id bigint not null,
    match_id text not null,
    kind text not null,
    competition text, home text, away text, comp_id text,
    minute real, home_score int, away_score int,
    signals jsonb not null default '[]',
    response text,
    message_id bigint,
    sent_at timestamptz not null default now(),
    primary key (user_id, match_id)
  )`,
  `create table if not exists nights (
    user_id bigint not null,
    brief_date text not null,
    report jsonb not null,
    created_at timestamptz not null default now(),
    primary key (user_id, brief_date)
  )`,
];

// A cold start used to replay every statement above (one round trip each) before its first query. Now one read
// tells whether this exact schema is already in place; any change to SCHEMA changes the version and replays it.
const SCHEMA_VERSION = (() => {
  let h = 0x811c9dc5;
  for (const ch of SCHEMA.join(";")) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return `${SCHEMA.length}:${h.toString(16)}`;
})();

async function migrate(run: Exec) {
  const have = await run(`select v from kv where k = 'schema:version'`, []).catch(() => [] as Row[]);
  if (have[0]?.v === SCHEMA_VERSION) return;
  for (const stmt of SCHEMA) await run(stmt, []);
  await run(
    `insert into kv (k, v, expires_at) values ('schema:version', $1::jsonb, null) on conflict (k) do update set v = excluded.v, expires_at = null`,
    [JSON.stringify(SCHEMA_VERSION)],
  );
}

// --- small key/value cache with TTL, stored in Postgres so it survives serverless cold starts ---
export async function cacheGet<T>(k: string): Promise<T | null> {
  const r = await one<{ v: T }>(`select v from kv where k = $1 and (expires_at is null or expires_at > now())`, [k]);
  return r ? r.v : null;
}

export async function cacheSet(k: string, v: unknown, ttlSeconds: number | null) {
  await q(
    `insert into kv (k, v, expires_at) values ($1, $2::jsonb, case when $3::int is null then null else now() + ($3::int * interval '1 second') end)
     on conflict (k) do update set v = excluded.v, expires_at = excluded.expires_at`,
    [k, JSON.stringify(v), ttlSeconds],
  );
}

export async function cached<T>(k: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const hit = await cacheGet<T>(k);
  if (hit !== null) return hit;
  try {
    const v = await fn();
    await cacheSet(k, v, ttlSeconds);
    return v;
  } catch (e) {
    // Upstream down (the football feed has outages): an expired copy beats an error. Expired rows are kept.
    const stale = await one<{ v: T }>(`select v from kv where k = $1`, [k]).catch(() => null);
    if (stale) return stale.v;
    throw e;
  }
}

// Best-effort lease so overlapping ticks (cron + webhook) don't double-send.
export async function withLease<T>(name: string, seconds: number, fn: () => Promise<T>): Promise<T | null> {
  const k = `lease:${name}`;
  const holder = Math.random().toString(36).slice(2);
  const got = await q(
    `insert into kv (k, v, expires_at) values ($1, $3::jsonb, now() + ($2::int * interval '1 second'))
     on conflict (k) do update set v = excluded.v, expires_at = excluded.expires_at
     where kv.expires_at is null or kv.expires_at < now()
     returning k`,
    [k, seconds, JSON.stringify({ holder })],
  );
  if (!got.length) return null;
  try {
    return await fn();
  } finally {
    // Only release our own lease: a pass that overran it must not free the next holder's.
    await q(`delete from kv where k = $1 and v->>'holder' = $2`, [k, holder]);
  }
}
