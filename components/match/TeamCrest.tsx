"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Deterministic monogram crest: a shield with the team's initials, coloured from a hash of its name, so the
 * same name always gives the same crest. When the server enables official crests (OFFICIAL_CRESTS=1) it
 * passes the public feed's team picture as `logo`; if that image fails, the monogram shows instead.
 */

import { CREST_PALETTE, hashName, teamInitials } from "./crest";

const SHIELD = "M20 1.6 36.5 6.4v14.8c0 11-6.6 19.2-16.5 23.4C10.1 40.4 3.5 32.2 3.5 21.2V6.4Z";

/** The feed serves square PNGs at 80, 150 and 256 px ("teams-sq-3/4/5"). Offer them as a srcset so a 76 px
 *  crest on a 2x screen gets the 256 px file instead of an upscaled 80 px one. */
function crestSources(logo: string) {
  const m = logo.match(/^(.*\/picture\/teams-sq-)\d(\/.+)$/);
  if (!m) return { src: logo, srcSet: undefined, sample: logo };
  const at = (n: number) => `${m[1]}${n}${m[2]}`;
  return { src: at(4), srcSet: `${at(3)} 80w, ${at(4)} 150w, ${at(5)} 256w`, sample: at(3) };
}

/**
 * Average the saturated pixels of a crest (CORS-enabled 80 px copy) into an "r g b" tint, or null when the
 * crest is mostly black, white or grey. Light colours get a lighter wash so panels stay readable.
 */
function sampleTint(url: string): Promise<{ tint: string; a: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onerror = () => resolve(null);
    img.onload = () => {
      try {
        const n = 24;
        const c = document.createElement("canvas");
        c.width = c.height = n;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, n, n);
        const d = ctx.getImageData(0, 0, n, n).data;
        // Bucket saturated pixels by hue and keep the dominant bucket, so a red-and-yellow crest reads red
        // (or yellow), not a muddy average of both.
        const bins = Array.from({ length: 12 }, () => ({ r: 0, g: 0, b: 0, w: 0 }));
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 160) continue;
          const R0 = d[i], G0 = d[i + 1], B0 = d[i + 2];
          const mx = Math.max(R0, G0, B0), mn = Math.min(R0, G0, B0);
          const sat = mx ? (mx - mn) / mx : 0;
          if (sat < 0.28 || mx < 40) continue; // skip black, white, grey
          const c = mx - mn;
          const hue = mx === R0 ? ((G0 - B0) / c + 6) % 6 : mx === G0 ? (B0 - R0) / c + 2 : (R0 - G0) / c + 4;
          const bin = bins[Math.floor((hue / 6) * 12) % 12];
          bin.r += R0 * sat; bin.g += G0 * sat; bin.b += B0 * sat; bin.w += sat;
        }
        const top = bins.reduce((a, b) => (b.w > a.w ? b : a));
        if (top.w < 4) return resolve(null);
        const [R, G, B] = [top.r / top.w, top.g / top.w, top.b / top.w].map(Math.round);
        const lum = (0.2126 * R + 0.7152 * G + 0.0722 * B) / 255;
        resolve({ tint: `${R} ${G} ${B}`, a: lum > 0.6 ? 0.24 : lum > 0.42 ? 0.34 : 0.46 });
      } catch {
        resolve(null); // tainted canvas or decode error: keep the hash tint
      }
    };
    img.src = url;
  });
}

export function TeamCrest({ name, size = 44, className = "", logo, side }: { name: string; size?: number; className?: string; logo?: string | null; side?: "home" | "away" }) {
  const [failed, setFailed] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const sources = logo ? crestSources(logo) : null;

  // With an official crest, tint this side of the card from the crest's own colours (when it has any).
  useEffect(() => {
    if (!sources || failed || !side) return;
    let live = true;
    sampleTint(sources.sample).then((t) => {
      if (!live || !t) return;
      let el: HTMLElement | null = box.current;
      while (el) {
        if (el.hasAttribute("data-team-tints")) {
          el.style.setProperty(`--${side}`, t.tint);
          el.style.setProperty(`--${side}-a`, String(t.a));
        }
        el = el.parentElement;
      }
    });
    return () => {
      live = false;
    };
  }, [sources?.sample, failed, side]); // eslint-disable-line react-hooks/exhaustive-deps

  if (sources && !failed) {
    return (
      <span ref={box} className={`crest crest-logo relative grid shrink-0 place-items-center ${className}`} style={{ width: size, height: (size * 46) / 40 }} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sources.src}
          srcSet={sources.srcSet}
          sizes={`${size}px`}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="relative h-auto max-h-full w-[88%] object-contain [filter:drop-shadow(0_4px_8px_rgb(0_0_0/0.5))_drop-shadow(0_0_1px_rgb(238_243_236/0.35))]"
        />
      </span>
    );
  }
  return <MonogramCrest name={name} size={size} className={className} />;
}

function MonogramCrest({ name, size, className }: { name: string; size: number; className: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const h = hashName(name);
  const c = CREST_PALETTE[h % CREST_PALETTE.length];
  const variant = (h >>> 8) % 5;
  const initials = teamInitials(name);
  const fs = initials.length >= 3 ? 12 : initials.length === 2 ? 15.5 : 20;
  const ty = variant === 1 ? 30.5 : 28;
  const clip = `crest-${uid}`;
  const shine = `shine-${uid}`;

  return (
    <svg width={size} height={(size * 46) / 40} viewBox="0 0 40 46" className={`crest shrink-0 ${className}`} aria-hidden focusable={false}>
      <defs>
        <clipPath id={clip}><path d={SHIELD} /></clipPath>
        <linearGradient id={shine} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="40" height="46" fill={c.field} />
        {variant === 1 ? <rect width="40" height="13" fill={c.ink} opacity="0.92" /> : null}
        {variant === 1 ? <rect y="13" width="40" height="2" fill={c.field} opacity="0.5" /> : null}
        {variant === 2 ? <path d="M-4 10 L44 38 L44 46 L-4 18 Z" fill={c.ink} opacity="0.16" /> : null}
        {variant === 3 ? <rect x="20" width="20" height="46" fill="#000" opacity="0.16" /> : null}
        {variant === 4 ? <path d="M8 34 L20 40 L32 34" fill="none" stroke={c.ink} strokeWidth="2.2" opacity="0.7" /> : null}
        <rect className="crest-shine" x="-30" y="-4" width="22" height="54" fill={`url(#${shine})`} transform="skewX(-18)" opacity="0" />
      </g>
      <path d={SHIELD} fill="none" stroke={c.ink} strokeOpacity="0.55" strokeWidth="1.2" transform="translate(20 23) scale(0.86) translate(-20 -23)" />
      <path d={SHIELD} fill="none" stroke="rgb(238 243 236 / 0.28)" strokeWidth="1" />
      <text
        x="20"
        y={ty}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={c.ink}
        style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: fs, letterSpacing: initials.length >= 3 ? "0.01em" : "0.03em" }}
      >
        {initials}
      </text>
    </svg>
  );
}
