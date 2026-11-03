import type { Pick } from "@/lib/contract";
import { fmtBriefDate, fmtHour, fmtTime, localHour } from "@/lib/client/format";
import { RATING_META } from "@/lib/client/kinds";

const X0 = 15; // 15:00
const X1 = 29; // 05:00 next day
const x = (h: number) => `${((Math.max(X0, Math.min(X1, h)) - X0) / (X1 - X0)) * 100}%`;

/**
 * Where each day's picks kicked off in the viewer's local time, against their viewing window.
 * Memory picks drifting into the window, while control stays wherever the big games are, is the
 * clearest picture of memory changing the product.
 */
export function KickoffStrip({ picks, tz, windowStart, windowEnd, caption }: { picks: Pick[]; tz: string; windowStart: number; windowEnd: number; caption?: string }) {
  const days = Array.from(new Set(picks.map((p) => p.briefDate))).sort();
  const ws = windowStart < 12 ? windowStart + 24 : windowStart;
  const we = windowEnd < ws ? windowEnd + 24 : windowEnd;
  const ticks = [16, 19, 22, 25, 28];

  return (
    <figure className="card p-5 md:p-7">
      <figcaption className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-chalk-2">{caption ?? "Kickoff in your time zone, by brief day"}</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-chalk-2" aria-label="Legend">
          <li className="inline-flex items-center gap-1.5"><Dot color="var(--flare)" /> Memory pick</li>
          <li className="inline-flex items-center gap-1.5"><Dot color="var(--steel)" /> Control pick</li>
          <li className="inline-flex items-center gap-1.5"><Dot color="var(--chalk-2)" hollow /> Didn’t watch</li>
          <li className="inline-flex items-center gap-1.5"><Dot color="var(--chalk-3)" dashed /> Not rated yet</li>
        </ul>
      </figcaption>

      <div className="mt-6 grid grid-cols-[4.5rem_1fr] gap-x-3 sm:grid-cols-[6rem_1fr]">
        <span />
        <div className="relative mb-2 h-5 text-[0.68rem] text-chalk-3" aria-hidden>
          <span className="absolute inset-y-0" style={{ left: x(ws), width: `calc(${x(we)} - ${x(ws)})` }}>
            <span className="mono absolute -top-0.5 left-1.5 whitespace-nowrap text-chalk-2">your window {fmtHour(ws)}–{fmtHour(we)}</span>
            <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-flare" />
          </span>
        </div>
        {days.map((d) => {
          const dayPicks = picks.filter((p) => p.briefDate === d);
          return (
            <div key={d} className="contents">
              <span className="mono flex h-9 items-center text-xs text-chalk-3">{fmtBriefDate(d)}</span>
              <div className="relative h-9 border-t border-[var(--line-faint)]">
                <span aria-hidden className="absolute inset-y-0 bg-chalk/[0.045]" style={{ left: x(ws), width: `calc(${x(we)} - ${x(ws)})` }} />
                {dayPicks.map((p) => {
                  const h = localHour(p.kickoff, tz);
                  const color = p.arm === "memory" ? "var(--flare)" : p.arm === "control" ? "var(--steel)" : "var(--chalk-3)";
                  const hollow = p.rating === "skipped";
                  const dashed = p.arm === null;
                  const label = `${fmtBriefDate(d)}: ${p.home} v ${p.away} at ${fmtTime(p.kickoff, tz)}${p.arm ? `, ${p.arm} pick` : ""}${p.rating ? `, ${RATING_META[p.rating].label}` : ", not rated yet"}`;
                  return (
                    <span key={p.id} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: x(h) }} title={label} aria-label={label} role="img">
                      <Dot color={color} hollow={hollow} dashed={dashed} size={13} />
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
        <span />
        <div className="relative mt-2 h-4 border-t border-[var(--line)] text-[0.68rem] text-chalk-3" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="mono absolute top-1 -translate-x-1/2" style={{ left: x(t) }}>{fmtHour(t)}</span>
          ))}
        </div>
      </div>
    </figure>
  );
}

function Dot({ color, hollow, dashed, size = 10 }: { color: string; hollow?: boolean; dashed?: boolean; size?: number }) {
  const r = size / 2 - 1.5;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="block">
      {dashed ? (
        <circle cx={size / 2} cy={size / 2} r={r} fill="var(--ink-1)" stroke={color} strokeWidth="1.6" strokeDasharray="2.2 1.8" />
      ) : hollow ? (
        <circle cx={size / 2} cy={size / 2} r={r} fill="var(--ink-1)" stroke={color} strokeWidth="1.8" />
      ) : (
        <circle cx={size / 2} cy={size / 2} r={r + 0.5} fill={color} stroke="var(--ink-1)" strokeWidth="2" />
      )}
    </svg>
  );
}
