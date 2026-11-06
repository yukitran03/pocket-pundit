"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { RoomItem } from "@/components/three/TasteRoomScene";
import { SceneBoundary } from "@/components/three/SceneBoundary";
import { useIdle, useInView, useReducedMotion, useWebGL } from "@/components/three/hooks";
import { KIND_META, PRIMARY_KINDS } from "@/lib/client/kinds";
import { lifeLeft, walruscanBlob } from "@/lib/client/chain";
import { cleanMemoryText, fmtDateTime, shortId } from "@/lib/client/format";
import { IconExternal, IconX } from "@/components/site/Icons";
import { KindTag, ShapeGlyph, StatusPill } from "@/components/memory/Tags";

const TasteRoomScene = dynamic(() => import("@/components/three/TasteRoomScene"), {
  ssr: false,
  loading: () => <div className="skel absolute inset-0 !rounded-none" aria-hidden />,
});

export function TasteRoom({
  items, currentEpoch, epochEstimated, tz, selected, onSelect, highlighted,
}: {
  items: RoomItem[]; currentEpoch: number; epochEstimated: boolean; tz: string;
  selected: string | null; onSelect: (k: string | null) => void; highlighted: Set<string> | null;
}) {
  const reduced = useReducedMotion();
  const webgl = useWebGL();
  const idle = useIdle(800);
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box);
  const [hover, setHover] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [coarse, setCoarse] = useState(true);
  useEffect(() => setCoarse(window.matchMedia("(pointer: coarse)").matches), []);

  const focusKey = hover ?? selected;
  const focus = focusKey ? items.find((i) => i.key === focusKey) ?? null : null;
  const use3d = webgl === true && !failed;
  const citedCount = items.filter((i) => i.cited).length;

  return (
    <div className="card overflow-hidden">
      <div ref={box} className="relative aspect-[4/3] w-full bg-ink-0 sm:aspect-[16/9] lg:aspect-[21/9]">
        {use3d && idle ? (
          <SceneBoundary onError={() => setFailed(true)}>
            <TasteRoomScene
              items={items}
              currentEpoch={currentEpoch}
              selected={selected}
              highlighted={highlighted}
              onHover={setHover}
              onSelect={onSelect}
              reducedMotion={reduced}
              active={inView}
              allowOrbit={!coarse}
            />
          </SceneBoundary>
        ) : webgl === false || failed ? (
          <TileFallback items={items} currentEpoch={currentEpoch} selected={selected} onSelect={onSelect} highlighted={highlighted} />
        ) : (
          <div className="skel absolute inset-0 !rounded-none" aria-hidden />
        )}

        <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5 sm:left-4 sm:top-4">
          <span className="chip !bg-ink-0/80 backdrop-blur">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-flare" />
            {citedCount} cited by tonight’s brief
          </span>
          <span className="chip !bg-ink-0/80 backdrop-blur">Walrus epoch {epochEstimated ? "≈" : ""}{currentEpoch}</span>
        </div>
        {use3d && !coarse ? (
          <p className="pointer-events-none absolute bottom-3 right-4 hidden text-[0.7rem] text-chalk-3 sm:block">Drag to look around · click a memory to pin it</p>
        ) : null}
      </div>

      <div className="grid gap-4 border-t border-line p-4 sm:p-5 lg:grid-cols-[1fr_auto] lg:items-start">
        <div aria-live="polite" className="min-h-[5.5rem]">
          {focus ? (
            <FocusPanel item={focus} currentEpoch={currentEpoch} epochEstimated={epochEstimated} tz={tz} pinned={focus.key === selected} onClear={() => onSelect(null)} />
          ) : (
            <p className="text-sm text-chalk-3">
              Hover or tap a memory to read it. The table below lists the same memories.
            </p>
          )}
        </div>
        <ul className="grid grid-cols-2 gap-x-5 gap-y-1.5 text-xs text-chalk-2 sm:flex sm:flex-wrap lg:max-w-[18rem] lg:justify-end" aria-label="Legend">
          {[...PRIMARY_KINDS, ...(["form", "brief", "night"] as const).filter((x) => items.some((i) => i.row.kind === x))].map((k) => (
            <li key={k} className="inline-flex items-center gap-1.5"><ShapeGlyph shape={KIND_META[k].shape} color={KIND_META[k].color} /> {KIND_META[k].label}</li>
          ))}
          <li className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-full bg-flare shadow-[0_0_8px_2px_rgb(240_83_28/.6)]" /> Cited tonight</li>
          <li className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-full bg-chalk-4" /> Dim = expiring</li>
        </ul>
      </div>
    </div>
  );
}

