import { RatingGlyph } from "@/components/pick/PickCard";

const STEPS = [
  {
    when: "Your hour",
    title: "Three picks arrive",
    body: "Two are chosen with your memory and one with memory off. They are shuffled and unlabelled, so every rating is a blind A/B test.",
    visual: <BriefVisual />,
  },
  {
    when: "After the match",
    title: "One tap to rate",
    body: "Loved, Fine, Bailed or Didn’t watch. That is all it asks.",
    visual: <RateVisual />,
  },
  {
    when: "Full time + minutes",
    title: "It reads the real match",
    body: "Goals, late goals, lead changes, attempts and cards from the timeline become a 0–100 drama score.",
    visual: <TimelineVisual />,
  },
  {
    when: "Then",
    title: "It writes what it learned",
    body: "Each lesson becomes a memory, encrypted with Seal and stored on Walrus mainnet under your namespace.",
    visual: <BlobVisual />,
  },
  {
    when: "Tomorrow",
    title: "It recalls, and cites",
    body: "The next brief recalls those memories. Every pick lists the blob IDs that shaped it.",
    visual: <RecallVisual />,
  },
];

export function HowItLearns() {
  return (
    <ol className="relative grid gap-px overflow-hidden rounded-[var(--radius-card)] bg-[var(--line)] sm:grid-cols-2 xl:grid-cols-5">
      {STEPS.map((s, i) => (
        <li key={s.title} className="relative flex flex-col bg-ink-1 p-5 md:p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-7 w-7 place-items-center rounded-full font-mono text-xs font-semibold" style={{ background: i === 4 ? "var(--flare)" : "var(--ink-3)", color: i === 4 ? "var(--flare-ink)" : "var(--chalk)" }}>
              {i + 1}
            </span>
            <span className="micro">{s.when}</span>
          </div>
          <div className="mt-5 h-[72px]" aria-hidden>{s.visual}</div>
          <h3 className="mt-5 text-[1.05rem] font-semibold leading-snug">{s.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-chalk-3">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}

function BriefVisual() {
  const cards = [
    { c: "var(--flare)", label: "M" },
    { c: "var(--steel)", label: "C" },
    { c: "var(--flare)", label: "M" },
  ];
  return (
    <div className="flex h-full items-end gap-2">
      {cards.map((k, i) => (
        <div key={i} className="relative h-[64px] w-[46px] rounded-md bg-ink-2 hairline" style={{ transform: `rotate(${(i - 1) * 4}deg)` }}>
          <span className="absolute left-2 right-2 top-2 h-1 rounded bg-chalk-3/50" />
          <span className="absolute left-2 right-4 top-4 h-1 rounded bg-chalk-3/30" />
          <span className="absolute bottom-2 left-2 grid h-4 w-4 place-items-center rounded-full font-mono text-[9px] text-chalk-2" style={{ boxShadow: `inset 0 0 0 1px ${k.c}` }}>?</span>
        </div>
      ))}
    </div>
  );
}

function RateVisual() {
  return (
    <div className="flex h-full flex-wrap content-end gap-1.5">
      {(["loved", "fine", "bailed", "skipped"] as const).map((r, i) => (
        <span key={r} className={`chip !h-7 ${i === 0 ? "!text-chalk" : ""}`} style={i === 0 ? { boxShadow: "inset 0 0 0 1px rgb(240 83 28 / 0.6)" } : undefined}>
          <RatingGlyph rating={r} size={12} />
          {r === "skipped" ? "Didn’t" : r[0].toUpperCase() + r.slice(1)}
        </span>
      ))}
    </div>
  );
}

function TimelineVisual() {
  const goals = [23, 61, 78, 88, 90];
  return (
    <svg viewBox="0 0 200 72" className="h-full w-full">
      <rect x="0" y="34" width="200" height="2" fill="var(--line-strong)" />
      <rect x={(75 / 95) * 200} y="20" width={(20 / 95) * 200} height="30" fill="var(--flare)" opacity="0.1" rx="3" />
      {goals.map((m, i) => (
        <g key={m} transform={`translate(${(m / 95) * 200} 35)`}>
          <line y1={i % 2 ? 0 : -16} y2={i % 2 ? 16 : 0} stroke="var(--chalk-3)" strokeWidth="1" />
          <circle cy={i % 2 ? 16 : -16} r="4" fill={m >= 75 ? "var(--flare)" : "var(--chalk-2)"} />
        </g>
      ))}
      <text x="0" y="70" fill="var(--chalk-3)" fontSize="9" fontFamily="var(--font-mono)">0'</text>
      <text x="200" y="70" fill="var(--chalk-3)" fontSize="9" textAnchor="end" fontFamily="var(--font-mono)">90'+</text>
      <text x="200" y="10" fill="var(--chalk)" fontSize="12" textAnchor="end" fontFamily="var(--font-mono)" fontWeight="600">drama 86</text>
    </svg>
  );
}

function BlobVisual() {
  return (
    <div className="flex h-full flex-col justify-end gap-1.5">
      <span className="chip w-fit"><span className="h-1.5 w-1.5 rounded-full bg-ok" /> blob ondgK_hq…q0oY0</span>
      <span className="chip w-fit"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg> Seal-encrypted</span>
    </div>
  );
}

function RecallVisual() {
  return (
    <svg viewBox="0 0 200 72" className="h-full w-full">
      {[12, 36, 60].map((y, i) => (
        <g key={y}>
          <rect x="2" y={y - 7} width="46" height="14" rx="3" fill="var(--ink-3)" />
          <rect x="7" y={y - 2} width="28" height="3" rx="1.5" fill="var(--flare)" opacity={0.9 - i * 0.2} />
          <path d={`M48 ${y} C 100 ${y}, 110 36, 150 36`} fill="none" stroke="var(--flare)" strokeWidth="1.5" opacity="0.85" />
        </g>
      ))}
      <rect x="150" y="20" width="48" height="32" rx="4" fill="var(--chalk)" />
      <rect x="156" y="28" width="30" height="3" rx="1.5" fill="var(--ink-1)" />
      <rect x="156" y="36" width="22" height="3" rx="1.5" fill="var(--chalk-3)" />
    </svg>
  );
}
