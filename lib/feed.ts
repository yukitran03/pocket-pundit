// Client for the public football data API (anonymous, documented in its public Swagger UI).
// Only public, documented GET routes are used. Responses are cached in Postgres to stay polite.
import { cached } from "./db.ts";

const BASE = process.env.FOOTBALL_API_BASE || "";

export interface Fixture {
  matchId: string;
  compId: string;
  seasonId: string;
  stageId: string;
  competition: string;
  stage: string | null;
  kickoff: string; // ISO UTC
  home: string;
  away: string;
  homeId: string | null;
  awayId: string | null;
  country: string | null; // home team country code, used to label domestic leagues
  homeLogo?: string | null; // team picture from the public feed's PictureUrl (shown only if OFFICIAL_CRESTS=1)
  awayLogo?: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: number; // 0 played, 1 scheduled, 3 live, others = postponed/abandoned/etc.
}

export interface TeamForm {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface TimelineEvent {
  type: number; // 0 goal, 2 yellow, 3 red, 4 second yellow, 12 attempt, 26 match end ...
  minute: number; // parsed from "90'+3'"
  homeGoals: number | null;
  awayGoals: number | null;
  teamId: string | null;
}

const desc = (arr: any): string => (Array.isArray(arr) && arr[0]?.Description) || "";

/** "…/picture/teams-{format}-{size}/123" → a concrete square PNG URL on the public API. */
const picture = (tpl: unknown): string | null =>
  typeof tpl === "string" && tpl.startsWith(BASE + "/picture/") ? tpl.replace("{format}", "sq").replace("{size}", "3") : null;

async function getJson(path: string, timeoutMs = 15000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${BASE}/${path}`, { signal: ctrl.signal, headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(`football api ${r.status} for ${path.split("?")[0]}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

function toFixture(m: any): Fixture | null {
  const home = m.Home ? desc(m.Home.TeamName) : "";
  const away = m.Away ? desc(m.Away.TeamName) : "";
  if (!m.IdMatch || !home || !away) return null;
  return {
    matchId: m.IdMatch,
    compId: m.IdCompetition,
    seasonId: m.IdSeason,
    stageId: m.IdStage,
    competition: desc(m.CompetitionName).replace(/[™®]/g, "").trim() || "Football",
    stage: desc(m.StageName) || null,
    kickoff: m.Date,
    home,
    away,
    homeId: m.Home?.IdTeam ?? null,
    awayId: m.Away?.IdTeam ?? null,
    country: m.Home?.IdCountry ?? null,
    homeLogo: picture(m.Home?.PictureUrl),
    awayLogo: picture(m.Away?.PictureUrl),
    homeScore: m.HomeTeamScore ?? m.Home?.Score ?? null,
    awayScore: m.AwayTeamScore ?? m.Away?.Score ?? null,
    status: typeof m.MatchStatus === "number" ? m.MatchStatus : 1,
  };
}

const HOUR = 3600_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 19) + "Z";

/** All fixtures kicking off in [from, to). Split into ≤6h windows so the 500-per-call cap never truncates. */
export async function fixturesBetween(from: Date, to: Date): Promise<Fixture[]> {
  const out = new Map<string, Fixture>();
  const step = 6 * HOUR;
  // The calendar route answers `null` for some off-hour bounds (e.g. 12:45), so query whole hours and filter after.
  const start = Math.floor(from.getTime() / HOUR) * HOUR;
  const end = Math.ceil(to.getTime() / HOUR) * HOUR;
  for (let a = start; a < end; a += step) {
    const b = Math.min(a + step, end);
    const fromIso = iso(a);
    const toIso = iso(b);
    const key = `feed:cal:${fromIso}:${toIso}`;
    const rows: Fixture[] = await cached(key, 20 * 60, async () => {
      const j = await getJson(`calendar/matches?from=${fromIso}&to=${toIso}&language=en&count=500`);
      return (j?.Results || []).map(toFixture).filter(Boolean) as Fixture[];
    });
    for (const f of rows) out.set(f.matchId, f);
  }
  return [...out.values()].filter((f) => {
    const t = Date.parse(f.kickoff);
    return t >= from.getTime() && t < to.getTime();
  });
}

export async function teamForm(teamId: string): Promise<TeamForm | null> {
  return cached(`feed:form:${teamId}`, 12 * 3600, async () => {
    try {
      const j = await getJson(`teamform/${teamId}?count=5&language=en`);
      if (!j || typeof j.MatchesPlayed !== "number") return null;
      return {
        played: j.MatchesPlayed,
        wins: j.Wins ?? 0,
        draws: j.Draws ?? 0,
        losses: j.Losses ?? 0,
        goalsFor: j.GoalsScored ?? 0,
        goalsAgainst: j.GoalsAgainst ?? 0,
      };
    } catch {
      return null;
    }
  });
}

/** Current state of one match (score + status). Short cache: used while settling. */
export async function matchState(matchId: string): Promise<{ status: number; homeScore: number | null; awayScore: number | null } | null> {
  return cached(`feed:state:${matchId}`, 120, async () => {
    try {
      const j = await getJson(`live/football/${matchId}?language=en`);
      return {
        status: typeof j.MatchStatus === "number" ? j.MatchStatus : 1,
        homeScore: j.HomeTeam?.Score ?? null,
        awayScore: j.AwayTeam?.Score ?? null,
      };
    } catch {
      return null;
    }
  });
}

export function parseMinute(s: string | undefined): number {
  if (!s) return 0;
  const m = s.match(/(\d+)'(?:\+(\d+)')?/);
  if (!m) return 0;
  return Number(m[1]) + (m[2] ? Number(m[2]) / 10 : 0); // 90'+3' -> 90.3 (stays inside the 90' bucket)
}

export async function timeline(matchId: string): Promise<TimelineEvent[] | null> {
  return cached(`feed:timeline:${matchId}`, 6 * 3600, async () => {
    try {
      const j = await getJson(`timelines/${matchId}?language=en`, 20000);
      if (!Array.isArray(j.Event)) return null;
      return j.Event.map((e: any) => ({
        type: e.Type,
        minute: parseMinute(e.MatchMinute),
        homeGoals: typeof e.HomeGoals === "number" ? e.HomeGoals : null,
        awayGoals: typeof e.AwayGoals === "number" ? e.AwayGoals : null,
        teamId: e.IdTeam ?? null,
      }));
    } catch {
      return null;
    }
  });
}

/** Matches in play right now (kicked off in the last 2.5h and status live), refreshed every ~4 minutes. */
export async function liveNow(): Promise<(Fixture & { minute: number })[]> {
  const now = Date.now();
  return cached(`feed:live:${Math.floor(now / 240_000)}`, 300, async () => {
    // Whole-hour bounds (see fixturesBetween); the status filter below keeps only matches in play.
    const from = Math.floor((now - 150 * 60_000) / HOUR) * HOUR;
    const to = Math.ceil(now / HOUR) * HOUR;
    const j = await getJson(`calendar/matches?from=${iso(from)}&to=${iso(to)}&language=en&count=500`);
    return (j?.Results || [])
      .filter((m: any) => m.MatchStatus === 3)
      .map((m: any) => {
        const fx = toFixture(m);
        return fx ? { ...fx, minute: parseMinute(m.MatchTime) } : null;
      })
      .filter(Boolean);
  });
}
