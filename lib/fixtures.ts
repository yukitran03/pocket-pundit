// Realistic fixtures for local development and demo builds (NEXT_PUBLIC_USE_MOCK=1).
// Story: Linh, in Ho Chi Minh City, joined on Wed 28 Oct 2026. Today (Tue 3 Nov 2026) is day 7.
// On day 1 the agent mostly picked big-name games kicking off at 03:00 her time, and she bailed or skipped.
// By day 7 the memory arm picks games inside her 19:00–01:00 window, with late goals and lead changes.
// lib/client/api.ts only loads this module through a dynamic import, and only in mock mode or as a
// dev-only fallback. Every result it serves is tagged with source "mock" or "fallback", and the UI
// labels it. The landing page also imports SAMPLE_* to render cards that are explicitly labelled
// as illustrative.

import type {
  ArmStats,
  Cite,
  Drama,
  MeResponse,
  MemoryKind,
  MemoryRow,
  Pick,
  ProofResponse,
  RecallResponse,
  ReplayMatch,
  StatsResponse,
  TonightMatch,
  TonightResponse,
  WriteStatus,
} from "@/lib/contract";

const NS = "mf/u-7f3a91";
const walruscan = (b: string) => `https://walruscan.com/mainnet/blob/${b}`;
const suiscan = (o: string) => `https://suiscan.xyz/mainnet/object/${o}`;

// ---------------------------------------------------------------- memories
type M = [id: string, kind: MemoryKind, text: string, createdAt: string, status: WriteStatus, blobId: string | null, objectId: string | null, endEpoch: number | null];

