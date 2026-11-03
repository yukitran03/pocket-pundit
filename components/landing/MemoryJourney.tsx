"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { JourneyDrive } from "@/components/three/MemoryJourneyScene";
import { SceneBoundary } from "@/components/three/SceneBoundary";
import { useIdle, useInView, useReducedMotion, useWebGL } from "@/components/three/hooks";

const MemoryJourneyScene = dynamic(() => import("@/components/three/MemoryJourneyScene"), { ssr: false, loading: () => null });

/**
 * One memory's trip, in 3D: rating → sealed Walrus blob → read back from a Sui checkpoint via Tatum.
 * Scroll drives it; when the visitor stops scrolling it loops slowly. The SVG poster is the first paint,
 * the reduced-motion view and the no-WebGL view, and its caption carries the meaning in words.
 */
export function MemoryJourney() {
  const box = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const webgl = useWebGL();
  const idle = useIdle(1500);
  const inView = useInView(box, "200px");
  const [hidden, setHidden] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [wide, setWide] = useState(true);
  const drive = useRef<JourneyDrive>({ scroll: 0.1, scrolledAt: 0 });
  const labelEls = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState === "hidden");
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWide(el.getBoundingClientRect().width >= 520);
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    const onScroll = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // 0 when the scene's top enters the lower 10% of the screen, 1 when it reaches the top 10%.
      drive.current.scroll = Math.min(1, Math.max(0, (vh * 0.9 - r.top) / (vh * 0.8)));
      drive.current.scrolledAt = performance.now();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const show3d = webgl === true && !reduced && idle && !failed;

  return (
    <figure className="card overflow-hidden">
      <div ref={box} className="relative aspect-[4/3] w-full bg-ink-0 sm:aspect-[16/10]">
        <JourneyPoster className={`absolute inset-0 transition-opacity duration-700 ${show3d && ready ? "opacity-0" : "opacity-100"}`} />
        {show3d ? (
          <div className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}>
            <SceneBoundary onError={() => setFailed(true)}>
              <MemoryJourneyScene drive={drive} active={inView && !hidden} labels={labelEls} onReady={() => setReady(true)} />
            </SceneBoundary>
          </div>
        ) : null}
        {show3d ? (
          <div aria-hidden className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${ready && wide ? "opacity-100" : "opacity-0"}`}>
            {[
              ["Your rating", "after full time"],
              ["Sealed on Walrus", "encrypted blob"],
              ["Sui checkpoint", "read via Tatum"],
            ].map(([t, d], i) => (
              <span key={t} ref={(el) => { labelEls.current[i] = el; }} className="absolute left-0 top-0 whitespace-nowrap text-center opacity-0 will-change-transform">
                <span className="block text-[0.8rem] font-semibold leading-tight text-chalk">{t}</span>
                <span className="block text-[0.7rem] leading-tight text-chalk-3">{d}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <figcaption className="grid gap-3 border-t border-[var(--line)] p-4 text-sm sm:grid-cols-3 sm:gap-4 sm:p-5">
        {[
          ["1", "Your rating", "becomes a memory after full time."],
          ["2", "Sealed on Walrus", "as an encrypted blob."],
          ["3", "Read back from Sui", "through Tatum, each time you check."],
        ].map(([n, t, d]) => (
          <p key={n} className="flex gap-2.5">
            <span className="font-display text-xl font-extrabold leading-none text-flare">{n}</span>
            <span><span className="font-medium text-chalk">{t}</span> <span className="text-chalk-3">{d}</span></span>
          </p>
        ))}
      </figcaption>
    </figure>
  );
}

/** Static stand-in: same story, flat. First paint, reduced motion, no WebGL. */
function JourneyPoster({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 640 400" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden focusable={false}>
      <defs>
        <radialGradient id="jp-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#f0531c" stopOpacity="0.55" />
          <stop offset="1" stopColor="#f0531c" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="jp-ring" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#0ca30c" stopOpacity="0.35" />
          <stop offset="1" stopColor="#0ca30c" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="640" height="400" fill="#060e0b" />
      {/* pitch */}
      <polygon points="40,300 200,300 228,352 12,352" fill="#1b5c3b" />
      <g fill="none" stroke="#eef3ec" strokeOpacity="0.7" strokeWidth="1.5">
        <polygon points="40,300 200,300 228,352 12,352" />
        <line x1="120" y1="300" x2="120" y2="352" />
        <ellipse cx="120" cy="326" rx="18" ry="8" />
      </g>
      {/* tile lifting */}
      <rect x="112" y="214" width="40" height="27" rx="4" fill="#c98500" />
      <rect x="117" y="222" width="22" height="3" fill="#1a0f00" />
      <path d="M152 222 C 210 160, 260 150, 300 168" fill="none" stroke="#f0531c" strokeWidth="1.5" strokeDasharray="4 5" />
      {/* blob */}
      <circle cx="320" cy="176" r="34" fill="url(#jp-glow)" />
      <rect x="306" y="162" width="28" height="28" fill="#1a2e23" stroke="#f0531c" strokeWidth="1.6" />
      <rect x="316" y="172" width="8" height="6" fill="#f0531c" />
      {/* stack */}
      {Array.from({ length: 6 }, (_, i) => (
        <g key={i}>
          <polygon points={`${270},${332 - i * 16} ${370},${332 - i * 16} ${386},${342 - i * 16} ${254},${342 - i * 16}`} fill={i === 5 ? "#3a2416" : "#14261c"} stroke="#eef3ec" strokeOpacity="0.28" />
        </g>
      ))}
      {/* beam + ring */}
      <line x1="330" y1="236" x2="512" y2="120" stroke="#8fb8ec" strokeWidth="2" strokeOpacity="0.7" />
      <circle cx="520" cy="114" r="56" fill="url(#jp-ring)" />
      <circle cx="520" cy="114" r="30" fill="none" stroke="#0ca30c" strokeWidth="4" />
      <path d="M508 114 l8 8 l14 -16" fill="none" stroke="#0ca30c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
