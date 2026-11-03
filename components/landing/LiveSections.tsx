"use client";

import { ArmCompare } from "@/components/charts/ArmCompare";
import { BlobChip } from "@/components/pick/PickCard";
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
  ];

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] bg-[var(--line)] lg:grid-cols-4" aria-busy={s.status === "loading"}>
      {tiles.map((t) => (
        <div key={t.label} className="flex flex-col bg-ink-1 p-5 md:p-6">
          <dt className="text-sm font-medium text-chalk">{t.label}</dt>
          <dd className="order-first mb-3 min-h-[3.25rem]">
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
  if (s.status === "loading") return <Skeleton className="h-[460px] w-full !rounded-[var(--radius-card)]" label="Loading the A/B result" />;
  return <ArmCompare memory={s.data.ab.memory} control={s.data.ab.control} scope="everyone" />;
}

export function LessonsFeed({ limit = 4 }: { limit?: number }) {
  const s = useStats();
  const now = useNow(60_000);

  if (s.status === "error") return <ErrorState compact title="Recent lessons are unavailable right now" detail={s.error.message} onRetry={s.reload} />;
  if (s.status === "loading")
    return (
      <ul className="space-y-px" aria-busy>
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className="card p-5"><Skeleton className="h-4 w-4/5" /><Skeleton className="mt-3 h-3 w-40" /></li>
        ))}
      </ul>
    );
  const lessons = s.data.recentLessons.slice(0, limit);
  if (!lessons.length) return <EmptyState title="No lessons yet">They appear after the first rated matches.</EmptyState>;

  return (
    <ol className="divide-y divide-[var(--line)] overflow-hidden rounded-[var(--radius-card)] bg-ink-1 hairline">
      {lessons.map((l, i) => (
        <li key={`${l.createdAt}-${i}`} className="p-4 md:p-5">
          <p className="text-[0.95rem] leading-snug text-chalk">&ldquo;{cleanMemoryText(l.text)}&rdquo;</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <time dateTime={l.createdAt} className="text-xs text-chalk-3">{now ? fmtAgo(l.createdAt, now) : " "}</time>
            {l.blobId ? (
              <BlobChip blobId={l.blobId} tone="ok" />
            ) : (
              <span className="chip !h-[22px]" title="Saved; the Walrus certificate is still pending">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warn" /> Saving to Walrus
              </span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
