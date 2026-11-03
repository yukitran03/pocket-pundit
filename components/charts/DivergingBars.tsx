import type { TasteWeight } from "@/lib/contract";

// Diverging: flare = "leans in" (positive), steel = "steers away" (negative); neutral grey midline.
export function DivergingBars({ title, weights, empty }: { title: string; weights: TasteWeight[]; empty: string }) {
  const rows = [...weights].sort((a, b) => b.weight - a.weight);
  const id = `div-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <figure className="card p-5" aria-labelledby={id}>
      <figcaption id={id} className="flex items-baseline justify-between">
        <span className="font-semibold">{title}</span>
        <span className="mono text-[0.68rem] text-chalk-3">−1 … +1</span>
      </figcaption>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-chalk-3">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((w) => {
            const v = Math.max(-1, Math.min(1, w.weight));
            const pos = v >= 0;
            const half = Math.abs(v) * 50;
            return (
              <li key={w.key} title={`${w.label}: ${v > 0 ? "+" : ""}${v.toFixed(2)} from ${w.evidence} ${w.evidence === 1 ? "memory" : "memories"}`}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-chalk-2">{w.label}</span>
                  <span className="mono shrink-0 text-xs">
                    <span className="text-chalk">{v > 0 ? "+" : v < 0 ? "−" : ""}{Math.abs(v).toFixed(2)}</span>
                    <span className="ml-2 text-chalk-3" aria-label={`${w.evidence} supporting memories`}>×{w.evidence}</span>
                  </span>
                </div>
                <div className="relative mt-1.5 h-2.5" aria-hidden>
                  <span className="absolute inset-y-[-3px] left-1/2 w-px -translate-x-1/2 bg-[var(--line-strong)]" />
                  <span className="absolute inset-y-0 left-0 right-0 rounded-full bg-ink-2" />
                  <span
                    className="absolute inset-y-0"
                    style={{
                      left: pos ? "50%" : `${50 - half}%`,
                      width: `${half}%`,
                      background: pos ? "var(--flare)" : "var(--steel)",
                      borderRadius: pos ? "0 4px 4px 0" : "4px 0 0 4px",
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </figure>
  );
}

export function DivergingLegend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-chalk-2" aria-label="Legend">
      <li className="inline-flex items-center gap-2"><span aria-hidden className="h-2.5 w-5 rounded-r bg-flare" /> Leans in</li>
      <li className="inline-flex items-center gap-2"><span aria-hidden className="h-2.5 w-5 rounded-l bg-steel" /> Steers away</li>
      <li className="inline-flex items-center gap-2 text-chalk-3"><span className="mono">×n</span> supporting memories</li>
    </ul>
  );
}
