"use client";

import { useEffect, useRef } from "react";

/**
 * The VS plate (or the score) in the middle of a VsPanel, plus the panel's motion:
 * - the plate "slams" in once and a shine sweeps the crests when the panel first enters view;
 * - on a fine pointer, the panel tilts a few degrees toward the cursor (CSS perspective, crests on top).
 * Nothing moves under prefers-reduced-motion, and the server HTML is the finished, static state.
 */
export function VsMotion({ score, size }: { score: { home: number; away: number } | null; size: "md" | "lg" }) {
  const plate = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = plate.current;
    const vs = el?.closest<HTMLElement>(".vs");
    const panel = vs?.querySelector<HTMLElement>(".vs-panel");
    if (!el || !vs || !panel) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Entrance: once, when the panel is first on screen.
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      vs.dataset.vs = "wait";
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            vs.dataset.vs = "in";
            io?.disconnect();
          }
        },
        { threshold: 0.35 },
      );
      io.observe(vs);
    }

    // Tilt toward the pointer (mouse and pen only).
    let raf = 0;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = panel.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        panel.style.setProperty("--ry", `${(x * 7).toFixed(2)}deg`);
        panel.style.setProperty("--rx", `${(-y * 5).toFixed(2)}deg`);
        panel.style.setProperty("--px", `${(x * 8).toFixed(1)}px`);
        panel.style.setProperty("--py", `${(y * 6).toFixed(1)}px`);
      });
    };
    const leave = () => {
      cancelAnimationFrame(raf);
      panel.style.setProperty("--ry", "0deg");
      panel.style.setProperty("--rx", "0deg");
      panel.style.setProperty("--px", "0px");
      panel.style.setProperty("--py", "0px");
    };
    if (fine) {
      panel.addEventListener("pointermove", move);
      panel.addEventListener("pointerleave", leave);
    }
    return () => {
      io?.disconnect();
      cancelAnimationFrame(raf);
      panel.removeEventListener("pointermove", move);
      panel.removeEventListener("pointerleave", leave);
      vs.dataset.vs = "in";
    };
  }, []);

  const big = size === "lg";
  return (
    <span ref={plate} className={`vs-emblem inline-grid -skew-x-12 place-items-center rounded-[5px] bg-chalk text-ink-0 shadow-[0_10px_30px_-8px_rgb(0_0_0/0.7)] ${score ? (big ? "h-14 px-4" : "h-11 px-3") : big ? "h-12 px-3.5" : "h-9 px-2.5"}`}>
      <span className={`skew-x-12 font-display font-extrabold leading-none tnum ${score ? (big ? "text-[2.4rem]" : "text-[1.8rem]") : big ? "text-[1.9rem]" : "text-[1.35rem]"}`}>
        {score ? (
          <>
            {score.home}
            <span className="mx-1 opacity-50">–</span>
            {score.away}
          </>
        ) : (
          "VS"
        )}
      </span>
    </span>
  );
}
