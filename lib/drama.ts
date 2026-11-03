// What actually happened in a match, computed from the public event timeline after full time.
import type { Drama } from "./contract.ts";
import type { TimelineEvent } from "./feed.ts";

const GOAL = 0;
const YELLOW = 2;
const RED = 3;
const SECOND_YELLOW = 4;
const ATTEMPT = 12;

export function computeDrama(events: TimelineEvent[] | null, homeScore: number | null, awayScore: number | null): Drama {
  const hs = homeScore ?? 0;
  const as = awayScore ?? 0;
  const goals = hs + as;
  if (!events || events.length === 0) {
    // Score-only fallback when the competition has no event coverage.
    const tags = scoreTags(goals, hs - as, 0, 0, false);
    const score = clampScore(10 * Math.min(goals, 6) + (Math.abs(hs - as) <= 1 && goals >= 2 ? 10 : 0));
    return { score, goals, lateGoals: 0, leadChanges: 0, attempts: 0, cards: 0, comeback: false, tags };
  }

  let lateGoals = 0;
  let leadChanges = 0;
  let equalisers = 0;
  let attempts = 0;
  let cards = 0;
  let reds = 0;
  let prevDiff = 0;
  let lastLeader = 0;
  let maxHomeDeficit = 0;
  let maxAwayDeficit = 0;

  for (const e of events) {
    if (e.type === ATTEMPT) attempts++;
    if (e.type === YELLOW) cards++;
    if (e.type === RED || e.type === SECOND_YELLOW) {
      cards++;
      reds++;
    }
    if (e.type === GOAL && e.homeGoals !== null && e.awayGoals !== null) {
      attempts++;
      if (e.minute >= 75) lateGoals++;
      const diff = e.homeGoals - e.awayGoals;
      // A lead change is when the side in front differs from the last side that was in front (1-0, 1-1, 1-2 counts).
      if (diff !== 0 && lastLeader !== 0 && Math.sign(diff) !== lastLeader) leadChanges++;
      if (diff !== 0) lastLeader = Math.sign(diff);
      if (prevDiff !== 0 && diff === 0) equalisers++;
      maxHomeDeficit = Math.max(maxHomeDeficit, -diff);
      maxAwayDeficit = Math.max(maxAwayDeficit, diff);
      prevDiff = diff;
    }
  }
  const finalDiff = hs - as;
  const comeback = (maxHomeDeficit >= 1 && finalDiff > 0) || (maxAwayDeficit >= 1 && finalDiff < 0) || (Math.max(maxHomeDeficit, maxAwayDeficit) >= 2 && finalDiff === 0);

  const score = clampScore(
    10 * Math.min(goals, 6) +
      8 * Math.min(lateGoals, 3) +
      10 * Math.min(leadChanges, 3) +
      5 * Math.min(equalisers, 3) +
      (comeback ? 12 : 0) +
      0.6 * Math.min(attempts, 35) +
      6 * Math.min(reds, 2) -
      (goals === 0 ? 8 : 0),
  );
  const tags = scoreTags(goals, finalDiff, lateGoals, leadChanges, comeback);
  if (reds > 0) tags.push("red-card");
  if (attempts >= 28) tags.push("shot-fest");
  return { score, goals, lateGoals, leadChanges, attempts, cards, comeback, tags };
}

function scoreTags(goals: number, diff: number, late: number, changes: number, comeback: boolean): string[] {
  const t: string[] = [];
  if (goals >= 4) t.push("high-scoring");
  if (goals === 0) t.push("goalless");
  if (late >= 1) t.push("late-goals");
  if (changes >= 1) t.push("lead-changes");
  if (comeback) t.push("comeback");
  if (Math.abs(diff) >= 3) t.push("one-sided");
  if (Math.abs(diff) <= 1 && goals >= 2) t.push("tense");
  return t;
}

const clampScore = (x: number) => Math.round(Math.max(0, Math.min(100, x)));

export function dramaSummary(d: Drama): string {
  const parts: string[] = [`${d.goals} goal${d.goals === 1 ? "" : "s"}`];
  if (d.lateGoals) parts.push(`${d.lateGoals} after 75'`);
  if (d.leadChanges) parts.push(`${d.leadChanges} lead change${d.leadChanges === 1 ? "" : "s"}`);
  if (d.comeback) parts.push("a comeback");
  if (d.attempts) parts.push(`${d.attempts} attempts`);
  return parts.join(", ");
}
