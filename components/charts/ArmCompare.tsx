import type { ArmStats } from "@/lib/contract";

// Memory (flare) vs control (steel): a validated pair on #0c1a14 (CVD ΔE 27, normal ΔE 35).
const ARMS = [
  { key: "memory", label: "With memory", short: "Memory", color: "var(--flare)" },
  { key: "control", label: "Control (memory off)", short: "Control", color: "var(--steel)" },
] as const;

type Summary = { rated: number; mean: number | null; lo: number | null; hi: number | null };

/** Mean of loved=2 / fine=1 / bailed=0 with a normal-approximation 95% interval. */
export function summarise(a: ArmStats): Summary {
  const rated = a.loved + a.fine + a.bailed;
  if (!rated) return { rated, mean: a.score, lo: null, hi: null };
  const mean = (2 * a.loved + a.fine) / rated;
  if (rated < 2) return { rated, mean, lo: null, hi: null };
  const ss = a.loved * (2 - mean) ** 2 + a.fine * (1 - mean) ** 2 + a.bailed * (0 - mean) ** 2;
  const sd = Math.sqrt(ss / (rated - 1));
  const half = 1.96 * (sd / Math.sqrt(rated));
  return { rated, mean, lo: Math.max(0, mean - half), hi: Math.min(2, mean + half) };
}

const pct = (x: number, max: number) => `${Math.max(0, Math.min(100, (x / max) * 100))}%`;

