"use client";

// The memory switch: one evening ranked twice, with the viewer's Walrus memories and with memory off. Stored when
// the brief was made, so it shows what memory changed that night, not what today's taste would say.
import { useState } from "react";
import type { Rating, SwitchNight, SwitchRow } from "@/lib/contract";
import { cleanMemoryText, fmtBriefDate, fmtTime } from "@/lib/client/format";
import { BlobChip } from "@/components/pick/PickCard";
import { EmptyState } from "@/components/site/States";

const RATING_WORD: Record<Rating, string> = { loved: "Loved", fine: "Fine", bailed: "Bailed", skipped: "Didn’t watch" };

const SIDES = [
  { key: "on", title: "With your memory", color: "var(--flare)" },
  { key: "off", title: "Memory off", color: "var(--steel)" },
] as const;

function headline(n: SwitchNight): { head: string; tail: string } {
  const day = fmtBriefDate(n.date);
  if (n.sealed)
    return {
      head: n.changed ? `Your memories changed ${n.changed} of the top three on ${day}.` : `Memory off would have picked the same three on ${day}.`,
      tail: "Both lists open once that night’s picks have finished, so they can’t give away which pick ran with memory off.",
    };
  return {
    head: n.changed ? `Your memories changed ${n.changed} of the top three on ${day}.` : `Memory off would have picked the same three on ${day}.`,
    tail: `${n.considered} matches in your window, ranked twice: once with your Walrus memories, once with memory off.`,
  };
}

function Row({ r, side, other, scored, tz }: { r: SwitchRow; side: (typeof SIDES)[number]; other: Set<string>; scored: number | null; tz: string }) {
  const both = other.has(r.matchId);
  return (
    <li className={`rounded-xl p-4 ${both ? "bg-ink-1" : "bg-ink-1 hairline"}`} style={both ? undefined : { boxShadow: `inset 3px 0 0 ${side.color}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold leading-snug text-chalk">
            {r.home} v {r.away}
          </p>
          {/* Ranks, not scores: memory-on scores often top out at 100, and the two scales aren't comparable. */}
          <p className="mt-0.5 text-xs text-chalk-3">
            {r.competition} · {fmtTime(r.kickoff, tz)}
          </p>
        </div>
        {r.picked ? <span className="chip shrink-0">{r.rating ? `Picked · ${RATING_WORD[r.rating]}` : "Picked"}</span> : null}
      </div>
      {both ? (
        <p className="mt-2 text-xs text-chalk-3">In both lists.</p>
      ) : (
        <>
          <p className="mt-2 text-xs text-chalk-2 tnum">
            #{r.rankOn} with your memory · #{r.rankOff} with memory off
          </p>
          {r.why ? <p className="mt-1.5 text-sm text-chalk-2">{r.why}</p> : null}
          {r.cites.length ? (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Memories behind this">
              {r.cites.map((c) => (
                <li key={c.blobId} title={cleanMemoryText(c.text)}>
                  <BlobChip blobId={c.blobId} tone={side.key === "on" ? "flare" : "ok"} />
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
      {r.drama !== null ? (
        <p className="mt-2 text-xs text-chalk-3 tnum">
          What happened: drama {r.drama}
          {r.nightRank ? ` · #${r.nightRank}${scored ? ` of ${scored}` : ""} on the night` : ""}
        </p>
      ) : null}
    </li>
  );
}

export function MemorySwitch({ nights, tz }: { nights: SwitchNight[]; tz: string }) {
  const [i, setI] = useState(0);
  if (!nights.length)
    return <EmptyState title="Starts with your next brief">Each evening is ranked twice, with your memories and with memory off, and the two top threes are kept side by side.</EmptyState>;
  const n = nights[Math.min(i, nights.length - 1)];
  const h = headline(n);
  const ids = { on: new Set(n.on.map((r) => r.matchId)), off: new Set(n.off.map((r) => r.matchId)) };
  return (
    <figure className="card p-5 md:p-7">
      <figcaption className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <p className="text-lg font-semibold leading-snug text-chalk md:text-xl">{h.head}</p>
          <p className="mt-1 text-sm text-chalk-3">{h.tail}</p>
        </div>
        {nights.length > 1 ? (
          <div role="group" aria-label="Choose a night" className="flex flex-wrap gap-1.5">
            {nights.map((x, k) => (
              <button key={x.date} type="button" onClick={() => setI(k)} aria-pressed={k === i} className={`chip !h-8 px-3 ${k === i ? "!text-chalk ring-1 ring-flare" : ""}`}>
                {fmtBriefDate(x.date)}
              </button>
            ))}
          </div>
        ) : null}
      </figcaption>
      {n.sealed ? null : (
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {SIDES.map((side) => (
            <section key={side.key} aria-label={side.title}>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-chalk">
                <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: side.color }} />
                {side.title}
              </h3>
              <ol className="space-y-2.5">
                {n[side.key].map((r) => (
                  <Row key={r.matchId} r={r} side={side} other={side.key === "on" ? ids.off : ids.on} scored={n.scored} tz={tz} />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </figure>
  );
}