const RAW_MEMORIES: M[] = [
  ["m00", "brief", "[brief] 2026-11-03 · Tonight's picks, locked before kick-off: Buriram United v Shanghai Port (19:00); Club Brugge v Bayer Leverkusen (00:45); Real Madrid v Juventus (03:00). Memory-off pick sealed: commit 3f9a1c2b7d4e5f60. tags: kind=brief", "2026-11-03T10:01:12Z", "stored", "Lk7bR2xWq9tYv3MnPzA0cE5hJ8sFgD1uKoXiN6wB4eQ", "0x7d2a91c04be36f58e1a0d9c37b5f2e486a1c90d3e7b24f5a68c1d0e93b7a2f41", 47],
  ["m01", "preference", "Happy to watch Asian club football when it fits my evening. The AFC games have been great.", "2026-11-03T09:12:41Z", "queued", null, null, null],
  ["m02", "lesson", "Gulf-slot AFC games (23:00 my time) land right in the window and have been wild. Rank them up.", "2026-11-02T17:50:12Z", "stored", "z7x30Rzh__JntC5HgP_nPsJDUw8-L18ckHCTs3_r4WE", "0x60e74898a733c428a673fddc8e1e3a6cd5c14ef8b13ae80d441ec67ca4f5539e", 47],
  ["m03", "rating", "Al-Sadd 2–3 Al-Hilal (AFC Champions League Elite): loved. Drama 83, winner in the 88th minute.", "2026-11-02T17:48:03Z", "stored", "S3tTDubMw0rPxQ1wN17fTk-mS9Jl9wt08E3G1VCcHek", "0x49694df285ec5c8ff4e1712b82dcfae63c4659ffa551205617bb8d4f63a3da3c", 47],
  ["m04", "rating", "Torino 1–1 Parma: fine. Drama 47. Watchable, nothing late.", "2026-11-02T19:41:55Z", "pending", "XI_QTS6H2s3NV2gzmSVdKE8TLWSpNcsYL6NNr9wdVYM", null, null],
  ["m05", "rating", "Didn't watch Fulham v Everton. A 03:00 Tuesday kickoff is out of the window.", "2026-11-02T22:05:10Z", "stored", "1wM_F4yKnImOgI5VNPSJaWcFOS1Y0SvtjFmxR_go9fA", "0xa10fef1884c833ed36cf322019151eb3969052dd6f079271f8141bcce72c3eaf", 47],
  ["m06", "rating", "PSV 3–3 Ajax (Eredivisie): loved. Drama 91, four lead changes.", "2026-11-01T16:10:27Z", "stored", "cu_EsnsuTnQRSLMzA0hlXw6fFSZBWERC_Qs5HUq7uFc", "0xebf869e7114cc4495dcd90f5dee034a033eb0b47804e8e2de9e5a21267d726fc", 47],
  ["m07", "lesson", "Lead changes matter more than total goals. A 3–3 with swings beat any 4–0.", "2026-11-01T16:12:44Z", "stored", "rkv6SBbyA5_S-MU2fdTKxbq85sM8AtsaUwgV2mv4tBU", "0xfeeccdec0f311a923ff95fefb5e47cf2a98780d7bb613d3db0f66fdceb1ff039", 47],
  ["m08", "rating", "Aston Villa 2–2 Tottenham Hotspur: fine. Drama 64.", "2026-11-01T16:05:02Z", "stored", "3_tphLTp4iwpOmRBQn4pYiFZbmsbrpCcDjRGi3I3vsU", "0xb37018e599d71ca4bb2601d6297ca259d867505aae8e11ea43f5580456dbcb84", 47],
  ["m09", "rating", "Udinese 1–2 Como: loved. Como again, with a late winner.", "2026-10-31T16:02:38Z", "stored", "Mf1VcZoBCvXWjsUd_Xu7znN1EC_fpgLSd-KB3pQAmR4", "0x622772a28135b0f5d197b2307bac6123bca33a6515bc9abcdfa486ed01f8c28b", 47],
  ["m10", "lesson", "Como: two for two, both with goals after 75'. Treat Como as a team to follow.", "2026-10-31T16:05:19Z", "stored", "qBf9Ta3qNlW2drtbuPLDdX4AUXCk2SLW-6VRsZLEbaQ", "0xfa6a7d9a22bb42fe2a0501d2bc4d8e1c2e7d44f183ee0463ea2b86be6180ee5d", 47],
  ["m11", "rating", "Brighton & Hove Albion 2–3 Newcastle United: loved. Drama 88, winner in stoppage time.", "2026-10-31T14:31:50Z", "stored", "afGP08O2aMDQ1ERT8882GW2CQ-LrjWCBSNGaKLnwLUo", "0xbc6a2949905c2daab36abe364ea4110a44cf921380433083bf241139a7358b24", 47],
  ["m12", "rating", "Manchester City 1–1 Chelsea: fine. Slow first half.", "2026-10-31T19:33:12Z", "failed", null, null, null],
  ["m13", "rating", "Lens 4–2 Marseille (Ligue 1): loved. Drama 81.", "2026-10-30T21:00:40Z", "stored", "361dO-wc3KjSQm6DkgfPBgw1XpkjxqLuYnz4O1aeEmw", "0xc4a62dd8daa8286d10884dfd29c34fb040e7519984454d5fa9e8eaf90ae4b008", 47],
  ["m14", "rating", "Bayern München 3–0 Union Berlin: bailed at 60'. Drama 40, over by half-time.", "2026-10-30T21:04:09Z", "stored", "zOZ9JeQLug1aFYocxPA4rtW-GrJbKrWlFBg0NMrqxE0", "0x1867b479dcbe88f36c6b5672cf7ac3ee2e19615ecff5926d080d60a081c18ed4", 47],
  ["m15", "lesson", "One-sided home favourites are dull even when it's a big club. Penalise heavy mismatches.", "2026-10-30T21:06:33Z", "stored", "-dtvNsZqQNj4NoaXQHS6CDISfabymCt6LxPWUr9wN14", "0x076dfe60313681fd20a00bfbdde9e4971811b90847b9742adc5df958335f7e9d", 47],
  ["m16", "rating", "Genoa 2–2 Bologna: fine. Drama 61.", "2026-10-29T19:30:21Z", "stored", "lrii_AKAHj1uQiPe3oRWtVQf4GHV_rJ9xfz5YXKF3fQ", "0xc0dd3bfa0305adac2ac3dff013e03bf921f77d010d055ed0cbb75739e7fcb621", 44],
  ["m17", "rating", "Al-Ittihad 3–1 Al-Qadsiah: loved. A 23:00 kickoff felt right.", "2026-10-29T18:02:47Z", "stored", "PY8bpHxeAAE_Wks8S4252DZQLq1pkUHuTkK-HGzB02I", "0xc5e2aac40508db076fdb1517e8461c027b40f6ba96775ae8a46231ce8263c255", 44],
  ["m18", "rating", "Didn't watch Juventus 0–0 Lazio (02:45 kickoff).", "2026-10-29T21:55:03Z", "stored", "pZgtWZWNlID9TMGzUIhZZJw1hmhdo7oYQ9JNTQSsMgs", "0xf0b6a120f234a84017972112d8eff9a756f1a6604e96580f2ce28f557ab166b6", 44],
  ["m19", "limit", "Weeknights: kickoffs after 01:00 local get skipped. Treat 01:00 as a hard stop Monday to Thursday.", "2026-10-29T02:10:55Z", "stored", "a5rB6N1hiFVzTSGK3qP323r7n4pyc12_VlV7oeIxF6w", "0xa06d6396b010d9f319f931089690498830377461bfbc7aded09aa45011f6700b", 47],
  ["m20", "lesson", "Loved Como 3–2 Atalanta: two goals after 75' and a comeback. Open games beat big names.", "2026-10-28T22:40:16Z", "stored", "ondgK_hqyqJM3pnCjX0EI_75FbJ9QYat-U4Gxtq0oY0", "0xdd0ad7f0206554136c148c22509b8ba72afcb3cc81394657f0fcf2bc4be7f40e", 44],
  ["m21", "lesson", "Bailed on Inter 1–0 Napoli at 02:45. A cagey top-of-table game after midnight isn't worth it.", "2026-10-28T22:35:48Z", "stored", "SaLIvjx4O3GNaHS02vjW0AVNofrOpUAOMr-H9Um93yY", "0x04e4d04ead3583e95e1410462061082ac0a1f482d8bea643f0af6a74d86b760c", 44],
  ["m22", "rating", "Como 3–2 Atalanta: loved. Drama 86.", "2026-10-28T19:31:04Z", "stored", "2Ikx82NfMBNcKckmXAPABbqBUfDt1PKcfb0tfWlKIAc", "0x59ebd0ed38ab2b5798fd821c8fa415da98ac24a760437f8e5d5e178437565881", 44],
  ["m23", "preference", "Likes open, end-to-end games. Doesn't care about club size.", "2026-10-28T10:05:30Z", "stored", "zhboU16PX40Qzt2hh8wRY-u3j12bbbFXJluQY9Tg5cA", "0x90fa35e55692aa29e328a318498679fe25647832aee7c6fcc997ee6e17e0a216", 52],
  ["m24", "preference", "Window: 19:00 to 01:00, Ho Chi Minh City time. Brief at 17:00.", "2026-10-28T10:04:58Z", "stored", "2Wpy69PUoYN-kksf3s2sbSh1VwjquQchqeIM_5dt6hs", "0xcd82540cfceecd52d659cbf44c3b3794597db56c74cf7ebbc5ab5ddd71de2469", 52],
  ["m25", "system", "Account created. Namespace mf/u-7f3a91 on MemWal, Sui mainnet.", "2026-10-28T10:04:31Z", "stored", "xHXynvW2zG_ER2TJmDQS3d_O3CTqKe2zcI12kwW7IwI", "0x055b5edc24c3021efa68f1d2f6319170b684600cc312ecade7cb56ed28f6fdb3", 52],
];

