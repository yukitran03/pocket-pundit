"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconEye } from "@/components/site/Icons";

type Phase = "covered" | "burning" | "revealed";

/**
 * Spoiler cover that burns away when asked. The hidden content is not in the DOM until the viewer
 * chooses to reveal it, so it can't be read by accident (or by a screen reader) beforehand.
 * - WebGL + motion allowed: the cover is redrawn into a 2D canvas and burnt away from the click point.
 * - prefers-reduced-motion, no WebGL, or any shader failure: the content appears instantly.
 * After revealing, focus moves to the content so keyboard and screen-reader users land on it.
 */
export function BurnReveal({
  label = "Reveal score",
  hint = "Score hidden",
  srLabel,
  children,
  className = "",
  height = 64,
  burst = false,
}: {
  label?: string;
  hint?: string;
  srLabel: string;
  children: ReactNode;
  className?: string;
  height?: number;
  /** A short flare burst once the burn finishes (only after a real burn, never on the instant path). */
  burst?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("covered");
  const box = useRef<HTMLDivElement>(null);
  const cover = useRef<HTMLButtonElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const origin = useRef<[number, number]>([0.5, 0.5]);
  const paper = useRef<HTMLCanvasElement | null>(null);
  const [bursting, setBursting] = useState(false);

  // Start the burn once the canvas is mounted over the cover.
  useEffect(() => {
    if (phase !== "burning" || !canvas.current || !paper.current) return;
    let cancelled = false;
    const el = canvas.current;
    let burnt = false;
    import("./burn")
      .then(({ burn }) => burn({ canvas: el, paper: paper.current!, origin: origin.current, onFirstFrame: () => cover.current && (cover.current.style.visibility = "hidden") }))
      .then(() => {
        burnt = true;
      })
      .catch(() => undefined)
      .finally(() => {
        if (cancelled) return;
        setPhase("revealed");
        if (burnt && burst) {
          setBursting(true);
          setTimeout(() => setBursting(false), 1000);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [phase]);

  useEffect(() => {
    if (phase === "revealed") content.current?.focus({ preventScroll: true });
  }, [phase]);

  const reveal = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    const r = btn.getBoundingClientRect();
    // Keyboard activation reports 0,0: ignite from the middle.
    origin.current = e.clientX || e.clientY ? [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height] : [0.5, 0.5];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sheet = reduced ? null : paintCover(btn);
    if (!sheet) {
      setPhase("revealed");
      return;
    }
    paper.current = sheet;
    setPhase("burning");
  };

  return (
    <div ref={box} className={`relative overflow-hidden rounded-[10px] ${className}`} style={{ minHeight: height }}>
      {phase !== "covered" ? (
        <div ref={content} tabIndex={-1} className="flex h-full min-h-[inherit] items-center justify-center outline-none">
          {children}
        </div>
      ) : null}
      {phase !== "revealed" ? (
        <button
          ref={cover}
          type="button"
          onClick={reveal}
          disabled={phase === "burning"}
          aria-label={srLabel}
          className="spoiler-cover absolute inset-0 flex w-full items-center justify-between gap-3 px-4 text-left"
        >
          <span className="text-xs text-chalk-3">{hint}</span>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-chalk">
            <IconEye size={16} /> {label}
          </span>
        </button>
      ) : null}
      {phase === "burning" ? <canvas ref={canvas} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" /> : null}
      {bursting ? (
        <span aria-hidden className="flare-burst">
          <b />
          {Array.from({ length: 10 }, (_, i) => (
            <i key={i} style={{ "--a": `${i * 36 + 8}deg`, "--d": `${(i % 3) * 40}ms` } as React.CSSProperties} />
          ))}
        </span>
      ) : null}
    </div>
  );
}

/** Redraw the cover (surface, hatch, the two labels) into a 2D canvas the shader can burn. Null without WebGL. */
function paintCover(btn: HTMLButtonElement): HTMLCanvasElement | null {
  try {
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl");
    if (!gl) return null;
    gl.getExtension("WEBGL_lose_context")?.loseContext();

    const r = btn.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(r.width * dpr));
    c.height = Math.max(1, Math.round(r.height * dpr));
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.scale(dpr, dpr);

    const css = getComputedStyle(document.documentElement);
    const v = (n: string, fb: string) => css.getPropertyValue(n).trim() || fb;
    const radius = 10;
    ctx.beginPath();
    ctx.roundRect(0, 0, r.width, r.height, radius);
    ctx.clip();
    ctx.fillStyle = v("--ink-2", "#122219");
    ctx.fillRect(0, 0, r.width, r.height);
    // Same diagonal hatch as .spoiler-cover
    ctx.strokeStyle = v("--ink-3", "#1a2e23");
    ctx.lineWidth = 3.5;
    for (let x = -r.height; x < r.width + r.height; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, r.height);
      ctx.lineTo(x + r.height, 0);
      ctx.stroke();
    }
    ctx.strokeStyle = v("--line-strong", "rgba(226,238,228,.18)");
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(0.5, 0.5, r.width - 1, r.height - 1, radius);
    ctx.stroke();

    // Copy the two text labels at their real positions and fonts.
    const spans = btn.querySelectorAll<HTMLSpanElement>(":scope > span");
    spans.forEach((s) => {
      const sr = s.getBoundingClientRect();
      const st = getComputedStyle(s);
      ctx.font = `${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
      ctx.fillStyle = st.color;
      ctx.textBaseline = "middle";
      const svg = s.querySelector("svg");
      let x = sr.left - r.left;
      if (svg) {
        const ir = svg.getBoundingClientRect();
        ctx.strokeStyle = st.color;
        ctx.lineWidth = 1.6;
        const cx = ir.left - r.left + ir.width / 2;
        const cy = ir.top - r.top + ir.height / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, ir.width * 0.42, ir.height * 0.26, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, ir.width * 0.12, 0, Math.PI * 2);
        ctx.fill();
        x = ir.right - r.left + 6;
      }
      ctx.fillText(s.textContent?.trim() ?? "", x, sr.top - r.top + sr.height / 2);
    });
    return c;
  } catch {
    return null;
  }
}
