// End-to-end run of the whole bot against a fake football world, a fake Telegram and the SDK's in-memory
// MemWalMock, on a throwaway PGlite database. Nothing touches mainnet, the real bot or the real database.
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createWorld, type FakeMatch } from "./helpers/fakeWorld.ts";

const dir = mkdtempSync(path.join(tmpdir(), "pundit-e2e-"));
Object.assign(process.env, {
  PGLITE_DIR: dir,
  APP_SECRET: "e2e-secret",
  TELEGRAM_BOT_TOKEN: "123456:e2e-fake-token",
  TELEGRAM_WEBHOOK_SECRET: "hook",
  CRON_SECRET: "cron",
  APP_URL: "https://pundit.test",
  MEMWAL_PUBLIC_KEY: "ab".repeat(32),
  MEMWAL_ACCOUNT_ID: "0x" + "1".repeat(64),
});
delete process.env.DATABASE_URL;
delete process.env.POSTGRES_URL;
delete process.env.VERCEL;

const world = createWorld();
const realFetch = globalThis.fetch;
const U = { id: 424242, first_name: "Test", last_name: "Viewer", username: "test_viewer" };
const TZ = "Asia/Ho_Chi_Minh";
const H = 3600_000;

let L: any; // lazily imported modules
let upd = 0;
const msg = (text: string) => ({ update_id: ++upd, message: { message_id: upd, chat: { id: U.id, type: "private" }, from: U, text } });
const cb = (data: string, messageId = 999) => ({ update_id: ++upd, callback_query: { id: `cb${upd}`, from: U, data, message: { message_id: messageId, chat: { id: U.id } } } });

const EPL = { compId: "2000000000", comp: "Premier League" };
const LIGA = { compId: "2000000037", comp: "Primera División" };
const L1 = { compId: "2000000018", comp: "Ligue 1" };
const MINOR = { compId: "minor-league", comp: "Regional League" };

function seedHistory(now: number) {
  // Last week: Premier League and Ligue 1 get results in the feed; Primera División never does.
  for (let d = 1; d <= 5; d++) {
    const k = new Date(now - d * 24 * H - 2 * H);
    world.add({ ...EPL, home: `Old Town ${d}`, away: `Harbour ${d}`, kickoff: k, status: 0, hs: 2, as: 1 });
    world.add({ ...L1, home: `Rive ${d}`, away: `Colline ${d}`, kickoff: k, status: 0, hs: 1, as: 1 });
    world.add({ ...LIGA, home: `Sierra ${d}`, away: `Costa ${d}`, kickoff: k, status: 1, hs: null, as: null });
  }
}

/** Fixtures inside today's watch window (window "any time in the next 24h" = local 12:00 to 12:00 tomorrow). */
function seedTonight(base: number): FakeMatch[] {
  return [
    world.add({ ...EPL, home: "Northbridge", away: "Eastvale", kickoff: new Date(base + 2 * H), status: 1, hs: null, as: null }),
    world.add({ ...LIGA, home: "Sierra Alta", away: "Costa Azul", kickoff: new Date(base + 3 * H), status: 1, hs: null, as: null }),
    world.add({ ...L1, home: "Rive Gauche", away: "Mont Blanc", kickoff: new Date(base + 4 * H), status: 1, hs: null, as: null }),
    world.add({ ...MINOR, home: "Village A", away: "Village B", kickoff: new Date(base + 2.5 * H), status: 1, hs: null, as: null }),
    world.add({ ...MINOR, home: "Village C", away: "Village D", kickoff: new Date(base + 5 * H), status: 1, hs: null, as: null }),
  ];
}