const memoryById = new Map<string, MemoryRow>();
export const FIXTURE_MEMORIES: MemoryRow[] = RAW_MEMORIES.map(([id, kind, text, createdAt, status, blobId, objectId, endEpoch]) => {
  const row: MemoryRow = {
    blobId,
    kind,
    text,
    createdAt,
    status,
    namespace: NS,
    suiObjectId: objectId,
    endEpoch,
    walruscanUrl: blobId && status === "stored" ? walruscan(blobId) : null,
    suiscanUrl: objectId ? suiscan(objectId) : null,
  };
  memoryById.set(id, row);
  return row;
});

const cite = (...ids: string[]): Cite[] =>
  ids.map((id) => {
    const m = memoryById.get(id);
    if (!m || !m.blobId) throw new Error(`fixture: memory ${id} has no blob`);
    return { blobId: m.blobId, text: m.text };
  });

// ---------------------------------------------------------------- picks
const drama = (score: number, goals: number, lateGoals: number, leadChanges: number, attempts: number, cards: number, comeback: boolean, tags: string[]): Drama => ({
  score, goals, lateGoals, leadChanges, attempts, cards, comeback, tags,
});

let pickSeq = 0;
function pick(p: Omit<Pick, "id" | "status"> & { status?: Pick["status"] }): Pick {
  pickSeq += 1;
  return { id: `pk_${p.briefDate.replaceAll("-", "")}_${p.slot}_${pickSeq}`, status: p.status ?? "finished", ...p };
}

// Tonight's brief (memory m00) was written to Walrus at 17:01 local, before the first kick-off.
const BRIEF_LOCK = "Lk7bR2xWq9tYv3MnPzA0cE5hJ8sFgD1uKoXiN6wB4eQ";
const BRIEF_LOCKED_AT = "2026-11-03T10:01:12Z";

export const FIXTURE_TODAY: Pick[] = [
  pick({
    briefDate: "2026-11-03", slot: 1, arm: null, kickoff: "2026-11-03T17:45:00Z",
    competition: "UEFA Champions League", stage: "League phase · Matchday 4",
    home: "Club Brugge", away: "Bayer Leverkusen", homeScore: null, awayScore: null, status: "upcoming",
    score: 84,
    reasons: [
      "Kicks off at 00:45 your time, before your 01:00 weeknight stop",
      "Both sides press high and average 14+ attempts a game",
      "Plays like PSV 3–3 Ajax, which you loved",
    ],
    cites: cite("m19", "m07", "m06"),
    rating: null, drama: null,
    lock: { blobId: BRIEF_LOCK, lockedAt: BRIEF_LOCKED_AT, minutesBeforeKickoff: 464 },
  }),
  pick({
    briefDate: "2026-11-03", slot: 2, arm: null, kickoff: "2026-11-03T20:00:00Z",
    competition: "UEFA Champions League", stage: "League phase · Matchday 4",
    home: "Real Madrid", away: "Juventus", homeScore: null, awayScore: null, status: "upcoming",
    score: 79,
    reasons: [
      "The highest-profile fixture on tonight's slate",
      "Both clubs sit in the league-phase top eight",
      "Two of the last three meetings were decided after 80'",
    ],
    cites: [],
    rating: null, drama: null,
    lock: { blobId: BRIEF_LOCK, lockedAt: BRIEF_LOCKED_AT, minutesBeforeKickoff: 599 },
  }),
  pick({
    briefDate: "2026-11-03", slot: 3, arm: null, kickoff: "2026-11-03T12:00:00Z",
    competition: "AFC Champions League Elite", stage: "League stage · Matchday 4",
    home: "Buriram United", away: "Shanghai Port", homeScore: null, awayScore: null, status: "upcoming",
    score: 88,
    reasons: [
      "19:00 your time, the first match in your window",
      "These sides average 3.1 goals a game in the league stage",
      "Your last two AFC picks were both loved",
    ],
    cites: cite("m02", "m03", "m24"),
    rating: null, drama: null,
    lock: { blobId: BRIEF_LOCK, lockedAt: BRIEF_LOCKED_AT, minutesBeforeKickoff: 119 },
  }),
];

