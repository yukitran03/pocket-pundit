// Shared API contract between the web UI (app/(site), components) and the API routes (app/api).
// Keep this file free of server-only imports so client components can use it.
import { BRAND } from "./brand.ts";

export type Arm = "memory" | "control";
export type Rating = "loved" | "fine" | "bailed" | "skipped";
export type PickStatus = "upcoming" | "live" | "finished";
export type MemoryKind = "system" | "preference" | "rating" | "lesson" | "limit" | "taste" | "brief" | "night" | "form";
export type WriteStatus = "queued" | "pending" | "stored" | "failed";

export interface Drama {
  score: number; // 0..100, computed from the match timeline after full time
  goals: number;
  lateGoals: number; // goals at 75' or later
  leadChanges: number;
  attempts: number;
  cards: number;
  comeback: boolean;
  tags: string[]; // e.g. ["late-goals", "high-scoring", "comeback", "goalless"]
}

export interface Cite {
  blobId: string;
  text: string;
}

export interface Pick {
  id: string;
  briefDate: string; // YYYY-MM-DD in the user's time zone
  slot: number; // 1..3, display order (shuffled)
  arm: Arm | null; // hidden (null) until the pick is rated or settled, so the A/B stays blind
  kickoff: string; // ISO UTC
  competition: string;
  stage: string | null;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  status: PickStatus;
  score: number; // the agent's 0..100 "worth watching" score
  reasons: string[];
  cites: Cite[]; // memories recalled from Walrus that shaped this pick (empty for control picks)
  rating: Rating | null;
  drama: Drama | null;
  form?: MatchForm | null; // recent form of both sides when the pick was made (from the public feed)
  logos?: TeamLogos | null; // official crests, only when the server enables them
  // Tonight's brief is written to Walrus before kick-off, so picks (and which arm chose them) can't be edited later.
  lock?: { blobId: string | null; lockedAt: string; minutesBeforeKickoff: number } | null;
}

/** Team pictures from the public football feed. Absent unless the server enables official crests. */
export interface TeamLogos {
  home: string | null;
  away: string | null;
}

