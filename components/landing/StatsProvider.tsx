"use client";

import { createContext, useContext, type ReactNode } from "react";
import { getStats } from "@/lib/client/api";
import { useApi } from "@/lib/client/useApi";
import type { StatsResponse } from "@/lib/contract";

type StatsCtx = ReturnType<typeof useApi<StatsResponse>>;
const Ctx = createContext<StatsCtx | null>(null);

/** One /api/stats request shared by every live section of the landing page. */
export function StatsProvider({ children }: { children: ReactNode }) {
  const state = useApi<StatsResponse>((signal) => getStats(signal), "stats");
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function useStats(): StatsCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStats must be used inside <StatsProvider>");
  return v;
}