export const FIXTURE_HISTORY: Pick[] = [
  // Day 6: Mon 2 Nov
  pick({ briefDate: "2026-11-02", slot: 1, arm: "memory", kickoff: "2026-11-02T15:00:00Z", competition: "AFC Champions League Elite", stage: "League stage · Matchday 4", home: "Al-Sadd", away: "Al-Hilal", homeScore: 2, awayScore: 3, score: 82,
    reasons: ["22:00 your time, mid-window", "Al-Hilal have scored after 80' in 4 of 5 games", "You loved Al-Ittihad 3–1 at the same hour"],
    cites: cite("m17", "m19"), rating: "loved", drama: drama(83, 5, 2, 2, 29, 3, true, ["late-goals", "comeback", "high-scoring"]) }),
  pick({ briefDate: "2026-11-02", slot: 2, arm: "control", kickoff: "2026-11-02T20:00:00Z", competition: "Premier League", stage: "Matchday 10", home: "Fulham", away: "Everton", homeScore: 1, awayScore: 1, score: 66,
    reasons: ["Monday night Premier League", "Both sides unbeaten in three"],
    cites: [], rating: "skipped", drama: drama(44, 2, 0, 0, 21, 4, false, []) }),
  pick({ briefDate: "2026-11-02", slot: 3, arm: "memory", kickoff: "2026-11-02T17:30:00Z", competition: "Serie A", stage: "Matchday 10", home: "Torino", away: "Parma", homeScore: 1, awayScore: 1, score: 63,
    reasons: ["00:30 kickoff, inside the weeknight stop", "Parma have conceded late in three straight"],
    cites: cite("m19", "m20"), rating: "fine", drama: drama(47, 2, 1, 0, 23, 5, false, ["late-goals"]) }),
  // Day 5: Sun 1 Nov
  pick({ briefDate: "2026-11-01", slot: 1, arm: "memory", kickoff: "2026-11-01T13:30:00Z", competition: "Eredivisie", stage: "Matchday 11", home: "PSV", away: "Ajax", homeScore: 3, awayScore: 3, score: 86,
    reasons: ["20:30 your time, prime window", "De Topper: 3.4 goals per game in the last 10", "You rate open games highly"],
    cites: cite("m20", "m23"), rating: "loved", drama: drama(91, 6, 2, 4, 34, 4, true, ["late-goals", "high-scoring", "comeback"]) }),
  pick({ briefDate: "2026-11-01", slot: 2, arm: "memory", kickoff: "2026-11-01T14:00:00Z", competition: "Premier League", stage: "Matchday 10", home: "Aston Villa", away: "Tottenham Hotspur", homeScore: 2, awayScore: 2, score: 71,
    reasons: ["21:00 your time", "Both teams have scored in 8 of their last 9 meetings"],
    cites: cite("m11"), rating: "fine", drama: drama(64, 4, 1, 1, 27, 3, false, ["high-scoring"]) }),
  pick({ briefDate: "2026-11-01", slot: 3, arm: "control", kickoff: "2026-11-01T20:00:00Z", competition: "La Liga", stage: "Matchday 12", home: "Barcelona", away: "Real Sociedad", homeScore: 2, awayScore: 1, score: 77,
    reasons: ["Barcelona at home", "Top-six meeting"],
    cites: [], rating: "skipped", drama: drama(59, 3, 1, 1, 28, 2, false, ["late-goals"]) }),
  // Day 4: Sat 31 Oct
  pick({ briefDate: "2026-10-31", slot: 1, arm: "control", kickoff: "2026-10-31T17:30:00Z", competition: "Premier League", stage: "Matchday 10", home: "Manchester City", away: "Chelsea", homeScore: 1, awayScore: 1, score: 81,
    reasons: ["Saturday's headline game", "Title-race fixture"],
    cites: [], rating: "fine", drama: drama(55, 2, 1, 0, 26, 3, false, ["late-goals"]) }),
  pick({ briefDate: "2026-10-31", slot: 2, arm: "memory", kickoff: "2026-10-31T12:30:00Z", competition: "Premier League", stage: "Matchday 10", home: "Brighton & Hove Albion", away: "Newcastle United", homeScore: 2, awayScore: 3, score: 78,
    reasons: ["19:30 your time, the start of your window", "Both sides average 15+ attempts"],
    cites: cite("m23", "m20"), rating: "loved", drama: drama(88, 5, 2, 2, 33, 2, true, ["late-goals", "high-scoring", "comeback"]) }),
  pick({ briefDate: "2026-10-31", slot: 3, arm: "memory", kickoff: "2026-10-31T14:00:00Z", competition: "Serie A", stage: "Matchday 10", home: "Udinese", away: "Como", homeScore: 1, awayScore: 2, score: 80,
    reasons: ["Como, a team you loved on day 1", "21:00 your time"],
    cites: cite("m22", "m20"), rating: "loved", drama: drama(77, 3, 1, 1, 25, 4, true, ["late-goals", "comeback"]) }),
  // Day 3: Fri 30 Oct
  pick({ briefDate: "2026-10-30", slot: 1, arm: "memory", kickoff: "2026-10-30T18:45:00Z", competition: "Ligue 1", stage: "Matchday 11", home: "Lens", away: "Marseille", homeScore: 4, awayScore: 2, score: 74,
    reasons: ["Friday: the 01:00 stop doesn't apply", "Lens have scored 2+ in 6 straight at home"],
    cites: cite("m19", "m20"), rating: "loved", drama: drama(81, 6, 1, 2, 30, 5, false, ["high-scoring"]) }),
  pick({ briefDate: "2026-10-30", slot: 2, arm: "control", kickoff: "2026-10-30T19:30:00Z", competition: "Bundesliga", stage: "Matchday 9", home: "Bayern München", away: "Union Berlin", homeScore: 3, awayScore: 0, score: 76,
    reasons: ["Bayern at home", "Bundesliga leaders"],
    cites: [], rating: "bailed", drama: drama(40, 3, 0, 0, 24, 1, false, ["one-sided"]) }),
  pick({ briefDate: "2026-10-30", slot: 3, arm: "memory", kickoff: "2026-10-30T19:00:00Z", competition: "Eredivisie", stage: "Matchday 11", home: "NEC", away: "Feyenoord", homeScore: 2, awayScore: 2, score: 65,
    reasons: ["Open game between two attacking sides", "02:00 kickoff, fine on a Friday"],
    cites: cite("m20"), rating: "fine", drama: drama(57, 4, 0, 1, 26, 3, false, ["high-scoring"]) }),
  // Day 2: Thu 29 Oct
  pick({ briefDate: "2026-10-29", slot: 1, arm: "control", kickoff: "2026-10-29T19:45:00Z", competition: "Serie A", stage: "Matchday 9", home: "Juventus", away: "Lazio", homeScore: 0, awayScore: 0, score: 75,
    reasons: ["Big-club fixture", "Top-half meeting"],
    cites: [], rating: "skipped", drama: drama(18, 0, 0, 0, 17, 6, false, ["goalless"]) }),
  pick({ briefDate: "2026-10-29", slot: 2, arm: "memory", kickoff: "2026-10-29T16:00:00Z", competition: "Saudi Pro League", stage: "Matchday 8", home: "Al-Ittihad", away: "Al-Qadsiah", homeScore: 3, awayScore: 1, score: 70,
    reasons: ["23:00 your time, inside the window", "High-scoring fixture: 3.0 goals per game"],
    cites: cite("m21", "m23"), rating: "loved", drama: drama(72, 4, 1, 1, 28, 3, false, ["high-scoring", "late-goals"]) }),
  pick({ briefDate: "2026-10-29", slot: 3, arm: "memory", kickoff: "2026-10-29T17:30:00Z", competition: "Serie A", stage: "Matchday 9", home: "Genoa", away: "Bologna", homeScore: 2, awayScore: 2, score: 64,
    reasons: ["00:30 kickoff, early enough", "Like Como 3–2 Atalanta: two pressing sides"],
    cites: cite("m20", "m21"), rating: "fine", drama: drama(61, 4, 1, 1, 25, 4, false, ["high-scoring"]) }),
  // Day 1: Wed 28 Oct (only the onboarding memories exist)
  pick({ briefDate: "2026-10-28", slot: 1, arm: "memory", kickoff: "2026-10-28T19:45:00Z", competition: "Serie A", stage: "Matchday 9", home: "Inter", away: "Napoli", homeScore: 1, awayScore: 0, score: 77,
    reasons: ["Top-of-table clash", "Both sides in the top three"],
    cites: cite("m23"), rating: "bailed", drama: drama(34, 1, 0, 0, 19, 6, false, ["low-scoring"]) }),
  pick({ briefDate: "2026-10-28", slot: 2, arm: "control", kickoff: "2026-10-28T20:00:00Z", competition: "La Liga", stage: "Matchday 11", home: "Real Madrid", away: "Getafe", homeScore: 2, awayScore: 0, score: 74,
    reasons: ["Real Madrid at home", "Strong recent form"],
    cites: [], rating: "skipped", drama: drama(31, 2, 0, 0, 22, 5, false, ["one-sided"]) }),
  pick({ briefDate: "2026-10-28", slot: 3, arm: "memory", kickoff: "2026-10-28T17:30:00Z", competition: "Serie A", stage: "Matchday 9", home: "Como", away: "Atalanta", homeScore: 3, awayScore: 2, score: 71,
    reasons: ["Open game: both sides average 1.8+ goals", "00:30 your time"],
    cites: cite("m23", "m24"), rating: "loved", drama: drama(86, 5, 2, 2, 31, 4, true, ["late-goals", "high-scoring", "comeback"]) }),
];

