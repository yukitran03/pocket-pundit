// Memory switch (pure): one evening ranked with memory on and with memory off, the lock line with Sui's
// certification time, and night placements. No network, no database.
import { describe, expect, it } from "vitest";
import { memorySwitch, scoreCandidates } from "../lib/picker.ts";
import { buildTaste, parseMemory } from "../lib/taste.ts";
import { placeMatches } from "../lib/night.ts";
import { lockedText } from "../lib/lock.ts";

const fx = (matchId: string, compId: string, kickoff: string, stage: string | null = null) => ({
  matchId, compId, seasonId: "s", stageId: "st", competition: `Comp ${compId}`, stage, kickoff,
  home: `Home ${matchId}`, away: `Away ${matchId}`, homeId: null, awayId: null, country: null, homeScore: null, awayScore: null, status: 1,
});

describe("memory switch (pure)", () => {
  // A and B have the stage boost, so memory off ranks them first. The viewer has bailed on their competition
  // twice and loved D's three times.
  const fixtures = [
    fx("A", "hatec", "2026-11-08T12:00:00Z", "Final"),
    fx("B", "hatec", "2026-11-08T12:30:00Z", "Semi-final"),
    fx("C", "neutral1", "2026-11-08T13:00:00Z"),
    fx("D", "lovec", "2026-11-08T13:30:00Z"),
    fx("E", "neutral2", "2026-11-08T14:00:00Z"),
  ];
  const taste = buildTaste(
    [
      parseMemory("love1", "[rating] 2026-11-06 · Loved a match. tags: verdict=1.00 comp=lovec"),
      parseMemory("love2", "[rating] 2026-11-07 · Loved a match. tags: verdict=1.00 comp=lovec"),
      parseMemory("love3", "[rating] 2026-11-07 · Loved a match. tags: verdict=1.00 comp=lovec"),
      parseMemory("hate1", "[rating] 2026-11-06 · Bailed on a match. tags: verdict=-0.80 comp=hatec"),
      parseMemory("hate2", "[rating] 2026-11-07 · Bailed on a match. tags: verdict=-0.80 comp=hatec"),
    ],
    "2026-11-08",
  );
  const end = new Date("2026-11-08T17:00:00Z");

  it("keeps both top threes, says what memory brought in and what it dropped, and cites the memories", () => {
    const sw = memorySwitch(scoreCandidates(fixtures, new Map(), taste, "UTC", end), taste);
    expect(sw.off.map((e) => e.matchId)).toEqual(["A", "B", "C"]);
    expect(sw.on.map((e) => e.matchId)).toEqual(["D", "C", "E"]);
    expect(sw.changed).toBe(2);
    expect(sw.considered).toBe(5);
    const d = sw.on[0];
    expect(d.rankOn).toBe(1);
    expect(d.rankOff).toBe(4);
    expect(d.why).toMatch(/^You've enjoyed Comp lovec before \(3 memories\)\.$/);
    expect(d.cites.map((c) => c.blobId).sort()).toEqual(["love2", "love3"]);
    const a = sw.off[0];
    expect(a.why).toBe("You've cooled on Comp hatec (2 memories).");
    expect(a.cites.map((c) => c.blobId).sort()).toEqual(["hate1", "hate2"]);
    expect(a.rankOn).toBeGreaterThan(3);
    // In both lists: nothing to explain.
    expect(sw.on[1].why).toBeNull();
    expect(sw.off[2].why).toBeNull();
  });

  it("with no memories the two lists are the same, and memory-off ties never read the memory score", () => {
    const none = memorySwitch(scoreCandidates(fixtures, new Map(), null, "UTC", end), null);
    expect(none.changed).toBe(0);
    expect(none.on.map((e) => e.matchId)).toEqual(none.off.map((e) => e.matchId));
    // C, D and E tie on the memory-off score: kick-off order decides, whatever memory thinks of D.
    const sw = memorySwitch(scoreCandidates(fixtures.slice(2), new Map(), taste, "UTC", end), taste);
    expect(sw.off.map((e) => e.matchId)).toEqual(["C", "D", "E"]);
    expect(sw.on[0].matchId).toBe("D");
  });
});

describe("night placements (pure)", () => {
  it("places any match of the night by drama, ties share a rank, and missing results stay null", () => {
    const scored = [{ matchId: "a", drama: 80 }, { matchId: "b", drama: 50 }, { matchId: "c", drama: 50 }, { matchId: "d", drama: 10 }];
    expect(placeMatches(scored, ["c", "d", "x", "c"])).toEqual([
      { matchId: "c", drama: 50, rank: 2 },
      { matchId: "d", drama: 10, rank: 4 },
      { matchId: "x", drama: null, rank: null },
    ]);
  });
});

describe("the lock line (pure)", () => {
  const base = { blobId: "EbRYJMsi23LhOdhyi2mhxgLGNlHyYi7a4eMFpem6EqU", walruscanUrl: "https://walruscan.com/mainnet/blob/x", tz: "Asia/Ho_Chi_Minh" };

  it("says when Sui certified the picks, against the first kick-off", () => {
    const text = lockedText({ ...base, cert: { objectId: "0x1", checkpoint: "342812004", at: "2026-11-08T11:01:07Z" }, firstKickoff: "2026-11-08T12:00:00Z" });
    expect(text).toBe(
      `🔒 Tonight's picks are locked on Walrus · <a href="https://walruscan.com/mainnet/blob/x">EbRYJM…6EqU</a>\nCertified on Sui at 18:01 your time, checkpoint 342,812,004, 59 min before the first kick-off. Read back through Tatum.`,
    );
    expect(text).not.toMatch(/—/);
  });

  it("still shows the Walrus blob when Sui can't be read", () => {
    expect(lockedText({ ...base, cert: null, firstKickoff: null })).toBe(`🔒 Tonight's picks are locked on Walrus · <a href="https://walruscan.com/mainnet/blob/x">EbRYJM…6EqU</a>`);
  });
});
