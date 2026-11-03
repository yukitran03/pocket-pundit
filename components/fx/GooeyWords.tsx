"use client";

import { useEffect, useId, useRef } from "react";

/**
 * Cycles a few phrases with a liquid "gooey" morph: the outgoing phrase blurs out while the incoming one
 * blurs in, and an SVG alpha-threshold filter turns the overlap into one melting shape. Our own take on
 * the blur + threshold technique.
 *
 * - Decorative only (aria-hidden). Put the real sentence in the heading for SEO and screen readers.
 * - All phrases are stacked in one grid cell, so the box is sized by the longest one: no layout shift.
 * - The filter is applied only during a morph, so the resting text is crisp.
 * - Stops under prefers-reduced-motion, while the tab is hidden, and while it is off-screen.
 */
export function GooeyWords({ phrases, holdMs = 3200, morphMs = 900, className = "" }: { phrases: string[]; holdMs?: number; morphMs?: number; className?: string }) {
  const filterId = `goo-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const root = useRef<HTMLSpanElement>(null);
  const a = useRef<HTMLSpanElement>(null);
  const b = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = root.current;
    const A = a.current;
    const B = b.current;
    if (!el || !A || !B || phrases.length < 2) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = true;
    let raf = 0;
    let timer = 0;
    let i = 0;
    let stopped = mq.matches;

    const rest = () => {
      el.style.filter = "none";
      A.style.filter = "none";
      A.style.opacity = "1";
      B.style.opacity = "0";
      B.style.filter = "none";
    };

    const morph = () => {
      if (stopped || !visible || document.hidden) {
        timer = window.setTimeout(morph, holdMs);
        return;
      }
      const next = (i + 1) % phrases.length;
      A.textContent = phrases[i];
      B.textContent = phrases[next];
      el.style.filter = `url(#${filterId})`;
      const t0 = performance.now();
      const step = (now: number) => {
        const f = Math.min(1, (now - t0) / morphMs);
        // Blur grows as each phrase gets fainter; capped so nothing smears across the page.
        const inF = Math.max(f, 0.0001);
        const outF = Math.max(1 - f, 0.0001);
        B.style.filter = `blur(${Math.min(5 / inF - 5, 12)}px)`;
        B.style.opacity = `${Math.pow(f, 0.4)}`;
        A.style.filter = `blur(${Math.min(5 / outF - 5, 12)}px)`;
        A.style.opacity = `${Math.pow(1 - f, 0.4)}`;
        if (f < 1) raf = requestAnimationFrame(step);
        else {
          i = next;
          A.textContent = phrases[i];
          rest();
          timer = window.setTimeout(morph, holdMs);
        }
      };
      raf = requestAnimationFrame(step);
    };

    const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(([e]) => (visible = e.isIntersecting)) : null;
    io?.observe(el);
    const onMotion = () => {
      stopped = mq.matches;
      if (stopped) {
        cancelAnimationFrame(raf);
        i = 0;
        A.textContent = phrases[0];
        rest();
      }
    };
    mq.addEventListener("change", onMotion);
    rest();
    timer = window.setTimeout(morph, holdMs);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      io?.disconnect();
      mq.removeEventListener("change", onMotion);
    };
  }, [phrases, holdMs, morphMs, filterId]);

  return (
    <span aria-hidden className={`relative inline-grid align-top ${className}`}>
      <svg width="0" height="0" className="absolute" focusable={false}>
        <filter id={filterId}>
          <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 255 -140" />
        </filter>
      </svg>
      {/* Sizers: invisible, but they reserve the widest phrase. */}
      {phrases.map((p) => (
        <span key={p} className="invisible col-start-1 row-start-1 whitespace-nowrap">{p}</span>
      ))}
      <span ref={root} className="col-start-1 row-start-1 grid">
        <span ref={a} className="col-start-1 row-start-1 whitespace-nowrap">{phrases[0]}</span>
        <span ref={b} className="col-start-1 row-start-1 whitespace-nowrap opacity-0">{phrases[1] ?? ""}</span>
      </span>
    </span>
  );
}