function armStats(picks: Pick[], arm: "memory" | "control"): ArmStats {
  const p = picks.filter((x) => x.arm === arm);
  const count = (r: Pick["rating"]) => p.filter((x) => x.rating === r).length;
  const loved = count("loved"), fine = count("fine"), bailed = count("bailed"), skipped = count("skipped");
  const rated = loved + fine + bailed;
  const dramas = p.map((x) => x.drama?.score).filter((x): x is number => typeof x === "number");
  return {
    n: p.length, loved, fine, bailed, skipped,
    avgDrama: dramas.length ? Math.round((dramas.reduce((a, b) => a + b, 0) / dramas.length) * 10) / 10 : null,
    score: rated ? Math.round(((loved * 2 + fine) / rated) * 100) / 100 : null,
  };
}

export const FIXTURE_ME: MeResponse = {
  user: {
    name: "Linh",
    tz: "Asia/Ho_Chi_Minh",
    briefHour: 17,
    windowStart: 19,
    windowEnd: 25,
    namespace: NS,
    joinedAt: "2026-10-28T10:04:31Z",
    dayIndex: 7,
  },
  today: FIXTURE_TODAY,
  history: FIXTURE_HISTORY,
  taste: {
    competitions: [
      { key: "comp:afc-champions-league-elite", label: "AFC Champions League Elite", weight: 0.62, evidence: 3 },
      { key: "comp:eredivisie", label: "Eredivisie", weight: 0.48, evidence: 2 },
      { key: "comp:premier-league", label: "Premier League", weight: 0.31, evidence: 3 },
      { key: "comp:serie-a", label: "Serie A", weight: 0.18, evidence: 6 },
      { key: "comp:la-liga", label: "La Liga", weight: -0.36, evidence: 2 },
    ],
    teams: [
      { key: "team:como", label: "Como", weight: 0.74, evidence: 3 },
      { key: "team:psv", label: "PSV", weight: 0.41, evidence: 1 },
      { key: "team:brighton", label: "Brighton & Hove Albion", weight: 0.38, evidence: 1 },
      { key: "team:inter", label: "Inter", weight: -0.24, evidence: 2 },
      { key: "team:bayern-munchen", label: "Bayern München", weight: -0.29, evidence: 1 },
    ],
    signals: [
      { key: "signal:late-goals", label: "Goals after 75'", weight: 0.83, evidence: 7 },
      { key: "signal:lead-changes", label: "Lead changes", weight: 0.66, evidence: 5 },
      { key: "signal:high-scoring", label: "High-scoring", weight: 0.57, evidence: 6 },
      { key: "signal:comeback", label: "Comebacks", weight: 0.49, evidence: 4 },
      { key: "signal:one-sided", label: "One-sided favourites", weight: -0.52, evidence: 2 },
      { key: "signal:goalless", label: "Goalless at half-time", weight: -0.71, evidence: 2 },
    ],
    limits: [
      { key: "limit:kickoff-after-01-weeknight", label: "Kick-off after 01:00, Mon to Thu", weight: -0.92, evidence: 5 },
      { key: "limit:kickoff-after-03-weekend", label: "Kick-off after 03:00, Fri to Sun", weight: -0.55, evidence: 2 },
      { key: "limit:kickoff-before-19", label: "Kickoff before 19:00", weight: -0.2, evidence: 1 },
    ],
  },
  memories: FIXTURE_MEMORIES,
  ab: { memory: armStats(FIXTURE_HISTORY, "memory"), control: armStats(FIXTURE_HISTORY, "control") },
  shares: [],
};