export function ArmCompare({ memory, control, scope }: { memory: ArmStats; control: ArmStats; scope: "everyone" | "you" }) {
  const stats = { memory, control };
  const sums = { memory: summarise(memory), control: summarise(control) };
  const noData = memory.n + control.n === 0;

  if (noData) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-line-strong p-6 text-sm text-chalk-3">
        No rated picks yet. The comparison appears after the first ratings come in from Telegram.
      </div>
    );
  }

  const ratingRows = [
    { key: "loved", label: "Loved" },
    { key: "fine", label: "Fine" },
    { key: "bailed", label: "Bailed" },
    { key: "skipped", label: "Didn't watch" },
  ] as const;
  const share = (a: ArmStats, k: (typeof ratingRows)[number]["key"]) => (a.n ? a[k] / a.n : 0);
  const maxShare = Math.max(0.1, ...ratingRows.flatMap((r) => [share(memory, r.key), share(control, r.key)]));
  const shareMax = Math.min(1, Math.ceil(maxShare * 10) / 10);

  return (
    <figure className="card p-5 md:p-7">
      <figcaption className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-chalk-2">
          {scope === "everyone" ? "All users, every rated pick so far" : "Your picks since day 1"}
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Legend">
          {ARMS.map((a) => (
            <li key={a.key} className="inline-flex items-center gap-2 text-chalk-2">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />
              {a.label}
              <span className="mono text-chalk-3">n={stats[a.key].n}</span>
            </li>
          ))}
        </ul>
      </figcaption>

      <div className="mt-7 grid gap-10 lg:grid-cols-[1.15fr_1fr]">
        {/* --- Panel A: mean rating with 95% interval, on a fixed 0–2 scale */}
        <div>
          <h3 className="text-[0.95rem] font-semibold">Average rating</h3>
          <p className="mt-0.5 text-xs text-chalk-3">Loved = 2, Fine = 1, Bailed = 0. The whisker is the 95% interval.</p>
          <div className="mt-5 space-y-5">
            {ARMS.map((a) => {
              const s = sums[a.key];
              return (
                <div key={a.key} className="grid grid-cols-[4.75rem_1fr] items-center gap-3">
                  <span className="text-sm text-chalk-2">{a.short}</span>
                  <div className="relative h-9">
                    {[0, 0.5, 1, 1.5, 2].map((t) => (
                      <span key={t} aria-hidden className="absolute inset-y-0 w-px bg-[var(--line)]" style={{ left: pct(t, 2) }} />
                    ))}
                    {s.lo !== null && s.hi !== null ? (
                      <span
                        aria-hidden
                        className="absolute top-1/2 h-[2px] -translate-y-1/2 rounded-full opacity-70"
                        style={{ left: pct(s.lo, 2), width: `calc(${pct(s.hi, 2)} - ${pct(s.lo, 2)})`, background: a.color }}
                      />
                    ) : null}
                    {s.mean !== null ? (
                      <span
                        className="absolute top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center"
                        style={{ left: pct(s.mean, 2) }}
                        title={`${a.label}: ${s.mean.toFixed(2)} average from ${s.rated} rated picks${s.lo !== null ? ` (95% interval ${s.lo.toFixed(2)}–${s.hi!.toFixed(2)})` : ""}`}
                      >
                        <span className="block h-3.5 w-3.5 rounded-full" style={{ background: a.color, boxShadow: "0 0 0 2px var(--ink-1)" }} />
                        <span className={`mono absolute -top-[1.35rem] whitespace-nowrap text-xs font-semibold text-chalk ${s.mean > 1.7 ? "right-0" : "left-1/2 -translate-x-1/2"}`}>{s.mean.toFixed(2)}</span>
                      </span>
                    ) : (
                      <span className="absolute inset-y-0 left-0 flex items-center text-xs text-chalk-3">No rated picks yet</span>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="grid grid-cols-[4.75rem_1fr] gap-3" aria-hidden>
              <span />
              <div className="relative h-4 text-[0.68rem] text-chalk-3">
                {[
                  [0, "0 · Bailed"],
                  [1, "1 · Fine"],
                  [2, "2 · Loved"],
                ].map(([t, l]) => (
                  <span
                    key={t as number}
                    className={`mono absolute whitespace-nowrap ${t === 0 ? "" : t === 2 ? "-translate-x-full" : "-translate-x-1/2"}`}
                    style={{ left: pct(t as number, 2) }}
                  >
                    {l}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-[var(--line)]">
            {ARMS.map((a) => (
              <div key={a.key} className="bg-ink-1 p-4">
                <p className="flex items-center gap-2 text-xs text-chalk-3">
                  <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: a.color }} />
                  Avg drama, {a.short.toLowerCase()}
                </p>
                <p className="mt-1 font-display text-4xl font-extrabold leading-none">
                  {stats[a.key].avgDrama === null ? "–" : Math.round(stats[a.key].avgDrama!)}
                  <span className="ml-1 font-sans text-xs font-normal text-chalk-3">/100</span>
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* --- Panel B: rating mix, share of each arm's picks, 0-based */}
        <div>
          <h3 className="text-[0.95rem] font-semibold">How the picks were rated</h3>
          <p className="mt-0.5 text-xs text-chalk-3">Share of each arm’s picks. Axis runs 0–{Math.round(shareMax * 100)}%.</p>
          <div className="mt-5 space-y-4">
            {ratingRows.map((r) => (
              <div key={r.key} className="grid grid-cols-[5.5rem_1fr] items-center gap-3">
                <span className="text-sm text-chalk-2">{r.label}</span>
                <div className="space-y-[3px]">
                  {ARMS.map((a) => {
                    const v = share(stats[a.key], r.key);
                    return (
                      <div key={a.key} className="flex items-center gap-2" title={`${a.label}: ${stats[a.key][r.key]} of ${stats[a.key].n} picks (${Math.round(v * 100)}%)`}>
                        <div className="relative h-3 flex-1">
                          <span
                            className="absolute inset-y-0 left-0 rounded-r-[4px]"
                            style={{ width: pct(v, shareMax), background: a.color, minWidth: v > 0 ? 2 : 0 }}
                          />
                        </div>
                        <span className="mono w-9 shrink-0 text-right text-[0.72rem] text-chalk-2">{Math.round(v * 100)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <HonestNote sums={sums} />

      <details className="mt-5 text-sm">
        <summary className="inline-flex min-h-[36px] items-center text-chalk-3 hover:text-chalk">Show the numbers as a table</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="table">
            <caption className="sr-only">Memory versus control arm statistics</caption>
            <thead>
              <tr>
                <th scope="col">Arm</th>
                <th scope="col" className="num">Picks</th>
                <th scope="col" className="num">Loved</th>
                <th scope="col" className="num">Fine</th>
                <th scope="col" className="num">Bailed</th>
                <th scope="col" className="num">Didn’t watch</th>
                <th scope="col" className="num">Avg rating</th>
                <th scope="col" className="num">Avg drama</th>
              </tr>
            </thead>
            <tbody>
              {ARMS.map((a) => {
                const s = stats[a.key];
                return (
                  <tr key={a.key}>
                    <th scope="row" className="!text-sm !normal-case !tracking-normal !font-sans !text-chalk">{a.label}</th>
                    <td className="num">{s.n}</td>
                    <td className="num">{s.loved}</td>
                    <td className="num">{s.fine}</td>
                    <td className="num">{s.bailed}</td>
                    <td className="num">{s.skipped}</td>
                    <td className="num">{sums[a.key].mean?.toFixed(2) ?? "–"}</td>
                    <td className="num">{s.avgDrama === null ? "–" : s.avgDrama.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

function HonestNote({ sums }: { sums: { memory: Summary; control: Summary } }) {
  const m = sums.memory, c = sums.control;
  const minRated = Math.min(m.rated, c.rated);
  let tone: "small" | "overlap" | "ahead" | "behind" = "overlap";
  if (minRated < 30) tone = "small";
  else if (m.lo !== null && c.hi !== null && m.lo > c.hi) tone = "ahead";
  else if (c.lo !== null && m.hi !== null && c.lo > m.hi) tone = "behind";

  const text = {
    small: `Small sample: ${m.rated} rated memory picks vs ${c.rated} control. The intervals are wide, so read this as an early trend, not a result. We will keep saying so until each arm has at least 30 rated picks.`,
    overlap: `The 95% intervals overlap, so the difference isn’t conclusive yet (${m.rated} vs ${c.rated} rated picks).`,
    ahead: `Memory picks rate higher, and the gap is larger than the 95% intervals (${m.rated} vs ${c.rated} rated picks).`,
    behind: `Control picks are rating higher right now. We show this as it is.`,
  }[tone];

  return (
    <p className="mt-7 flex gap-3 rounded-xl bg-ink-0/60 p-4 text-sm text-chalk-2 hairline">
      <span aria-hidden className="mono mt-px shrink-0 text-warn">n</span>
      <span>{text} Picks are shuffled and unlabelled in Telegram, so you rate them blind.</span>
    </p>
  );
}
