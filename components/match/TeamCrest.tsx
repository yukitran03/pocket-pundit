"use client";

import { useId, useState } from "react";

/**
 * Deterministic monogram crest: a shield with the team's initials, coloured from a hash of its name, so the
 * same name always gives the same crest. When the server enables official crests (OFFICIAL_CRESTS=1) it
 * passes the public feed's team picture as `logo`; if that image fails, the monogram shows instead.
 */

import { CREST_PALETTE, hashName, teamInitials } from "./crest";

const SHIELD = "M20 1.6 36.5 6.4v14.8c0 11-6.6 19.2-16.5 23.4C10.1 40.4 3.5 32.2 3.5 21.2V6.4Z";

export function TeamCrest({ name, size = 44, className = "", logo }: { name: string; size?: number; className?: string; logo?: string | null }) {
  const [failed, setFailed] = useState(false);
  if (logo && !failed) {
    return (
      <span className={`crest grid shrink-0 place-items-center ${className}`} style={{ width: size, height: (size * 46) / 40 }} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="" width={size} height={size} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-auto max-h-full w-full object-contain drop-shadow-[0_2px_6px_rgb(0_0_0_/_0.45)]" />
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