// ---------------------------------------------------------------- stats (all users, anonymised)
export const FIXTURE_STATS: StatsResponse = {
  memoriesStored: 612,
  users: 23,
  picksSent: 291,
  picksRated: 246,
  matchesScanned: 39_812,
  ab: {
    memory: { n: 164, loved: 71, fine: 52, bailed: 19, skipped: 22, avgDrama: 63.4, score: 1.37 },
    control: { n: 82, loved: 21, fine: 27, bailed: 18, skipped: 16, avgDrama: 51.8, score: 1.05 },
  },
  recentLessons: [
    { text: "Gulf-slot AFC games (23:00 local) land in the window and have been wild. Rank them up.", createdAt: "2026-11-02T17:50:12Z", blobId: "z7x30Rzh__JntC5HgP_nPsJDUw8-L18ckHCTs3_r4WE" },
    { text: "Two 0–0s at half-time, two bails. Goalless at the break between defensive sides is a red flag.", createdAt: "2026-11-02T11:21:40Z", blobId: "Y1ZMJGXo8Bj-kTgvtMQeUosVWwweLNrJSIB9yEKrRXQ" },
    { text: "Lead changes matter more than total goals. A 3–3 with swings beat any 4–0.", createdAt: "2026-11-01T16:12:44Z", blobId: "rkv6SBbyA5_S-MU2fdTKxbq85sM8AtsaUwgV2mv4tBU" },
    { text: "Rated 5 of 6 games with a goal after 85' as Loved. Late drama is the strongest signal for this viewer.", createdAt: "2026-11-01T09:03:12Z", blobId: "yZOskW-X0MjOGky1ztoZRhrKk9rf9gCRpVB4qGNuBNU" },
    { text: "Sunday-afternoon WSL games rated Loved twice. Add the women's game to weekend picks.", createdAt: "2026-10-31T18:47:29Z", blobId: "P4g8wYcFXDX2LFj0WplPMrQ5WxdZOrs0T3xAPGC8Rbs" },
    { text: "One-sided home favourites are dull even when it's a big club. Penalise heavy mismatches.", createdAt: "2026-10-30T21:06:33Z", blobId: "-dtvNsZqQNj4NoaXQHS6CDISfabymCt6LxPWUr9wN14" },
    { text: "Skips anything kicking off after 01:00 on weeknights, title deciders included.", createdAt: "2026-10-29T02:10:55Z", blobId: null },
  ],
  updatedAt: "2026-11-03T10:02:11Z",
};

