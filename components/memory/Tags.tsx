import type { MemoryKind, WriteStatus } from "@/lib/contract";
import { KIND_META, STATUS_META, type KindShape } from "@/lib/client/kinds";
import { IconAlert, IconCheck, IconClock, IconDot } from "@/components/site/Icons";

/** Small glyph matching the 3D shape, so kind never relies on colour alone. */
export function ShapeGlyph({ shape, color, size = 12 }: { shape: KindShape; color: string; size?: number }) {
  const c = { fill: color };
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden className="shrink-0">
      {shape === "sphere" && <circle cx="6" cy="6" r="5" {...c} />}
      {shape === "cube" && <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" {...c} />}
      {shape === "octa" && <path d="M6 .5 11.5 6 6 11.5.5 6Z" {...c} />}
      {shape === "torus" && <circle cx="6" cy="6" r="3.9" fill="none" stroke={color} strokeWidth="2.4" />}
      {shape === "tetra" && <path d="M6 1 11.2 10.5H.8Z" {...c} />}
      {shape === "seal" && <path d="M6 .9 10.6 3.5v5L6 11.1 1.4 8.5v-5Z" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />}
    </svg>
  );
}

export function KindTag({ kind }: { kind: MemoryKind }) {
  const m = KIND_META[kind];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-chalk-2" title={m.blurb}>
      <ShapeGlyph shape={m.shape} color={m.color} />
      {m.label}
    </span>
  );
}

export function StatusPill({ status }: { status: WriteStatus }) {
  const m = STATUS_META[status];
  const color = { ok: "var(--ok)", warn: "var(--warn)", bad: "var(--bad)", idle: "var(--chalk-3)" }[m.tone];
  const icon = { ok: <IconCheck size={12} />, warn: <IconClock size={12} />, bad: <IconAlert size={12} />, idle: <IconDot size={12} /> }[m.tone];
  return (
    <span className="chip !h-[22px]" style={{ color, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 40%, transparent)` }} title={m.hint}>
      {icon}
      <span className="text-chalk-2">{m.label}</span>
    </span>
  );
}
