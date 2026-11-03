import type { Pick } from "@/lib/contract";
import { PickCard, RatingGlyph } from "@/components/pick/PickCard";

const STEPS = [
  {
    title: "Start in Telegram",
    body: "Answer four quick questions: where you are, when you want your picks, the hours you can watch, and the leagues you follow.",
    extra: <span className="chip chip-id !text-chalk">/start</span>,
  },
  {
    title: "Get tonight’s three",
    body: "At your hour, three matches arrive with kick-off in your time zone and a short reason for each, like the card here.",
    extra: <span className="text-xs text-chalk-3">Out of 400+ fixtures on a busy night</span>,
  },
  {
    title: "Tap how it was",
    body: "After full time, one tap. Your pundit also checks what really happened in the match, so tomorrow’s picks fit you better.",
    extra: (
      <span className="flex flex-wrap gap-1.5" aria-hidden>
        {(["loved", "fine", "bailed", "skipped"] as const).map((r, i) => (
          <span key={r} className={`chip !h-[26px] ${i === 0 ? "!text-chalk" : ""}`} style={i === 0 ? { boxShadow: "inset 0 0 0 1px rgb(240 83 28 / 0.6)" } : undefined}>
            <RatingGlyph rating={r} size={11} />
            {r === "skipped" ? "Didn’t watch" : r[0].toUpperCase() + r.slice(1)}
          </span>
        ))}
      </span>
    ),
  },
];

/** Three steps on the left, a real (sample) pick card on the right. */
export function HowItWorks({ sample, tz }: { sample: Pick; tz: string }) {
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:gap-14">
      <ol className="flex flex-col">
        {STEPS.map((s, i) => (
          <li key={s.title} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-4 border-t border-[var(--line)] py-6 first:border-t-0 first:pt-0 md:grid-cols-[4.5rem_minmax(0,1fr)] md:py-8">
            <span aria-hidden className={`font-display text-[3.25rem] font-extrabold leading-[0.8] md:text-[4.5rem] ${i === 1 ? "text-flare" : "text-chalk-4"}`}>{i + 1}</span>
            <div className="min-w-0">
              <h3 className="text-xl font-semibold leading-tight md:text-2xl">
                <span className="sr-only">Step {i + 1}: </span>
                {s.title}
              </h3>
              <p className="mt-2 max-w-lg text-chalk-2">{s.body}</p>
              <div className="mt-3.5">{s.extra}</div>
            </div>
          </li>
        ))}
      </ol>
      <div className="min-w-0 self-start">
        <PickCard pick={sample} tz={tz} sampleLabel="Sample pick" showTz />
        <p className="mt-3 text-xs text-chalk-3">Illustration: a real card layout with sample data for a viewer in Ho Chi Minh City.</p>
      </div>
    </div>
  );
}