// ---------------------------------------------------------------- proof
const ACCOUNT_ID = "0xe60476b8f7fb9b90970e10ce5439f873b1f7da397fee18324f42b12706b46d79";
const OWNER = "0x45ca33e3e5768968df1e393350b54c34b9b9500ede84e22ead60932fe22ef75c";

export const FIXTURE_PROOF: ProofResponse = {
  network: "mainnet",
  account: {
    id: ACCOUNT_ID,
    owner: OWNER,
    active: true,
    delegateKeys: [
      { label: "Relayer: app server", publicKeyHex: "9c1e5d0b7a43f2e8d6c4b2a0918e7f6d5c4b3a2918e7f6d5c4b3a2918e7f6d5c", suiAddress: "0xdc39b57516a33da1df5a2dbdb19b2f73526afca012746ea13f9ad0cb018b7e36", createdAt: "2026-10-26T08:14:02Z" },
      { label: "Telegram bot worker", publicKeyHex: "3f7a9b2c4d6e8f0a1b3c5d7e9f1a2b4c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a", suiAddress: "0x18a1416f0bc90d71c33546273bd4df336bb40d74e614ea33b67fdde101ceaff3", createdAt: "2026-10-27T13:40:55Z" },
    ],
  },
  chain: { epoch: "1280", checkpoint: "312847391", via: ["Tatum Sui gRPC", "Tatum Sui GraphQL"] },
  blobs: {
    onChainCount: 609,
    sample: [
      { objectId: "0x60e74898a733c428a673fddc8e1e3a6cd5c14ef8b13ae80d441ec67ca4f5539e", blobId: "z7x30Rzh__JntC5HgP_nPsJDUw8-L18ckHCTs3_r4WE", namespace: NS, size: 1984, endEpoch: 47 },
      { objectId: "0x49694df285ec5c8ff4e1712b82dcfae63c4659ffa551205617bb8d4f63a3da3c", blobId: "S3tTDubMw0rPxQ1wN17fTk-mS9Jl9wt08E3G1VCcHek", namespace: NS, size: 2112, endEpoch: 47 },
      { objectId: "0xca0b32bfb069a3339744f646e48ac07332c6c3be359f9f2d75b77cf982546563", blobId: "M9SDbP9hZcciACpPot6C0be65xlGV6tSL9QE-iBT59U", namespace: "mf/u-2c81d4", size: 1736, endEpoch: 47 },
      { objectId: "0x39747e3e40677059045c62b0affe462b6bc4b2b401ea819188b244614af1e5d0", blobId: "Q00ovHIcbRXxK-dCe_AlsyQ3dBmICTyUzohJkCLwC1M", namespace: "mf/u-b09e7f", size: 2240, endEpoch: 46 },
      { objectId: "0xad930c5a63b619f73444db7bfd402d06cab48d788de363fd11e7be3e2a19aa46", blobId: "aXClMNUFmBEaddSDTfkeksi07Rte4VsI2gPle7WskDc", namespace: "mf/u-5e33a0", size: 1872, endEpoch: 46 },
      { objectId: "0x811fd13335614abee67eb8b938a094b0b354e15d3b6c5c2fa08baf27eae8da9f", blobId: "P01sxUNR-PbBsSs8QfBJT2w4V4x5yVIBtcxVxnGcCTs", namespace: "mf/u-2c81d4", size: 2048, endEpoch: 45 },
      { objectId: "0xc2d9393bbccbb28285c75d8157cbd161894dbc34338a62fe2f449bc98223ed77", blobId: "bwgTha_mvfAaOC6NrPkHtaFRoM-HpEBzx-jOoBCgYeo", namespace: null, size: 4096, endEpoch: 44 },
      { objectId: "0xdd0ad7f0206554136c148c22509b8ba72afcb3cc81394657f0fcf2bc4be7f40e", blobId: "ondgK_hqyqJM3pnCjX0EI_75FbJ9QYat-U4Gxtq0oY0", namespace: NS, size: 1920, endEpoch: 44 },
    ],
  },
  relayer: { memories: 612, namespaces: 24 },
  verified: { matched: 606, missing: 6 },
  locks: [
    { date: "2026-11-03", blobId: "Lk7bR2xWq9tYv3MnPzA0cE5hJ8sFgD1uKoXiN6wB4eQ", objectId: "0x7d2a91c04be36f58e1a0d9c37b5f2e486a1c90d3e7b24f5a68c1d0e93b7a2f41", certifiedAt: "2026-11-03T10:01:38Z", firstKickoff: "2026-11-03T12:00:00Z", minutesBefore: 118 },
    { date: "2026-11-02", blobId: "Hq3vT8nWc1yZr6KsLx0pB7dFj2mGa9uEoYiR5tN4wCe", objectId: "0x3b91e0d27c4a58f6e1b0a9d38c7f2e5146a0b9c2d8e7f3a5b6c1d0e9f8a7b2c4", certifiedAt: "2026-11-02T13:46:05Z", firstKickoff: "2026-11-02T15:00:00Z", minutesBefore: 74 },
    { date: "2026-11-01", blobId: "Pz5mK2cXv8bNq1WrTj7yLd0sFh3gAe9uRoUi6tM4nBx", objectId: null, certifiedAt: null, firstKickoff: "2026-11-01T13:30:00Z", minutesBefore: null },
  ],
  checkedAt: "2026-11-03T10:02:48Z",
  links: { account: suiscan(ACCOUNT_ID), owner: `https://suiscan.xyz/mainnet/account/${OWNER}` },
};

