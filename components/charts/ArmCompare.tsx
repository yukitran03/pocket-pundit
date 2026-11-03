import type { ArmStats } from "@/lib/contract";
import { IconChevron } from "@/components/site/Icons";

// Arms keep their meaning: flare = memory, steel = memory off (validated pair on #0c1a14).
const ARMS = [
  { key: "memory", name: "Memory picks", short: "Memory", color: "var(--flare)" },
  { key: "control", name: "Memory-off picks", short: "Memory off", color: "var(--steel)" },
] as const;

// Rating mix: colour follows the rating, not the arm, so the two bars compare directly. Loved, Fine and
// Bailed are ordinal (one neutral ramp, light to dark, monotonic, CVD ΔE 19, all ≥ 3:1 on the card);
// "Didn't watch" sits off the scale and gets the texture.
const MIX = [
  { key: "loved", label: "Loved", fill: "#eef3ec", ink: "#0c1a14" },
  { key: "fine", label: "Fine", fill: "#9aab9f", ink: "#0c1a14" },
  { key: "bailed", label: "Bailed", fill: "#5f7267", ink: "#eef3ec" },
  { key: "skipped", label: "Didn’t watch", fill: "repeating-linear-gradient(135deg, #1a2e23 0 4px, #2b3f34 4px 7px)", ink: "#b9c6bc" },
] as const;

type Summary = { rated: number; mean: number | null; lo: number | null; hi: number | null };

/** Mean of loved=2 / fine=1 / bailed=0 with a normal-approximation 95% interval. */
export function summarise(a: ArmStats): Summary {
  const rated = a.loved + a.fine + a.bailed;
  if (!rated) return { rated, mean: null, lo: null, hi: null };
  const mean = (2 * a.loved + a.fine) / rated;
  if (rated < 2) return { rated, mean, lo: null, hi: null };
  const ss = a.loved * (2 - mean) ** 2 + a.fine * (1 - mean) ** 2 + a.bailed * (0 - mean) ** 2;
  const sd = Math.sqrt(ss / (rated - 1));
  const half = 1.96 * (sd / Math.sqrt(rated));
  return { rated, mean, lo: Math.max(0, mean - half), hi: Math.min(2, mean + half) };
}

const EARLY = 10;
const one = (x: number) => x.toFixed(1);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** The plain-language headline a fan reads first. */
export function verdict(m: Summary, c: Summary) {
  const total = m.rated + c.rated;
  if (!total) return { head: "No ratings yet.", tail: "The comparison starts with the first rated picks." };
  if (m.mean === null || c.mean === null) {
    const side = m.mean !== null ? "Memory picks" : "Memory-off picks";
    return { head: `${side} have ${plural(total, "rating")} so far.`, tail: "The other side has none yet, so it’s too early to call." };
  }
  const diff = m.mean - c.mean;
  const head =
    Math.abs(diff) < 0.05
      ? `Level so far: both rated ${one(m.mean)}`
      : diff > 0
        ? `Memory picks are ahead: rated ${one(m.mean)} vs ${one(c.mean)}`
        : `Memory-off picks are ahead: rated ${one(c.mean)} vs ${one(m.mean)}`;
  const overlap = m.lo === null || c.lo === null || m.hi === null || c.hi === null || !(m.lo > c.hi || c.lo > m.hi);
  const tail = Math.min(m.rated, c.rated) < EARLY ? `(${plural(total, "rating")} so far, too early to call)` : overlap ? `(${plural(total, "rating")}; the gap isn’t conclusive yet)` : `(${plural(total, "rating")}; a clear gap)`;
  return { head, tail };
}

