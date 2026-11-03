import { describe, expect, it, beforeAll } from "vitest";

beforeAll(() => {
  process.env.APP_SECRET ||= "test-secret-for-unit-tests-only";
});

describe("brief locks", () => {
  it("seals the control pick with a commit anyone can recheck once the salt is revealed", async () => {
    const { briefLockText, sealCheck, lockCommit, lockSalt } = await import("../lib/lock.ts");
    const { sha256 } = await import("../lib/util.ts");
    const mk = (slot: number, arm: "memory" | "control", id: string, home: string) => ({
      id: `p${slot}`, slot, arm, reasons: [], neutral: [], cites: [], score: 70,
      c: { f: { matchId: id, home, away: "Away FC", kickoff: "2026-11-04T13:15:00Z" } } as any,
    });
    const b = { briefDate: "2026-11-04", picks: [mk(2, "control", "m-ctrl", "Beta"), mk(1, "memory", "m-a", "Alpha"), mk(3, "memory", "m-b", "Gamma")], considered: 100, recallOk: true, memoriesUsed: 3, recallMs: 1 } as any;
    const text = briefLockText({ id: 42, tz: "Asia/Ho_Chi_Minh" } as any, b)!;
    expect(text).toMatch(/^\[brief\] 2026-11-04 · Tonight's picks, locked before kick-off: Alpha v Away FC/);
    expect(text).not.toMatch(/control=|m-ctrl/); // the arm is not readable from the memory itself
    const commit = lockCommit("2026-11-04", "m-ctrl", lockSalt(42, "2026-11-04"));
    expect(text).toContain(`commit ${commit}`);
    const s = sealCheck(42, "2026-11-04", "m-ctrl");
    expect(sha256(`2026-11-04|control=m-ctrl|${s.salt}`).slice(0, 16)).toBe(s.commit);
    expect(sealCheck(42, "2026-11-04", "m-a").commit).not.toBe(commit);
  });

  it("brief memories carry no taste weight", async () => {
    const { parseMemory, buildTaste } = await import("../lib/taste.ts");
    const m = parseMemory("b1", "[brief] 2026-11-04 · Tonight's picks, locked before kick-off: A v B (19:15). tags: kind=brief");
    expect(m.kind).toBe("brief");
    expect(buildTaste([m], "2026-11-04").memoriesUsed).toBe(0);
  });
});

describe("single-purpose keys", () => {
  it("a card key opens the card and nothing else", async () => {
    const { purposeKey, verifyPurposeKey, verifyUserToken } = await import("../lib/auth.ts");
    const k = purposeKey("card", 6797476867);
    expect(verifyPurposeKey("card", k)).toBe(6797476867);
    expect(verifyPurposeKey("card", `${k}.png`)).toBe(6797476867);
    expect(verifyPurposeKey("cal", k)).toBeNull();
    expect(verifyUserToken(k)).toBeNull();
    expect(verifyPurposeKey("card", k.slice(0, -1) + (k.endsWith("A") ? "B" : "A"))).toBeNull();
  });
});

describe("feed coverage", () => {
  it("down-weights competitions the feed never settles, leaves unknown ones alone", async () => {
    const { coverageFactor } = await import("../lib/coverage.ts");
    const cov = new Map([["covered", { n: 10, done: 10 }], ["never", { n: 10, done: 0 }], ["patchy", { n: 10, done: 5 }], ["thin", { n: 2, done: 0 }]]);
    expect(coverageFactor(cov, "covered")).toBe(1);
    expect(coverageFactor(cov, "never")).toBe(0.7);
    expect(coverageFactor(cov, "patchy")).toBe(0.88);
    expect(coverageFactor(cov, "thin")).toBe(1);
    expect(coverageFactor(cov, "unknown")).toBe(1);
    expect(coverageFactor(null, "x")).toBe(1);
  });
  it("asks without a score when the feed has no result", async () => {
    const { askText, resultText } = await import("../lib/telegram.ts");
    const p = { home: "Port", away: "Beijing Guoan", competition: "AFC Champions League Elite", home_score: null, away_score: null, drama: null };
    expect(askText(p)).toMatch(/no result for this competition/);
    expect(resultText(p)).not.toMatch(/\?/);
    expect(resultText({ ...p, home_score: 2, away_score: 1 })).toMatch(/Port 2–1 Beijing Guoan/);
  });
});

describe("public feed lines", () => {
  it("rating memories become short, spoiler-free lines; old lessons lose their raw numbers", async () => {
    process.env.APP_SECRET ||= "x";
    const { feedItem } = await import("../lib/views.ts");
    const r = feedItem("[rating] 2026-11-03 · Loved Northbridge 3–2 Eastvale (Premier League · Matchday 9); kicked off 21:00 my time. Drama 92/100: 5 goals. tags: verdict=1.00");
    expect(r).toMatchObject({ kind: "rating", verdict: "loved", headline: "Loved Northbridge v Eastvale", detail: "Premier League · drama 92" });
    expect(JSON.stringify({ h: r.headline, d: r.detail })).not.toMatch(/3–2/);
    const f = feedItem("[rating] 2026-11-03 · Watched (fine) Công An Hà Nội v Kyoto Sanga (AFC Champions League Elite · League Stage); kicked off 19:15 my time. tags: verdict=0.35");
    expect(f.headline).toBe("Fine Công An Hà Nội v Kyoto Sanga");
    const l = feedItem("[lesson] 2026-11-03 · After 3 memories: strongest pulls are AFC Champions League Elite (+0.72) and evening kick-offs (+0.72). Memory picks average 2.00 vs 1.00 for memory-off picks (n=1/1; loved=2, fine=1, bailed=0).");
    expect(l.kind).toBe("lesson");
    expect(l.detail).toBe("After 3 memories: leans towards AFC Champions League Elite and evening kick-offs. Memory picks rate 2.0 vs 1.0 for memory-off picks.");
  });
});