function FocusPanel({ item, currentEpoch, epochEstimated, tz, pinned, onClear }: { item: RoomItem; currentEpoch: number; epochEstimated: boolean; tz: string; pinned: boolean; onClear: () => void }) {
  const r = item.row;
  const left = r.endEpoch === null ? null : r.endEpoch - currentEpoch;
  return (
    <div className="flex gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <KindTag kind={r.kind} />
          <StatusPill status={r.status} />
          {item.cited ? <span className="chip !h-[22px] !text-flare">Cited tonight</span> : null}
          <span className="text-xs text-chalk-3">{fmtDateTime(r.createdAt, tz)}</span>
        </div>
        <p className="mt-2 text-[0.95rem] text-chalk">“{cleanMemoryText(r.text)}”</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-chalk-3">
          {r.blobId ? (
            <a className="chip chip-id" href={r.walruscanUrl ?? walruscanBlob(r.blobId)} target="_blank" rel="noopener noreferrer" aria-label={`Open blob ${r.blobId} on Walruscan`} title={r.blobId}>
              {shortId(r.blobId, 6, 4)} <IconExternal size={11} />
            </a>
          ) : (
            <span>No blob ID yet</span>
          )}
          {left !== null ? (
            <span>
              Stored until epoch {r.endEpoch} · {left > 0 ? `${epochEstimated ? "≈" : ""}${left} ${left === 1 ? "epoch" : "epochs"} left` : "expired"}
              {left > 0 && lifeLeft(r.endEpoch, currentEpoch) < 1 ? " · renew soon" : ""}
            </span>
          ) : null}
        </p>
      </div>
      {pinned ? (
        <button type="button" onClick={onClear} className="btn btn-quiet !min-h-[32px] self-start" aria-label="Unpin memory">
          <IconX size={16} />
        </button>
      ) : null}
    </div>
  );
}

/** No-WebGL view: the same encoding as flat tiles. */
function TileFallback({ items, currentEpoch, selected, onSelect, highlighted }: { items: RoomItem[]; currentEpoch: number; selected: string | null; onSelect: (k: string | null) => void; highlighted: Set<string> | null }) {
  return (
    <div className="absolute inset-0 overflow-auto p-4">
      <p className="mb-3 text-xs text-chalk-3">3D view unavailable on this device. Showing the same memories as tiles.</p>
      <ul className="flex flex-wrap gap-2">
        {items.map((it) => {
          const m = KIND_META[it.row.kind];
          const life = it.row.status === "stored" ? lifeLeft(it.row.endEpoch, currentEpoch) : 1;
          const dim = highlighted !== null && !highlighted.has(it.key);
          return (
            <li key={it.key}>
              <button
                type="button"
                onClick={() => onSelect(selected === it.key ? null : it.key)}
                aria-pressed={selected === it.key}
                aria-label={`${m.label}: ${cleanMemoryText(it.row.text)}`}
                className="grid h-9 w-9 place-items-center rounded-md bg-ink-2"
                style={{
                  opacity: dim ? 0.25 : 0.35 + 0.65 * life,
                  boxShadow: it.cited ? "0 0 0 2px var(--flare), 0 0 16px 2px rgb(240 83 28 / .45)" : selected === it.key ? "0 0 0 2px var(--chalk)" : "inset 0 0 0 1px var(--line)",
                }}
              >
                <ShapeGlyph shape={m.shape} color={it.cited ? "#f0531c" : m.color} size={14} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