beforeAll(async () => {
  globalThis.fetch = world.fakeFetch as any;
  const [memory, telegram, tick, picker, util, db, extras2, views, lock, auth, extras] = await Promise.all([
    import("../lib/memory.ts"),
    import("../lib/telegram.ts"),
    import("../lib/tick.ts"),
    import("../lib/picker.ts"),
    import("../lib/util.ts"),
    import("../lib/db.ts"),
    import("../lib/extras2.ts"),
    import("../lib/views.ts"),
    import("../lib/lock.ts"),
    import("../lib/auth.ts"),
    import("../lib/extras.ts"),
  ]);
  // @ts-ignore: the mock ships in the SDK's dist but isn't in its exports map
  const { MemWalMock } = await import("../node_modules/@mysten-incubation/memwal/dist/mock.js");
  memory.useMemWalClient(MemWalMock.create());
  L = { memory, telegram, tick, picker, util, db, extras2, views, lock, auth, extras };
  // No chain in tests: pre-seed the proof cache so views never dial Tatum.
  await db.cacheSet("proof:chainblobs", { owner: null, blobs: [] }, 86_400);
  seedHistory(Date.now());
}, 60_000);

afterAll(() => {
  globalThis.fetch = realFetch;
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {}
});

const picksOf = () => L.db.q(`select * from picks where user_id = $1 order by slot`, [U.id]);
const jobsOf = (kind?: string) => L.db.q(`select * from memory_jobs where user_id = $1 ${kind ? "and kind = $2" : ""} order by id`, kind ? [U.id, kind] : [U.id]);
const settleQueue = async () => {
  await L.memory.processMemoryQueue(20);
  return L.memory.processMemoryQueue(20); // second pass settles the bulk status
};
const lastText = (m: number) => world.texts(m);

let tonight: FakeMatch[] = [];

