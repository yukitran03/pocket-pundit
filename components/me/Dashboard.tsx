"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import type { MeResponse, MemoryRow, Pick } from "@/lib/contract";
import { ApiError, getMe } from "@/lib/client/api";
import { useApi } from "@/lib/client/useApi";
import { estimateWalrusEpoch } from "@/lib/client/chain";
import { fmtBriefDate, fmtDay, fmtHour, localHour, tzLabel } from "@/lib/client/format";
import { PickCard } from "@/components/pick/PickCard";
import { KickoffStrip } from "@/components/charts/KickoffStrip";
import { DivergingBars, DivergingLegend } from "@/components/charts/DivergingBars";
import { ArmCompare } from "@/components/charts/ArmCompare";
import { DataSourceBadge, EmptyState, ErrorState, Skeleton } from "@/components/site/States";
import { IconChevron } from "@/components/site/Icons";
import type { RoomItem } from "@/components/three/TasteRoomScene";
import { TasteRoom } from "./TasteRoom";
import { MemoryTable, memKey } from "./MemoryTable";
import { SettingsForm, TeachForm } from "./Forms";
import { TokenHelp } from "./TokenHelp";

/** Optional, backward-compatible extension the API may add (see docs/DESIGN.md). */
type MeResponseExt = MeResponse & { currentWalrusEpoch?: number | null };

export function Dashboard({ token }: { token: string }) {
  const me = useApi<MeResponseExt>((signal) => getMe(token, signal), token);

  if (me.status === "loading") return <DashboardSkeleton />;
  if (me.status === "error") {
    if (me.error instanceof ApiError && me.error.fromApi && (me.error.isAuth || me.error.status === 400 || me.error.status === 404)) return <TokenHelp reason="invalid" />;
    return (
      <div className="shell pt-14">
        <ErrorState title="Your dashboard couldn’t load" detail={`${me.error.message}. Your memories are safe on Walrus; this is only the page.`} onRetry={me.reload} />
      </div>
    );
  }
  return <DashboardView data={me.data} source={me.source} token={token} mutate={me.mutate} />;
}

