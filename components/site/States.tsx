import type { ReactNode } from "react";
import type { DataSource } from "@/lib/client/api";
import { IconAlert, IconRefresh } from "./Icons";

export function Skeleton({ className = "", label }: { className?: string; label?: string }) {
  return <div className={`skel ${className}`} aria-hidden={label ? undefined : true} role={label ? "status" : undefined} aria-label={label} />;
}

export function ErrorState({ title, detail, onRetry, compact = false }: { title: string; detail?: string; onRetry?: () => void; compact?: boolean }) {
  return (
    <div role="alert" className={`card flex flex-col gap-3 ${compact ? "p-4" : "p-6 md:p-8"} sm:flex-row sm:items-start sm:justify-between`}>
      <div className="flex gap-3">
        <span className="mt-0.5 text-bad"><IconAlert size={20} /></span>
        <div>
          <p className="font-semibold">{title}</p>
          {detail ? <p className="mt-1 text-sm text-chalk-3">{detail}</p> : null}
        </div>
      </div>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn btn-ghost !min-h-[38px] self-start">
          <IconRefresh size={16} /> Try again
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-line-strong p-6 text-sm md:p-8">
      <p className="font-semibold text-chalk">{title}</p>
      {children ? <div className="mt-1.5 text-chalk-3">{children}</div> : null}
    </div>
  );
}

/** Says out loud where the numbers came from. Live data shows a quiet "live" marker. */
export function DataSourceBadge({ source, updatedAt }: { source: DataSource | null; updatedAt?: string }) {
  if (!source) return null;
  if (source === "live")
    return (
      <span className="chip" title={updatedAt ? `Updated ${updatedAt}` : undefined}>
        <span className="live-dot !h-1.5 !w-1.5" aria-hidden /> Live
      </span>
    );
  const text = source === "mock" ? "Demo data" : "Sample data · API offline (dev)";
  return (
    <span className="chip !text-warn" style={{ boxShadow: "inset 0 0 0 1px rgb(250 178 25 / 0.35)" }} role="note">
      <IconAlert size={13} /> {text}
    </span>
  );
}