// ---------------------------------------------------------------- recall (naive lexical stand-in for vector search)
export function fixtureRecall(q: string): RecallResponse {
  const terms = q.toLowerCase().split(/[^\p{L}\p{N}']+/u).filter((t) => t.length > 1);
  const hits = FIXTURE_MEMORIES.filter((m) => m.blobId)
    .map((m) => {
      const hay = m.text.toLowerCase();
      const matched = terms.filter((t) => hay.includes(t)).length;
      const distance = terms.length ? 1 - matched / terms.length + (hay.length % 17) / 400 : 1;
      return { blobId: m.blobId as string, text: m.text, distance: Math.round(Math.min(distance, 0.99) * 1000) / 1000, createdAt: m.createdAt };
    })
    .filter((h) => h.distance < 0.9)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 8);
  return { hits, latencyMs: 180 + ((q.length * 37) % 140) };
}

/** Labelled samples for the landing page: the same viewer on day 1 and on day 7. */
export const SAMPLE_DAY1 = FIXTURE_HISTORY.filter((p) => p.briefDate === "2026-10-28");
export const SAMPLE_DAY7 = FIXTURE_TODAY;
export const SAMPLE_TZ = FIXTURE_ME.user.tz;

// ---------------------------------------------------------------- tonight (public board, memory off)
/**
 * SAMPLE for GET /api/tonight, used only when that request fails (the UI labels it "Sample").
 * Kick-offs are generated relative to `now`, so the sample reads like a real evening at any hour.
 */
export function fixtureTonight(tz: string, now = Date.now()): TonightResponse {
  const step = 15 * 60_000;
  const base = Math.ceil(now / step) * step;
  const at = (min: number) => new Date(base + min * 60_000).toISOString();
  const up = (matchId: string, inMin: number, competition: string, stage: string | null, home: string, away: string, score: number, reasons: string[]): TonightMatch => ({
    matchId, kickoff: at(inMin), competition, stage, home, away, status: "upcoming", minute: null, score, reasons,
  });
  const tonight: TonightMatch[] = [
    up("smp-t1", 75, "AFC Champions League Elite", "League stage", "Buriram United", "Shanghai Port", 88, ["They average 3.1 goals a game between them", "Both need a win to stay in the top eight"]),
    { matchId: "smp-t2", kickoff: at(-75), competition: "AFC Champions League Elite", stage: "League stage", home: "Al-Ahli", away: "Persepolis", status: "live", minute: 63, score: 85, reasons: ["Level after an hour, with chances at both ends", "Al-Ahli have scored after 75' in four straight"] },
    up("smp-t3", 300, "UEFA Champions League", "League phase", "Club Brugge", "Bayer Leverkusen", 84, ["Two high-pressing sides, 14+ attempts a game each", "Brugge are unbeaten at home this season"]),
    up("smp-t4", 435, "UEFA Champions League", "League phase", "Real Madrid", "Juventus", 79, ["Two of the last three meetings were settled after 80'", "Both sit in the top eight"]),
    up("smp-t5", 435, "UEFA Champions League", "League phase", "Sporting CP", "Galatasaray", 76, ["Both average 2.5+ goals a game", "Galatasaray need a point to go through"]),
    up("smp-t6", 255, "Saudi Pro League", null, "Al-Ittihad", "Al-Nassr", 74, ["Top-of-table meeting", "Last four meetings: 15 goals"]),
    up("smp-t7", 150, "A-League Men", null, "Melbourne Victory", "Sydney FC", 66, ["The Big Blue derby", "Both scored in 8 of the last 9"]),
    up("smp-t8", 660, "Copa Libertadores", "Semi-final, 2nd leg", "Flamengo", "Palmeiras", 64, ["Level on aggregate", "A packed Maracanã"]),
  ];
  const ago = (h: number) => new Date(base - h * 3600_000).toISOString();
  const replays: ReplayMatch[] = [
    { matchId: "smp-r1", kickoff: ago(9), competition: "Primeira Liga", home: "Sporting CP", away: "Benfica", drama: 92, vibe: ["it swings", "late drama", "goals"], homeScore: 3, awayScore: 3 },
    { matchId: "smp-r2", kickoff: ago(11), competition: "Premier League", home: "Brentford", away: "Brighton & Hove Albion", drama: 87, vibe: ["late drama", "end to end"], homeScore: 2, awayScore: 3 },
    { matchId: "smp-r3", kickoff: ago(13), competition: "La Liga", home: "Atlético de Madrid", away: "Villarreal", drama: 78, vibe: ["late drama", "tense"], homeScore: 2, awayScore: 1 },
    { matchId: "smp-r4", kickoff: ago(17), competition: "AFC Champions League Elite", home: "Urawa Red Diamonds", away: "Ulsan HD", drama: 71, vibe: ["goals", "end to end"], homeScore: 2, awayScore: 2 },
    { matchId: "smp-r5", kickoff: ago(20), competition: "Ligue 1", home: "Lyon", away: "Lille", drama: 58, vibe: ["tense"], homeScore: 1, awayScore: 1 },
  ];
  return { tz, scanned: 412, tonight, replays, updatedAt: new Date(now).toISOString() };
}
