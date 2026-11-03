/** Centre-circle mark: a chalk circle and spot, with one recalled memory (flare) linked to the spot. */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden focusable={false}>
      <circle cx="14" cy="18" r="10" fill="none" stroke="var(--chalk)" strokeWidth="1.8" />
      <line x1="4" y1="18" x2="24" y2="18" stroke="var(--chalk)" strokeWidth="1.8" opacity="0.35" />
      <path d="M14 18 L26 6" stroke="var(--flare)" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="2.2 2.6" />
      <circle cx="14" cy="18" r="2.4" fill="var(--chalk)" />
      <circle cx="26.5" cy="5.5" r="3.6" fill="var(--flare)" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      <span className="font-display text-[1.35rem] font-extrabold uppercase leading-none tracking-[0.02em]" style={{ fontVariationSettings: '"opsz" 30' }}>
        Match&nbsp;Finder
      </span>
    </span>
  );
}
