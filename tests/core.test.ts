import { describe, expect, it } from "vitest";
import { computeDrama } from "../lib/drama.ts";
import { buildTaste, parseMemory, ratingMemory, preferenceMemory, kickBucket } from "../lib/taste.ts";
import { blobIdToU256, u256ToBlobId, localToUtc, localParts } from "../lib/util.ts";
import { redact } from "../lib/memory.ts";
import type { TimelineEvent } from "../lib/feed.ts";

const goal = (minute: number, h: number, a: number): TimelineEvent => ({ type: 0, minute, homeGoals: h, awayGoals: a, teamId: null });

describe("drama", () => {
  it("scores a late comeback above a goalless draw", () => {
    const comeback = computeDrama([goal(10, 0, 1), goal(55, 1, 1), goal(88, 2, 1)], 2, 1);
    const dull = computeDrama([{ type: 12, minute: 30, homeGoals: 0, awayGoals: 0, teamId: null }], 0, 0);
    expect(comeback.comeback).toBe(true);
    expect(comeback.lateGoals).toBe(1);
    expect(comeback.leadChanges).toBe(1);
    expect(comeback.tags).toContain("late-goals");
    expect(dull.tags).toContain("goalless");
    expect(comeback.score).toBeGreaterThan(dull.score);
  });
  it("counts a lead change through an equaliser (1-0, 1-1, 1-2)", () => {
    const d = computeDrama([goal(5, 1, 0), goal(40, 1, 1), goal(70, 1, 2)], 1, 2);
    expect(d.leadChanges).toBe(1);
  });
  it("falls back to the final score without a timeline", () => {
    const d = computeDrama(null, 3, 2);
    expect(d.goals).toBe(5);
    expect(d.tags).toContain("high-scoring");
  });
});

describe("taste memory round trip", () => {
  const text = ratingMemory({ date: "2026-11-03", rating: "loved", home: "Como", away: "Inter", homeScore: 3, awayScore: 2, competition: "Serie A", compId: "2000000026", stage: null, drama: computeDrama([goal(80, 3, 2)], 3, 2), localKick: "02:45", bucket: "late" });
  it("writes a readable sentence with a parseable tag tail", () => {
    expect(text.startsWith("[rating] 2026-11-03 · Loved Como 3–2 Inter")).toBe(true);
    const p = parseMemory("b1", text);
    expect(p.kind).toBe("rating");
    expect(p.verdict).toBe(1);
    expect(p.keys).toEqual(expect.arrayContaining(["comp:2000000026", "team:como", "team:inter", "signal:late-goals", "kick:late"]));
  });
  it("turns loved and bailed memories into opposite weights, decaying with age", () => {
    const bailed = parseMemory("b2", preferenceMemory("2026-11-03", "No more 0-0s.", ["signal=goalless"], -1));
    const t = buildTaste([parseMemory("b1", text), bailed], "2026-11-04");
    expect(t.weights.get("comp:2000000026")!.w).toBeGreaterThan(0);
    expect(t.weights.get("signal:goalless")!.w).toBeLessThan(0);
    const old = buildTaste([parseMemory("b1", text)], "2027-01-30");
    expect(old.weights.get("comp:2000000026")!.w).toBeLessThan(t.weights.get("comp:2000000026")!.w);
  });
  it("ignores lessons when computing weights", () => {
    const t = buildTaste([parseMemory("l", "[lesson] 2026-11-03 · After 3 memories: strongest pulls are goals.")], "2026-11-03");
    expect(t.memoriesUsed).toBe(0);
  });
});

describe("util", () => {
  it("converts Walrus blob ids between base64url and the on-chain u256", () => {
    const b = "fGjxAgMjJvQl6B2XGricm2AuWn6kjzAy2m0UXZ80VsY";
    const d = "89710256054301686310379095861809634604088404892056884786082150218096784271484";
    expect(blobIdToU256(b)).toBe(d);
    expect(u256ToBlobId(d)).toBe(b);
  });
  it("maps a local watch window that crosses midnight to UTC", () => {
    expect(localToUtc("2026-11-03", 26, "Asia/Ho_Chi_Minh").toISOString()).toBe("2026-11-03T19:00:00.000Z");
    expect(localParts(new Date("2026-11-03T17:45:00Z"), "Asia/Ho_Chi_Minh")).toMatchObject({ date: "2026-11-04", hour: 0 });
  });
  it("buckets kick-off hours", () => {
    expect(kickBucket(2)).toBe("late");
    expect(kickBucket(20)).toBe("evening");
    expect(kickBucket(13)).toBe("day");
  });
});

describe("redaction", () => {
  it("removes credential-shaped strings before anything reaches the relayer", () => {
    // Fake keys in both shapes: t-<24 hex>-<24 hex> (current) and t-<24 hex>-<32 hex> (older).
    const r = redact("my tatum key t-0123456789abcdef01234567-89abcdef0123456789abcdef, old t-fedcba9876543210fedcba98-0123456789abcdef0123456789abcdef and email me@x.io");
    expect(r.removed).toBe(3);
    expect(r.text).not.toMatch(/t-0123|t-fedc|me@x\.io/);
  });
});
