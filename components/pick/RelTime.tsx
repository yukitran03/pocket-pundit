"use client";

import { fmtUntil } from "@/lib/client/format";
import { useNow } from "@/lib/client/useNow";

/**
 * "in 2 h", "in 35 min", "kicking off". Shows `fallback` (usually the day) on the server, on the first
 * client render, and whenever the kick-off is too far away for a relative hint to help.
 */
export function UntilKickoff({ iso, fallback = null, className = "" }: { iso: string; fallback?: string | null; className?: string }) {
  const now = useNow();
  const text = (now === null ? null : fmtUntil(iso, now)) ?? fallback;
  if (!text) return null;
  return <span className={className}>{text}</span>;
}
