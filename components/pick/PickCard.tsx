import type { Drama, Pick, Rating } from "@/lib/contract";
import { fmtDay, fmtTime, shortId, tzLabel } from "@/lib/client/format";
import { walruscanBlob } from "@/lib/client/chain";
import { RATING_META } from "@/lib/client/kinds";
import { IconChevron, IconExternal } from "@/components/site/Icons";

/**
 * A pick exactly as the product renders it. Server-renderable: expansion uses <details>.
 * While a pick is unrated its arm is hidden (null) and the memories stay folded,
 * so looking at the dashboard does not unblind the A/B test.
 */
export function PickCard({ pick, tz, openCites = false, sampleLabel }: { pick: Pick; tz: string; openCites?: boolean; sampleLabel?: string }) {
  const blind = pick.arm === null;
  const finished = pick.status === "finished";
  const live = pick.status === "live";
  const showScore = pick.homeScore !== null && pick.awayScore !== null;
  const homeWin = showScore && (pick.homeScore ?? 0) > (pick.awayScore ?? 0);
  const awayWin = showScore && (pick.awayScore ?? 0) > (pick.homeScore ?? 0);

  return (
    <article
      className="card relative flex h-full flex-col overflow-hidden"
      aria-label={`${pick.home} versus ${pick.away}, ${pick.competition}, kickoff ${fmtTime(pick.kickoff, tz)} ${tzLabel(tz)} time`}
    >
      {/* floodlight wash on memory picks once revealed */}
      {pick.arm === "memory" ? (
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full opacity-60" style={{ background: "radial-gradient(closest-side, rgb(240 83 28 / 0.22), transparent)" }} />
      ) : null}

      <header className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <p className="truncate text-[0.8rem] font-semibold text-chalk-2">{pick.competition}</p>
          {pick.stage ? <p className="truncate text-xs text-chalk-3">{pick.stage}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {sampleLabel ? <span className="chip !h-[22px] !text-[0.65rem] uppercase">{sampleLabel}</span> : null}
          <ArmTag arm={pick.arm} />
        </div>
      </header>

      <div className="mt-4 flex items-end justify-between gap-4 px-5">
        <div>
          <p className="font-display text-[2.6rem] font-extrabold leading-[0.85] tnum" style={{ fontVariationSettings: '"opsz" 72' }}>
            <time dateTime={pick.kickoff}>{fmtTime(pick.kickoff, tz)}</time>
          </p>
          <p className="micro mt-1.5">{fmtDay(pick.kickoff, tz)} · {tzLabel(tz)}</p>
        </div>
        {live ? (
          <span className="chip !text-flare"><span className="live-dot !h-1.5 !w-1.5" aria-hidden /> Live</span>
        ) : finished ? (
          <span className="chip">Full time</span>
        ) : (
          <span className="chip">Upcoming</span>
        )}
      </div>

      <dl className="mx-5 mt-5 divide-y divide-[var(--line-faint)] rounded-xl bg-ink-0/60 hairline">
        <TeamRow name={pick.home} score={pick.homeScore} strong={homeWin} side="Home" />
        <TeamRow name={pick.away} score={pick.awayScore} strong={awayWin} side="Away" />
      </dl>

      <div className="px-5 pt-5">
        <ScoreBar value={pick.score} />
      </div>

      <div className="px-5 pt-5">
        <p className="micro mb-2">Why this pick</p>
        <ul className="space-y-1.5 text-[0.92rem] leading-snug text-chalk-2">
          {pick.reasons.map((r, i) => (
            <li key={i} className="flex gap-2.5">
              <span aria-hidden className="mt-[0.55em] h-px w-3 shrink-0 bg-chalk-3" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto px-5 pb-5 pt-5">
        <CitedMemories pick={pick} blind={blind} defaultOpen={openCites} />
        {pick.rating || pick.drama ? (
          <div className="mt-4 space-y-4 border-t border-line pt-4">
            {pick.rating ? <RatingLine rating={pick.rating} /> : null}
            {pick.drama ? <DramaBreakdown drama={pick.drama} /> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function TeamRow({ name, score, strong, side }: { name: string; score: number | null; strong: boolean; side: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <dt className={`min-w-0 truncate text-[1.02rem] ${strong ? "font-semibold text-chalk" : "text-chalk-2"}`}>
        <span className="sr-only">{side}: </span>
        {name}
      </dt>
      <dd className={`font-display text-2xl font-extrabold leading-none tnum ${score === null ? "text-chalk-4" : strong ? "text-chalk" : "text-chalk-2"}`}>
        {score === null ? <span aria-label="not played yet">–</span> : score}
      </dd>
    </div>
  );
}

function ArmTag({ arm }: { arm: Pick["arm"] }) {
  if (arm === null)
    return (
      <span className="chip" title="Arm hidden until you rate: the A/B test is blind">
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><circle cx="5" cy="5" r="3.6" fill="none" stroke="var(--chalk-3)" strokeWidth="1.4" strokeDasharray="2 1.6" /></svg>
        Blind
      </span>
    );
  return arm === "memory" ? (
    <span className="chip !text-chalk" style={{ boxShadow: "inset 0 0 0 1px rgb(240 83 28 / 0.45)" }}>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><circle cx="5" cy="5" r="4" fill="var(--flare)" /></svg>
      Memory pick
    </span>
  ) : (
    <span className="chip !text-chalk" style={{ boxShadow: "inset 0 0 0 1px rgb(57 135 229 / 0.45)" }}>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><circle cx="5" cy="5" r="4" fill="var(--steel)" /></svg>
      Control pick
    </span>
  );
}

export function ScoreBar({ value, label = "Worth watching" }: { value: number; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="micro">{label}</span>
        <span className="mono text-sm text-chalk">
          <span className="font-semibold">{Math.round(v)}</span>
          <span className="text-chalk-3">/100</span>
        </span>
      </div>
      <div
        className="relative mt-2 h-2 overflow-hidden rounded-full bg-ink-3"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(v)}
      >
        <div className="absolute inset-y-0 left-0 rounded-full bg-flare" style={{ width: `${v}%` }} />
        {[25, 50, 75].map((t) => (
          <span key={t} aria-hidden className="absolute inset-y-0 w-[2px] bg-ink-1" style={{ left: `calc(${t}% - 1px)` }} />
        ))}
      </div>
    </div>
  );
}

function CitedMemories({ pick, blind, defaultOpen }: { pick: Pick; blind: boolean; defaultOpen: boolean }) {
  const n = pick.cites.length;
  const summary = blind ? "Show the memories behind this pick" : n ? `${n} ${n === 1 ? "memory" : "memories"} recalled from Walrus` : "No memories used";
  return (
    <details className="group rounded-xl bg-ink-0/50 hairline" open={defaultOpen}>
      <summary className="flex min-h-[44px] items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium text-chalk-2 hover:text-chalk">
        <span className="flex items-center gap-2.5">
          <span aria-hidden className={`grid h-5 w-5 place-items-center rounded-full ${!blind && n ? "bg-flare text-flare-ink" : "bg-ink-3 text-chalk-3"} font-mono text-[0.65rem] font-semibold`}>
            {blind ? "?" : n}
          </span>
          {summary}
        </span>
        <IconChevron size={16} className="shrink-0 transition-transform group-open:rotate-90" />
      </summary>
      <div className="px-4 pb-4">
        {blind ? <p className="mb-3 text-xs text-warn">Opening this unblinds tonight’s test for this pick.</p> : null}
        {n === 0 ? (
          <p className="text-sm text-chalk-3">
            No memories were used. This is the <strong className="font-semibold text-chalk-2">control pick</strong>, chosen with memory switched off so your ratings can be compared fairly.
          </p>
        ) : (
          <ol className="space-y-3">
            {pick.cites.map((c) => (
              <li key={c.blobId} className="text-sm">
                <p className="text-chalk-2">“{c.text}”</p>
                <a
                  href={walruscanBlob(c.blobId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="chip mt-1.5"
                  aria-label={`Open blob ${c.blobId} on Walruscan`}
                >
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-flare" />
                  blob {shortId(c.blobId, 8, 6)}
                  <IconExternal size={12} />
                </a>
              </li>
            ))}
          </ol>
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

function RatingLine({ rating }: { rating: Rating }) {
  return (
    <p className="flex items-center justify-between text-sm">
      <span className="micro">Your rating</span>
      <span className="inline-flex items-center gap-2 font-semibold">
        <RatingGlyph rating={rating} />
        {RATING_META[rating].label}
      </span>
    </p>
  );
}

export function DramaBreakdown({ drama }: { drama: Drama }) {
  const items: [string, number | string][] = [
    ["Goals", drama.goals],
    ["Late goals (75'+)", drama.lateGoals],
    ["Lead changes", drama.leadChanges],
    ["Attempts", drama.attempts],
    ["Cards", drama.cards],
    ["Comeback", drama.comeback ? "Yes" : "No"],
  ];
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <p className="micro">Drama, from the match timeline</p>
        <p className="font-display text-3xl font-extrabold leading-none tnum">
          {Math.round(drama.score)}
          <span className="ml-0.5 font-sans text-xs font-normal text-chalk-3">/100</span>
        </p>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-[var(--line)] text-center">
        {items.map(([k, v]) => (
          <div key={k} className="flex flex-col-reverse bg-ink-1 px-1.5 py-2">
            <dt className="mt-0.5 text-[0.68rem] leading-tight text-chalk-3">{k}</dt>
            <dd className="mono text-base font-semibold text-chalk">{v}</dd>
          </div>
        ))}
      </dl>
      {drama.tags.length ? (
        <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Drama tags">
          {drama.tags.map((t) => (
            <li key={t} className="chip !h-[22px]">{t}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
