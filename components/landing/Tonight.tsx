"use client";

import { useEffect, useRef, useState } from "react";
import type { ReplayMatch, TonightMatch, TonightResponse } from "@/lib/contract";
import { BRAND } from "@/lib/brand";
import { getTonight, type DataSource } from "@/lib/client/api";
import { useApi } from "@/lib/client/useApi";
import { useNow } from "@/lib/client/useNow";
import { fmtAgo, fmtDay, fmtInt, fmtTime, fmtUntil, ordinal, tidyReasons, tzLabel, visitorTz } from "@/lib/client/format";
import { Meter } from "@/components/pick/PickCard";
import { BurnReveal } from "@/components/fx/BurnReveal";
import { HeadToHead, VsPanel, WorthRing } from "@/components/match/Vs";
import { TeamCrest } from "@/components/match/TeamCrest";
import { teamColors } from "@/components/match/crest";
import { Aura, CardSpot } from "@/components/fx/CardFx";

const tintsOf = (home: string, away: string) => {
  const h = teamColors(home), a = teamColors(away);
  return { home: h.tint, away: a.tint, homeA: h.a ?? 0.46, awayA: a.a ?? 0.46 };
};
const tintVars = (home: string, away: string) => {
  const t = tintsOf(home, away);
  return { "--home": t.home, "--away": t.away, "--home-a": t.homeA, "--away-a": t.awayA } as React.CSSProperties;
};
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
  const list = useStagger();
  if (!matches.length)
    return <EmptyState title="A quiet night">Nothing worth flagging kicks off in the next 12 hours. Check back tomorrow evening.</EmptyState>;
  const [top, ...rest] = matches;
  const others = all ? rest : rest.slice(0, SHOW - 1);
  return (
    <div className="space-y-4">
      <FeaturedVs m={top} tz={tz} now={now} />
      {others.length ? (
        <ol ref={list} className="stagger overflow-hidden rounded-[var(--radius-card)] bg-ink-1 hairline" aria-label="More matches tonight">
          {others.map((m, i) => (
            <VsRow key={m.matchId} m={m} rank={i + 2} tz={tz} now={now} index={i} />
          ))}
        </ol>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-chalk-3">
        <p>
          {fmtInt(scanned)} fixtures checked. Scores are for a neutral fan; yours would use your memory.
        </p>
        {rest.length > SHOW - 1 ? (
          <button type="button" className="btn btn-quiet !min-h-[32px] !text-xs" onClick={() => setAll((v) => !v)} aria-expanded={all}>
            {all ? "Show the top 5" : `Show all ${matches.length}`}
            <IconChevron size={14} className={`transition-transform ${all ? "-rotate-90" : "rotate-90"}`} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Rows arrive one after another the first time the list is on screen (CSS does the motion). */
function useStagger() {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.dataset.stagger = "wait";
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        el.dataset.stagger = "in";
        io.disconnect();
      }
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

/** Kick-off for the VS column: the time and "in 2 h", or a pulsing LIVE with the minute. */
function KickoffCell({ m, tz, now, big = false }: { m: TonightMatch; tz: string; now: number | null; big?: boolean }) {
  if (m.status === "live")
    return (
      <span role="status" aria-atomic="true" className="flex flex-col items-center gap-1">
        <span className="sr-only">{m.minute !== null ? `Live, ${ordinal(m.minute)} minute` : "Live now"}</span>
        <span aria-hidden className={`font-display font-extrabold leading-none text-flare tnum ${big ? "text-[1.7rem]" : "text-[1.35rem]"}`}>{m.minute !== null ? `${m.minute}'` : ""}</span>
        <span aria-hidden className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-flare">
          <span className="live-dot !h-1.5 !w-1.5" /> Live
        </span>
      </span>
    );
  const until = now !== null ? fmtUntil(m.kickoff, now) : null;
  return (
    <span className="flex flex-col items-center gap-0.5">
      <time dateTime={m.kickoff} className={`font-display font-extrabold leading-none tnum ${big ? "text-[1.7rem]" : "text-[1.3rem]"}`}>{fmtTime(m.kickoff, tz)}</time>
      <span className="text-xs text-chalk-2">{until ?? fmtDay(m.kickoff, tz)}</span>
    </span>
  );
}

/** Tonight's top match as a full versus screen: crests, names, VS, kick-off, ring, reasons and form. */
function FeaturedVs({ m, tz, now }: { m: TonightMatch; tz: string; now: number | null }) {
  const reasons = tidyReasons(m.reasons, m).slice(0, 2);
  const id = `top-${m.matchId}`;
  return (
    <Aura tints={tintsOf(m.home, m.away)}>
    <article data-team-tints style={tintVars(m.home, m.away)} className="card relative overflow-hidden p-4 sm:p-6" aria-labelledby={id}>
      <CardSpot />
      <h4 id={id} className="sr-only">
        Top match tonight: {m.home} versus {m.away}, {m.competition}
        {m.status === "live" ? `, live, ${m.minute ?? ""} minutes played` : `, kick-off ${fmtTime(m.kickoff, tz)}`}
      </h4>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="chip !text-chalk" style={{ boxShadow: "inset 0 0 0 1px rgb(57 135 229 / 0.55)" }}>Top match tonight</span>
        <span className="chip !h-auto min-h-6 !whitespace-normal py-0.5">{m.competition}</span>
      </div>
      <div className="relative grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-stretch lg:gap-8">
        <VsPanel home={m.home} away={m.away} logos={m.logos} size="lg" fill center={<KickoffCell m={m} tz={tz} now={now} big />} />
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-chalk-3">Ranked by your pundit with no personal memory.</p>
            <WorthRing value={m.score} tone="control" size={76} />
          </div>
          {reasons.length ? (
            <ul className="mt-4 space-y-1.5 text-[0.95rem] text-chalk-2" aria-label="Why">
              {reasons.map((r, i) => (
                <li key={i} className="flex gap-2.5">
                  <span aria-hidden className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-steel" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <HeadToHead form={m.form} home={m.home} away={m.away} className="mt-5 border-t border-[var(--line-faint)] pt-4" />
        </div>
      </div>
    </article>
    </Aura>
  );
}

/** Compact versus row: crest, name, VS, name, crest, then kick-off and the score. */
function VsRow({ m, rank, tz, now, index = 0 }: { m: TonightMatch; rank: number; tz: string; now: number | null; index?: number }) {
  const reasons = tidyReasons(m.reasons, m).slice(0, 2);
  return (
    <li data-team-tints style={{ "--i": index, ...tintVars(m.home, m.away) } as React.CSSProperties} className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 border-b border-[var(--line-faint)] px-4 py-4 last:border-0 sm:px-5 md:grid-cols-[1.5rem_minmax(0,1fr)_6.5rem_9.5rem] md:gap-x-5">
      <span aria-hidden className="row-wash" />
      <span aria-hidden className="relative hidden font-display text-xl font-extrabold leading-none text-chalk-4 md:block">{rank}</span>
      <div className="col-span-2 min-w-0 md:col-span-1">
        <p className="sr-only">
          {rank}. {m.home} versus {m.away}, {m.competition}
          {m.status === "live" ? `, live, ${m.minute ?? ""} minutes played` : ""}
        </p>
        <div aria-hidden className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2.5 sm:gap-3">
          <span className="flex min-w-0 items-center justify-end gap-2 text-right">
            <span className="min-w-0 font-semibold leading-tight text-chalk [text-wrap:balance]">{m.home}</span>
            <TeamCrest name={m.home} size={28} logo={m.logos?.home} />
          </span>
          <span className="vs-plate h-6 px-1.5"><span className="font-display text-[0.95rem] font-extrabold leading-none">VS</span></span>
          <span className="flex min-w-0 items-center gap-2">
            <TeamCrest name={m.away} size={28} logo={m.logos?.away} />
            <span className="min-w-0 font-semibold leading-tight text-chalk [text-wrap:balance]">{m.away}</span>
          </span>
        </div>
        <p className="mt-2 truncate text-center text-xs text-chalk-3" title={reasons.join(" · ")}>
          <span className="text-chalk-2">{m.competition}</span>
          {reasons[0] ? <span className="hidden sm:inline"> · {reasons[0]}</span> : null}
        </p>
      </div>
      <div className="md:text-center">
        <KickoffCell m={m} tz={tz} now={now} />
      </div>
      <div className="justify-self-end md:justify-self-stretch">
        <Meter value={m.score} label="Worth watching" tone="control" compact labelClassName="sr-only" className="w-28 md:w-auto" />
      </div>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading tonight's matches">
      <div className="card grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Skeleton className="h-[220px] w-full !rounded-[18px] sm:h-[260px]" />
        <div className="space-y-3"><Skeleton className="ml-auto h-[76px] w-[76px] !rounded-full" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-3/5" /><Skeleton className="h-24 w-full" /></div>
      </div>
      <div className="overflow-hidden rounded-[var(--radius-card)] bg-ink-1 hairline">
        {Array.from({ length: SHOW - 1 }, (_, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-[var(--line-faint)] px-5 py-5 last:border-0 md:grid-cols-[1.5rem_1fr_6.5rem_9.5rem]">
            <Skeleton className="hidden h-5 w-4 md:block" />
            <Skeleton className="col-span-2 h-8 w-full md:col-span-1" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-5 w-28 md:w-full" />
          </div>
        ))}
      </div>
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
    <li data-team-tints style={tintVars(r.home, r.away)} className="card relative flex flex-col overflow-hidden p-5">
      <CardSpot />
      <p className="truncate text-xs text-chalk-3">
        {r.competition} · {fmtDay(r.kickoff, tz)} {fmtTime(r.kickoff, tz)}
        {now ? <span className="sr-only">, {fmtAgo(r.kickoff, now)}</span> : null}
      </p>
      <p className="sr-only">{r.home} versus {r.away}</p>
      <VsPanel home={r.home} away={r.away} logos={r.logos} className="mt-3" center={<span className="text-xs text-chalk-3">Full time</span>} />
      <Meter className="mt-4" value={r.drama} label="Drama" compact />
      {r.vibe.length ? (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="What it was like">
          {r.vibe.map((v) => <li key={v} className="chip !h-[22px]">{v}</li>)}
        </ul>
      ) : null}
      <div className="mt-auto pt-4">
        {hasScore ? (
          <BurnReveal srLabel={`Reveal the final score of ${r.home} versus ${r.away}`} burst={r.drama >= 80}>
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
