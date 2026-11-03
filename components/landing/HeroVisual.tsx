"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { PitchFallback } from "@/components/three/PitchFallback";
import { SceneBoundary } from "@/components/three/SceneBoundary";
import { useIdle, useInView, useReducedMotion, useWebGL } from "@/components/three/hooks";
import { KIND_META, PRIMARY_KINDS } from "@/lib/client/kinds";
import { fmtInt } from "@/lib/client/format";
import { useStats } from "./StatsProvider";
import { useSeason } from "@/components/season/useSeason";
import { SeasonChip } from "@/components/season/Season";

const NightPitchScene = dynamic(() => import("@/components/three/NightPitchScene"), { ssr: false, loading: () => null });

export function HeroVisual() {
  const stats = useStats();
  const { snow, decor } = useSeason();
  const reduced = useReducedMotion();
  const webgl = useWebGL();
  const idle = useIdle();
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // 0 while the visual sits in place, 1 once it has scrolled past the header: drives the camera tilt and the rising picks.
  const scroll = useRef(0);
  useEffect(() => {
    const el = box.current;
    if (!el || reduced) return;
    const onScroll = () => {
      const r = el.getBoundingClientRect();
      scroll.current = Math.min(1, Math.max(0, (80 - r.top) / Math.max(1, r.height * 0.85)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reduced]);

  const stored = stats.status === "ok" ? stats.data.memoriesStored : null;
  const count = stored === null ? 28 : Math.max(18, Math.min(64, stored));
  const show3d = webgl === true && idle && !failed;

  return (
    <div ref={box} className="relative h-full w-full">
      <SeasonChip className="absolute left-[var(--gutter)] top-3 z-10 sm:left-5 sm:top-5" />
      <div
        className="relative aspect-[4/3] w-full sm:absolute sm:inset-0 sm:aspect-auto"
        style={{
          maskImage: "radial-gradient(120% 95% at 55% 55%, #000 55%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(120% 95% at 55% 55%, #000 55%, transparent 100%)",
        }}
      >
        <PitchFallback className={`transition-opacity duration-700 ${ready ? "opacity-0" : "opacity-100"}`} />
        {show3d ? (
          <div className={`absolute inset-0 transition-opacity duration-1000 ${ready ? "opacity-100" : "opacity-0"}`}>
            <SceneBoundary onError={() => setFailed(true)}>
              <NightPitchScene memoryCount={count} reducedMotion={reduced} active={inView} scroll={scroll} snow={snow} trees={decor} onReady={() => setReady(true)} />
            </SceneBoundary>
          </div>
        ) : null}
      </div>

      {/* Caption: what the picture shows, in words, so the visual is never the only carrier. */}
      <div className="pointer-events-none relative flex flex-col gap-3 px-[var(--gutter)] pt-1 sm:absolute sm:inset-x-0 sm:bottom-0 sm:flex-row sm:items-end sm:justify-between sm:p-5">
        <p className="max-w-xs text-xs text-chalk-2">
          Each card is something a pundit has learned about its viewer (<span className="text-chalk">{stored === null ? "…" : fmtInt(stored)}</span> so far). Every evening a few{" "}
          <span className="text-flare">light up</span> to choose tonight’s pick.
        </p>
        <ul className="flex flex-wrap gap-x-3 gap-y-1.5" aria-label="Memory kinds">
          {PRIMARY_KINDS.map((k) => (
            <li key={k} className="inline-flex items-center gap-1.5 text-[0.7rem] text-chalk-3">
              <span aria-hidden className="h-2 w-2 rounded-[2px]" style={{ background: KIND_META[k].color }} />
              {KIND_META[k].label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
