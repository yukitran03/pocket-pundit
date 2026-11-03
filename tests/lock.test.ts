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
