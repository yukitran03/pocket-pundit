"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const motionOk = () => typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/**
 * Pointer-follow spotlight for a card: a soft glow in the team colour of the side you're over.
 * Drop it inside any positioned card that carries --home/--away (data-team-tints). Decorative only:
 * mouse and pen, transform and opacity, nothing under reduced motion.
 */
export function CardSpot() {
  const spot = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = spot.current;
    const card = el?.parentElement;
    if (!el || !card || !motionOk() || !finePointer()) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        const side = x < r.width / 2 ? "--home" : "--away";
        const tint = getComputedStyle(card).getPropertyValue(side).trim() || "238 243 236";
        el.style.setProperty("--spot", tint);
        el.style.transform = `translate3d(${x - 210}px, ${y - 210}px, 0)`;
        el.style.opacity = "1";
      });
    };
    const leave = () => {
      cancelAnimationFrame(raf);
      el.style.opacity = "0";
    };
    card.addEventListener("pointermove", move);
    card.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      card.removeEventListener("pointermove", move);
      card.removeEventListener("pointerleave", leave);
    };
  }, []);
  return <span ref={spot} aria-hidden className="card-spot" />;
}

/**
 * Team-colour border for the featured VS card: a conic gradient (home to away) that sweeps once around the
 * card when it first comes into view, and once more on hover, then rests. The sweep is a transform on a
 * square layer sized to the card's diagonal, so it stays on the compositor.
 */
export function Aura({ tints, children, className = "" }: { tints: { home: string; away: string; homeA: number; awayA: number }; children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [d, setD] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setD(Math.ceil(Math.hypot(r.width, r.height)) + 4);
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    let io: IntersectionObserver | null = null;
    if (motionOk() && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver((es) => {
        if (es.some((e) => e.isIntersecting)) {
          el.dataset.aura = "in";
          io?.disconnect();
        }
      }, { threshold: 0.3 });
      io.observe(el);
    }
    return () => {
      ro?.disconnect();
      io?.disconnect();
    };
  }, []);
  const style = { "--home": tints.home, "--away": tints.away, "--home-a": tints.homeA, "--away-a": tints.awayA, "--aura-d": d ? `${d}px` : "200%" } as CSSProperties;
  return (
    <div ref={box} data-team-tints className={`aura ${className}`} style={style}>
      <span aria-hidden className="aura-ring" />
      {children}
    </div>
  );
}

/**
 * Counts a number up from 0 the first time it comes into view (ease-out, about 0.9 s). The real value is
 * rendered on the server and kept for screen readers; only the visible digits animate. Static under
 * reduced motion.
 */
export function CountUp({ value, format = (n) => String(Math.round(n)), duration = 900, className = "" }: { value: number; format?: (n: number) => string; duration?: number; className?: string }) {
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = el.current;
    if (!node || !motionOk() || typeof IntersectionObserver === "undefined") return;
    let raf = 0;
    // Off-screen at mount: show 0 now (nobody sees it) so the count starts cleanly when it scrolls in.
    const r = node.getBoundingClientRect();
    if (r.top > window.innerHeight || r.bottom < 0) node.textContent = format(0);
    const run = () => {
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / duration);
        const e = 1 - Math.pow(1 - p, 3);
        node.textContent = format(value * e);
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        io.disconnect();
        run();
      }
    }, { threshold: 0.6 });
    io.observe(node);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      node.textContent = format(value);
    };
  }, [value, duration]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <span ref={el} aria-hidden className={className}>{format(value)}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}
