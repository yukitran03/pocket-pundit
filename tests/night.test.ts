// Night reports: after a viewer's window closes, every match in it that finished with a result is ranked by what
// happened, the picks are placed, the report goes to Walrus (MemWalMock) and opens the next brief. Fake football
// world, fake Telegram, throwaway PGlite. Nothing touches mainnet, the real bot or the real database.
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createWorld } from "./helpers/fakeWorld.ts";
import { rankNight, nightLine, nightMemory, OTHER_FORMAT, dayBefore, leagueForm, formMemory } from "../lib/night.ts";
import { buildTaste, parseMemory } from "../lib/taste.ts";
import { scoreCandidates, explain, FORM_POINTS } from "../lib/picker.ts";

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

const sm = (matchId: string, drama: number, hs = 1, as = 1, compId = "c1", kickoff = "2026-11-05T19:00:00Z") => ({ matchId, compId, home: `H${matchId}`, away: `A${matchId}`, competition: "League", kickoff, homeScore: hs, awayScore: as, drama });

describe("ranking a night (pure)", () => {
  it("ties share a rank, the best can be caught by a tie, and unranked picks stay null", () => {
    const r = rankNight("2026-11-05", 9, [sm("a", 60), sm("b", 87, 3, 2), sm("c", 87, 2, 2), sm("d", 30)], [
      { match_id: "c", arm: "control", home: "Hc", away: "Ac" },
      { match_id: "d", arm: "memory", home: "Hd", away: "Ad" },
      { match_id: "x", arm: "memory", home: "Hx", away: "Ax" },
    ]);
    expect(r.scored).toBe(4);
    // b (3–2) would win the goals tie-break, but the pick c is level on drama, so c is the best that gets named:
    // "Best: X, one of my picks" must always be about a match that was picked.
    expect(r.best?.matchId).toBe("c");
    expect(r.tiedBest?.map((m) => m.matchId)).toEqual(["b"]);
    expect(r.picks.map((p) => p.rank)).toEqual([1, 4, null]);
    expect(r.caughtBest).toBe(true);
    expect(r.top3).toBe(1);
    expect(nightMemory(r, "19:00 to 00:00")).toContain("Best: Hc 2–2 Ac (League), drama 87, one of my picks, joint best with Hb 3–2 Ab (League). My picks ranked #1 and #4 (1 had no result in the feed).");
    expect(nightLine(r, null, false)).toBe("🏆 Last night's best in your window was one of your picks: <b>Hc v Ac</b> · drama 87 (joint best)");
  });

  it("a tie on top with no pick in it keeps the goals tie-break and says it was joint", () => {
    const r = rankNight("2026-11-05", 9, [sm("b", 87, 3, 2), sm("c", 87, 2, 2), sm("e", 87, 1, 1), sm("d", 30)], [{ match_id: "d", arm: "memory", home: "Hd", away: "Ad" }]);
    expect(r.best?.matchId).toBe("b");
    expect(r.caughtBest).toBe(false);
    expect(nightMemory(r, "19:00 to 00:00")).toContain("Best: Hb 3–2 Ab (League), drama 87, not one of my picks, joint best with 2 other matches. My picks ranked #4.");
    expect(nightLine(r, null, false)).toBe("📼 Last night's best in your window: <b>Hb v Ab</b> · drama 87 (joint best). Not one of your picks; worth the highlights.");
    expect(rankNight("2026-11-05", 2, [sm("a", 50), sm("b", 40)], []).tiedBest).toBeUndefined();
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

  it("keeps a picked futsal match in the ranking (9 Nov: one of only three in the window)", () => {
    const futsal = { matchId: "400022498", competition: "Youth Olympic Futsal Tournaments - Men" };
    expect(L.night.keepForNight(futsal, new Set(["400022498"]))).toBe(true);
    expect(L.night.keepForNight(futsal, new Set(["other"]))).toBe(false);
    expect(L.night.keepForNight({ matchId: "x", competition: "NPFL" }, new Set())).toBe(true);
  });

  it("lessons name signals in words people use", () => {
    expect(L.tick.labelFor("signal:tense")).toBe("tight games");
    expect(L.tick.labelFor("signal:late-goals")).toBe("late drama");
    expect(L.tick.labelFor("kick:evening")).toBe("evening kick-offs");
  });
});

describe("league form (pure)", () => {
  // Night average: (90 + 80 + 70 + 24 + 66) / 5 = 66.
  const night = [
    { compId: "isl", competition: "Indian Super League", drama: 90 },
    { compId: "caf", competition: "CAF Women's Champions League", drama: 80 },
    { compId: "caf", competition: "CAF Women's Champions League", drama: 70 },
    { compId: "cup", competition: "Cup", drama: 24 },
    { compId: "flat", competition: "Flat League", drama: 66 },
  ];

  it("scores each competition against the night's average, shrunk for small samples", () => {
    const f = leagueForm(night)!;
    expect(f.mean).toBe(66);
    expect(f.entries.map((e) => [e.compId, e.value])).toEqual([
      ["cup", -0.5], // (24 - 66) / 40 clamps to -1, and one match counts half
      ["isl", 0.3], // (90 - 66) / 40 = 0.6, halved
      ["caf", 0.15], // (75 - 66) / 40 = 0.225, two matches count two thirds
    ]); // "flat" sat on the average, so it says nothing
    expect(leagueForm(night.slice(0, 2))).toBeNull(); // two matches say nothing about leagues
  });

  it("writes cal tags the taste model reads back, with decay, and never as a verdict", () => {
    const text = formMemory("2026-11-05", "19:00 to 00:00", leagueForm(night))!;
    expect(text).toBe(
      "[form] 2026-11-05 · League form in my 19:00 to 00:00 window, from 5 finished matches averaging drama 66: Cup 24 (below); Indian Super League 90 (above); CAF Women's Champions League 75 (above, 2 matches). tags: kind=form cal=cup:-0.50 cal=isl:+0.30 cal=caf:+0.15",
    );
    const m = parseMemory("blob-form", text);
    expect(m.verdict).toBe(0);
    expect(m.cals).toEqual([{ key: "cal:cup", value: -0.5 }, { key: "cal:isl", value: 0.3 }, { key: "cal:caf", value: 0.15 }]);
    const fresh = buildTaste([m], "2026-11-05").weights.get("cal:isl")!;
    const old = buildTaste([m], "2026-11-26").weights.get("cal:isl")!; // 21 days later: half the evidence
    expect(fresh.w).toBeCloseTo(Math.tanh(0.3 / 1.5), 3);
    expect(old.w).toBeCloseTo(Math.tanh((0.3 * 0.5) / 1.5), 3);
    expect(fresh.blobs[0].blobId).toBe("blob-form");
    expect(formMemory("2026-11-05", "19:00 to 00:00", null)).toBeNull();
  });

  it("moves only the memory-on score, by at most FORM_POINTS, and explains itself with the night report", () => {
    const f = { matchId: "m1", compId: "isl", seasonId: "s", stageId: "st", competition: "Indian Super League", stage: null, kickoff: "2026-11-06T14:00:00Z", home: "Mohun Bagan", away: "Bengaluru", homeId: null, awayId: null, country: null, homeScore: null, awayScore: null, status: 1 };
    const taste = buildTaste([parseMemory("blob-form", "[form] 2026-11-05 · League form. tags: kind=form cal=isl:+1.00")], "2026-11-05");
    const [withForm] = scoreCandidates([f], new Map(), taste, "Asia/Ho_Chi_Minh", new Date("2026-11-06T17:00:00Z"));
    const [without] = scoreCandidates([f], new Map(), null, "Asia/Ho_Chi_Minh", new Date("2026-11-06T17:00:00Z"));
    expect(withForm.base).toBe(without.base); // the memory-off arm never sees league form
    expect(withForm.mem - withForm.base).toBeGreaterThan(0);
    expect(withForm.mem - withForm.base).toBeLessThanOrEqual(FORM_POINTS);
    const why = explain(withForm, taste, "memory");
    expect(why.memoryReasons.join(" ")).toMatch(/Indian Super League has been more dramatic than the rest of your evenings lately \(1 night report\)\./);
    expect(why.cites.map((c) => c.blobId)).toContain("blob-form");
    expect(explain(withForm, taste, "control").cites).toEqual([]);
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
    expect(jobs[0].text).toMatch(new RegExp(`^\\[night\\] ${D} · Night report for my 19:00 to 02:00 window: 3 of 4 matches finished with full data\\. Best: Northbridge 3–2 Eastvale \\(Premier League \\(XYZ\\)\\), drama \\d+, one of my picks\\. My picks ranked #1 and #3 \\(1 had no result in the feed\\)\\.`));
    expect(jobs[0].text).not.toMatch(/control|memory off|memory-off/i);
    // League form from the same night: Premier League's one match (drama 100) against a night averaging 54 is +0.50
    // after shrinkage; Ligue 1's two (11 and 52) sit below it.
    expect(r.form.entries.map((e: any) => e.compId)).toEqual([EPL.compId, L1.compId]);
    const forms = await L.db.q(`select text from memory_jobs where user_id = $1 and kind = 'form'`, [UID]);
    expect(forms).toHaveLength(1);
    expect(forms[0].text).toMatch(new RegExp(`^\\[form\\] ${D} · League form in my 19:00 to 02:00 window, from 3 finished matches averaging drama 54: Premier League \\(XYZ\\) 100 \\(above\\); Ligue 1 \\(XYZ\\) 32 \\(below, 2 matches\\)\\. tags: kind=form cal=${EPL.compId}:\\+0\\.50 cal=${L1.compId}:-0\\.38$`));

    await L.memory.processMemoryQueue(10);
    await L.memory.processMemoryQueue(10);
    const stored = await L.db.q(`select kind, status from memory_jobs where user_id = $1 and kind in ('night','form') order by kind`, [UID]);
    expect(stored).toEqual([{ kind: "form", status: "stored" }, { kind: "night", status: "stored" }]);
  });

  it("adds league form to nights reported before it existed, once", async () => {
    await L.db.q(`update nights set report = report - 'form' where user_id = $1`, [UID]);
    const [kept] = await L.db.q(`select id from memory_jobs where user_id = $1 and kind = 'form'`, [UID]);
    await L.db.q(`update memory_jobs set idem_key = idem_key || ':old' where id = $1`, [kept.id]); // as if it never had one
    expect(await L.night.runNights(at(31))).toBe(1);
    expect(await L.night.runNights(at(32))).toBe(0);
    const [row] = await L.db.q(`select report from nights where user_id = $1`, [UID]);
    expect(row.report.form.entries).toHaveLength(2);
    expect(row.report.best.matchId).toBe(ids.wild); // the rest of the report is untouched
    const fresh = await L.db.q(`select id from memory_jobs where user_id = $1 and kind = 'form' and idem_key not like '%:old'`, [UID]);
    expect(fresh).toHaveLength(1);
    await L.db.q(`delete from memory_jobs where id = $1`, [fresh[0].id]); // keep one form memory for what follows
    await L.db.q(`update memory_jobs set idem_key = replace(idem_key, ':old', '') where id = $1`, [kept.id]);
  });

  it("a night report never moves the taste weights", async () => {
    const { parseMemory, buildTaste } = await import("../lib/taste.ts");
    const [job] = await L.db.q(`select text from memory_jobs where user_id = $1 and kind = 'night'`, [UID]);
    const t = buildTaste([parseMemory("b1", job.text)], D);
    expect(t.memoriesUsed).toBe(0);
    expect(t.weights.size).toBe(0);
  });

  it("opens the next brief, spoiler-free by default, and the memory-on picks read the league form back from Walrus", async () => {
    const next = world.add({ ...EPL, home: "Westford", away: "Southgate", kickoff: at(24 + 20), status: 1, hs: null, as: null });
    world.add({ ...L1, home: "Plage B", away: "Foret B", kickoff: at(24 + 20.5), status: 1, hs: null, as: null });
    world.add({ compId: "minor-league", comp: "Regional League", home: "Village A", away: "Village B", kickoff: at(24 + 21), status: 1, hs: null, as: null });
    const u = await L.telegram.getUser(UID);
    const m = world.mark();
    const b = await L.telegram.sendBrief(u, at(24 + 18.1));
    const text = world.since(m, "sendMessage").map((c) => c.body.text).join("\n");
    expect(text).toMatch(/🏆 Last night's best in your window was one of your picks: <b>Northbridge v Eastvale<\/b> · drama \d+/);
    expect(text).not.toMatch(/3–2/);
    expect(text).not.toMatch(/—/);
    expect(text).not.toMatch(/\/100/); // a score would point at the memory-off pick (memory picks score with memory)

    const [form] = await L.db.q(`select blob_id from memory_jobs where user_id = $1 and kind = 'form' and status = 'stored'`, [UID]);
    const epl = b.picks.find((p: any) => p.c.f.matchId === next.id);
    expect(epl).toBeTruthy();
    const cal = epl.c.contribs.find((x: any) => x.key === `cal:${EPL.compId}`);
    expect(cal.value).toBeGreaterThan(0);
    expect(epl.arm).toBe("memory"); // top on both scores, and the form only lifts it
    expect(epl.cites.map((c: any) => c.blobId)).toContain(form.blob_id);
    expect(epl.reasons.join(" ")).toMatch(/Premier League( \(XYZ\))? has been more dramatic than the rest of your evenings lately \(1 night report\)/);
    const l1 = b.picks.find((p: any) => p.c.f.compId === L1.compId);
    if (l1) expect(l1.c.contribs.find((x: any) => x.key === `cal:${L1.compId}`).value).toBeLessThan(0);
  });

  it("the brief stores the memory switch, and the dashboard keeps it sealed until that night's picks are answered", async () => {
    const D1 = new Date(Date.parse(`${D}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    const [s] = await L.db.q(`select switch from scans where user_id = $1 and brief_date = $2`, [UID, D1]);
    expect(s.switch.on).toHaveLength(3);
    expect(s.switch.off).toHaveLength(3);
    expect(s.switch.considered).toBe(3);

    let me = await L.views.meView(UID);
    const sealed = me.memorySwitch.find((x: any) => x.date === D1);
    expect(sealed).toMatchObject({ sealed: true, on: [], off: [] }); // nothing in the response that could point at the memory-off pick
    // The picks themselves stay blind on the dashboard too: no score, and only neutral reasons up front.
    const blind = [...me.today, ...me.history].filter((p: any) => p.briefDate === D1);
    expect(blind).toHaveLength(3);
    for (const p of blind) {
      expect(p.arm).toBeNull();
      expect(p.score).toBeNull();
      expect(p.reasons.length).toBeGreaterThan(0);
      expect(p.reasons.join(" ")).not.toMatch(/memor|enjoyed|more dramatic than|suits when you/i);
    }
    // The lock carries the brief's message, so the tick can reply with the blob and Sui's certification time.
    const [lock] = await L.db.q(`select notify_chat, notify_message from memory_jobs where idem_key = $1`, [`mf:brief:${UID}:${D1}`]);
    expect(Number(lock.notify_chat)).toBe(UID);
    expect(Number(lock.notify_message)).toBeGreaterThan(0);

    await L.db.q(`update picks set rating = 'fine', rated_at = now() where user_id = $1 and brief_date = $2`, [UID, D1]);
    me = await L.views.meView(UID);
    const open = me.memorySwitch.find((x: any) => x.date === D1);
    expect(open.sealed).toBe(false);
    for (const p of [...me.today, ...me.history].filter((x: any) => x.briefDate === D1)) expect(typeof p.score).toBe("number"); // rated: the score shows
    const picked = new Set((await L.db.q(`select match_id from picks where user_id = $1 and brief_date = $2`, [UID, D1])).map((r: any) => r.match_id));
    const rows = [...open.on, ...open.off];
    for (const r of rows) expect(r.picked).toBe(picked.has(r.matchId));
    // Memory picks are the top two with memory and the control is the best memory-off match left, so every pick
    // sits in one of the two lists.
    for (const id of picked) expect(rows.some((r: any) => r.matchId === id)).toBe(true);
    const { switchLine } = await import("../lib/lock.ts");
    expect(await switchLine(UID, D1)).toMatch(/^🧠 Memory switch: with memory off, tonight's top three would have/);
    await L.db.q(`delete from kv where k like 'view:stats%'`);
    const st = (await L.views.statsView()).switch;
    expect(st).toMatchObject({ briefs: 1, changed: s.switch.changed, slots: 3 }); // counts only, never the lists
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
