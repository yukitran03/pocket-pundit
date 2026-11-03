import { describe, expect, it } from "vitest";
import { cleanMemoryText, fmtLead, fmtUntil, tidyReasons } from "../lib/client/format.ts";
import { fixtureTonight } from "../lib/fixtures.ts";

const NOW = Date.UTC(2026, 10, 3, 10, 0, 0);
const inMin = (m: number) => new Date(NOW + m * 60_000).toISOString();

describe("fmtUntil", () => {
  it("gives a short relative hint within a day", () => {
    expect(fmtUntil(inMin(35), NOW)).toBe("in 35 min");
    expect(fmtUntil(inMin(60), NOW)).toBe("in 1 h");
    expect(fmtUntil(inMin(105), NOW)).toBe("in 1 h 45 min");
    expect(fmtUntil(inMin(178), NOW)).toBe("in 3 h");
    expect(fmtUntil(inMin(7 * 60 + 10), NOW)).toBe("in 7 h");
  });
  it("says nothing when the date says enough", () => {
    expect(fmtUntil(inMin(25 * 60), NOW)).toBeNull();
    expect(fmtUntil(inMin(-90), NOW)).toBeNull();
    expect(fmtUntil(inMin(-3), NOW)).toBe("kicking off");
  });
});

describe("fmtLead", () => {
  it("keeps minutes under 90 and rounds longer leads", () => {
    expect(fmtLead(75)).toBe("75 min");
    expect(fmtLead(119)).toBe("2 h");
    expect(fmtLead(130)).toBe("2 h 10 min");
    expect(fmtLead(464)).toBe("8 h");
  });
});

describe("cleanMemoryText", () => {
  it("drops the kind, the date and the tag tail", () => {
    expect(cleanMemoryText("[rating] 2026-11-04 · Loved Como 4–1 Manchester United. tags: verdict=1.00 team=como")).toBe("Loved Como 4–1 Manchester United.");
    expect(cleanMemoryText("Plain sentence with no tags.")).toBe("Plain sentence with no tags.");
  });
});

describe("tidyReasons", () => {
  it("strips form strings and drops reasons that repeat the row", () => {
    const r = tidyReasons(
      ["Both sides average 4.3 goals a game lately (W3 D0 L2 / W3 D1 L1).", "UEFA Champions League, kick-off Wed 00:45 your time."],
      { competition: "UEFA Champions League" },
    );
    expect(r).toEqual(["Both sides average 4.3 goals a game lately."]);
  });
});

describe("fixtureTonight", () => {
  it("is a well-formed, clearly sample TonightResponse relative to now", () => {
    const t = fixtureTonight("Asia/Ho_Chi_Minh", NOW);
    expect(t.tonight.length).toBeLessThanOrEqual(8);
    expect(t.replays.length).toBeLessThanOrEqual(6);
    expect(t.tonight.every((m) => m.reasons.length <= 2 && m.matchId.startsWith("smp-"))).toBe(true);
    const upcoming = t.tonight.filter((m) => m.status === "upcoming");
    expect(upcoming.every((m) => new Date(m.kickoff).getTime() > NOW && new Date(m.kickoff).getTime() < NOW + 12 * 3600_000)).toBe(true);
    expect(t.replays.every((r) => new Date(r.kickoff).getTime() < NOW)).toBe(true);
  });
});
