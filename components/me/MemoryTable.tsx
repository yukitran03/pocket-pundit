"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MemoryRow, RecallResponse } from "@/lib/contract";
import { recall } from "@/lib/client/api";
import { fmtDateTime, shortId } from "@/lib/client/format";
import { lifeLeft, suiscanObject, walruscanBlob } from "@/lib/client/chain";
import { IconExternal, IconSearch, IconX } from "@/components/site/Icons";
import { ErrorState, Skeleton } from "@/components/site/States";
import { KindTag, StatusPill } from "@/components/memory/Tags";

export const memKey = (m: MemoryRow, i: number) => m.blobId ?? `local-${m.createdAt}-${i}`;

type Recall = { status: "idle" } | { status: "loading"; q: string } | { status: "ok"; q: string; data: RecallResponse } | { status: "error"; q: string; error: string };

export function MemoryTable({
  token, memories, tz, currentEpoch, citedKeys, selected, onSelect, onHits,
}: {
  token: string; memories: MemoryRow[]; tz: string; currentEpoch: number; citedKeys: Set<string>;
  selected: string | null; onSelect: (k: string | null) => void; onHits: (keys: Set<string> | null) => void;
}) {
  const [q, setQ] = useState("");
  const [state, setState] = useState<Recall>({ status: "idle" });
  const onHitsRef = useRef(onHits);
  onHitsRef.current = onHits;

  // Debounced recall against Walrus memory (vector search on the relayer).
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setState({ status: "idle" });
      onHitsRef.current(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setState({ status: "loading", q: query });
      recall(token, query, ctrl.signal)
        .then((r) => {
          setState({ status: "ok", q: query, data: r.data });
          onHitsRef.current(new Set(r.data.hits.map((h) => h.blobId)));
        })
        .catch((e: Error) => {
          if (e.name === "AbortError") return;
          setState({ status: "error", q: query, error: e.message });
          onHitsRef.current(null);
        });
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, token]);

  const indexed = useMemo(() => memories.map((m, i) => ({ m, key: memKey(m, i) })), [memories]);

  const rows = useMemo(() => {
    if (state.status !== "ok") return indexed.map((r) => ({ ...r, distance: null as number | null }));
    const byBlob = new Map(indexed.map((r) => [r.key, r]));
    return state.data.hits.map((h) => {
      const known = byBlob.get(h.blobId);
      const m: MemoryRow = known?.m ?? {
        blobId: h.blobId, kind: "lesson", text: h.text, createdAt: h.createdAt ?? new Date(0).toISOString(), status: "stored",
        namespace: "", suiObjectId: null, endEpoch: null, walruscanUrl: walruscanBlob(h.blobId), suiscanUrl: null,
      };
      return { m, key: h.blobId, distance: h.distance };
    });
  }, [state, indexed]);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <form role="search" className="relative w-full sm:max-w-md" onSubmit={(e) => e.preventDefault()}>
          <label htmlFor="recall-q" className="sr-only">Recall memories</label>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-chalk-3"><IconSearch size={16} /></span>
          <input
            id="recall-q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Recall: “late goals”, “Como”, “kickoff”…"
            className="field !pl-9 !pr-9"
            autoComplete="off"
            spellCheck={false}
          />
          {q ? (
            <button type="button" onClick={() => setQ("")} className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-chalk-3 hover:text-chalk" aria-label="Clear search">
              <IconX size={14} />
            </button>
          ) : null}
        </form>
        <p className="text-xs text-chalk-3" aria-live="polite">
          {state.status === "idle" && `${memories.length} memories, newest first`}
          {state.status === "loading" && "Recalling from Walrus memory…"}
          {state.status === "ok" && `${state.data.hits.length} recalled for “${state.q}” in ${state.data.latencyMs} ms`}
          {state.status === "error" && "Recall failed"}
        </p>
      </div>

      {state.status === "error" ? (
        <div className="p-4"><ErrorState compact title="Recall is unavailable right now" detail={state.error} /></div>
      ) : state.status === "loading" ? (
        <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <p className="p-6 text-sm text-chalk-3">{state.status === "ok" ? "Nothing recalled for that query." : "No memories yet. They appear after your first rated match."}</p>
      ) : (
        <>
          {/* table ≥ md */}
          <div className="hidden max-h-[560px] overflow-auto md:block">
            <table className="table">
              <caption className="sr-only">Your memories</caption>
              <thead className="sticky top-0 z-10 bg-ink-1">
                <tr>
                  <th scope="col">Kind</th>
                  <th scope="col">Memory</th>
                  <th scope="col">Created</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num">End epoch</th>
                  <th scope="col">Links</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ m, key, distance }) => {
                  const sel = selected === key;
                  const life = m.status === "stored" ? lifeLeft(m.endEpoch, currentEpoch) : 1;
                  return (
                    <tr key={key} aria-selected={sel} className={sel ? "!bg-[rgb(240_83_28/0.07)]" : ""}>
                      <td><KindTag kind={m.kind} /></td>
                      <td className="max-w-[28rem]">
                        <button type="button" className="text-left text-chalk hover:underline hover:decoration-[var(--flare)] hover:underline-offset-4" onClick={() => onSelect(sel ? null : key)} aria-pressed={sel}>
                          {m.text}
                        </button>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {citedKeys.has(key) ? <span className="chip !h-5 !text-[0.65rem] !text-flare">cited tonight</span> : null}
                          {distance !== null ? <span className="chip !h-5 !text-[0.65rem]">match {Math.round((1 - distance) * 100)}%</span> : null}
                        </div>
                      </td>
                      <td className="mono whitespace-nowrap text-xs text-chalk-3">{fmtDateTime(m.createdAt, tz)}</td>
                      <td><StatusPill status={m.status} /></td>
                      <td className="num mono text-xs">
                        {m.endEpoch ?? "–"}
                        {m.endEpoch !== null && life < 1 ? <span className="block text-[0.65rem] text-warn">{life <= 0 ? "expired" : "expiring"}</span> : null}
                      </td>
                      <td><Links m={m} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* list < md */}
          <ul className="divide-y divide-[var(--line-faint)] md:hidden">
            {rows.map(({ m, key, distance }) => {
              const sel = selected === key;
              return (
                <li key={key} className={`p-4 ${sel ? "bg-[rgb(240_83_28/0.07)]" : ""}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <KindTag kind={m.kind} />
                    <StatusPill status={m.status} />
                    {citedKeys.has(key) ? <span className="chip !h-5 !text-[0.65rem] !text-flare">cited tonight</span> : null}
                    {distance !== null ? <span className="chip !h-5 !text-[0.65rem]">match {Math.round((1 - distance) * 100)}%</span> : null}
                  </div>
                  <button type="button" className="mt-2 text-left text-[0.95rem] text-chalk" onClick={() => onSelect(sel ? null : key)} aria-pressed={sel}>
                    {m.text}
                  </button>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-chalk-3">
                    <span className="mono">{fmtDateTime(m.createdAt, tz)}</span>
                    {m.endEpoch !== null ? <span className="mono">end epoch {m.endEpoch}</span> : null}
                    <Links m={m} />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function Links({ m }: { m: MemoryRow }) {
  const wal = m.walruscanUrl ?? (m.blobId && m.status === "stored" ? walruscanBlob(m.blobId) : null);
  const sui = m.suiscanUrl ?? (m.suiObjectId ? suiscanObject(m.suiObjectId) : null);
  if (!wal && !sui) return <span className="text-xs text-chalk-4">not on-chain yet</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {wal && m.blobId ? (
        <a href={wal} target="_blank" rel="noopener noreferrer" className="chip" aria-label={`Blob ${m.blobId} on Walruscan`}>
          Walruscan <span className="text-chalk-4">{shortId(m.blobId, 4, 3)}</span> <IconExternal size={11} />
        </a>
      ) : null}
      {sui ? (
        <a href={sui} target="_blank" rel="noopener noreferrer" className="chip" aria-label={`Blob object ${m.suiObjectId ?? ""} on Suiscan`}>
          Suiscan <IconExternal size={11} />
        </a>
      ) : null}
    </span>
  );
}
