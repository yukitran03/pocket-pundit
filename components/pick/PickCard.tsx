import type { Drama, Pick, Rating } from "@/lib/contract";
import { cleanMemoryText, fmtDay, fmtLead, fmtTime, shortId, tzLabel } from "@/lib/client/format";
import { walruscanBlob } from "@/lib/client/chain";
import { RATING_META } from "@/lib/client/kinds";
import { IconChevron, IconExternal, IconLock } from "@/components/site/Icons";
import { UntilKickoff } from "./RelTime";
import { HeadToHead, VsPanel, WorthRing } from "@/components/match/Vs";
import { teamColors } from "@/components/match/crest";
import { CardSpot } from "@/components/fx/CardFx";

/**
 * A pick as the product shows it, presented like a football game's versus screen. Reading order:
 * competition and worth-watching ring, the matchup (crests, names, VS or score, kick-off), recent form
 * head to head, why it was picked, then (folded) the memories behind it, and a quiet status row last.
 * Server-renderable: the memories fold with <details>; only the "in 2 h" hint is a client island.
 * While a pick is unrated its arm is hidden (null) and the memories stay folded, so looking at the
 * dashboard does not unblind the A/B test.
 */
export function PickCard({ pick, tz, openCites = false, sampleLabel, showTz = false }: { pick: Pick; tz: string; openCites?: boolean; sampleLabel?: string; showTz?: boolean }) {
  const hasScore = pick.homeScore !== null && pick.awayScore !== null;
  const tone = pick.arm === "memory" ? "memory" : pick.arm === "control" ? "control" : "neutral";
  const titleId = `${pick.id}-title`;
  // Two reasons up front; any more live behind the memories disclosure, so the card stays compact.
  const reasons = pick.reasons.slice(0, 2);
  const moreReasons = pick.reasons.slice(2, 4);
  const hc = teamColors(pick.home);
  const ac = teamColors(pick.away);
  const tints = { "--home": hc.tint, "--away": ac.tint, "--home-a": hc.a ?? 0.46, "--away-a": ac.a ?? 0.46 } as React.CSSProperties;

  return (
    <article data-team-tints className="card relative flex h-full flex-col overflow-hidden" style={tints} aria-labelledby={titleId}>
      <CardSpot />
      {pick.arm === "memory" ? (
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full opacity-60" style={{ background: "radial-gradient(closest-side, rgb(240 83 28 / 0.2), transparent)" }} />
      ) : null}

      <div className="relative flex flex-1 flex-col p-4 sm:p-5">
        {/* 1. What, and how much it's worth watching */}
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <p className="min-w-0">
            <span className="chip max-w-full !h-auto min-h-6 !whitespace-normal py-0.5 !text-chalk-2" title={pick.stage ? `${pick.competition} · ${pick.stage}` : pick.competition}>
              {pick.competition}
            </span>
          </p>
          <WorthRing value={pick.score} tone={tone} size={50} />
        </div>

        {/* 2. Who, and when: the versus screen */}
        <h3 className="sr-only" id={titleId}>
          {pick.home} versus {pick.away}
          {hasScore ? `, ${pick.homeScore}–${pick.awayScore}` : ""}
        </h3>
        <VsPanel
          home={pick.home}
          away={pick.away}
          logos={pick.logos}
          score={hasScore ? { home: pick.homeScore!, away: pick.awayScore! } : null}
          center={
            <span className="flex flex-col items-center gap-0.5">
              {!hasScore || pick.status !== "finished" ? (
                <time dateTime={pick.kickoff} className="font-display text-[1.3rem] font-extrabold leading-none tnum">{fmtTime(pick.kickoff, tz)}</time>
              ) : null}
              <StatusHint pick={pick} />
            </span>
          }
        />
        <p className="mt-1.5 text-center text-[0.72rem] text-chalk-3">
          {fmtDay(pick.kickoff, tz)}
          {showTz ? `, ${tzLabel(tz)} time` : ""}
          {pick.stage ? ` · ${pick.stage}` : ""}
        </p>

        {/* 3. Recent form, head to head (only when the feed has it) */}
        <HeadToHead form={pick.form} home={pick.home} away={pick.away} compact className="mt-3.5 border-t border-[var(--line-faint)] pt-3" />

        {/* 4. Why */}
        {reasons.length ? (
          <ul className="mt-3.5 space-y-1.5 text-[0.9rem] leading-snug text-chalk-2" aria-label="Why this pick">
            {reasons.map((r, i) => (
              <li key={i} className="flex gap-2.5">
                <span aria-hidden className={`mt-[0.5em] h-1.5 w-1.5 shrink-0 rounded-full ${tone === "memory" ? "bg-flare" : tone === "control" ? "bg-steel" : "bg-chalk-3"}`} />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {/* 5. Memories behind it (folded) */}
        <div className="mt-auto pt-3.5">
          <CitedMemories pick={pick} defaultOpen={openCites} more={moreReasons} />
          {pick.rating || pick.drama ? <Outcome rating={pick.rating} drama={pick.drama} /> : null}
        </div>
      </div>

      {/* 6. Status */}
      <footer className="relative flex flex-wrap items-center gap-1.5 border-t border-[var(--line-faint)] px-4 py-2.5 sm:px-5">
        {sampleLabel ? <span className="chip !h-[22px] uppercase !tracking-[0.06em] !text-[0.65rem]">{sampleLabel}</span> : null}
        <ArmTag arm={pick.arm} />
        {pick.lock ? <LockChip lock={pick.lock} tz={tz} /> : null}
      </footer>
    </article>
  );
}

/** Under the kick-off time in the VS column: "LIVE", "Full time", or "in 2 h" (nothing when the day says enough). */
function StatusHint({ pick }: { pick: Pick }) {
  if (pick.status === "live")
    return (
      <span role="status" aria-atomic="true" className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-flare">
        <span className="live-dot !h-1.5 !w-1.5" aria-hidden /> <span aria-hidden>Live</span>
        <span className="sr-only">Live now</span>
      </span>
    );
  if (pick.status === "finished") return <span className="text-xs text-chalk-3">Full time</span>;
  return <UntilKickoff iso={pick.kickoff} className="text-xs text-chalk-2" />;
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

function MoreReasons({ more }: { more: string[] }) {
  if (!more.length) return null;
  return (
    <ul className="mb-3 space-y-1 text-sm text-chalk-2" aria-label="More reasons">
      {more.map((r, i) => (
        <li key={i} className="flex gap-2.5">
          <span aria-hidden className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-chalk-3" />
          <span>{r}</span>
        </li>
      ))}
    </ul>
  );
}

function CitedMemories({ pick, defaultOpen, more = [] }: { pick: Pick; defaultOpen: boolean; more?: string[] }) {
  const blind = pick.arm === null;
  const n = pick.cites.length;
  if (!blind && n === 0 && !more.length)
    return (
      <p className="flex min-h-[38px] items-center gap-2.5 rounded-[10px] bg-ink-0/50 px-3.5 text-sm text-chalk-3 hairline">
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-steel" />
        Picked with memory off: the control for your A/B test.
      </p>
    );
  const summary = blind
    ? "The memories behind this pick"
    : n
      ? `Shaped by ${n} ${n === 1 ? "memory" : "memories"} on Walrus`
      : `Picked with memory off · ${more.length} more ${more.length === 1 ? "reason" : "reasons"}`;
  return (
    <details className="group rounded-[10px] bg-ink-0/50 hairline" open={defaultOpen}>
      <summary className="flex min-h-[38px] items-center justify-between gap-3 px-3.5 text-sm font-medium text-chalk-2 hover:text-chalk">
        <span className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${blind ? "bg-chalk-3" : n ? "bg-flare" : "bg-steel"}`} />
          <span className="truncate">{summary}</span>
        </span>
        <IconChevron size={15} className="shrink-0 transition-transform group-open:rotate-90" />
      </summary>
      <div className="px-3.5 pb-3">
        {blind ? <p className="mb-2.5 text-xs text-warn">Opening this tells you whether it&rsquo;s a memory pick.</p> : null}
        <MoreReasons more={more} />
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
