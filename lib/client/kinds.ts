import type { MemoryKind, Rating, WriteStatus } from "@/lib/contract";

export type KindShape = "sphere" | "cube" | "octa" | "torus" | "tetra";

// Categorical palette validated all-pairs on #0c1a14 (dark). Always paired with shape + label.
export const KIND_META: Record<MemoryKind, { label: string; color: string; shape: KindShape; blurb: string }> = {
  rating: { label: "Rating", color: "#c98500", shape: "sphere", blurb: "How a match you watched felt" },
  preference: { label: "Preference", color: "#9085e9", shape: "cube", blurb: "Something you told it" },
  lesson: { label: "Lesson", color: "#008300", shape: "octa", blurb: "What it concluded" },
  limit: { label: "Limit", color: "#d55181", shape: "torus", blurb: "A hard boundary" },
  taste: { label: "Taste", color: "#83958a", shape: "tetra", blurb: "A derived taste weight" },
  system: { label: "System", color: "#83958a", shape: "tetra", blurb: "Account bookkeeping" },
};

export const PRIMARY_KINDS: MemoryKind[] = ["rating", "lesson", "preference", "limit"];

export const RATING_META: Record<Rating, { label: string; value: number | null }> = {
  loved: { label: "Loved", value: 2 },
  fine: { label: "Fine", value: 1 },
  bailed: { label: "Bailed", value: 0 },
  skipped: { label: "Didn't watch", value: null },
};

export const STATUS_META: Record<WriteStatus, { label: string; tone: "ok" | "warn" | "bad" | "idle"; hint: string }> = {
  queued: { label: "Queued", tone: "idle", hint: "Waiting to be encrypted and uploaded" },
  pending: { label: "Pending", tone: "warn", hint: "Uploaded to Walrus, waiting for the on-chain certificate" },
  stored: { label: "Stored", tone: "ok", hint: "Certified on Walrus with a Sui Blob object" },
  failed: { label: "Failed", tone: "bad", hint: "The write failed and will be retried" },
};
