// Shared API contract between the web UI (app/(site), components) and the API routes (app/api).
// Keep this file free of server-only imports so client components can use it.

export type Arm = "memory" | "control";
export type Rating = "loved" | "fine" | "bailed" | "skipped";
export type PickStatus = "upcoming" | "live" | "finished";
export type MemoryKind = "system" | "preference" | "rating" | "lesson" | "limit" | "taste";
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
  };
  memories: MemoryRow[]; // newest first
  ab: { memory: ArmStats; control: ArmStats };
  shares: { username: string; since: string }[];
  currentWalrusEpoch?: number; // latest Walrus epoch seen on-chain (via Tatum), for expiry countdowns
}

export interface StatsResponse {
  memoriesStored: number;
  users: number;
  picksSent: number;
  picksRated: number;
  matchesScanned: number; // fixtures considered across all briefs
  ab: { memory: ArmStats; control: ArmStats };
  recentLessons: { text: string; createdAt: string; blobId: string | null }[]; // anonymised
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

export const BOT_URL = "https://t.me/finder_matching_bot";
