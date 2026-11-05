"use client";

import { useState } from "react";
import type { Rating, StatsResponse } from "@/lib/contract";
import { ArmCompare } from "@/components/charts/ArmCompare";
import { RatingGlyph } from "@/components/pick/PickCard";
import { IconBulb, IconChevron, IconExternal } from "@/components/site/Icons";
import { walruscanBlob } from "@/lib/client/chain";
import { DataSourceBadge, EmptyState, ErrorState, Skeleton } from "@/components/site/States";
import { cleanMemoryText, fmtAgo, fmtCompact, fmtInt } from "@/lib/client/format";
import { useNow } from "@/lib/client/useNow";
import { useStats } from "./StatsProvider";
import { CountUp } from "@/components/fx/CardFx";

export function StatsSourceBadge() {
  const s = useStats();
  return <DataSourceBadge source={s.source} updatedAt={s.status === "ok" ? s.data.updatedAt : undefined} />;
}

export function LiveNumbers() {
  const s = useStats();
  if (s.status === "error") return <ErrorState title="Live numbers are unavailable right now" detail={s.error.message} onRetry={s.reload} />;

  const d = s.status === "ok" ? s.data : null;
  const tiles = [
    { label: "Picks sent", value: d?.picksSent, note: d ? `to ${fmtInt(d.users)} ${d.users === 1 ? "viewer" : "viewers"}` : "on Telegram" },
    { label: "Picks rated", value: d?.picksRated, note: d && d.picksSent ? `${Math.round((d.picksRated / d.picksSent) * 100)}% of picks` : "one tap each" },
    { label: "Memories saved", value: d?.memoriesStored, note: "on Walrus mainnet" },
    { label: "Fixtures checked", value: d?.matchesScanned, note: "across every brief" },
    // Ranked the morning after: every finished match in the viewer's window by drama, picks locked beforehand.
    { label: "Night's best caught", value: d ? d.nights?.caught ?? 0 : undefined, note: d?.nights?.nights ? `of ${fmtInt(d.nights.nights)} ${d.nights.nights === 1 ? "night" : "nights"} ranked after full time` : "ranked after full time" },
    { label: "Top-3 nights", value: d ? d.nights?.top3Nights ?? 0 : undefined, note: "a top-3 match of the night was a pick" },
  ];

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] bg-[var(--line)] lg:grid-cols-3" aria-busy={s.status === "loading"}>
      {tiles.map((t) => (
        <div key={t.label} className="flex flex-col bg-ink-1 p-5 md:p-6">
          <dt className="text-sm font-medium text-chalk">{t.label}</dt>
          <dd className="order-first mb-3 min-h-[3.25rem]" aria-label={t.value === undefined ? undefined : fmtInt(t.value)}>
            {t.value === undefined ? (
              <Skeleton className="h-12 w-24" />
            ) : (
              <span className="font-display text-[clamp(2.6rem,1.6rem+3vw,3.75rem)] font-extrabold leading-none" title={fmtInt(t.value)}>
                <CountUp value={t.value} format={fmtCompact} />
              </span>
            )}
          </dd>
          <dd className="mt-0.5 text-xs text-chalk-3">{t.note}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ABFromStats() {
  const s = useStats();
  if (s.status === "error") return <ErrorState title="The A/B numbers are unavailable right now" detail={s.error.message} onRetry={s.reload} />;
  if (s.status === "loading") return <Skeleton className="h-[420px] w-full !rounded-[var(--radius-card)]" label="Loading the A/B result" />;
  return <ArmCompare memory={s.data.ab.memory} control={s.data.ab.control} scope="everyone" />;
}

type Lesson = StatsResponse["recentLessons"][number];

const VERDICT_WORD: Record<Rating, string> = { loved: "Loved", fine: "Fine", bailed: "Bailed", skipped: "Didn’t watch" };

/** One friendly line per lesson: an icon, the headline in bold, a short detail, when, and a Walrus link. */
function LessonCard({ l, now }: { l: Lesson; now: number | null }) {
  const verdict = l.kind === "rating" && l.verdict ? l.verdict : null;
  const headline = l.headline ?? cleanMemoryText(l.text);
  return (
    <li className="flex gap-3.5 p-4 md:p-5">
      <span
        aria-hidden
        className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${verdict ? "bg-ink-2" : "bg-[rgb(240_83_28/0.14)] text-flare"}`}
        style={{ boxShadow: "inset 0 0 0 1px var(--line)" }}
      >
        {verdict ? <RatingGlyph rating={verdict} size={16} /> : <IconBulb size={18} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug text-chalk">
          {verdict ? <span className="sr-only">{VERDICT_WORD[verdict]}: </span> : null}
          {headline}
        </p>
        {l.detail ? <p className="mt-0.5 text-sm leading-snug text-chalk-3">{l.detail}</p> : null}
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-chalk-3">
          <time dateTime={l.createdAt}>{now ? fmtAgo(l.createdAt, now) : " "}</time>
          {l.blobId ? (
            <a href={walruscanBlob(l.blobId)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-chalk-2 hover:text-chalk" aria-label="Open this memory on Walruscan" title={l.blobId}>
              <IconExternal size={12} /> Walrus
            </a>
          ) : (
            <span className="inline-flex items-center gap-1">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warn" /> Saving to Walrus
            </span>
          )}
        </p>
      </div>
    </li>
  );
}

export function LessonsFeed({ limit = 4 }: { limit?: number }) {
  const s = useStats();
  const now = useNow(60_000);
  const [all, setAll] = useState(false);

  if (s.status === "error") return <ErrorState compact title="Recent lessons are unavailable right now" detail={s.error.message} onRetry={s.reload} />;
  if (s.status === "loading")
    return (
      <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-[var(--radius-card)] bg-ink-1 hairline" aria-busy>
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className="flex gap-3.5 p-5">
            <Skeleton className="h-9 w-9 !rounded-full" />
            <div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
          </li>
        ))}
      </ul>
    );
  const lessons = s.data.recentLessons;
  if (!lessons.length) return <EmptyState title="No lessons yet">They appear after the first rated matches.</EmptyState>;
  const shown = all ? lessons : lessons.slice(0, limit);

  return (
    <div>
      <ol className="divide-y divide-[var(--line)] overflow-hidden rounded-[var(--radius-card)] bg-ink-1 hairline">
        {shown.map((l, i) => (
          <LessonCard key={`${l.createdAt}-${i}`} l={l} now={now} />
        ))}
      </ol>
      {lessons.length > limit ? (
        <button type="button" className="btn btn-quiet mt-2 !min-h-[32px] !text-xs" onClick={() => setAll((v) => !v)} aria-expanded={all}>
          {all ? "Show fewer" : `Show ${lessons.length - limit} more`}
          <IconChevron size={14} className={`transition-transform ${all ? "-rotate-90" : "rotate-90"}`} />
        </button>
      ) : null}
    </div>
  );
}
