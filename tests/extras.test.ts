import { describe, expect, it } from "vitest";
import { judgeLive } from "../lib/extras.ts";
import { askText, resultText } from "../lib/telegram.ts";
import { buildTaste, parseMemory, preferenceMemory } from "../lib/taste.ts";

const live = (minute: number, hs: number, as: number, compId = "2000000000") => ({
  matchId: "m1", compId, seasonId: "s", stageId: "st", competition: "Premier League", stage: null, kickoff: "2026-11-07T15:00:00Z",
  home: "Leeds United", away: "Tottenham Hotspur", homeId: null, awayId: null, country: "ENG", homeScore: hs, awayScore: as, status: 3, minute,
});
const empty = buildTaste([], "2026-11-07");
const lovesLate = buildTaste([parseMemory("b", preferenceMemory("2026-11-06", "I love late drama.", ["signal=late-goals", "signal=tense"], 1))], "2026-11-07");
const hatesTense = buildTaste([parseMemory("b", preferenceMemory("2026-11-06", "Tight cagey games bore me.", ["signal=tense"], -1))], "2026-11-07");

describe("live alerts follow memory", () => {
  it("a neutral fan hears about a tight game from 68'", () => {
    expect(judgeLive(live(62, 1, 1), empty, false)).toBeNull();
    expect(judgeLive(live(70, 1, 1), empty, false)?.kind).toBe("tense-late");
  });
  it("someone who loves late drama hears from 60', with the memory cited in the reason", () => {
    const a = judgeLive(live(62, 1, 1), lovesLate, false);
    expect(a?.kind).toBe("tense-late");
    expect(a?.why).toMatch(/your kind of game/);
  });
  it("someone who dislikes tight games is not pinged", () => {
    expect(judgeLive(live(75, 1, 1), hatesTense, false)).toBeNull();
  });
  it("one-sided games never trigger", () => {
    expect(judgeLive(live(75, 3, 0), lovesLate, false)).toBeNull();
  });
  it("ignores low-interest competitions unless they are the user's pick", () => {
    expect(judgeLive(live(75, 1, 1, "obscure-league"), empty, false)).toBeNull();
    expect(judgeLive(live(75, 1, 1, "obscure-league"), empty, true)?.kind).toBe("tense-late");
  });
});

describe("spoiler-free full-time message", () => {
  const p = { home: "Como", away: "Inter", home_score: 3, away_score: 2, competition: "Serie A (ITA)", drama: { score: 71, goals: 5, lateGoals: 1, leadChanges: 1, attempts: 20, cards: 2, comeback: false, tags: [] } };
  it("hides the score by default and shows it after answering", () => {
    expect(askText(p)).not.toMatch(/3–2|Drama/);
    expect(askText(p, true)).toMatch(/3–2/);
    expect(resultText(p)).toMatch(/3–2.*\n.*\nDrama 71\/100/s);
  });
});