describe("a viewer's first evening, end to end", () => {
  it("onboards in four taps and gets three blind picks, locked before kick-off", async () => {
    const lp = L.util.localParts(new Date(), TZ);
    const winStart = L.util.localToUtc(lp.date, 12, TZ).getTime();
    tonight = seedTonight(Math.max(Date.now(), winStart));

    let m = world.mark();
    await L.telegram.handleUpdate(msg("/start"));
    expect(lastText(m)).toMatch(/I'm Pocket Pundit/);
    expect(lastText(m)).not.toMatch(/—/);

    await L.telegram.handleUpdate(cb(`tz:${TZ}`));
    await L.telegram.handleUpdate(cb("bh:18"));
    await L.telegram.handleUpdate(cb("win:12-36"));
    await L.telegram.handleUpdate(cb(`lg:${EPL.compId}`));
    m = world.mark();
    await L.telegram.handleUpdate(cb("lg:done"));

    const brief = world.since(m, "sendMessage").map((c) => c.body.text).find((t: string) => /Tonight's picks/.test(t));
    expect(brief).toBeTruthy();
    expect(brief).toMatch(/🔒 Locked on Walrus before kick-off/);
    expect(brief).not.toMatch(/memory-off pick|control/i); // blind: no arm in the brief
    const picks = await picksOf();
    expect(picks).toHaveLength(3);
    expect(picks.filter((p: any) => p.arm === "memory")).toHaveLength(2);
    expect(picks.filter((p: any) => p.arm === "control")).toHaveLength(1);
    expect(picks.map((p: any) => p.competition).join(" ")).not.toMatch(/futsal/i);

    const [lockJob] = await jobsOf("brief");
    expect(lockJob.text).toMatch(/^\[brief\] .* locked before kick-off: .* Memory-off pick sealed: commit [0-9a-f]{16}\. tags: kind=brief$/);
    const control = picks.find((p: any) => p.arm === "control");
    expect(lockJob.text).not.toContain(control.match_id);
    expect((await jobsOf("preference")).length).toBe(1); // "I follow Premier League"
  });

  it("writes the queue to Walrus (mock) and stores every job", async () => {
    await settleQueue();
    const jobs = await jobsOf();
    expect(jobs.every((j: any) => j.status === "stored" && j.blob_id)).toBe(true);
  });

  it("reminds about 20-35 minutes before kick-off", async () => {
    const [p] = await picksOf();
    await L.db.q(`update picks set kickoff = now() + interval '25 minutes' where id = $1`, [p.id]);
    const m = world.mark();
    await L.tick.tick();
    expect(lastText(m)).toMatch(/⏰ Kicks off in 2\d min/);
    const again = world.mark();
    await L.tick.tick();
    expect(lastText(again)).not.toMatch(/⏰/); // only once
  });

  it("pings 'worth switching on' for a tight, late game, hides the score, and learns from the answer", async () => {
    const live = world.add({ ...EPL, home: "Lakeside", away: "Hillcrest", kickoff: new Date(Date.now() - 80 * 60_000), status: 3, hs: 1, as: 1, minute: 74 });
    await L.db.q(`delete from kv where k like 'feed:live:%'`);
    const m = world.mark();
    await L.tick.tick();
    const alert = world.since(m, "sendMessage").find((c) => /Worth switching on/.test(c.body.text));
    expect(alert).toBeTruthy();
    expect(alert!.body.text).toMatch(/Score hidden/);
    expect(alert!.body.text).not.toMatch(/1–1/);
    await L.telegram.handleUpdate(cb(`al:${live.id}:y`));
    const alertMem = (await jobsOf("preference")).find((j: any) => /^\[alert\]/.test(j.text));
    expect(alertMem.text).toMatch(/Switched on for Lakeside v Hillcrest .* verdict=0.60/);
    live.status = 0;
  });

  it("asks after full time without spoiling the score, and asks even when the feed has no result", async () => {
    const picks = await picksOf();
    for (const p of picks) await L.db.q(`update picks set kickoff = now() - interval '3 hours' where id = $1`, [p.id]);
    // Pretend the lock landed before kick-off.
    await L.db.q(`update memory_jobs set updated_at = now() - interval '4 hours' where kind = 'brief' and user_id = $1`, [U.id]);
    for (const p of picks) {
      const f = world.matches.get(p.match_id)!;
      if (f.compId === LIGA.compId) continue; // the feed never settles this competition
      f.status = 0;
      f.hs = 3;
      f.as = 2;
      f.events = [
        { type: 0, minute: 12, hg: 1, ag: 0 },
        { type: 0, minute: 30, hg: 1, ag: 1 },
        { type: 0, minute: 58, hg: 1, ag: 2 },
        { type: 0, minute: 81, hg: 2, ag: 2 },
        { type: 0, minute: 90, hg: 3, ag: 2 },
        { type: 2, minute: 66 },
      ];
    }
    const m = world.mark();
    await L.tick.tick();
    const asks = world.since(m, "sendMessage").filter((c) => /Full time/.test(c.body.text));
    const hasLiga = picks.some((p: any) => p.comp_id === LIGA.compId);
    const settledNow = picks.filter((p: any) => p.comp_id !== LIGA.compId).length + (hasLiga ? 1 : 0);
    expect(asks.length).toBe(settledNow);
    for (const a of asks) {
      expect(a.body.text).not.toMatch(/3–2/);
      expect(a.body.reply_markup.inline_keyboard.flat().map((b: any) => b.text)).toEqual(["😍 Loved it", "🙂 Fine", "😴 Bailed", "🙈 Didn't watch"]);
    }
    if (hasLiga) expect(asks.some((a) => /no result for this competition/.test(a.body.text))).toBe(true);
  });

  it("rating reveals the score and the arm, writes a rating memory with what happened, and unseals at the end", async () => {
    const picks = await L.db.q(`select * from picks where user_id = $1 and asked_at is not null order by slot`, [U.id]);
    // Loves the Premier League game, bails on the one the feed can't settle, skips anything else.
    const codeFor = (p: any) => (p.comp_id === EPL.compId ? "l" : p.comp_id === LIGA.compId ? "b" : "s");
    expect(picks.some((p: any) => p.comp_id === EPL.compId)).toBe(true);
    for (let i = 0; i < picks.length; i++) {
      const p = picks[i];
      const m = world.mark();
      await L.telegram.handleUpdate(cb(`r:${p.id}:${codeFor(p)}`, p.ask_message_id));
      const editText = world.since(m, "editMessageText").map((c) => c.body.text).join("\n");
      expect(editText).toMatch(/🔓 <b>Memory(-off)? pick<\/b>/);
      if (p.comp_id !== LIGA.compId) expect(editText).toMatch(/3–2/);
      if (i === picks.length - 1) expect(editText).toMatch(/seal ✓ <code>[0-9a-f]{16}<\/code>/);
      expect(editText).toMatch(/🔒 Locked on Walrus \d+ (h|min) before kick-off/);
    }
    const again = world.mark();
    await L.telegram.handleUpdate(cb(`r:${picks[0].id}:f`, picks[0].ask_message_id));
    expect(world.since(again, "answerCallbackQuery")[0].body.text).toMatch(/Already saved/);

    const ratings = await jobsOf("rating");
    expect(ratings.length).toBe(picks.length);
    const loved = ratings.find((r: any) => /Loved/.test(r.text));
    if (loved && !/no final score/.test(loved.text) && /3–2/.test(loved.text)) {
      expect(loved.text).toMatch(/Drama \d+\/100: 5 goals, 2 after 75', \d lead changes, comeback/);
      expect(loved.text).toMatch(/signal=late-goals/);
    }
    // the seal can be rechecked from what the bot revealed
    const control = picks.find((p: any) => p.arm === "control");
    if (control) {
      const s = L.lock.sealCheck(U.id, control.brief_date, control.match_id);
      expect((await jobsOf("brief"))[0].text).toContain(`commit ${s.commit}`);
    }
  });

  it("confirms each rating once Walrus has stored it", async () => {
    const m = world.mark();
    const r = await settleQueue();
    expect(r.failed).toBe(0);
    await L.tick.tick();
    expect(lastText(m)).toMatch(/✅ stored on Walrus/);
  });

  it("writes a lesson the next day, and day two's memory picks lean on what was loved", async () => {
    const tomorrowNoon = (() => {
      const lp = L.util.localParts(new Date(Date.now() + 24 * H), TZ);
      return L.util.localToUtc(lp.date, 13, TZ);
    })();
    await L.tick.tick(tomorrowNoon);
    const [lesson] = await jobsOf("lesson");
    expect(lesson?.text).toMatch(/^\[lesson\] .*After \d+ memories/);

    // Day two: new fixtures tomorrow, recall from the mock store, memory arm uses the taste.
    await settleQueue();
    const day2 = L.util.localToUtc(L.util.localParts(tomorrowNoon, TZ).date, 12, TZ).getTime();
    world.add({ ...EPL, home: "Westford", away: "Southgate", kickoff: new Date(day2 + 8 * H), status: 1, hs: null, as: null });
    world.add({ ...LIGA, home: "Norte", away: "Sur", kickoff: new Date(day2 + 8 * H), status: 1, hs: null, as: null });
    world.add({ ...MINOR, home: "Village E", away: "Village F", kickoff: new Date(day2 + 9 * H), status: 1, hs: null, as: null });
    world.add({ ...L1, home: "Plage", away: "Foret", kickoff: new Date(day2 + 10 * H), status: 1, hs: null, as: null });
    await L.db.q("delete from kv where k like 'feed:cal:%'");
    const u = await L.telegram.getUser(U.id);
    const at = new Date(L.util.localToUtc(L.util.localParts(tomorrowNoon, TZ).date, 18, TZ).getTime() + 5 * 60_000);
    const b = await L.picker.buildBrief(u, at);
    const mem = b.picks.filter((p: any) => p.arm === "memory");
    expect(b.memoriesUsed).toBeGreaterThan(0);
    expect(mem.some((p: any) => p.cites.length > 0)).toBe(true);
    const contribKeys = mem.flatMap((p: any) => p.c.contribs.map((x: any) => x.key));
    expect(contribKeys).toContain(`comp:${EPL.compId}`);
    // Coverage: the competition the feed never settles is down-weighted for both arms.
    const liga = b.picks.find((p: any) => p.c.f.compId === LIGA.compId);
    if (liga) expect(liga.arm).toBe("control");
  });
});

describe("commands", () => {
  it("/ask answers from the viewer's own memory with blob links", async () => {
    const m = world.mark();
    await L.telegram.handleUpdate(msg("/ask which leagues do I enjoy?"));
    const t = lastText(m);
    expect(t).toMatch(/From your memory on Walrus/);
    expect(t).toMatch(/walruscan\.com\/mainnet\/blob\//);
  });

  it("/card sends a photo of the taste card, /calendar sends a private feed that has every pick with a reminder", async () => {
    let m = world.mark();
    await L.telegram.handleUpdate(msg("/card"));
    const photo = world.since(m, "sendPhoto")[0];
    expect(photo.body.photo).toMatch(/^https:\/\/pundit\.test\/api\/card\/[\w-]+\.[\w-]+\?v=/);
    const key = photo.body.photo.split("/api/card/")[1].split("?")[0];
    expect(L.auth.verifyPurposeKey("card", key)).toBe(U.id);
    const card = await L.extras2.cardData(U.id);
    expect(card.memories).toBeGreaterThan(3);

    m = world.mark();
    await L.telegram.handleUpdate(msg("/calendar"));
    expect(lastText(m)).toMatch(/https:\/\/pundit\.test\/api\/cal\/[\w-]+\.[\w-]+\.ics/);
    const ics = await L.extras2.calendarFeed(U.id, "Pocket Pundit", "https://pundit.test");
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(ics).toMatch(/TRIGGER:-PT20M/);
    expect(ics.split("\r\n").every((l: string) => Buffer.byteLength(l) <= 75)).toBe(true);
  });

  it("/teach and plain messages become preference or limit memories, with secrets removed", async () => {
    let m = world.mark();
    await L.telegram.handleUpdate(msg("/teach I love late comebacks"));
    expect(lastText(m)).toMatch(/Noted/);
    await L.telegram.handleUpdate(msg("no matches after 2am on weekdays please"));
    await L.telegram.handleUpdate(msg("Primera División games are boring"));
    m = world.mark();
    await L.telegram.handleUpdate(msg("/teach remember my key sk-abcdefghijklmnopqrstuvwxyz123456"));
    expect(lastText(m)).toMatch(/removed something that looked like a secret/);
    const prefs = (await jobsOf()).map((j: any) => j.text);
    expect(prefs.some((t: string) => /late comebacks.*verdict=0.80.*signal=late-goals.*signal=comeback/.test(t) || /late comebacks.*verdict=0.80/.test(t))).toBe(true);
    expect((await jobsOf("limit")).length).toBe(1);
    expect(prefs.some((t: string) => /boring.*verdict=-0.80.*comp=2000000037/.test(t))).toBe(true);
    expect(prefs.some((t: string) => /sk-abcdef/.test(t))).toBe(false);
  });

  it("settings, spoilers and alerts switches behave", async () => {
    let m = world.mark();
    await L.telegram.handleUpdate(msg("/tz Mars/Olympus"));
    expect(lastText(m)).toMatch(/isn't a time zone I know/);
    await L.telegram.handleUpdate(msg("/spoilers on"));
    await L.telegram.handleUpdate(msg("/alerts off"));
    const u = await L.db.one(`select show_scores, alerts from users where id = $1`, [U.id]);
    expect(u).toMatchObject({ show_scores: true, alerts: false });
    m = world.mark();
    await L.telegram.handleUpdate(msg("/settings"));
    expect(lastText(m)).toMatch(/Watch window: 12:00 to 12:00/);
    m = world.mark();
    await L.telegram.handleUpdate(msg("/whatever"));
    expect(lastText(m)).toMatch(/What I can do/);
    // with alerts off, a tense late game sends nothing
    world.add({ ...EPL, home: "Quiet", away: "Night", kickoff: new Date(Date.now() - 80 * 60_000), status: 3, hs: 0, as: 1, minute: 78 });
    await L.db.q(`delete from kv where k like 'feed:live:%'`);
    m = world.mark();
    await L.tick.tick();
    expect(lastText(m)).not.toMatch(/Worth switching on/);
  });

  it("the dashboard view shows locks, cited memories and A/B counts", async () => {
    const v = await L.views.meView(U.id);
    const all = [...v.today, ...v.history];
    expect(all.length).toBeGreaterThanOrEqual(3);
    expect(v.memories.some((m: any) => m.kind === "brief")).toBe(true);
    expect(v.ab.memory.n + v.ab.control.n).toBe(3);
    expect(v.taste.competitions.some((c: any) => c.key === `comp:${EPL.compId}` && c.weight > 0)).toBe(true);
  });

  it("no em dashes anywhere the bot spoke", () => {
    const all = world.tg.map((c) => String(c.body.text ?? c.body.caption ?? "")).join("\n");
    expect(all).not.toMatch(/—/);
  });
});

describe("watch together and taste passport", () => {
  const F = { id: 515151, first_name: "Friend", username: "friend_viewer" };
  const fmsg = (text: string) => ({ update_id: ++upd, message: { message_id: upd, chat: { id: F.id, type: "private" }, from: F, text } });
  const fcb = (data: string) => ({ update_id: ++upd, callback_query: { id: `cb${upd}`, from: F, data, message: { message_id: 1, chat: { id: F.id } } } });

  it("/duo gives an invite link; a friend who joins through it is paired after setup and both are told", async () => {
    let m = world.mark();
    await L.telegram.handleUpdate(msg("/duo"));
    const t = lastText(m);
    const code = /start=(duo_[A-Za-z0-9_-]+)/.exec(t)?.[1];
    expect(code).toBeTruthy();
    m = world.mark();
    await L.telegram.handleUpdate(fmsg(`/start ${code}`));
    expect(lastText(m)).toMatch(/Test invited you to watch together/);
    await L.telegram.handleUpdate(fcb(`tz:${TZ}`));
    await L.telegram.handleUpdate(fcb("bh:18"));
    await L.telegram.handleUpdate(fcb("win:12-36"));
    m = world.mark();
    await L.telegram.handleUpdate(fcb("lg:done"));
    const told = world.since(m, "sendMessage").map((c) => `${c.body.chat_id}: ${c.body.text}`).join("\n");
    expect(told).toMatch(new RegExp(`${U.id}: 👥 Friend joined`));
    expect(told).toMatch(new RegExp(`${F.id}: 👥 You and Test are paired`));
    const rows = await L.db.q(`select id, duo_partner from users where id in ($1, $2) order by id`, [U.id, F.id]);
    expect(rows.map((r: any) => Number(r.duo_partner))).toEqual([F.id, U.id]);
  });

  it("a forged or self invite does nothing", async () => {
    const { parseDuoCode, duoCode } = await import("../lib/duo.ts");
    expect(parseDuoCode(duoCode(U.id))).toBe(U.id);
    expect(parseDuoCode(duoCode(U.id).slice(0, -1) + "Z")).toBeNull();
    expect(parseDuoCode("duo_abc")).toBeNull();
  });

  it("the shared pick sits inside both windows and both tastes; /duo off ends it for both", async () => {
    const lp = L.util.localParts(new Date(Date.now() + 2 * 24 * H), TZ);
    const day3 = L.util.localToUtc(lp.date, 12, TZ).getTime();
    world.add({ ...EPL, home: "Duo Home", away: "Duo Away", kickoff: new Date(day3 + 8 * H), status: 1, hs: null, as: null });
    world.add({ ...MINOR, home: "Hamlet A", away: "Hamlet B", kickoff: new Date(day3 + 9 * H), status: 1, hs: null, as: null });
    await L.db.q("delete from kv where k like 'feed:cal:%'"); // earlier steps may have cached these windows empty
    const u = await L.telegram.getUser(U.id);
    const at = new Date(L.util.localToUtc(lp.date, 18, TZ).getTime() + 5 * 60_000);
    const { duoPick } = await import("../lib/duo.ts");
    const d = await duoPick(u, at);
    expect(d).toBeTruthy();
    expect(d!.partnerName).toBe("Friend");
    expect(`${d!.home} v ${d!.away}`).toBe("Duo Home v Duo Away"); // the Premier League game both lean to
    const brief = L.telegram.briefText(u, { briefDate: lp.date, picks: [], considered: 0, recallOk: true, memoriesUsed: 1, recallMs: 1 }, 3, null, d);
    expect(brief).toMatch(/👥 Watch together with Friend: <b>Duo Home v Duo Away<\/b>/);
    const m = world.mark();
    await L.telegram.handleUpdate(msg("/duo off"));
    expect(lastText(m)).toMatch(/Pairing ended/);
    expect(lastText(m)).toMatch(/ended your watch-together pairing/);
    const rows = await L.db.q(`select duo_partner from users where id in ($1, $2)`, [U.id, F.id]);
    expect(rows.every((r: any) => r.duo_partner === null)).toBe(true);
  });

  it("/export links a taste passport with every stored memory and its blob", async () => {
    const m = world.mark();
    await L.telegram.handleUpdate(msg("/export"));
    const btn = world.since(m, "sendMessage")[0].body.reply_markup.inline_keyboard[0][0];
    expect(btn.url).toMatch(/^https:\/\/pundit\.test\/api\/me\/export\?t=/);
    await settleQueue();
    const { tastePassport, PASSPORT_FORMAT } = await import("../lib/passport.ts");
    const doc = await tastePassport(U.id);
    expect(doc!.format).toBe(PASSPORT_FORMAT);
    expect(doc!.memories.length).toBeGreaterThan(5);
    expect(doc!.memories.every((x: any) => x.blobId && x.walruscan.includes(x.blobId))).toBe(true);
    expect(doc!.taste.competitions.length).toBeGreaterThan(0);
  });
});

describe("own your memory", () => {
  const MINE = "0x" + "c".repeat(64);
  const OWNER = "0x" + "9".repeat(64);

  it("refuses an account without our key, the shared account, or junk", async () => {
    const own = await import("../lib/own.ts");
    own.setOwnershipVerifier(async () => ({ owner: OWNER, active: true, keys: ["00".repeat(32)] }));
    expect((await own.claimAccount(U.id, MINE)).ok).toBe(false);
    expect((await own.claimAccount(U.id, process.env.MEMWAL_ACCOUNT_ID!)).ok).toBe(false);
    expect((await own.claimAccount(U.id, "not-an-id")).ok).toBe(false);
    expect((await L.db.one(`select memwal_account from users where id = $1`, [U.id])).memwal_account).toBeNull();
  });

  it("claims a verified account, copies memories across once, and routes new memories there", async () => {
    const own = await import("../lib/own.ts");
    own.setOwnershipVerifier(async () => ({ owner: OWNER, active: true, keys: ["ab".repeat(32)] }));
    const before = (await L.extras.ledgerTaste(U.id, "2026-11-10")).memoriesUsed;
    const r = await own.claimAccount(U.id, MINE);
    expect(r.ok).toBe(true);
    expect((r as any).copied).toBeGreaterThan(3);
    const again = await own.claimAccount(U.id, MINE);
    expect((again as any).already).toBe(true);
    await settleQueue();
    const copies = await L.db.q(`select count(*)::int n from memory_jobs where user_id = $1 and account_id = $2 and status = 'stored'`, [U.id, MINE]);
    expect(copies[0].n).toBe((r as any).copied);
    expect((await L.extras.ledgerTaste(U.id, "2026-11-10")).memoriesUsed).toBe(before); // no double counting
    await L.telegram.handleUpdate(msg("/teach I love cup upsets"));
    const last = await L.db.one(`select account_id from memory_jobs where user_id = $1 order by id desc limit 1`, [U.id]);
    expect(last.account_id).toBe(MINE);
    const m = world.mark();
    await L.telegram.handleUpdate(msg("/own"));
    expect(lastText(m)).toContain(MINE);
  });

  it("notices when the viewer removes our key and falls back to the shared account", async () => {
    const own = await import("../lib/own.ts");
    own.setOwnershipVerifier(async () => ({ owner: OWNER, active: true, keys: [] }));
    expect(await own.stillOwned(U.id)).toBe("revoked");
    expect((await L.db.one(`select memwal_account from users where id = $1`, [U.id])).memwal_account).toBeNull();
    const taste = await L.extras.ledgerTaste(U.id, "2026-11-10");
    expect(taste.memoriesUsed).toBeGreaterThan(0);
    await L.telegram.handleUpdate(msg("/teach I like derbies"));
    const last = await L.db.one(`select account_id from memory_jobs where user_id = $1 order by id desc limit 1`, [U.id]);
    expect(last.account_id).toBeNull();
  });
});

describe("bot messages stay short", () => {
  it("every message keeps the visible part short and puts detail in a collapsed quote", () => {
    for (const c of world.tg) {
      const t = String(c.body.text ?? "");
      if (!t || c.method === "answerCallbackQuery") continue;
      const visible = t.replace(/<blockquote expandable>[\s\S]*?<\/blockquote>/g, "").replace(/<[^>]+>/g, "");
      expect(visible.length, t.slice(0, 80)).toBeLessThan(700);
      expect(t).not.toMatch(/—/);
    }
  });
});
