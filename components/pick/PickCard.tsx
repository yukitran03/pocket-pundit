import type { Drama, Pick, Rating } from "@/lib/contract";
import { cleanMemoryText, fmtDay, fmtLead, fmtTime, shortId, tzLabel } from "@/lib/client/format";
import { walruscanBlob } from "@/lib/client/chain";
import { RATING_META } from "@/lib/client/kinds";
import { IconChevron, IconExternal, IconLock } from "@/components/site/Icons";
import { UntilKickoff } from "./RelTime";

/**
 * A pick as the product shows it. Reading order: who is playing, when, how much it's worth watching,
 * why, then (folded) the memories behind it, and a quiet status row last.
 * Server-renderable: the memories fold with <details>; only the "in 2 h" hint is a client island.
 * While a pick is unrated its arm is hidden (null) and the memories stay folded, so looking at the
 * dashboard does not unblind the A/B test.
 */
export function PickCard({ pick, tz, openCites = false, sampleLabel, showTz = false }: { pick: Pick; tz: string; openCites?: boolean; sampleLabel?: string; showTz?: boolean }) {
  const hasScore = pick.homeScore !== null && pick.awayScore !== null;
  const tone = pick.arm === "memory" ? "memory" : pick.arm === "control" ? "control" : "neutral";
  const titleId = `${pick.id}-title`;
  const reasons = pick.reasons.slice(0, 3);

  return (
    <article className="card relative flex h-full flex-col overflow-hidden" aria-labelledby={titleId}>
      {pick.arm === "memory" ? (
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full opacity-60" style={{ background: "radial-gradient(closest-side, rgb(240 83 28 / 0.2), transparent)" }} />
      ) : null}

      <div className="relative flex flex-1 flex-col p-5">
        {/* 1. Who */}
        <h3 id={titleId} className="font-display text-[1.95rem] font-extrabold leading-[0.95] tracking-[-0.005em]" style={{ fontVariationSettings: '"opsz" 72' }}>
          {hasScore ? (
            <span className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1">
              <TeamScore name={pick.home} score={pick.homeScore!} win={pick.homeScore! > pick.awayScore!} />
              <TeamScore name={pick.away} score={pick.awayScore!} win={pick.awayScore! > pick.homeScore!} />
            </span>
          ) : (
            <>
              <span className="block">
                {pick.home}
                <span className="ml-2 text-[0.6em] text-chalk-4" aria-hidden>v</span>
                <span className="sr-only"> versus </span>
              </span>
              <span className="block">{pick.away}</span>
            </>
          )}
        </h3>

        {/* 2. When, and in what */}
        <div className="mt-4">
          <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <time dateTime={pick.kickoff} className="font-display text-[1.6rem] font-extrabold leading-none tnum">{fmtTime(pick.kickoff, tz)}</time>
            <StatusHint pick={pick} day={`${fmtDay(pick.kickoff, tz)}${showTz ? `, ${tzLabel(tz)} time` : ""}`} />
          </p>
          <p className="mt-1.5 truncate text-sm text-chalk-3" title={pick.stage ? `${pick.competition} · ${pick.stage}` : pick.competition}>
            {pick.competition}
          </p>
        </div>

        {/* 3. How much */}
        <Meter className="mt-5" value={pick.score} label="Worth watching" tone={tone} />

        {/* 4. Why */}
        {reasons.length ? (
          <ul className="mt-5 space-y-2 text-[0.93rem] leading-snug text-chalk-2" aria-label="Why this pick">
            {reasons.map((r, i) => (
              <li key={i} className="flex gap-2.5">
                <span aria-hidden className={`mt-[0.5em] h-1.5 w-1.5 shrink-0 rounded-full ${tone === "memory" ? "bg-flare" : tone === "control" ? "bg-steel" : "bg-chalk-3"}`} />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {/* 5. Memories behind it (folded) */}
        <div className="mt-auto pt-5">
          <CitedMemories pick={pick} defaultOpen={openCites} />
          {pick.rating || pick.drama ? <Outcome rating={pick.rating} drama={pick.drama} /> : null}
        </div>
      </div>

      {/* 6. Status */}
      <footer className="relative flex flex-wrap items-center gap-1.5 border-t border-[var(--line-faint)] px-5 py-3">
        {sampleLabel ? <span className="chip !h-[22px] uppercase !tracking-[0.06em] !text-[0.65rem]">{sampleLabel}</span> : null}
        <ArmTag arm={pick.arm} />
        {pick.lock ? <LockChip lock={pick.lock} tz={tz} /> : null}
      </footer>
    </article>
  );
}

function TeamScore({ name, score, win }: { name: string; score: number; win: boolean }) {
  return (
    <>
      <span className={`min-w-0 ${win ? "text-chalk" : "text-chalk-2"}`}>{name}</span>
      <span className={`text-right tnum ${win ? "text-chalk" : "text-chalk-3"}`}>
        {score}
      </span>
    </>
  );
}

/** Next to the kick-off time: "Live now", "Full time · Mon 2 Nov", or "in 2 h" (falling back to the day). */
function StatusHint({ pick, day }: { pick: Pick; day: string }) {
  if (pick.status === "live")
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-flare">
        <span className="live-dot !h-1.5 !w-1.5" aria-hidden /> Live now
      </span>
    );
  if (pick.status === "finished") return <span className="text-sm text-chalk-3">Full time · {day}</span>;
  return <UntilKickoff iso={pick.kickoff} fallback={day} className="text-sm text-chalk-2" />;
}

const TONE_FILL = { memory: "var(--flare)", control: "var(--steel)", neutral: "var(--chalk-2)" } as const;

/** One 0–100 meter: the number big, a plain label, a thin bar. */
export function Meter({ value, label, tone = "neutral", className = "", compact = false, labelClassName = "" }: { value: number; label: string; tone?: keyof typeof TONE_FILL; className?: string; compact?: boolean; labelClassName?: string }) {
  const v = Math.round(Math.max(0, Math.min(100, value)));
  return (
    <div className={className}>
      <div className="flex items-end justify-between gap-3">
        <span className={`${compact ? "text-xs" : "text-sm"} text-chalk-2 ${labelClassName}`}>{label}</span>
        <span className={`font-display font-extrabold leading-none tnum ${compact ? "text-xl" : "text-[1.75rem]"}`}>
          {v}
          <span className="ml-0.5 font-sans text-xs font-normal text-chalk-3">/100</span>
        </span>
      </div>
      <div className={`relative overflow-hidden rounded-full bg-ink-3 ${compact ? "mt-1.5 h-1" : "mt-2 h-1.5"}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}>
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${v}%`, background: TONE_FILL[tone] }} />
      </div>
    </div>
  );
}

/** @deprecated kept for callers outside the card; use <Meter>. */
export function ScoreBar({ value, label = "Worth watching" }: { value: number; label?: string }) {
  return <Meter value={value} label={label} />;
}

function ArmTag({ arm }: { arm: Pick["arm"] }) {
  if (arm === null)
    return (
      <span className="chip !h-[22px]" title="Which pick ran with memory off stays hidden until you rate, so the test is blind">
        <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden><circle cx="5" cy="5" r="3.6" fill="none" stroke="var(--chalk-3)" strokeWidth="1.4" strokeDasharray="2 1.6" /></svg>
        Blind until rated
      </span>
    );
  return (
    <span className="chip !h-[22px] !text-chalk-2">
      <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden><circle cx="5" cy="5" r="4" fill={arm === "memory" ? "var(--flare)" : "var(--steel)"} /></svg>
      {arm === "memory" ? "Memory pick" : "Control pick"}
    </span>
  );
}

/** "Locked on Walrus 75 min before kick-off": tonight's brief was written to Walrus before the game. */
export function LockChip({ lock, tz }: { lock: NonNullable<Pick["lock"]>; tz: string }) {
  const lead = lock.minutesBeforeKickoff > 0 ? ` ${fmtLead(lock.minutesBeforeKickoff)} before kick-off` : "";
  const text = `Locked on Walrus${lead}`;
  const when = `Written at ${fmtTime(lock.lockedAt, tz)}, ${fmtDay(lock.lockedAt, tz)}. The picks can't be changed after this.`;
  const body = (
    <>
      <IconLock size={12} />
      <span>{text}</span>
      {lock.blobId ? <IconExternal size={11} /> : null}
    </>
  );
  return lock.blobId ? (
    <a href={walruscanBlob(lock.blobId)} target="_blank" rel="noopener noreferrer" className="chip !h-[22px]" title={when} aria-label={`${text}. ${when} Open the locked brief on Walruscan.`}>
      {body}
    </a>
  ) : (
    <span className="chip !h-[22px]" title={when} aria-label={`${text}. ${when}`}>{body}</span>
  );
}

export function BlobChip({ blobId, tone = "flare" }: { blobId: string; tone?: "flare" | "ok" }) {
  return (
    <a href={walruscanBlob(blobId)} target="_blank" rel="noopener noreferrer" className="chip chip-id shrink-0" aria-label={`Open blob ${blobId} on Walruscan`} title={blobId}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${tone === "ok" ? "bg-ok" : "bg-flare"}`} />
      {shortId(blobId, 5, 4)}
      <IconExternal size={11} />
    </a>
  );
}

function CitedMemories({ pick, defaultOpen }: { pick: Pick; defaultOpen: boolean }) {
  const blind = pick.arm === null;
  const n = pick.cites.length;
  if (!blind && n === 0)
    return (
      <p className="flex min-h-[40px] items-center gap-2.5 rounded-[10px] bg-ink-0/50 px-3.5 text-sm text-chalk-3 hairline">
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-steel" />
        Picked with memory off: the control for your A/B test.
      </p>
    );
  const summary = blind ? "The memories behind this pick" : `Shaped by ${n} ${n === 1 ? "memory" : "memories"} on Walrus`;
  return (
    <details className="group rounded-[10px] bg-ink-0/50 hairline" open={defaultOpen}>
      <summary className="flex min-h-[40px] items-center justify-between gap-3 px-3.5 text-sm font-medium text-chalk-2 hover:text-chalk">
        <span className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${blind ? "bg-chalk-3" : "bg-flare"}`} />
          <span className="truncate">{summary}</span>
        </span>
        <IconChevron size={15} className="shrink-0 transition-transform group-open:rotate-90" />
      </summary>
      <div className="px-3.5 pb-3.5">
        {blind ? <p className="mb-2.5 text-xs text-warn">Opening this tells you whether it&rsquo;s a memory pick.</p> : null}
        {n === 0 ? (
          <p className="text-sm text-chalk-3">None. This is the control pick, chosen with memory off so your ratings can be compared fairly.</p>
        ) : (
          <ul className="space-y-1.5">
            {pick.cites.map((c) => {
              const text = cleanMemoryText(c.text);
              return (
                <li key={c.blobId} className="flex min-w-0 items-center gap-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate text-chalk-2" title={text}>&ldquo;{text}&rdquo;</span>
                  <BlobChip blobId={c.blobId} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}

const RATING_GLYPH: Record<Rating, React.ReactNode> = {
  loved: <circle cx="7" cy="7" r="5.5" fill="var(--flare)" />,
  fine: (
    <>
      <circle cx="7" cy="7" r="5" fill="none" stroke="var(--chalk-2)" strokeWidth="1.5" />
      <path d="M7 2a5 5 0 0 1 0 10Z" fill="var(--chalk-2)" />
    </>
  ),
  bailed: <circle cx="7" cy="7" r="5" fill="none" stroke="var(--chalk-2)" strokeWidth="1.5" />,
  skipped: <path d="M3 7h8" stroke="var(--chalk-3)" strokeWidth="1.6" strokeLinecap="round" />,
};

export function RatingGlyph({ rating, size = 14 }: { rating: Rating; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden>
      {RATING_GLYPH[rating]}
    </svg>
  );
}

/** After full time: your rating, the drama score and a one-line summary of what happened. */
function Outcome({ rating, drama }: { rating: Rating | null; drama: Drama | null }) {
  return (
    <div className="mt-4 space-y-3 border-t border-[var(--line-faint)] pt-4">
      {rating ? (
        <p className="flex items-center justify-between text-sm">
          <span className="text-chalk-2">You rated it</span>
          <span className="inline-flex items-center gap-2 font-semibold">
            <RatingGlyph rating={rating} />
            {RATING_META[rating].label}
          </span>
        </p>
      ) : null}
      {drama ? <DramaBreakdown drama={drama} /> : null}
    </div>
  );
}

export function DramaBreakdown({ drama }: { drama: Drama }) {
  const bits = [
    `${drama.goals} ${drama.goals === 1 ? "goal" : "goals"}`,
    drama.lateGoals ? `${drama.lateGoals} after 75'` : null,
    drama.leadChanges ? `${drama.leadChanges} lead ${drama.leadChanges === 1 ? "change" : "changes"}` : null,
    drama.comeback ? "a comeback" : null,
    `${drama.attempts} attempts`,
  ].filter(Boolean);
  return (
    <div>
      <Meter value={drama.score} label="Drama, from the match timeline" compact />
      <p className="mt-2 text-xs text-chalk-3">{bits.join(" · ")}</p>
    </div>
  );
}
