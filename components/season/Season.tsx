"use client";

import { useEffect, useRef } from "react";
import { winterLabel } from "@/lib/client/season";
import { applySeasonToDocument, setSnow, useSeason } from "./useSeason";

/**
 * Mounted once in the root layout. Mirrors the season on <html> (for the CSS accents) and, when snow is on,
 * adds a very light snow layer over the page. Renders nothing out of season.
 */
export function SeasonLayer() {
  const s = useSeason();
  useEffect(() => applySeasonToDocument(s), [s]);
  return s.snow ? <PageSnow /> : null;
}

/** Light page snow: a fixed canvas, capped at a few dozen flakes, paused while the tab is hidden. */
function PageSnow() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    let w = 0, h = 0, raf = 0, last = performance.now();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    type Flake = { x: number; y: number; r: number; v: number; ph: number; a: number };
    let flakes: Flake[] = [];
    const seed = () => {
      const n = Math.max(14, Math.min(48, Math.round((w * h) / 34_000)));
      flakes = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, r: 0.7 + Math.random() * 1.6, v: 10 + Math.random() * 22, ph: Math.random() * Math.PI * 2, a: 0.25 + Math.random() * 0.45 }));
    };
    const size = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (const f of flakes) {
        f.y += f.v * dt;
        f.x += Math.sin(now / 1600 + f.ph) * 8 * dt;
        if (f.y > h + 4) { f.y = -4; f.x = Math.random() * w; }
        ctx.globalAlpha = f.a;
        ctx.fillStyle = "#eef3ec";
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      if (document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    size();
    start();
    window.addEventListener("resize", size);
    document.addEventListener("visibilitychange", start);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
      document.removeEventListener("visibilitychange", start);
    };
  }, []);
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-40 h-full w-full opacity-60" />;
}

/** "Winter nights · Boxing Day in 53 days" on the hero visual (absolutely placed, so no layout shift). */
export function SeasonChip({ className = "" }: { className?: string }) {
  const s = useSeason();
  if (!s.season) return null;
  return (
    <span className={`chip season-chip !h-7 !bg-ink-0/75 !text-chalk backdrop-blur ${className}`}>
      <SnowGlyph />
      Winter nights <span aria-hidden className="text-chalk-4">·</span> {winterLabel(s.daysToBoxingDay)}
    </span>
  );
}

/** Footer switch, only in season. Remembered in localStorage (try/catch). */
export function SnowToggle() {
  const s = useSeason();
  if (!s.season) return null;
  if (s.reduced) return <p className="text-xs text-chalk-4">Snow is off because your device asks for reduced motion.</p>;
  const on = s.pref === "on";
  return (
    <button type="button" onClick={() => setSnow(!on)} aria-pressed={on} className="btn btn-quiet !min-h-[32px] !px-2.5 !text-xs">
      <SnowGlyph /> Snow {on ? "on" : "off"}
    </button>
  );
}

/** Warm string lights along the bottom of the header: they warm up once, then glow quietly. */
export function HeaderLights() {
  const s = useSeason();
  if (!s.season) return null;
  const n = 28;
  return (
    <span aria-hidden className="header-lights pointer-events-none absolute inset-x-0 -bottom-[7px] h-[12px] overflow-hidden">
      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${n * 10} 12`} preserveAspectRatio="none">
        <path
          d={Array.from({ length: n }, (_, i) => `${i === 0 ? "M0 1" : ""} Q ${i * 10 + 5} 8 ${i * 10 + 10} 1`).join(" ")}
          fill="none"
          stroke="rgb(238 243 236 / 0.22)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {Array.from({ length: n }, (_, i) => (
        <i key={i} style={{ left: `${((i + 0.5) / n) * 100}%`, animationDelay: `${(i % 7) * 140 + Math.floor(i / 7) * 60}ms` }} />
      ))}
    </span>
  );
}

function SnowGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden focusable={false} className="shrink-0">
      <path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5M9.5 4 12 6.5 14.5 4M9.5 20l2.5-2.5 2.5 2.5" />
    </svg>
  );
}
