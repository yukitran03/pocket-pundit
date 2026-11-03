"use client";

import { useEffect, useState } from "react";
import { ArmCompare } from "@/components/charts/ArmCompare";
import { IconExternal } from "@/components/site/Icons";
import { DataSourceBadge, EmptyState, ErrorState, Skeleton } from "@/components/site/States";
import { walruscanBlob } from "@/lib/client/chain";
import { fmtAgo, fmtCompact, fmtInt, shortId } from "@/lib/client/format";
import { useStats } from "./StatsProvider";

export function StatsSourceBadge() {
  const s = useStats();
  return <DataSourceBadge source={s.source} updatedAt={s.status === "ok" ? s.data.updatedAt : undefined} />;
}

export function LiveNumbers() {
  const s = useStats();
  if (s.status === "error") return <ErrorState title="Live numbers are unavailable right now" detail={s.error.message} onRetry={s.reload} />;

  const d = s.status === "ok" ? s.data : null;
  const tiles = [
    { label: "Memories stored on Walrus", value: d?.memoriesStored, note: "Encrypted, user-scoped blobs" },
    { label: "Picks sent", value: d?.picksSent, note: d ? `To ${fmtInt(d.users)} ${d.users === 1 ? "viewer" : "viewers"} on Telegram` : "To viewers on Telegram" },
    { label: "Picks rated", value: d?.picksRated, note: d && d.picksSent ? `${Math.round((d.picksRated / d.picksSent) * 100)}% of picks got a rating` : "Loved, Fine, Bailed or Didn’t watch" },
    { label: "Fixtures scanned", value: d?.matchesScanned, note: "Every fixture considered, across all briefs" },
  ];

  return (
    <div>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] bg-[var(--line)] lg:grid-cols-4" aria-busy={s.status === "loading"}>
        {tiles.map((t) => (
          <div key={t.label} className="flex flex-col bg-ink-1 p-5 md:p-6">
            <dt className="text-sm text-chalk-2">{t.label}</dt>
            <dd className="order-first mb-4 mt-1 min-h-[3.25rem]">
              {t.value === undefined ? (
                <Skeleton className="h-12 w-28" />
              ) : (
                <span className="font-display text-[clamp(2.5rem,1.5rem+3vw,3.75rem)] font-extrabold leading-none" title={fmtInt(t.value)}>
                  {fmtCompact(t.value)}
                </span>
              )}
            </dd>
            <dd className="mt-1 text-xs text-chalk-3">{t.note}</dd>
          </div>
        ))}
      </dl>
      {d ? (
        <p className="mono mt-3 text-xs text-chalk-3">
          Updated <time dateTime={d.updatedAt}>{new Date(d.updatedAt).toISOString().replace("T", " ").slice(0, 16)} UTC</time>
        </p>
      ) : null}
    </div>
  );
}

export function ABFromStats() {
  const s = useStats();
  if (s.status === "error") return <ErrorState title="The A/B numbers are unavailable right now" detail={s.error.message} onRetry={s.reload} />;
  if (s.status === "loading") return <Skeleton className="h-[460px] w-full !rounded-[var(--radius-card)]" label="Loading the A/B result" />;
  return <ArmCompare memory={s.data.ab.memory} control={s.data.ab.control} scope="everyone" />;
}

export function LessonsFeed() {
  const s = useStats();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (s.status === "error") return <ErrorState title="Recent lessons are unavailable right now" detail={s.error.message} onRetry={s.reload} />;
  if (s.status === "loading")
    return (
      <ul className="space-y-px" aria-busy>
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="card p-5"><Skeleton className="h-4 w-4/5" /><Skeleton className="mt-3 h-3 w-40" /></li>
        ))}
      </ul>
    );
  const lessons = s.data.recentLessons;
  if (!lessons.length) return <EmptyState title="No lessons yet">Lessons appear after the first rated matches have been read.</EmptyState>;

  return (
    <ol className="divide-y divide-[var(--line)] overflow-hidden rounded-[var(--radius-card)] bg-ink-1 hairline">
      {lessons.map((l, i) => (
        <li key={`${l.createdAt}-${i}`} className="grid gap-3 p-5 md:grid-cols-[1fr_auto] md:items-center md:gap-8">
          <p className="flex gap-2.5 text-[0.98rem] text-chalk">
            <span aria-hidden className="font-display text-xl font-extrabold leading-[1.1] text-flare">“</span>
            <span>{l.text}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <time dateTime={l.createdAt} className="mono text-xs text-chalk-3">{now ? fmtAgo(l.createdAt, now) : " "}</time>
            {l.blobId ? (
              <a href={walruscanBlob(l.blobId)} target="_blank" rel="noopener noreferrer" className="chip" aria-label={`Open blob ${l.blobId} on Walruscan`}>
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ok" />
                {shortId(l.blobId, 7, 4)}
                <IconExternal size={12} />
              </a>
            ) : (
              <span className="chip" title="Written to the relayer; Walrus certificate pending">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warn" /> pending
              </span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
