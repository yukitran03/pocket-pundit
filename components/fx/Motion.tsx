"use client";

import { useEffect, useLayoutEffect } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

/**
 * Lenis smooth scrolling for wheel and trackpad. Off under prefers-reduced-motion and on touch-first
 * devices (native momentum scrolling is better there). Anchor links are handled by Lenis and respect
 * the page's scroll-padding-top. Nested scrollers opt out with data-lenis-prevent.
 */
export function SmoothScroll() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = window.matchMedia("(pointer: coarse)");
    if (reduce.matches || coarse.matches) return;
    const lenis = new Lenis({ autoRaf: true, lerp: 0.11, wheelMultiplier: 1, anchors: true, stopInertiaOnNavigate: true, allowNestedScroll: true });
    const onChange = () => reduce.matches && lenis.destroy();
    reduce.addEventListener("change", onChange);
    return () => {
      reduce.removeEventListener("change", onChange);
      lenis.destroy();
    };
  }, []);
  return null;
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Soft reveal for blocks marked data-reveal. Server HTML is always fully visible (no JS, no problem).
 * After hydration, only blocks still below the fold are set to "pending", before the browser paints,
 * so nothing that was already visible ever flickers. They fade up once when scrolled into view.
 * Does nothing under prefers-reduced-motion.
 */
export function ScrollReveal() {
  useIsoLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof IntersectionObserver === "undefined") return;
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const fold = window.innerHeight * 0.92;
    const pending = els.filter((el) => el.getBoundingClientRect().top > fold);
    pending.forEach((el) => (el.dataset.reveal = "pending"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.reveal = "in";
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    pending.forEach((el) => io.observe(el));
    // Never leave content hidden: anything still pending after a jump (anchor, find-in-page) is shown.
    const reveal = () => pending.forEach((el) => el.dataset.reveal === "pending" && el.getBoundingClientRect().top < window.innerHeight && (el.dataset.reveal = "in"));
    window.addEventListener("hashchange", reveal);
    return () => {
      io.disconnect();
      window.removeEventListener("hashchange", reveal);
      pending.forEach((el) => (el.dataset.reveal = "in"));
    };
  }, []);
  return null;
}
