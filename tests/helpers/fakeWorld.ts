// A small fake football world and a fake Telegram, served through a fetch interceptor.
// Team names are invented; nothing here reflects a real result.

export interface FakeEvent {
  type: number; // 0 goal, 2 yellow, 3 red, 12 attempt
  minute: number;
  hg?: number;
  ag?: number;
}

export interface FakeMatch {
  id: string;
  compId: string;
  comp: string;
  stage?: string;
  home: string;
  away: string;
  homeId: string;
  awayId: string;
  kickoff: Date;
  status: number; // 0 played, 1 scheduled, 3 live
  hs: number | null;
  as: number | null;
  minute?: number;
  events?: FakeEvent[];
}

export interface TgCall {
  method: string;
  body: any;
}

/** Base URL the client is pointed at in tests (the real one comes from FOOTBALL_API_BASE). */
export const FEED_BASE = "https://feed.test/api/v3";

export function createWorld() {
  process.env.FOOTBALL_API_BASE = FEED_BASE;
  const matches = new Map<string, FakeMatch>();
  const forms = new Map<string, { MatchesPlayed: number; Wins: number; Draws: number; Losses: number; GoalsScored: number; GoalsAgainst: number }>();
  const tg: TgCall[] = [];
  let msgId = 1000;
  /** Telegram sends whose text matches one of these fail once (simulates a transient Bot API error). */
  const failOnce: RegExp[] = [];
  /** Set `feed.down` to make every football API call answer 503 (a feed outage). */
  const feed = { down: false };

  const toApi = (m: FakeMatch) => ({
    IdMatch: m.id,
    IdCompetition: m.compId,
    IdSeason: `s-${m.compId}`,
    IdStage: `st-${m.compId}`,
    CompetitionName: [{ Description: m.comp }],
    StageName: m.stage ? [{ Description: m.stage }] : [],
    Date: m.kickoff.toISOString().slice(0, 19) + "Z",
    Home: { TeamName: [{ Description: m.home }], IdTeam: m.homeId, IdCountry: "XYZ", Score: m.hs },
    Away: { TeamName: [{ Description: m.away }], IdTeam: m.awayId, IdCountry: "XYZ", Score: m.as },
    HomeTeamScore: m.hs,
    AwayTeamScore: m.as,
    MatchStatus: m.status,
    MatchTime: m.status === 3 ? `${m.minute ?? 0}'` : null,
  });

  async function fakeFetch(input: any, init?: any): Promise<Response> {
    const url = String(typeof input === "string" ? input : input.url);
    if (url.startsWith("https://api.telegram.org/")) {
      const method = url.split("/").pop()!;
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const i = failOnce.findIndex((re) => re.test(String(body.text ?? "")));
      if (i >= 0) {
        failOnce.splice(i, 1);
        return Response.json({ ok: false, error_code: 502, description: "Bad Gateway" });
      }
      tg.push({ method, body });
      const result = method === "sendMessage" || method === "sendPhoto" ? { message_id: ++msgId, chat: { id: body.chat_id } } : true;
      return Response.json({ ok: true, result });
    }
    if (url.startsWith(`${FEED_BASE}/`)) {
      if (feed.down) return new Response("Service Unavailable", { status: 503 });
      const u = new URL(url);
      const path = u.pathname.replace("/api/v3/", "");
      if (path === "calendar/matches") {
        const from = Date.parse(u.searchParams.get("from")!);
        const to = Date.parse(u.searchParams.get("to")!);
        const Results = [...matches.values()].filter((m) => m.kickoff.getTime() >= from && m.kickoff.getTime() < to).map(toApi);
        return Response.json({ ContinuationToken: null, Results });
      }
      if (path.startsWith("teamform/")) {
        const f = forms.get(path.split("/")[1]);
        return f ? Response.json(f) : new Response("not found", { status: 404 });
      }
      if (path.startsWith("live/football/")) {
        const m = matches.get(path.split("/")[2]);
        if (!m) return new Response("not found", { status: 404 });
        return Response.json({ MatchStatus: m.status, HomeTeam: { Score: m.hs }, AwayTeam: { Score: m.as }, MatchTime: m.minute ? `${m.minute}'` : "0'" });
      }
      if (path.startsWith("timelines/")) {
        const m = matches.get(path.split("/")[1]);
        if (!m) return new Response("not found", { status: 404 });
        return Response.json({
          Event: (m.events ?? []).map((e) => ({ Type: e.type, MatchMinute: `${e.minute}'`, HomeGoals: e.hg ?? null, AwayGoals: e.ag ?? null, IdTeam: null })),
        });
      }
      return new Response("not found", { status: 404 });
    }
    throw new Error(`unexpected network call in test: ${url}`);
  }

  let n = 0;
  function add(m: Omit<FakeMatch, "id" | "homeId" | "awayId"> & { id?: string }): FakeMatch {
    const id = m.id ?? `m${++n}`;
    const full: FakeMatch = { ...m, id, homeId: `t-${slug(m.home)}`, awayId: `t-${slug(m.away)}` };
    matches.set(id, full);
    for (const t of [full.homeId, full.awayId]) if (!forms.has(t)) forms.set(t, { MatchesPlayed: 5, Wins: 3, Draws: 1, Losses: 1, GoalsScored: 10, GoalsAgainst: 6 });
    return full;
  }

  /** Telegram calls since a marker, optionally of one method. */
  const since = (mark: number, method?: string) => tg.slice(mark).filter((c) => !method || c.method === method);
  const texts = (mark: number) => since(mark).map((c) => String(c.body.text ?? c.body.caption ?? "")).join("\n---\n");

  return { matches, forms, tg, add, fakeFetch, since, texts, failOnce, feed, mark: () => tg.length };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