function DashboardView({ data, source, token, mutate }: { data: MeResponseExt; source: "live" | "mock" | "fallback"; token: string; mutate: (fn: (d: MeResponseExt) => MeResponseExt) => void }) {
  const { user, today, history, taste, memories, ab, shares } = data;
  const [selected, setSelected] = useState<string | null>(null);
  const [hits, setHits] = useState<Set<string> | null>(null);
  const roomRef = useRef<HTMLDivElement>(null);

  const epochEstimated = typeof data.currentWalrusEpoch !== "number";
  const currentEpoch = epochEstimated ? estimateWalrusEpoch() : (data.currentWalrusEpoch as number);

  const todaySorted = useMemo(() => [...today].sort((a, b) => a.slot - b.slot), [today]);
  const citedKeys = useMemo(() => new Set(today.flatMap((p) => p.cites.map((c) => c.blobId))), [today]);
  const items: RoomItem[] = useMemo(() => memories.map((m, i) => ({ key: memKey(m, i), row: m, cited: citedKeys.has(memKey(m, i)) })), [memories, citedKeys]);
  const strip = useMemo(() => [...history, ...today], [history, today]);

  const selectFromTable = useCallback((k: string | null) => {
    setSelected(k);
    const el = roomRef.current;
    if (k && el) {
      const r = el.getBoundingClientRect();
      if (r.bottom < 80 || r.top > window.innerHeight - 80) {
        el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      }
    }
  }, []);

  const onAdded = (m: MemoryRow) => mutate((d) => ({ ...d, memories: [m, ...d.memories] }));
  const onSaved = (u: Partial<MeResponse["user"]>) => mutate((d) => ({ ...d, user: { ...d.user, ...u } }));

  const inWindow = (p: Pick) => {
    const h = localHour(p.kickoff, user.tz);
    const ws = user.windowStart < 12 ? user.windowStart + 24 : user.windowStart;
    const we = user.windowEnd < ws ? user.windowEnd + 24 : user.windowEnd;
    return h >= ws && h <= we;
  };
  const days = Array.from(new Set(strip.map((p) => p.briefDate))).sort();
  const firstDay = strip.filter((p) => p.briefDate === days[0]);
  const lastDay = strip.filter((p) => p.briefDate === days[days.length - 1]);

  return (
    <div className="pb-4">
      {/* ---------------------------------------------------------- header */}
      <header className="border-b border-line">
        <div className="shell flex flex-col gap-8 pb-8 pt-10 md:flex-row md:items-end md:justify-between md:pt-14">
          <div className="min-w-0">
            <p className="micro flex flex-wrap items-center gap-2">
              <span>Private dashboard</span>
              <span aria-hidden className="h-px w-6 bg-line-strong" />
              <span className="normal-case tracking-normal text-chalk-3">{user.namespace}</span>
            </p>
            <h1 className="display-l mt-4">{user.name}’s evenings</h1>
            <ul className="mt-5 flex flex-wrap gap-2 text-sm">
              <li className="chip">{tzLabel(user.tz)} time</li>
              <li className="chip">Brief at {fmtHour(user.briefHour)}</li>
              <li className="chip">Window {fmtHour(user.windowStart)}–{fmtHour(user.windowEnd)}</li>
              <li className="chip">Joined {fmtDay(user.joinedAt, user.tz)}</li>
              <li><DataSourceBadge source={source} /></li>
            </ul>
          </div>
          <div className="flex items-end gap-5">
            <div className="text-right">
              <p className="micro mb-3">Day</p>
              <p className="font-display text-[clamp(4.5rem,3rem+6vw,8rem)] font-extrabold leading-[0.78] text-flare">{user.dayIndex}</p>
            </div>
            <dl className="mb-1 space-y-2 border-l border-line pl-5 text-sm">
              <div><dt className="text-xs text-chalk-3">Memories</dt><dd className="mono text-chalk">{memories.length}</dd></div>
              <div><dt className="text-xs text-chalk-3">Rated picks</dt><dd className="mono text-chalk">{history.filter((p) => p.rating).length}</dd></div>
            </dl>
          </div>
        </div>
        <nav aria-label="Dashboard sections" className="shell">
          <ul className="-mb-px flex gap-1 overflow-x-auto pb-px text-sm [scrollbar-width:none]">
            {[["tonight", "Tonight"], ["progress", "Since day 1"], ["learned", "What it learned"], ["ab", "A/B"], ["memory", "Memory wall"], ["teach", "Teach it"], ["settings", "Settings"]].map(([id, l]) => (
              <li key={id}><a href={`#${id}`} className="block whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-chalk-3 hover:border-line-strong hover:text-chalk">{l}</a></li>
            ))}
          </ul>
        </nav>
      </header>

      {/* ---------------------------------------------------------- tonight */}
      <Block id="tonight" index="01" title="Tonight’s picks" note="Arms stay hidden until you rate in Telegram, so the A/B stays blind.">
        {todaySorted.length ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {todaySorted.map((p) => <PickCard key={p.id} pick={p} tz={user.tz} />)}
          </div>
        ) : (
          <EmptyState title="No brief yet today">Your three picks arrive at {fmtHour(user.briefHour)} {tzLabel(user.tz)} time, in Telegram and here.</EmptyState>
        )}
      </Block>

      {/* ---------------------------------------------------------- progress */}
      <Block id="progress" index="02" title="Since day 1" note="Where each day’s picks kicked off, against your window. This is memory changing the product.">
        {strip.length ? (
          <div className="space-y-5">
            {days.length > 1 ? (
              <div className="grid gap-px overflow-hidden rounded-[var(--radius-card)] bg-[var(--line)] sm:grid-cols-2">
                {[
                  ["Day 1", firstDay, days[0]],
                  [`Day ${user.dayIndex}`, lastDay, days[days.length - 1]],
                ].map(([label, picks, d]) => {
                  const ps = picks as Pick[];
                  return (
                    <div key={label as string} className="bg-ink-1 p-5">
                      <p className="micro">{label as string} · {fmtBriefDate(d as string)}</p>
                      <p className="mt-2 font-display text-4xl font-extrabold leading-none">
                        {ps.filter(inWindow).length} <span className="text-chalk-3">of {ps.length}</span>
                      </p>
                      <p className="mt-1 text-sm text-chalk-3">picks inside your viewing window</p>
                    </div>
                  );
                })}
              </div>
            ) : null}
            <KickoffStrip picks={strip} tz={user.tz} windowStart={user.windowStart} windowEnd={user.windowEnd} />
            {history.length ? (
              <details className="group">
                <summary className="btn btn-ghost w-full justify-between sm:w-auto">
                  <span>Past picks with ratings and drama ({history.length})</span>
                  <IconChevron size={16} className="transition-transform group-open:rotate-90" />
                </summary>
                <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {history.map((p) => <PickCard key={p.id} pick={p} tz={user.tz} />)}
                </div>
              </details>
            ) : null}
          </div>
        ) : (
          <EmptyState title="Nothing to compare yet">After a couple of evenings this shows your picks moving into your window.</EmptyState>
        )}
      </Block>

      {/* ---------------------------------------------------------- learned */}
      <Block id="learned" index="03" title="What it has learned" note="Taste weights from −1 (steers away) to +1 (leans in), each backed by memories." aside={<DivergingLegend />}>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <DivergingBars title="Competitions" weights={taste.competitions} empty="No competition preferences yet." />
          <DivergingBars title="Teams" weights={taste.teams} empty="No team preferences yet." />
          <DivergingBars title="Match signals" weights={taste.signals} empty="Signals appear after the first rated matches." />
          <DivergingBars title="Limits" weights={taste.limits} empty="No limits learned yet." />
        </div>
      </Block>

      {/* ---------------------------------------------------------- A/B */}
      <Block id="ab" index="04" title="Your A/B" note="Your ratings of memory picks vs the hidden control pick.">
        <ArmCompare memory={ab.memory} control={ab.control} scope="you" />
      </Block>

      {/* ---------------------------------------------------------- memory wall */}
      <Block id="memory" index="05" title="The memory wall" note="Everything it remembers about you, as stored on Walrus. Search runs a real recall.">
        <div className="space-y-5">
          <div ref={roomRef}>
            <TasteRoom items={items} currentEpoch={currentEpoch} epochEstimated={epochEstimated} tz={user.tz} selected={selected} onSelect={setSelected} highlighted={hits} />
          </div>
          <MemoryTable token={token} memories={memories} tz={user.tz} currentEpoch={currentEpoch} citedKeys={citedKeys} selected={selected} onSelect={selectFromTable} onHits={setHits} />
          {shares.length ? (
            <p className="text-sm text-chalk-3">
              Shared with {shares.map((s, i) => <span key={s.username}>{i ? ", " : ""}<span className="text-chalk-2">@{s.username}</span> since {fmtBriefDate(s.since.slice(0, 10))}</span>)}.
            </p>
          ) : null}
        </div>
      </Block>

      {/* ---------------------------------------------------------- teach + settings */}
      <div className="shell mt-16 grid gap-5 lg:grid-cols-2">
        <div id="teach" className="scroll-mt-24">
          <TeachForm token={token} memories={memories} onAdded={onAdded} />
        </div>
        <div id="settings" className="scroll-mt-24">
          <SettingsForm key={`${user.tz}-${user.briefHour}-${user.windowStart}-${user.windowEnd}`} token={token} user={user} onSaved={onSaved} />
        </div>
      </div>
    </div>
  );
}

function Block({ id, index, title, note, aside, children }: { id: string; index: string; title: string; note?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="shell mt-14 scroll-mt-24 md:mt-20">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="micro"><span className="text-flare">{index}</span></p>
          <h2 id={`${id}-h`} className="display-m mt-2">{title}</h2>
          {note ? <p className="mt-2 max-w-2xl text-sm text-chalk-3">{note}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="shell pt-10 md:pt-14" role="status" aria-label="Loading your dashboard">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="mt-5 h-16 w-72 max-w-full" />
      <div className="mt-6 flex gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-6 w-24" />)}</div>
      <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[520px] !rounded-[var(--radius-card)]" />)}
      </div>
      <span className="sr-only">Loading your dashboard…</span>
    </div>
  );
}
