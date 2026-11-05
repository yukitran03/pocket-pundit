// Night reports: after a viewer's window closes, every match in it that finished with a result is ranked by what
// happened, the picks are placed, the report goes to Walrus (MemWalMock) and opens the next brief. Fake football
// world, fake Telegram, throwaway PGlite. Nothing touches mainnet, the real bot or the real database.
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createWorld } from "./helpers/fakeWorld.ts";
import { rankNight, nightLine, nightMemory, OTHER_FORMAT, dayBefore } from "../lib/night.ts";

const dir = mkdtempSync(path.join(tmpdir(), "pundit-night-"));
Object.assign(process.env, {
  PGLITE_DIR: dir,
  APP_SECRET: "night-secret",
  TELEGRAM_BOT_TOKEN: "123456:night-fake-token",
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
const L1 = { compId: "2000000018", comp: "Ligue 1" };
const FUTSAL = { compId: "futsal-1", comp: "Youth Olympic Futsal Tournaments - Men" };
const world = createWorld();
const realFetch = globalThis.fetch;
let L: any;

beforeAll(async () => {
  globalThis.fetch = world.fakeFetch as any;
  const [memory, telegram, tick, util, db, night, views] = await Promise.all([
    import("../lib/memory.ts"),
    import("../lib/telegram.ts"),
    import("../lib/tick.ts"),
    import("../lib/util.ts"),
    import("../lib/db.ts"),
    import("../lib/night.ts"),
    import("../lib/views.ts"),
  ]);
  // @ts-ignore: the mock ships in the SDK's dist but isn't in its exports map
  const { MemWalMock } = await import("../node_modules/@mysten-incubation/memwal/dist/mock.js");
  memory.useMemWalClient(MemWalMock.create());
  L = { memory, telegram, tick, util, db, night, views };
  await db.cacheSet("proof:chainblobs", { owner: null, blobs: [] }, 86_400);
}, 60_000);

afterAll(() => {
  globalThis.fetch = realFetch;
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* PGlite may still hold the folder on Windows */
  }
});

const sm = (matchId: string, drama: number, hs = 1, as = 1, kickoff = "2026-11-05T19:00:00Z") => ({ matchId, home: `H${matchId}`, away: `A${matchId}`, competition: "League", kickoff, homeScore: hs, awayScore: as, drama });

describe("ranking a night (pure)", () => {
  it("ties share a rank, the best can be caught by a tie, and unranked picks stay null", () => {
    const r = rankNight("2026-11-05", 9, [sm("a", 60), sm("b", 87, 3, 2), sm("c", 87, 2, 2), sm("d", 30)], [
      { match_id: "c", arm: "control", home: "Hc", away: "Ac" },
      { match_id: "d", arm: "memory", home: "Hd", away: "Ad" },
      { match_id: "x", arm: "memory", home: "Hx", away: "Ax" },
    ]);
    expect(r.scored).toBe(4);
    expect(r.best?.matchId).toBe("b"); // 3–2 beats 2–2 on goals at equal drama
    expect(r.picks.map((p) => p.rank)).toEqual([1, 4, null]);
    expect(r.caughtBest).toBe(true);
    expect(r.top3).toBe(1);
  });

  it("the Walrus sentence never names which pick ran with memory off", () => {
    const r = rankNight("2026-11-05", 7, [sm("a", 87, 3, 2), sm("b", 54, 2, 1)], [
      { match_id: "a", arm: "control", home: "Ha", away: "Aa" },
      { match_id: "b", arm: "memory", home: "Hb", away: "Ab" },
    ]);
    const text = nightMemory(r, "19:00 to 02:00")!;
    expect(text).toMatch(/^\[night\] 2026-11-05 · Night report for my 19:00 to 02:00 window: 2 of 7 matches finished with full data\. Best: Ha 3–2 Aa \(League\), drama 87, one of my picks\. My picks ranked #1 and #2\. tags: kind=night$/);
    expect(text).not.toMatch(/control|memory-off|memory off/i);
  });

  it("the brief line hides the score unless the viewer opted in, and says so plainly when it missed", () => {
    const caught = rankNight("2026-11-05", 3, [sm("a", 80, 4, 3)], [{ match_id: "a", arm: "memory", home: "Ha", away: "Aa" }]);
    expect(nightLine(caught, { nights: 1, caught: 1 }, false)).toBe("🏆 Last night's best in your window was one of your picks: <b>Ha v Aa</b> · drama 80");
    expect(nightLine(caught, { nights: 3, caught: 2 }, true)).toMatch(/<b>Ha 4–3 Aa<\/b> · drama 80\n<i>Best of the night in your picks: 2 of 3 nights so far\.<\/i>$/);
    const missed = rankNight("2026-11-05", 3, [sm("a", 80), sm("b", 40)], [{ match_id: "b", arm: "memory", home: "Hb", away: "Ab" }]);
    expect(nightLine(missed, null, false)).toMatch(/^📼 Last night's best in your window: <b>Ha v Aa<\/b> · drama 80\. Not one of your picks; worth the highlights\.$/);
    expect(nightLine(rankNight("2026-11-05", 3, [], []), null, false)).toBeNull();
  });

  it("other formats are left out of the ranking", () => {
    expect(OTHER_FORMAT.test("Youth Olympic Futsal Tournaments™ - Women")).toBe(true);
    expect(OTHER_FORMAT.test("Beach Soccer World Cup")).toBe(true);
    expect(OTHER_FORMAT.test("CAF Women's Champions League")).toBe(false);
    expect(dayBefore("2026-11-01")).toBe("2026-10-31");
  });
});

describe("a night, end to end", () => {
  const D = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
  const at = (h: number) => new Date(Date.parse(`${D}T00:00:00Z`) + h * H);
  const UID = 7001;
  let ids: Record<string, string> = {};

  it("ranks every finished match in the window after it closes, once, and writes it to Walrus", async () => {
    await L.db.q(
      `insert into users (id, chat_id, name, namespace, tz, brief_hour, window_start, window_end, onboard_step, last_brief_date, alerts, show_scores)
       values ($1,$1,'Night viewer',$2,'UTC',18,19,26,'done',$3,false,false)`,
      [UID, L.memory.namespaceFor(UID), D],
    );
    const wild = world.add({ ...EPL, home: "Northbridge", away: "Eastvale", kickoff: at(19), status: 0, hs: 3, as: 2, events: [
      { type: 0, minute: 10, hg: 1, ag: 0 }, { type: 0, minute: 35, hg: 1, ag: 1 }, { type: 0, minute: 60, hg: 1, ag: 2 }, { type: 0, minute: 82, hg: 2, ag: 2 }, { type: 0, minute: 90, hg: 3, ag: 2 },
    ] });
    const dull = world.add({ ...L1, home: "Rive", away: "Colline", kickoff: at(20), status: 0, hs: 1, as: 0, events: [{ type: 0, minute: 50, hg: 1, ag: 0 }] });
    const level = world.add({ ...L1, home: "Plage", away: "Foret", kickoff: at(21), status: 0, hs: 2, as: 2, events: [
      { type: 0, minute: 20, hg: 1, ag: 0 }, { type: 0, minute: 40, hg: 1, ag: 1 }, { type: 0, minute: 55, hg: 2, ag: 1 }, { type: 0, minute: 70, hg: 2, ag: 2 },
    ] });
    world.add({ ...FUTSAL, home: "Team X", away: "Team Y", kickoff: at(20), status: 0, hs: 6, as: 5 });
    const open = world.add({ comp: "Primera División", compId: "2000000037", home: "Sierra", away: "Costa", kickoff: at(22), status: 1, hs: null, as: null });
    world.add({ ...EPL, home: "Outside", away: "Window", kickoff: at(17), status: 0, hs: 5, as: 4 }); // before the window opens
    ids = { wild: wild.id, dull: dull.id, level: level.id, open: open.id };
    let slot = 0;
    for (const [m, arm] of [[wild, "control"], [dull, "memory"], [open, "memory"]] as const) {
      await L.db.q(
        `insert into picks (id, user_id, brief_date, slot, arm, match_id, competition, home, away, kickoff, score) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,50)`,
        [`n${++slot}`, UID, D, slot, arm, m.id, m.comp, m.home, m.away, m.kickoff.toISOString()],
      );
    }

    expect(await L.night.runNights(at(27))).toBe(0); // 03:00: the window closed an hour ago, results still landing
    expect(await L.night.runNights(at(29))).toBe(1);
    expect(await L.night.runNights(at(30))).toBe(0); // once per night

    const [row] = await L.db.q(`select report from nights where user_id = $1 and brief_date = $2`, [UID, D]);
    const r = row.report;
    expect(r.scheduled).toBe(4); // futsal and the pre-window match left out
    expect(r.scored).toBe(3);
    expect(r.best.matchId).toBe(ids.wild);
    expect(r.caughtBest).toBe(true);
    const rank = Object.fromEntries(r.picks.map((p: any) => [p.matchId, p.rank]));
    expect(rank[ids.wild]).toBe(1);
    expect(rank[ids.dull]).toBe(3);
    expect(rank[ids.open]).toBeNull();

    const jobs = await L.db.q(`select text, idem_key from memory_jobs where user_id = $1 and kind = 'night'`, [UID]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].text).toMatch(new RegExp(`^\\[night\\] ${D} · Night report for my 19:00 to 02:00 window: 3 of 4 matches finished with full data\\. Best: Northbridge 3–2 Eastvale \\(Premier League\\), drama \\d+, one of my picks\\. My picks ranked #1 and #3 \\(1 had no result in the feed\\)\\.`));
    expect(jobs[0].text).not.toMatch(/control|memory off|memory-off/i);
    await L.memory.processMemoryQueue(10);
    await L.memory.processMemoryQueue(10);
    const [stored] = await L.db.q(`select status, blob_id from memory_jobs where user_id = $1 and kind = 'night'`, [UID]);
    expect(stored.status).toBe("stored");
  });

  it("a night report never moves the taste weights", async () => {
    const { parseMemory, buildTaste } = await import("../lib/taste.ts");
    const [job] = await L.db.q(`select text from memory_jobs where user_id = $1 and kind = 'night'`, [UID]);
    const t = buildTaste([parseMemory("b1", job.text)], D);
    expect(t.memoriesUsed).toBe(0);
    expect(t.weights.size).toBe(0);
  });

  it("opens the next brief, spoiler-free by default", async () => {
    const u = await L.telegram.getUser(UID);
    const m = world.mark();
    await L.telegram.sendBrief(u, at(24 + 18.1));
    const text = world.since(m, "sendMessage").map((c) => c.body.text).join("\n");
    expect(text).toMatch(/🏆 Last night's best in your window was one of your picks: <b>Northbridge v Eastvale<\/b> · drama \d+/);
    expect(text).not.toMatch(/3–2/);
    expect(text).not.toMatch(/—/);
  });

  it("public stats count the night, but keep arms out until every pick is answered", async () => {
    await L.db.q(`delete from kv where k like 'view:stats%'`);
    let s = (await L.views.statsView()).nights;
    expect(s).toMatchObject({ nights: 1, caught: 1, top3Nights: 1, byArm: { nights: 0, memory: 0, control: 0 } });
    await L.db.q(`update picks set rating = 'loved', rated_at = now() where user_id = $1`, [UID]);
    await L.db.q(`delete from kv where k like 'view:stats%'`);
    s = (await L.views.statsView()).nights;
    expect(s.byArm).toEqual({ nights: 1, memory: 0, control: 1 });
  });
});
