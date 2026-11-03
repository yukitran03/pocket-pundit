import type { ReactNode } from "react";
import { IconBell, IconBolt, IconCalendar, IconClock, IconEye, IconLock } from "@/components/site/Icons";
import { RatingGlyph } from "@/components/pick/PickCard";

type Feature = { icon: ReactNode; title: string; body: string; cmds: string[]; visual: ReactNode };

const FEATURES: Feature[] = [
  {
    icon: <IconClock size={18} />,
    title: "Tonight’s three",
    body: "The three matches most worth your evening, inside the hours you can actually watch.",
    cmds: ["/picks"],
    visual: <PicksVisual />,
  },
  {
    icon: <IconEye size={18} />,
    title: "No spoilers",
    body: "Full-time messages keep the score hidden until you’ve answered, and each brief names last night’s game most worth the highlights.",
    cmds: ["/spoilers"],
    visual: <SpoilerVisual />,
  },
  {
    icon: <IconBolt size={18} />,
    title: "Worth switching on",
    body: "If a game in your window turns tight and late, you get one quiet ping, at most twice a day.",
    cmds: ["/alerts"],
    visual: <AlertVisual />,
  },
  {
    icon: <IconCalendar size={18} />,
    title: "Never miss kick-off",
    body: "A reminder 20 minutes before each pick, and a Google or Apple Calendar feed that fills itself.",
    cmds: ["/calendar"],
    visual: <CalendarVisual />,
  },
  {
    icon: <IconBell size={18} />,
    title: "Learns your taste",
    body: "Every rating teaches it what you love and what you skip. Ask your pundit what it knows about you any time.",
    cmds: ["/teach", "/ask"],
    visual: <TasteVisual />,
  },
  {
    icon: <IconLock size={18} />,
    title: "Yours to keep",
    body: "Your taste memory is encrypted and stored on Walrus, and you can check it on Sui. Share it as a taste card.",
    cmds: ["/card", "/me"],
    visual: <OwnVisual />,
  },
];

export function Features() {
  return (
    <ul className="grid gap-px overflow-hidden rounded-[var(--radius-card)] bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((f, i) => (
        <li key={f.title} className="flex flex-col bg-ink-1 p-5 md:p-6" data-reveal style={{ "--reveal-delay": `${(i % 3) * 70}ms` } as React.CSSProperties}>
          <div className="h-[68px]" aria-hidden>{f.visual}</div>
          <h3 className="mt-5 flex items-center gap-2.5 text-lg font-semibold leading-tight">
            <span className={i < 4 ? "text-chalk-2" : "text-flare"}>{f.icon}</span>
            {f.title}
          </h3>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-chalk-2">{f.body}</p>
          <p className="mt-auto flex flex-wrap gap-1.5 pt-4" aria-label="Telegram commands">
            {f.cmds.map((c) => <span key={c} className="chip chip-id">{c}</span>)}
          </p>
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------ tiny illustrative snippets (decorative)

function Bubble({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`w-fit max-w-full rounded-[12px] rounded-bl-[4px] bg-ink-2 px-3 py-2 text-[0.72rem] leading-snug text-chalk-2 hairline ${className}`}>{children}</div>;
}

function PicksVisual() {
  const rows = [["19:00", "88"], ["22:30", "81"], ["00:45", "84"]];
  return (
    <div className="flex h-full flex-col justify-end gap-1">
      {rows.map(([t, s], i) => (
        <div key={t} className="flex items-center gap-2.5 rounded-md bg-ink-2 px-2.5 py-1 hairline">
          <span className="mono text-[0.7rem] text-chalk">{t}</span>
          <span className="h-1 flex-1 rounded-full bg-ink-3"><span className="block h-1 rounded-full" style={{ width: `${s}%`, background: i === 1 ? "var(--steel)" : "var(--flare)" }} /></span>
          <span className="mono text-[0.65rem] text-chalk-3">{s}</span>
        </div>
      ))}
    </div>
  );
}

function SpoilerVisual() {
  return (
    <div className="flex h-full flex-col justify-end gap-1.5">
      <Bubble>
        <span className="text-chalk">Full time:</span> Sporting v Benfica{" "}
        <span className="inline-block h-2.5 w-9 translate-y-[1px] rounded-[3px] align-baseline" style={{ background: "repeating-linear-gradient(135deg, var(--ink-3) 0 2px, var(--chalk-4) 2px 4px)" }} />
      </Bubble>
      <Bubble>How was it?</Bubble>
    </div>
  );
}

function AlertVisual() {
  return (
    <div className="flex h-full items-end">
      <Bubble className="!rounded-bl-[12px]">
        <span className="flex items-center gap-1.5 font-semibold text-chalk"><span className="live-dot !h-1.5 !w-1.5" aria-hidden /> Worth switching on · 78&prime;</span>
        <span className="mt-0.5 block">Level, chances at both ends.</span>
      </Bubble>
    </div>
  );
}

function CalendarVisual() {
  const days = ["Mon", "Tue", "Wed", "Thu"];
  return (
    <div className="grid h-full grid-cols-4 gap-1">
      {days.map((d, i) => (
        <div key={d} className="flex flex-col gap-1 rounded-md bg-ink-2 p-1.5 hairline">
          <span className="mono text-[0.6rem] text-chalk-3">{d}</span>
          <span className="h-2 rounded-[2px]" style={{ background: "var(--flare)", opacity: 0.85 }} />
          {i % 2 === 0 ? <span className="h-2 rounded-[2px] bg-chalk-4" /> : null}
        </div>
      ))}
    </div>
  );
}

function TasteVisual() {
  return (
    <div className="flex h-full flex-col justify-end gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        {(["loved", "fine", "bailed"] as const).map((r, i) => (
          <span key={r} className={`chip !h-6 ${i === 0 ? "!text-chalk" : ""}`} style={i === 0 ? { boxShadow: "inset 0 0 0 1px rgb(240 83 28 / 0.6)" } : undefined}>
            <RatingGlyph rating={r} size={11} />
            {r[0].toUpperCase() + r.slice(1)}
          </span>
        ))}
      </div>
      <Bubble>/ask which leagues do I enjoy?</Bubble>
    </div>
  );
}

function OwnVisual() {
  return (
    <div className="flex h-full flex-col justify-end gap-1.5">
      <span className="chip w-fit"><IconLock size={11} /> Encrypted before it&rsquo;s stored</span>
      <span className="chip chip-id w-fit"><span className="h-1.5 w-1.5 rounded-full bg-ok" /> blob ondgK…oY0</span>
    </div>
  );
}
