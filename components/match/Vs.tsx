import type { ReactNode } from "react";
import type { FormLine, MatchForm } from "@/lib/contract";
import { TeamCrest } from "./TeamCrest";
import { teamColors } from "./crest";
import { VsMotion } from "./VsMotion";

type Size = "md" | "lg";

/**
 * Names are sized from their own column (container query units) and their longest word, so a long word
 * steps the size down instead of overflowing, and multi-word names wrap onto balanced lines.
 */
function nameStyle(name: string, size: Size): React.CSSProperties {
  const longest = Math.max(5, ...name.split(/\s+/).map((w) => w.length));
  return { "--chars": longest, "--max": size === "lg" ? "2.7rem" : "1.65rem" } as React.CSSProperties;
}

/**
 * Football "versus" screen: two angled panels tinted by each side's crest colour with a diagonal seam,
 * the crests and names facing each other, and a VS plate (or the score) in the middle.
 * The visual names are aria-hidden; pass `title` (e.g. an sr-only heading) for the accessible name.
 */
export function VsPanel({
  home,
  away,
  size = "md",
  center,
  score,
  titleId,
  className = "",
  fill = false,
}: {
  home: string;
  away: string;
  size?: Size;
  center?: ReactNode;
  score?: { home: number; away: number } | null;
  titleId?: string;
  className?: string;
  /** Stretch to the parent's height (content stays vertically centred). */
  fill?: boolean;
}) {
  const h = teamColors(home);
  const a = teamColors(away);
  const crest = size === "lg" ? 76 : 50;
  return (
    <div className={`vs ${fill ? "h-full" : ""} ${className}`} style={{ "--home": h.tint, "--away": a.tint, "--home-a": h.a ?? 0.46, "--away-a": a.a ?? 0.46 } as React.CSSProperties}>
      {titleId ? (
        <p id={titleId} className="sr-only">
          {home} versus {away}
          {score ? `, ${score.home}–${score.away}` : ""}
        </p>
      ) : null}
      <div className={`vs-panel relative overflow-hidden ${size === "lg" ? "rounded-[18px]" : "rounded-[14px]"} ${fill ? "grid h-full content-center" : ""}`}>
        <div aria-hidden className="vs-side vs-home absolute inset-0" />
        <div aria-hidden className="vs-side vs-away absolute inset-0" />
        <svg aria-hidden className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          <line x1="57" y1="-2" x2="43" y2="102" stroke="rgb(238 243 236 / 0.55)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        <div aria-hidden className={`vs-grid relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center ${size === "lg" ? "gap-3 p-5 sm:gap-6 sm:p-8" : "gap-2 p-4"}`}>
          <div className="vs-team flex min-w-0 flex-col items-start gap-2.5 text-left">
            <TeamCrest name={home} size={crest} className="vs-crest" />
            <p className="vs-name w-full font-display font-extrabold leading-[0.92] text-chalk [text-wrap:balance]" style={nameStyle(home, size)}>{home}</p>
          </div>
          <div className={`flex flex-col items-center text-center ${size === "lg" ? "min-w-[4.75rem] gap-2.5 sm:min-w-[6.5rem]" : "min-w-[4.25rem] gap-1.5"}`}>
            <VsMotion score={score ?? null} size={size} />
            {center}
          </div>
          <div className="vs-team flex min-w-0 flex-col items-end gap-2.5 text-right">
            <TeamCrest name={away} size={crest} className="vs-crest" />
            <p className="vs-name w-full font-display font-extrabold leading-[0.92] text-chalk [text-wrap:balance]" style={nameStyle(away, size)}>{away}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const RING_TONE = { memory: "var(--flare)", control: "var(--steel)", neutral: "var(--chalk-2)" } as const;

/** Worth-watching as a ring gauge with the number big inside. */
export function WorthRing({ value, label = "Worth watching", tone = "neutral", size = 64, showLabel = true }: { value: number; label?: string; tone?: keyof typeof RING_TONE; size?: number; showLabel?: boolean }) {
  const v = Math.round(Math.max(0, Math.min(100, value)));
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-2.5" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}>
      {showLabel ? <span className="max-w-[4.5rem] text-right text-xs leading-tight text-chalk-2">{label}</span> : null}
      <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
        <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
          <circle cx="32" cy="32" r={r} fill="none" stroke="var(--ink-3)" strokeWidth="6" />
          <circle cx="32" cy="32" r={r} fill="none" stroke={RING_TONE[tone]} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(c * v) / 100} ${c}`} />
        </svg>
        <span className="font-display font-extrabold leading-none tnum" style={{ fontSize: size * 0.36 }}>{v}</span>
      </span>
    </div>
  );
}

// ------------------------------------------------------------------ head to head

const per = (n: number, d: number) => (d > 0 ? n / d : 0);

function Pips({ f, align, dim }: { f: FormLine; align: "start" | "end"; dim: boolean }) {
  const pips = [...Array(f.wins).fill("W"), ...Array(f.draws).fill("D"), ...Array(f.losses).fill("L")] as ("W" | "D" | "L")[];
  // Mirror the sides so the wins sit next to the centre line on both.
  const shown = align === "end" ? [...pips].reverse() : pips;
  return (
    <span className={`flex gap-[3px] ${align === "end" ? "justify-end" : "justify-start"} ${dim ? "opacity-55" : ""}`}>
      {shown.map((p, i) => (
        <span
          key={i}
          className={`grid h-[17px] w-[17px] place-items-center rounded-[3px] text-[0.62rem] font-bold leading-none ${p === "W" ? "bg-chalk text-ink-0" : p === "D" ? "bg-chalk-4 text-chalk" : "text-chalk-3"}`}
          style={p === "L" ? { boxShadow: "inset 0 0 0 1.5px var(--chalk-4)" } : undefined}
        >
          {p}
        </span>
      ))}
    </span>
  );
}

function Bars({ label, l, r, fmt, lowerIsBetter = false, max }: { label: string; l: number; r: number; fmt: (x: number) => string; lowerIsBetter?: boolean; max: number }) {
  const lBetter = lowerIsBetter ? l < r : l > r;
  const rBetter = lowerIsBetter ? r < l : r > l;
  const w = (x: number) => `${Math.max(4, Math.min(100, (x / max) * 100))}%`;
  // Better side: brighter bar, bold value and a small marker, so it never relies on colour alone.
  return (
    <div>
      <p className="mb-1 text-center text-[0.72rem] text-chalk-3">{label}</p>
      <div className="grid grid-cols-[2.6rem_minmax(0,1fr)_minmax(0,1fr)_2.6rem] items-center gap-1.5">
        <span className={`flex items-center gap-1 text-left text-sm tnum ${lBetter ? "font-semibold text-chalk" : "text-chalk-3"}`}>
          {fmt(l)}
          {lBetter ? <span className="inline-block h-0 w-0 border-y-[4px] border-r-[5px] border-y-transparent border-r-chalk" /> : null}
        </span>
        <span className="flex h-2 justify-end overflow-hidden rounded-l-full bg-ink-3">
          <span className="h2h-fill h2h-l h-full rounded-l-full" style={{ width: w(l), background: lBetter ? "var(--chalk)" : "var(--chalk-4)" }} />
        </span>
        <span className="flex h-2 justify-start overflow-hidden rounded-r-full bg-ink-3">
          <span className="h2h-fill h2h-r h-full rounded-r-full" style={{ width: w(r), background: rBetter ? "var(--chalk)" : "var(--chalk-4)" }} />
        </span>
        <span className={`flex items-center justify-end gap-1 text-right text-sm tnum ${rBetter ? "font-semibold text-chalk" : "text-chalk-3"}`}>
          {rBetter ? <span className="inline-block h-0 w-0 border-y-[4px] border-l-[5px] border-y-transparent border-l-chalk" /> : null}
          {fmt(r)}
        </span>
      </div>
    </div>
  );
}

/**
 * Pre-match comparison, game style: mirrored bars that meet in the middle, the better side in chalk.
 * Renders nothing unless both sides have recent form.
 */
export function HeadToHead({ form, home, away, className = "" }: { form?: MatchForm | null; home: string; away: string; className?: string }) {
  const h = form?.home;
  const a = form?.away;
  if (!h || !a || !h.played || !a.played) return null;
  const pts = (f: FormLine) => f.wins * 3 + f.draws;
  const gfH = per(h.goalsFor, h.played), gfA = per(a.goalsFor, a.played);
  const gaH = per(h.goalsAgainst, h.played), gaA = per(a.goalsAgainst, a.played);
  const wrH = per(h.wins, h.played), wrA = per(a.wins, a.played);
  const one = (x: number) => x.toFixed(1);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const n = Math.max(h.played, a.played);
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="sr-only">
        <p>Recent form, last {n} matches.</p>
        <ul>
          <li>{home}: {h.wins} wins, {h.draws} draws, {h.losses} losses. {away}: {a.wins} wins, {a.draws} draws, {a.losses} losses.</li>
          <li>Goals per game: {home} {one(gfH)}, {away} {one(gfA)}{gfH === gfA ? "." : `, better: ${gfH > gfA ? home : away}.`}</li>
          <li>Conceded per game: {home} {one(gaH)}, {away} {one(gaA)}{gaH === gaA ? "." : `, better: ${gaH < gaA ? home : away}.`}</li>
          <li>Win rate: {home} {pct(wrH)}, {away} {pct(wrA)}.</li>
        </ul>
      </div>
      <div aria-hidden>
        <p className="mb-1 text-center text-[0.72rem] text-chalk-3">Form, last {n}</p>
        <div className="grid grid-cols-2 items-center gap-3">
          <Pips f={h} align="end" dim={pts(h) < pts(a)} />
          <Pips f={a} align="start" dim={pts(a) < pts(h)} />
        </div>
      </div>
      <div aria-hidden className="space-y-3">
        <Bars label="Goals per game" l={gfH} r={gfA} fmt={one} max={Math.max(3, gfH, gfA)} />
        <Bars label="Conceded per game" l={gaH} r={gaA} fmt={one} lowerIsBetter max={Math.max(3, gaH, gaA)} />
        <Bars label="Win rate" l={wrH} r={wrA} fmt={pct} max={1} />
      </div>
    </div>
  );
}
