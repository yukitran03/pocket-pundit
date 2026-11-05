// Failure modes with more than one user: unreachable chats, failed sends, relayer outages, per-chat message ids,
// and who may claim an own-memory account. Fake football world, fake Telegram (message ids counted per chat, as
// the Bot API does), MemWalMock, throwaway PGlite. Nothing touches mainnet, the real bot or the real database.
import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createWorld } from "./helpers/fakeWorld.ts";

const dir = mkdtempSync(path.join(tmpdir(), "pundit-rel-"));
Object.assign(process.env, {
  PGLITE_DIR: dir,
  APP_SECRET: "rel-secret",
  TELEGRAM_BOT_TOKEN: "123456:rel-fake-token",
  TELEGRAM_WEBHOOK_SECRET: "hook",
  CRON_SECRET: "cron",
  APP_URL: "https://pundit.test",
  MEMWAL_PUBLIC_KEY: "ab".repeat(32),
  MEMWAL_ACCOUNT_ID: "0x" + "1".repeat(64),
});
delete process.env.DATABASE_URL;
delete process.env.POSTGRES_URL;
delete process.env.VERCEL;

const H = 3600_000;
const EPL = { compId: "2000000000", comp: "Premier League" };
const world = createWorld();
const realFetch = globalThis.fetch;
const calls: { method: string; body: any }[] = [];
const perChat = new Map<number, number>();
const blocked = new Set<number>();
const failOnce: RegExp[] = [];
let L: any;