export function ArmCompare({ memory, control, scope }: { memory: ArmStats; control: ArmStats; scope: "everyone" | "you" }) {
  const stats = { memory, control };
  const sums = { memory: summarise(memory), control: summarise(control) };
  const v = verdict(sums.memory, sums.control);

  return (
    <figure className="card p-5 md:p-7">
      <figcaption>
        <p className="text-lg font-semibold leading-snug text-chalk md:text-xl">
          {v.head} <span className="font-normal text-chalk-3">{v.tail}</span>
        </p>
        <p className="mt-1 text-sm text-chalk-3">{scope === "everyone" ? "All viewers, rated without knowing which pick was which." : "Your ratings, given without knowing which pick was which."}</p>
      </figcaption>

      {/* Two big numbers */}
      <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-[var(--line)]">
        {ARMS.map((a) => {
          const s = sums[a.key];
          return (
            <div key={a.key} className="flex flex-col bg-ink-1 p-4 sm:p-5">
              <dt className="flex items-center gap-2 text-sm font-medium text-chalk">
                <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />
                {a.name}
              </dt>
              <dd className="mt-2 font-display text-[clamp(2.6rem,1.8rem+3vw,3.75rem)] font-extrabold leading-none tnum">
                {s.mean === null ? <span className="text-chalk-4">–</span> : one(s.mean)}
                <span className="ml-1 font-sans text-sm font-normal text-chalk-3">/ 2</span>
              </dd>
              <dd className="mt-2">
                <span className="block h-1.5 overflow-hidden rounded-full bg-ink-3" aria-hidden>
                  <span className="block h-full rounded-full" style={{ width: `${s.mean === null ? 0 : (s.mean / 2) * 100}%`, background: a.color }} />
                </span>
                <span className="mt-1.5 block text-xs text-chalk-3">{s.rated ? `average of ${plural(s.rated, "rating")}` : "no ratings yet"}</span>
              </dd>
            </div>
          );
        })}
      </dl>

      {/* Rating mix, one stacked bar per arm */}
      <div className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h3 className="text-[0.95rem] font-semibold">How the picks were rated</h3>
          <ul className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-chalk-2" aria-label="Legend">
            {MIX.map((k) => (
              <li key={k.key} className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-2.5 w-2.5 rounded-[2px]" style={{ background: k.fill }} />
                {k.label}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-3 space-y-3">
          {ARMS.map((a) => {
            const s = stats[a.key];
            const total = s.loved + s.fine + s.bailed + s.skipped;
            return (
              <div key={a.key}>
                <p className="mb-1.5 flex items-center justify-between text-xs text-chalk-2">
                  <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-full" style={{ background: a.color }} />{a.short}</span>
                  <span className="text-chalk-3">{plural(total, "pick")}</span>
                </p>
                {total ? (
                  <div className="flex h-8 gap-[2px] overflow-hidden rounded-[6px]" role="img" aria-label={`${a.name}: ${MIX.map((k) => `${k.label} ${s[k.key]}`).join(", ")} of ${total} picks`}>
                    {MIX.map((k) => {
                      const n = s[k.key];
                      if (!n) return null;
                      const pct = (n / total) * 100;
                      return (
                        <span key={k.key} className="flex min-w-[6px] items-center justify-center overflow-hidden text-xs font-semibold" style={{ width: `${pct}%`, background: k.fill, color: k.ink }} title={`${k.label}: ${n} of ${total} picks (${Math.round(pct)}%)`}>
                          {pct >= 12 ? <span className="truncate px-1.5">{pct >= 24 ? `${k.label} ${n}` : n}</span> : null}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="flex h-8 items-center rounded-[6px] px-3 text-xs text-chalk-3 hairline">No picks yet</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {memory.avgDrama !== null && control.avgDrama !== null ? (
        <p className="mt-5 text-sm text-chalk-3">
          Average drama of the matches: <span className="text-chalk">memory {Math.round(memory.avgDrama)}</span>, <span className="text-chalk">memory off {Math.round(control.avgDrama)}</span> (out of 100).
        </p>
      ) : null}

      <details className="group mt-5 text-sm">
        <summary className="inline-flex min-h-[36px] items-center gap-1.5 text-chalk-3 hover:text-chalk">
          How we measure this
          <IconChevron size={14} className="transition-transform group-open:rotate-90" />
        </summary>
        <div className="mt-2 space-y-3 text-chalk-3">
          <p>
            Every evening one of the three picks is chosen with memory switched off. The three are shuffled and unlabelled, so each rating is blind. Loved counts 2, Fine 1, Bailed 0; &ldquo;Didn&rsquo;t watch&rdquo; is left out of the average. We call it too early until each side has at least {EARLY} ratings, and only call a clear gap when the 95% intervals don&rsquo;t overlap.
          </p>
          <div className="overflow-x-auto" data-lenis-prevent>
            <table className="table">
              <caption className="sr-only">Memory versus memory-off statistics</caption>
              <thead>
                <tr>
                  <th scope="col">Side</th>
                  <th scope="col" className="num">Picks</th>
                  <th scope="col" className="num">Loved</th>
                  <th scope="col" className="num">Fine</th>
                  <th scope="col" className="num">Bailed</th>
                  <th scope="col" className="num">Didn’t watch</th>
                  <th scope="col" className="num">Average</th>
                  <th scope="col" className="num">95% interval</th>
                </tr>
              </thead>
              <tbody>
                {ARMS.map((a) => {
                  const s = stats[a.key];
                  const m = sums[a.key];
                  return (
                    <tr key={a.key}>
                      <th scope="row" className="!font-sans !text-sm !normal-case !tracking-normal !text-chalk">{a.name}</th>
                      <td className="num">{s.n}</td>
                      <td className="num">{s.loved}</td>
                      <td className="num">{s.fine}</td>
                      <td className="num">{s.bailed}</td>
                      <td className="num">{s.skipped}</td>
                      <td className="num">{m.mean === null ? "–" : m.mean.toFixed(2)}</td>
                      <td className="num">{m.lo === null || m.hi === null ? "–" : `${m.lo.toFixed(2)} to ${m.hi.toFixed(2)}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </figure>
  );
}
