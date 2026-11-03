"use client";

import { useId } from "react";
import { useSeason } from "./useSeason";

/**
 * A small stylised pine for the winter-nights season: three soft tiers in pine green, lit from the right
 * (like a tree beside a floodlit stand), with a few warm bulbs that glow slowly. Not a cartoon: no star,
 * no baubles, no faces. Decorative (aria-hidden), absolutely placed by the caller, so it never shifts layout.
 */
export function PineTree({ size = 72, className = "" }: { size?: number; className?: string }) {
  const gid = `pine-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const lights: [number, number, number][] = [
    [27, 26, 0], [36, 34, 1], [22, 44, 2], [40, 50, 3], [29, 58, 4], [18, 64, 5], [44, 66, 6], [33, 72, 7],
  ];
  return (
    <svg width={size} height={(size * 96) / 64} viewBox="0 0 64 96" aria-hidden focusable={false} className={`pine ${className}`}>
      <defs>
        <linearGradient id={gid} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#123d28" />
          <stop offset="0.62" stopColor="#1f5e3b" />
          <stop offset="1" stopColor="#3f8a5c" />
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="90" rx="22" ry="3.2" fill="#000" opacity="0.35" />
      <rect x="29" y="78" width="6" height="11" rx="1.5" fill="#3b2a1d" />
      <path d="M32 6 C 35 14 42 22 48 30 C 44 31 40 31 37 30 C 43 39 50 47 56 55 C 50 57 44 57 39 56 C 45 64 52 71 58 78 C 41 82 23 82 6 78 C 12 71 19 64 25 56 C 20 57 14 57 8 55 C 14 47 21 39 27 30 C 24 31 20 31 16 30 C 22 22 29 14 32 6 Z" fill={`url(#${gid})`} />
      <path d="M32 6 C 35 14 42 22 48 30 M37 30 C 43 39 50 47 56 55 M39 56 C 45 64 52 71 58 78" fill="none" stroke="rgb(238 243 236 / 0.22)" strokeWidth="1" strokeLinecap="round" />
      {/* a light dusting of snow on the tiers */}
      <path d="M27 30 C 30 29 34 29 37 30 M25 56 C 30 55 34 55 39 56 M6 78 C 14 80 22 80 30 79" fill="none" stroke="#eef3ec" strokeOpacity="0.5" strokeWidth="1.6" strokeLinecap="round" />
      {lights.map(([x, y, i]) => (
        <circle key={i} className="pine-bulb" cx={x} cy={y} r="1.6" fill="#ffdca6" style={{ animationDelay: `${(i * 470) % 2600}ms` }} />
      ))}
    </svg>
  );
}

/** A PineTree that only renders in the winter-nights season (and while Snow is switched on). */
export function SeasonTree({ size, className }: { size?: number; className?: string }) {
  const { decor } = useSeason();
  if (!decor) return null;
  return <PineTree size={size} className={className} />;
}