async function fakeFetch(input: any, init?: any): Promise<Response> {
  const url = String(typeof input === "string" ? input : input.url);
  if (url.startsWith("https://api.telegram.org/")) {
    const method = url.split("/").pop()!;
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (blocked.has(Number(body.chat_id))) return Response.json({ ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" });
    const i = failOnce.findIndex((re) => re.test(String(body.text ?? "")));
    if (i >= 0) {
      failOnce.splice(i, 1);
      return Response.json({ ok: false, error_code: 502, description: "Bad Gateway" });
    }
    calls.push({ method, body });
    const n = (perChat.get(Number(body.chat_id)) ?? 0) + 1;
    perChat.set(Number(body.chat_id), n);
    return Response.json({ ok: true, result: method === "sendMessage" ? { message_id: n, chat: { id: body.chat_id } } : true });
  }
  return world.fakeFetch(input, init);
}

async function addUser(id: number, extra: { brief_hour?: number; last_brief_date?: string | null } = {}) {
  await L.db.q(
    `insert into users (id, chat_id, name, namespace, tz, brief_hour, window_start, window_end, onboard_step, last_brief_date, alerts)
     values ($1,$1,$2,$3,'UTC',$4,0,36,'done',$5,false)`,
    [id, `User${id}`, L.memory.namespaceFor(id), extra.brief_hour ?? 23, "last_brief_date" in extra ? extra.last_brief_date : L.util.localParts(new Date(), "UTC").date],
  );
}

let pid = 0;
async function addPick(userId: number, kickoff: Date, matchId: string, extra: Record<string, unknown> = {}) {
  const id = `rp${++pid}`;
  await L.db.q(
    `insert into picks (id, user_id, brief_date, slot, arm, match_id, competition, home, away, kickoff, score, status, rating, ask_message_id, settled_at, asked_at, features)
     values ($1,$2,$3,1,'memory',$4,'Premier League',$5,$6,$7,50,'upcoming',$8,$9,$10,$11,$12::jsonb)`,
    [id, userId, `d-${pid}`, matchId, extra.home ?? "Home", extra.away ?? "Away", kickoff.toISOString(), extra.rating ?? null, extra.ask ?? null, extra.settled ?? null, extra.asked ?? null, JSON.stringify(extra.features ?? {})],
  );
  return id;
}

beforeAll(async () => {
  globalThis.fetch = fakeFetch as any;
  const [memory, telegram, tick, util, db, own] = await Promise.all([
    import("../lib/memory.ts"),
    import("../lib/telegram.ts"),
    import("../lib/tick.ts"),
    import("../lib/util.ts"),
    import("../lib/db.ts"),
    import("../lib/own.ts"),
  ]);
  const { MemWalMock } = await import("../node_modules/@mysten-incubation/memwal/dist/mock.js");
  memory.useMemWalClient(MemWalMock.create());
  L = { memory, telegram, tick, util, db, own, MemWalMock };
  await db.cacheSet("proof:chainblobs", { owner: null, blobs: [] }, 86_400);
}, 60_000);

afterEach(async () => {
  for (const t of ["picks", "users", "memory_jobs", "alerts"]) await L.db.q(`delete from ${t}`);
  await L.db.q(`delete from kv where k like 'lease:%'`);
  blocked.clear();
  calls.length = 0;
});

afterAll(() => {
  globalThis.fetch = realFetch;
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* PGlite may still hold the folder on Windows */
  }
});

describe("one unreachable chat never holds up the others", () => {
  it("a blocked user's reminder fails alone, and they stop getting scheduled sends", async () => {
    await addUser(1);
    await addUser(2);
    blocked.add(1);
    const k = new Date(Date.now() + 20 * 60_000);
    world.add({ ...EPL, home: "Reminder Town", away: "Late FC", kickoff: k, status: 1, hs: null, as: null, id: "rel-rm" });
    await addPick(1, k, "rel-rm");
    await addPick(2, k, "rel-rm");
    await L.tick.tick();
    const sent = calls.filter((c) => /Kicks off in/.test(c.body.text ?? ""));
    expect(sent.map((c) => c.body.chat_id)).toEqual([2]);
    expect((await L.db.one(`select active from users where id = 1`)).active).toBe(false);
    // Writing to the bot again brings them back.
    blocked.delete(1);
    await L.telegram.handleUpdate({ update_id: 1, message: { message_id: 1, chat: { id: 1, type: "private" }, from: { id: 1, first_name: "U1" }, text: "/help" } });
    expect((await L.db.one(`select active from users where id = 1`)).active).toBe(true);
  }, 60_000);

  it("a pile of asks for a blocked user doesn't starve everyone else's full-time asks", async () => {
    await addUser(1);
    await addUser(2);
    blocked.add(1);
    for (let i = 0; i < 12; i++) {
      const k = new Date(Date.now() - 3 * H - i * 60_000);
      world.add({ ...EPL, home: `Stuck ${i}`, away: `Side ${i}`, kickoff: k, status: 0, hs: 1, as: 0, id: `rel-st${i}` });
      await addPick(1, k, `rel-st${i}`);
    }
    const kb = new Date(Date.now() - 2.5 * H);
    world.add({ ...EPL, home: "Patient", away: "FC", kickoff: kb, status: 0, hs: 2, as: 2, id: "rel-stB" });
    await addPick(2, kb, "rel-stB");
    await L.tick.tick();
    await L.tick.tick();
    expect((await L.db.one(`select asked_at from picks where user_id = 2`)).asked_at).not.toBeNull();
  }, 120_000);
});

describe("retries", () => {
  it("a brief retried after a failed send shows the picks already chosen, not an empty night", async () => {
    await addUser(3, { brief_hour: 0, last_brief_date: null });
    const base = Date.now();
    for (let i = 1; i <= 4; i++) world.add({ ...EPL, home: `Retry H${i}`, away: `Retry A${i}`, kickoff: new Date(base + (i + 1) * H), status: 1, hs: null, as: null });
    failOnce.push(/Tonight's picks/);
    await L.tick.tick();
    await L.tick.tick();
    const briefs = calls.filter((c) => c.body.chat_id === 3 && /Tonight's picks/.test(c.body.text ?? ""));
    const picks = await L.db.q(`select home from picks where user_id = 3`);
    expect(briefs.length).toBe(1);
    expect(briefs[0].body.text).not.toMatch(/Nothing kicks off/);
    expect(picks.length).toBeGreaterThan(0);
    for (const p of picks) expect(briefs[0].body.text).toContain(p.home);
  }, 120_000);

  it("a relayer outage backs off instead of burning every attempt, and the write lands once it recovers", async () => {
    await addUser(30);
    const real = L.MemWalMock.create();
    L.memory.useMemWalClient({ remember: async () => { throw new Error("relayer 503 Service Unavailable"); }, getRememberBulkStatus: async () => ({ results: [] }) });
    const r = await L.memory.enqueueMemory({ userId: 30, namespace: "ns30", kind: "rating", text: "[rating] 2026-11-05 · Loved X v Y tags: verdict=1", idem: "rating:rel30" });
    for (let i = 0; i < 8; i++) await L.memory.processMemoryQueue(8);
    const during = await L.db.one(`select status, attempts from memory_jobs where id = $1`, [r.id]);
    expect(during).toMatchObject({ status: "queued", attempts: 1 }); // waiting out its backoff
    L.memory.useMemWalClient(real);
    await L.db.q(`update memory_jobs set updated_at = now() - interval '10 minutes' where id = $1`, [r.id]);
    await L.memory.processMemoryQueue(8);
    await L.memory.processMemoryQueue(8);
    expect((await L.db.one(`select status from memory_jobs where id = $1`, [r.id])).status).toBe("stored");
  }, 120_000);
});

describe("message ids are per chat", () => {
  it("the 'stored on Walrus' edit never shows another user's pick", async () => {
    await addUser(10);
    await addUser(20);
    // User 10's full-time ask is message 1 in their chat; user 20's teach reply is message 1 in theirs.
    await addPick(10, new Date(Date.now() - 5 * H), "rel-x1", { home: "PrivateHome", away: "PrivateAway", rating: "loved", ask: 1, settled: new Date().toISOString(), asked: new Date().toISOString() });
    await L.telegram.handleUpdate({ update_id: 2, message: { message_id: 1, chat: { id: 20, type: "private" }, from: { id: 20, first_name: "U20" }, text: "I love late comebacks" } });
    await L.memory.processMemoryQueue(10);
    await L.memory.processMemoryQueue(10);
    await L.tick.tick();
    const toUser20 = calls.filter((c) => Number(c.body.chat_id) === 20).map((c) => String(c.body.text ?? ""));
    expect(toUser20.some((t) => /Stored on Walrus/i.test(t))).toBe(true);
    expect(toUser20.join("\n")).not.toContain("PrivateHome");
  }, 120_000);
});

describe("own your memory", () => {
  const acc = "0x" + "c".repeat(64);

  it("only the viewer whose link added our key can claim the account", async () => {
    await addUser(50);
    await addUser(51);
    L.own.setOwnershipVerifier(async () => ({ owner: "0x" + "f".repeat(64), active: true, keys: [{ pub: "ab".repeat(32), label: L.own.viewerLabel(50) }] }));
    expect((await L.own.claimAccount(51, acc)).ok).toBe(false);
    expect((await L.own.claimAccount(50, acc)).ok).toBe(true);
  }, 60_000);

  it("claim, release, claim again keeps every earlier memory in use", async () => {
    await addUser(40);
    const ns = L.memory.namespaceFor(40);
    for (let i = 0; i < 3; i++) await L.memory.enqueueMemory({ userId: 40, namespace: ns, kind: "rating", text: `[rating] 2026-11-0${i + 1} · Loved T${i} v U${i} tags: verdict=1 comp=2000000000`, idem: `rating:rel40-${i}` });
    await L.memory.processMemoryQueue(10);
    await L.memory.processMemoryQueue(10);
    L.own.setOwnershipVerifier(async () => ({ owner: "0x" + "d".repeat(64), active: true, keys: [{ pub: "ab".repeat(32), label: L.own.viewerLabel(40) }] }));
    const live = async () => (await L.db.one(`select count(*)::int n from memory_jobs where user_id = 40 and status = 'stored' and not archived`)).n;
    await L.own.claimAccount(40, acc);
    await L.memory.processMemoryQueue(10);
    await L.memory.processMemoryQueue(10);
    expect(await live()).toBe(3);
    await L.own.releaseAccount(40);
    expect(await live()).toBe(3);
    await L.own.claimAccount(40, acc);
    expect(await live()).toBe(3);
  }, 120_000);
});
