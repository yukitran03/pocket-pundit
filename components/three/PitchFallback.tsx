// Static, server-rendered stand-in for the hero scene. Shown on first paint, without WebGL,
// and if the 3D chunk fails to load. CSS perspective only, no JavaScript.

const DOTS = [
  [12, 30, "#c98500"], [22, 18, "#008300"], [30, 40, "#9085e9"], [38, 24, "#c98500"], [64, 20, "#d55181"],
  [72, 36, "#c98500"], [82, 22, "#008300"], [88, 42, "#9085e9"], [18, 48, "#c98500"], [78, 52, "#c98500"],
  [26, 60, "#008300"], [70, 62, "#9085e9"], [8, 58, "#d55181"], [92, 30, "#c98500"], [56, 12, "#c98500"], [44, 10, "#9085e9"],
] as const;
const RECALLED = new Set([1, 4, 7]);
const PICK = { x: 50, y: 40 };

export function PitchFallback({ className = "" }: { className?: string }) {
  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`} aria-hidden>
      {/* floodlight haze */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(60% 45% at 50% 60%, rgb(255 240 210 / 0.10), transparent 70%), radial-gradient(30% 30% at 8% 18%, rgb(255 240 210 / 0.14), transparent 70%), radial-gradient(30% 30% at 92% 18%, rgb(255 240 210 / 0.14), transparent 70%)" }} />
      {/* pitch in perspective */}
      <div className="absolute inset-x-[2%] bottom-[2%] top-[34%]" style={{ perspective: "900px" }}>
        <div className="absolute inset-0 origin-bottom" style={{ transform: "rotateX(52deg)", transformStyle: "preserve-3d" }}>
          <svg viewBox="0 0 1050 680" className="h-full w-full" preserveAspectRatio="none">
            <defs>
              <radialGradient id="pf-light" cx="50%" cy="50%" r="65%">
                <stop offset="0" stopColor="#226e47" />
                <stop offset="1" stopColor="#0f3322" />
              </radialGradient>
            </defs>
            <rect width="1050" height="680" fill="url(#pf-light)" />
            {Array.from({ length: 12 }, (_, i) => (i % 2 ? <rect key={i} x={i * 87.5} width="87.5" height="680" fill="#000" opacity="0.07" /> : null))}
            <g fill="none" stroke="#eef3ec" strokeOpacity="0.75" strokeWidth="3">
              <rect x="2" y="2" width="1046" height="676" />
              <line x1="525" y1="0" x2="525" y2="680" />
              <circle cx="525" cy="340" r="91.5" />
              <rect x="0" y="138" width="165" height="404" />
              <rect x="885" y="138" width="165" height="404" />
              <rect x="0" y="248" width="55" height="184" />
              <rect x="995" y="248" width="55" height="184" />
              <path d="M165 266 A91.5 91.5 0 0 1 165 414" />
              <path d="M885 266 A91.5 91.5 0 0 0 885 414" />
            </g>
            <circle cx="525" cy="340" r="5" fill="#eef3ec" />
            <circle cx="525" cy="340" r="16" fill="none" stroke="#f0531c" strokeWidth="4" />
          </svg>
        </div>
      </div>
      {/* recall lines */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        {DOTS.map(([x, y], i) =>
          RECALLED.has(i) ? (
            <path key={i} d={`M${x} ${y} Q ${(x + PICK.x) / 2} ${Math.min(y, PICK.y) - 10} ${PICK.x} ${PICK.y}`} fill="none" stroke="#f0531c" strokeWidth="0.35" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 1.6 }} />
          ) : null,
        )}
      </svg>
      {DOTS.map(([x, y, c], i) => {
        const on = RECALLED.has(i);
        return (
          <span
            key={i}
            className="absolute block -translate-x-1/2 -translate-y-1/2 rounded-[3px]"
            style={{
              left: `${x}%`, top: `${y}%`, width: on ? 18 : 13, height: on ? 12 : 9,
              background: on ? "#f0531c" : c,
              boxShadow: `0 0 ${on ? 22 : 12}px ${on ? 6 : 2}px ${on ? "rgb(240 83 28 / 0.55)" : "rgb(255 255 255 / 0.08)"}`,
              opacity: on ? 1 : 0.85,
            }}
          />
        );
      })}
      <span
        className="absolute block -translate-x-1/2 -translate-y-1/2 rounded-[4px] bg-chalk"
        style={{ left: `${PICK.x}%`, top: `${PICK.y}%`, width: 46, height: 30, boxShadow: "0 0 0 3px #f0531c, 0 0 40px 10px rgb(240 83 28 / 0.45)" }}
      />
    </div>
  );
}
