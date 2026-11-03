"use client";

import { useEffect, useState } from "react";
import type { ReplayMatch, TonightMatch, TonightResponse } from "@/lib/contract";
import { BRAND } from "@/lib/brand";
import { getTonight, type DataSource } from "@/lib/client/api";
import { useApi } from "@/lib/client/useApi";
import { useNow } from "@/lib/client/useNow";
import { fmtAgo, fmtDay, fmtInt, fmtTime, fmtUntil, tidyReasons, tzLabel, visitorTz } from "@/lib/client/format";
import { Meter } from "@/components/pick/PickCard";
import { BurnReveal } from "@/components/fx/BurnReveal";
import { EmptyState, Skeleton } from "@/components/site/States";
import { IconAlert, IconChevron, IconTelegram } from "@/components/site/Icons";

/**
 * Public, live: what the agent (memory off) recommends to anyone tonight, in the visitor's own time
 * zone, plus last night's best games without the scores. If /api/tonight fails, a clearly labelled
 * sample is shown instead (see getTonight).
 */
export function TonightBoard() {
  const [tz, setTz] = useState<string | null>(null);
  useEffect(() => setTz(visitorTz()), []);
  const s = useApi<TonightResponse>((signal) => getTonight(tz ?? "UTC", signal), tz);
  const now = useNow(30_000);

  const data = s.status === "ok" ? s.data : null;
  const zone = tz ?? "UTC";

  return (
    <div className="space-y-14 md:space-y-16">
      {/* (a) Tonight, for anyone */}
      <div>
        <BlockHead
          title="Tonight, for anyone"
          sub={
            <>
              The best matches in the next 12 hours, ranked with no personal memory.
              {tz ? <> Times are in <span className="text-chalk-2">{tzLabel(zone)}</span> time.</> : null}
            </>
          }
          badge={<SourceBadge source={s.source} updatedAt={data?.updatedAt} now={now} />}
        />
        {data ? <TonightList matches={data.tonight} tz={zone} now={now} scanned={data.scanned} /> : <ListSkeleton />}
      </div>

      {/* (b) Last night, spoiler-free */}
      <div>
        <BlockHead title="Last night, worth the highlights" sub="The most dramatic games of the last 24 hours. Scores stay hidden until you ask." />
        {data ? <Replays replays={data.replays} tz={zone} now={now} /> : <ReplaySkeleton />}
      </div>

      {/* CTA */}
      <div className="card relative flex flex-col gap-5 overflow-hidden p-6 sm:flex-row sm:items-center sm:justify-between md:p-8" data-reveal>
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full" style={{ background: "radial-gradient(closest-side, rgb(240 83 28 / 0.18), transparent)" }} />
        <div className="relative">
          <p className="display-s">Get these tuned to you.</p>
          <p className="mt-2 max-w-xl text-chalk-2">Your pundit learns your leagues, your teams and the hours you can actually watch, then sends tonight&rsquo;s three at the time you choose.</p>
        </div>
        <a href={BRAND.botUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary relative self-start sm:self-auto">
          <IconTelegram size={18} /> Open in Telegram
        </a>
      </div>
    </div>
  );
}

function BlockHead({ title, sub, badge }: { title: string; sub: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h3 className="display-s">{title}</h3>
        <p className="mt-2 max-w-2xl text-sm text-chalk-3">{sub}</p>
      </div>
      {badge}
    </div>
  );
}

function SourceBadge({ source, updatedAt, now }: { source: DataSource | null; updatedAt?: string; now: number | null }) {
  if (!source) return null;
  if (source === "live")
    return (
      <span className="chip self-start sm:self-auto">
        <span className="live-dot !h-1.5 !w-1.5" aria-hidden /> Live{updatedAt && now ? ` · updated ${fmtAgo(updatedAt, now)}` : ""}
      </span>
    );
  return (
    <span role="note" className="chip self-start !text-warn sm:self-auto" style={{ boxShadow: "inset 0 0 0 1px rgb(250 178 25 / 0.35)" }} title="The live feed didn't answer, so this is an illustrative sample">
      <IconAlert size={13} /> {source === "mock" ? "Demo data" : "Sample · live feed unavailable"}
    </span>
  );
}

// ------------------------------------------------------------------ tonight list

const SHOW = 5;

function TonightList({ matches, tz, now, scanned }: { matches: TonightMatch[]; tz: string; now: number | null; scanned: number }) {
  const [all, setAll] = useState(false);
  if (!matches.length)
    return <EmptyState title="A quiet night">Nothing worth flagging kicks off in the next 12 hours. Check back tomorrow evening.</EmptyState>;
  const shown = all ? matches : matches.slice(0, SHOW);
  return (
    <div>
      <ol className="overflow-hidden rounded-[var(--radius-card)] bg-ink-1 hairline">
        <li aria-hidden className="hidden grid-cols-[2rem_6.5rem_minmax(0,1fr)_10rem] gap-x-5 border-b border-[var(--line)] px-5 py-2.5 text-xs text-chalk-3 md:grid">
          <span>#</span>
          <span>Kick-off</span>
          <span>Match</span>
          <span>Worth watching</span>
        </li>
        {shown.map((m, i) => (
          <TonightRow key={m.matchId} m={m} rank={i + 1} tz={tz} now={now} />
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-chalk-3">
        <p>
          {fmtInt(scanned)} fixtures checked. Scores are for a neutral fan; yours would use your memory.
        </p>
        {matches.length > SHOW ? (
          <button type="button" className="btn btn-quiet !min-h-[32px] !text-xs" onClick={() => setAll((v) => !v)} aria-expanded={all}>
            {all ? "Show the top 5" : `Show all ${matches.length}`}
            <IconChevron size={14} className={`transition-transform ${all ? "-rotate-90" : "rotate-90"}`} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function TonightRow({ m, rank, tz, now }: { m: TonightMatch; rank: number; tz: string; now: number | null }) {
  const live = m.status === "live";
  const until = now !== null && !live ? fmtUntil(m.kickoff, now) : null;
  const reasons = tidyReasons(m.reasons, m).slice(0, 2);
  return (
    <li className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-x-4 gap-y-3 border-b border-[var(--line-faint)] px-4 py-4 last:border-0 sm:px-5 md:grid-cols-[2rem_6.5rem_minmax(0,1fr)_10rem] md:gap-x-5 md:py-4.5">
      <span aria-hidden className="hidden pt-1 font-display text-xl font-extrabold leading-none text-chalk-4 md:block">{rank}</span>

      <div className="min-w-0">
        {live ? (
          <>
            <p className="font-display text-[1.6rem] font-extrabold leading-none text-flare tnum">{m.minute ?? ""}{m.minute !== null ? "'" : ""}</p>
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-flare">
              <span className="live-dot !h-1.5 !w-1.5" aria-hidden /> Live
            </p>
          </>
        ) : (
          <>
            <p className="font-display text-[1.6rem] font-extrabold leading-none tnum">
              <time dateTime={m.kickoff}>{fmtTime(m.kickoff, tz)}</time>
            </p>
            <p className="mt-1.5 text-xs text-chalk-3">{until ?? fmtDay(m.kickoff, tz)}</p>
          </>
        )}
      </div>

      <div className="min-w-0">
        <p className="font-semibold leading-snug text-chalk">
          <span className="sr-only">{rank}. </span>
          {m.home} <span className="font-normal text-chalk-4">v</span> {m.away}
          {live ? <span className="sr-only">, live, {m.minute ?? ""} minutes played</span> : null}
        </p>
        <p className="mt-0.5 truncate text-sm text-chalk-3">{m.competition}</p>
        {reasons.length ? (
          <ul className="mt-2 space-y-1 text-sm text-chalk-2" aria-label="Why">
            {reasons.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-steel" />
                <span className="md:truncate" title={r}>{r}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="col-span-2 md:col-span-1 md:pt-0.5">
        <Meter value={m.score} label="Worth watching" tone="control" compact labelClassName="md:sr-only" />
      </div>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] bg-ink-1 hairline" role="status" aria-label="Loading tonight's matches">
      {Array.from({ length: SHOW }, (_, i) => (
        <div key={i} className="grid grid-cols-[4.25rem_1fr] gap-4 border-b border-[var(--line-faint)] px-5 py-5 last:border-0 md:grid-cols-[2rem_6.5rem_1fr_10rem]">
          <Skeleton className="hidden h-5 w-4 md:block" />
          <Skeleton className="h-7 w-16" />
          <div className="space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/3" /><Skeleton className="h-3 w-2/3" /></div>
          <Skeleton className="col-span-2 h-6 w-full md:col-span-1" />
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ replays

function Replays({ replays, tz, now }: { replays: ReplayMatch[]; tz: string; now: number | null }) {
  const [all, setAll] = useState(false);
  if (!replays.length) return <EmptyState title="Nothing to replay yet">Last night&rsquo;s games appear here once their timelines are in.</EmptyState>;
  const shown = all ? replays : replays.slice(0, 3);
  return (
    <div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((r) => (
          <ReplayCard key={r.matchId} r={r} tz={tz} now={now} />
        ))}
      </ul>
      {replays.length > 3 ? (
        <button type="button" className="btn btn-quiet mt-3 !min-h-[32px] !text-xs" onClick={() => setAll((v) => !v)} aria-expanded={all}>
          {all ? "Show fewer" : `Show ${replays.length - 3} more`}
          <IconChevron size={14} className={`transition-transform ${all ? "-rotate-90" : "rotate-90"}`} />
        </button>
      ) : null}
    </div>
  );
}

function ReplayCard({ r, tz, now }: { r: ReplayMatch; tz: string; now: number | null }) {
  const hasScore = r.homeScore !== null && r.awayScore !== null;
  return (
    <li className="card flex flex-col p-5">
      <p className="truncate text-xs text-chalk-3">
        {r.competition} · {fmtDay(r.kickoff, tz)} {fmtTime(r.kickoff, tz)}
        {now ? <span className="sr-only">, {fmtAgo(r.kickoff, now)}</span> : null}
      </p>
      <p className="mt-2 font-display text-[1.6rem] font-extrabold leading-[0.95]">
        <span className="block">{r.home}<span className="ml-2 text-[0.6em] text-chalk-4" aria-hidden>v</span><span className="sr-only"> versus </span></span>
        <span className="block">{r.away}</span>
      </p>
      <Meter className="mt-4" value={r.drama} label="Drama" compact />
      {r.vibe.length ? (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="What it was like">
          {r.vibe.map((v) => <li key={v} className="chip !h-[22px]">{v}</li>)}
        </ul>
      ) : null}
      <div className="mt-auto pt-4">
        {hasScore ? (
          <BurnReveal srLabel={`Reveal the final score of ${r.home} versus ${r.away}`}>
            <p className="text-center" aria-label={`Final score: ${r.home} ${r.homeScore}, ${r.away} ${r.awayScore}`}>
              <span className="font-display text-[2.4rem] font-extrabold leading-none tnum">
                {r.homeScore}
                <span className="mx-2 text-chalk-4">–</span>
                {r.awayScore}
              </span>
              <span className="mt-0.5 block text-xs text-chalk-3">Full time</span>
            </p>
          </BurnReveal>
        ) : (
          <p className="flex min-h-[64px] items-center rounded-[10px] px-4 text-xs text-chalk-3 hairline">Final score not in yet.</p>
        )}
      </div>
    </li>
  );
}

function ReplaySkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading last night's games">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card space-y-3 p-5">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-16 w-full !rounded-[10px]" />
        </div>
      ))}
    </div>
  );
}