/** Recent form of one side (last ~5 matches in the feed). */
export interface FormLine {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface MatchForm {
  home: FormLine | null;
  away: FormLine | null;
}

/** GET /api/tonight?tz=Area/City — public, no login. The agent with memory off, for anyone. */
export interface TonightMatch {
  matchId: string;
  kickoff: string; // ISO UTC
  competition: string;
  stage: string | null;
  home: string;
  away: string;
  status: "upcoming" | "live";
  minute: number | null; // when live
  score: number; // 0..100 "worth watching" for a neutral fan
  reasons: string[]; // at most 2, short
  form?: MatchForm | null;
  logos?: TeamLogos | null;
}

export interface ReplayMatch {
  matchId: string;
  kickoff: string; // ISO UTC
  competition: string;
  home: string;
  away: string;
  drama: number; // 0..100 from the real timeline
  vibe: string[]; // spoiler-safe words only, e.g. "late drama", "end to end", "tense"
  homeScore: number | null; // the UI hides these until the viewer chooses to reveal
  awayScore: number | null;
  logos?: TeamLogos | null;
}

export interface TonightResponse {
  tz: string;
  scanned: number; // fixtures looked at in the next 12 hours
  tonight: TonightMatch[]; // up to 8, best first
  replays: ReplayMatch[]; // up to 6 finished in the last 24 hours, best first
  updatedAt: string;
}

export interface MemoryRow {
  blobId: string | null; // null until stored
  kind: MemoryKind;
  text: string;
  createdAt: string;
  status: WriteStatus;
  namespace: string;
  suiObjectId: string | null;
  endEpoch: number | null;
  walruscanUrl: string | null;
  suiscanUrl: string | null;
}

export interface TasteWeight {
  key: string; // e.g. "comp:uefa-champions-league", "team:como", "signal:late-goals", "limit:kickoff-after-02"
  label: string; // human label, e.g. "UEFA Champions League"
  weight: number; // -1..1
  evidence: number; // how many memories support it
}

export interface ArmStats {
  n: number;
  loved: number;
  fine: number;
  bailed: number;
  skipped: number;
  avgDrama: number | null;
  score: number | null; // mean rating score: loved=2, fine=1, bailed=0 (skipped excluded)
}

export interface MeResponse {
  user: {
    name: string;
    tz: string;
    briefHour: number; // local hour 0..23 when the daily picks are sent
    windowStart: number; // local hour the viewer can start watching (0..23)
    windowEnd: number; // local hour the window ends; may exceed 24 to mean "next day" (e.g. 26 = 02:00)
    namespace: string;
    joinedAt: string;
    dayIndex: number; // days since joining, 1-based
  };
  today: Pick[];
  history: Pick[]; // last 14 days, newest first
  taste: {
    competitions: TasteWeight[];
    teams: TasteWeight[];
    signals: TasteWeight[];
    limits: TasteWeight[];
    form?: TasteWeight[]; // league form learned from night reports (moves memory-on picks only)
  };
  memories: MemoryRow[]; // newest first
  ab: { memory: ArmStats; control: ArmStats };
  // The same evening ranked with memory on and with memory off (stored at brief time), newest first. Sealed (lists
  // left out of the response) until that night's picks have finished, so it can't give away the memory-off pick.
  memorySwitch?: SwitchNight[];
  shares: { username: string; since: string }[];
  currentWalrusEpoch?: number; // latest Walrus epoch seen on-chain (via Tatum), for expiry countdowns
}

export interface SwitchRow {
  matchId: string;
  home: string;
  away: string;
  competition: string;
  kickoff: string;
  base: number; // memory-off score (0..100)
  mem: number; // memory-on score
  rankOn: number; // rank among every match considered that evening, memory on
  rankOff: number; // … memory off
  why: string | null; // why memory moved it; null when both lists agree
  cites: Cite[]; // the Walrus memories behind `why`
  picked: boolean; // it was one of the three picks sent that evening
  rating: Rating | null; // the viewer's rating, when picked and rated
  drama: number | null; // what happened, from the night report (null before it, or no result in the feed)
  nightRank: number | null; // rank among the night's finished matches
}

export interface SwitchNight {
  date: string;
  sealed: boolean;
  changed: number; // memory-on picks the memory-off ranking would not have made (0..3)
  considered: number;
  scored: number | null; // finished matches in the night report, once there is one
  on: SwitchRow[]; // empty while sealed
  off: SwitchRow[];
}

export interface StatsResponse {
  memoriesStored: number;
  users: number;
  picksSent: number;
  picksRated: number;
  matchesScanned: number; // fixtures considered across all briefs
  ab: { memory: ArmStats; control: ArmStats };
  // Night reports: every finished match in a viewer's window ranked by drama after the fact, and where the picks
  // (locked on Walrus before kick-off) landed. byArm counts only nights whose picks have all been answered.
  nights?: { nights: number; caught: number; top3Nights: number; byArm: { nights: number; memory: number; control: number } };
  // Memory switch across every brief: of the memory-on top three, how many the memory-off ranking would have missed.
  switch?: { briefs: number; changed: number; slots: number };
  // Anonymised and spoiler-free. headline/detail are ready to show; text is the raw memory sentence (no tags).
  recentLessons: { text: string; createdAt: string; blobId: string | null; kind?: "rating" | "lesson"; verdict?: Rating | null; headline?: string; detail?: string }[];
  updatedAt: string;
}

export interface ProofResponse {
  network: "mainnet";
  account: {
    id: string;
    owner: string;
    active: boolean;
    delegateKeys: { label: string; publicKeyHex: string; suiAddress: string; createdAt: string }[];
  } | null;
  chain: { epoch: string | null; checkpoint: string | null; via: string[] };
  blobs: {
    onChainCount: number; // Walrus Blob objects owned by the account owner (read via Tatum)
    sample: { objectId: string; blobId: string; namespace: string | null; size: number; endEpoch: number | null }[];
  };
  relayer: { memories: number; namespaces: number };
  verified: { matched: number; missing: number }; // relayer memories that have a matching on-chain Blob
  // Brief locks: tonight's picks written to Walrus before kick-off; certification time read from Sui via Tatum.
  locks?: { date: string; blobId: string; objectId: string | null; certifiedAt: string | null; firstKickoff: string; minutesBefore: number | null }[];
  checkedAt: string;
  links: { account: string; owner: string };
}

export interface RecallResponse {
  hits: { blobId: string; text: string; distance: number; createdAt: string | null }[];
  latencyMs: number;
}

export interface SettingsBody {
  tz?: string;
  briefHour?: number;
  windowStart?: number;
  windowEnd?: number;
}

export interface NewMemoryBody {
  text: string;
  supersedes?: string; // blobId of the memory this one corrects
}

export const BOT_URL = BRAND.botUrl;
