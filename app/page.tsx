import type { Pick } from "@/lib/contract";
import { BRAND } from "@/lib/brand";
import { SAMPLE_DAY1, SAMPLE_DAY7, SAMPLE_TZ } from "@/lib/fixtures";
import { fmtTime, localHour } from "@/lib/client/format";
import { Section } from "@/components/site/Section";
import { IconArrowRight, IconTelegram } from "@/components/site/Icons";
import { StatsProvider } from "@/components/landing/StatsProvider";
import { HeroVisual } from "@/components/landing/HeroVisual";
import { ABFromStats, LessonsFeed, LiveNumbers, StatsSourceBadge } from "@/components/landing/LiveSections";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Features } from "@/components/landing/Features";
import { TonightBoard } from "@/components/landing/Tonight";
import { Ownership } from "@/components/landing/Ownership";
import { Faq } from "@/components/landing/Faq";
import { BuiltWith } from "@/components/landing/BuiltWith";
import { TatumCheck } from "@/components/landing/TatumCheck";
import { MemoryJourney } from "@/components/landing/MemoryJourney";
import { GooeyWords } from "@/components/fx/GooeyWords";
import { ScrollReveal, SmoothScroll } from "@/components/fx/Motion";

// Illustrative sample (labelled on the page): the same viewer on day 1 and day 7.
// For the illustration the arms are revealed; in the product they stay hidden until rated.
const reveal = (p: Pick): Pick => ({ ...p, arm: p.arm ?? (p.cites.length ? "memory" : "control") });
const DAY7 = SAMPLE_DAY7.map(reveal);
const SAMPLE_CARD = DAY7.find((p) => p.competition.startsWith("AFC")) ?? DAY7[0];
const PHRASES = ["your evening.", "staying up for.", "the highlights."];

export default function Home() {
  return (
    <StatsProvider>
      <SmoothScroll />
      {/* ------------------------------------------------------------ hero */}
      <section aria-labelledby="hero-title" className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(50% 60% at 78% 30%, rgb(255 240 210 / 0.05), transparent 70%)" }} />
        <div aria-hidden className="season-ambient pointer-events-none absolute inset-0" />
        <div className="shell relative grid gap-6 pb-6 pt-10 md:pt-16 lg:grid-cols-12 lg:gap-0 lg:pb-16 lg:pt-20">
          <div className="relative z-10 lg:col-span-6 lg:pr-6">
            <p className="micro text-chalk-2">Your football pundit, in Telegram</p>
            <h1 id="hero-title" className="hero-title mt-6">
              <span className="sr-only">400 fixtures tonight. Three worth your evening.</span>
              <span aria-hidden className="block">
                400 fixtures tonight.
                <br />
                <span className="text-flare">Three</span> worth
                <br />
                <GooeyWords phrases={PHRASES} />
              </span>
            </h1>
            <p className="lede mt-7 max-w-xl">
              {BRAND.name} is a Telegram bot that knows your taste. Every evening it sends the three matches most worth your time, at hours you can actually watch. No spoilers, a reminder before kick-off, and a ping when a game turns.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href={BRAND.botUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                <IconTelegram size={18} /> Open in Telegram
              </a>
              <a href="#tonight" className="btn btn-ghost">
                See tonight&rsquo;s picks <IconArrowRight size={16} className="rotate-90" />
              </a>
            </div>
            <p className="mt-4 text-sm text-chalk-3">Free. Set up in four taps. No wallet, no app to install.</p>
            <dl className="mt-10 grid max-w-lg grid-cols-3 border-y border-line">
              {[
                ["3", "matches a night"],
                ["0", "spoilers"],
                ["1 tap", "to rate"],
              ].map(([v, l]) => (
                <div key={l} className="flex flex-col py-4 pr-3 [&+&]:border-l [&+&]:border-line [&+&]:pl-4">
                  <dt className="order-last mt-1 text-sm text-chalk-2">{l}</dt>
                  <dd className="font-display text-4xl font-extrabold leading-none">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative -mx-[var(--gutter)] sm:aspect-[16/10] lg:col-span-6 lg:mx-0 lg:-mr-[var(--gutter)] lg:aspect-auto lg:min-h-[600px]">
            <HeroVisual />
          </div>
        </div>
      </section>

      <BuiltWith />

      {/* ------------------------------------------------------------ how it works */}
      <Section id="how" index="01" label="How it works" title="Three steps. Then it does the scrolling." wide>
        <HowItWorks sample={SAMPLE_CARD} tz={SAMPLE_TZ} />
      </Section>

      {/* ------------------------------------------------------------ features */}
      <Section id="features" index="02" label="What you get" title="Less scrolling. No spoilers. No missed thrillers." lede="Six things your pundit does every day, each one a tap or a command away." wide>
        <Features />
      </Section>

      {/* ------------------------------------------------------------ tonight, live */}
      <Section id="tonight" index="03" label="Tonight" title="What’s worth watching tonight." lede="Straight from the live feed, in your time zone. This is your pundit before it knows you." wide>
        <TonightBoard />
      </Section>

      {/* ------------------------------------------------------------ results: numbers + A/B */}
      <Section
        id="results"
        index="04"
        label="Results"
        title="Better every night. We measure it."
        lede="Each brief hides one pick chosen with memory off. Viewers rate all three without knowing which is which, so the comparison is fair."
        aside={<StatsSourceBadge />}
        wide
      >
        <div className="space-y-10">
          <LiveNumbers />
          <div id="ab">
            <h3 className="display-s mb-4">Memory picks vs memory-off picks</h3>
            <ABFromStats />
          </div>
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h3 className="display-s">One viewer, day 1 vs day 7</h3>
              <p className="mt-2 text-sm text-chalk-3">Illustration with sample data: a viewer in Ho Chi Minh City who watches from 19:00 to 01:00.</p>
              <DayCompare />
            </div>
            <div>
              <h3 className="display-s">What pundits learned this week</h3>
              <p className="mt-2 text-sm text-chalk-3">Recent lessons from all viewers, anonymised.</p>
              <div className="mt-5"><LessonsFeed limit={4} /></div>
            </div>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------ checked on Sui, through Tatum */}
      <Section
        id="verified"
        index="05"
        label="Checked on Sui"
        title="Every claim here is checked on Sui, through Tatum."
        lede="So you don’t have to trust us. Each check reads Sui mainnet live through Tatum’s gateway and compares it with what your pundit says it saved."
        aside={<TatumMark />}
        wide
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:items-start">
          <MemoryJourney />
          <TatumCheck />
        </div>
      </Section>

      {/* ------------------------------------------------------------ ownership */}
      <Section id="yours" index="06" label="Your data" title="Your taste memory is yours." lede="What your pundit learns is encrypted and kept on Walrus. Anyone can check it on Sui, and you never need a wallet.">
        <Ownership />
      </Section>

      {/* ------------------------------------------------------------ FAQ */}
      <Section id="faq" index="07" label="FAQ" title="Questions, answered.">
        <Faq />
      </Section>

      {/* ------------------------------------------------------------ closing CTA */}
      <section className="shell mt-[var(--section-gap)]" aria-labelledby="cta-title">
        <div className="card relative overflow-hidden p-8 md:p-12" data-reveal>
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full" style={{ background: "radial-gradient(closest-side, rgb(240 83 28 / 0.25), transparent)" }} />
          <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <h2 id="cta-title" className="display-l max-w-2xl">Tell your pundit when you can watch. It handles the other 397.</h2>
              <p className="lede mt-4 max-w-xl">Answer four quick questions and tonight&rsquo;s three arrive at the hour you choose. Send <span className="mono text-chalk">/me</span> any time for your private dashboard.</p>
            </div>
            <div className="flex flex-col items-start gap-2 md:items-end">
              <a href={BRAND.botUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                <IconTelegram size={18} /> Open in Telegram
              </a>
              <span className="mono text-xs text-chalk-3">{BRAND.botHandle}</span>
            </div>
          </div>
        </div>
      </section>
      <ScrollReveal />
    </StatsProvider>
  );
}

/** "Sui reads powered by Tatum": their logo, linked, with clear space. Factual wording only. */
function TatumMark() {
  return (
    <p className="flex items-center gap-3 text-sm text-chalk-3">
      Sui reads powered by
      <a href="https://tatum.io" target="_blank" rel="noopener" className="inline-flex rounded-md p-1.5" aria-label="Tatum (opens tatum.io)">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brands/tatum-on-dark.svg" alt="Tatum" width={97} height={24} className="block h-6 w-auto" />
      </a>
    </p>
  );
}

/** Day 1 vs day 7 for the sample viewer: how many picks landed inside her viewing hours. */
function DayCompare() {
  const inWindow = (p: Pick) => {
    const h = localHour(p.kickoff, SAMPLE_TZ);
    return h >= 19 && h <= 25;
  };
  const days = [
    { label: "Day 1", picks: [...SAMPLE_DAY1].sort((a, b) => a.kickoff.localeCompare(b.kickoff)), note: "Big names at 03:00. She bailed or skipped two." },
    { label: "Day 7", picks: [...DAY7].sort((a, b) => a.kickoff.localeCompare(b.kickoff)), note: "Both memory picks sit inside her hours." },
  ];
  return (
    <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] bg-[var(--line)]">
      {days.map((d, i) => {
        const n = d.picks.filter(inWindow).length;
        return (
          <div key={d.label} className="flex flex-col bg-ink-1 p-4 sm:p-5">
            <p className="text-sm font-medium text-chalk">{d.label}</p>
            <p className={`mt-2 font-display text-5xl font-extrabold leading-none ${i ? "text-flare" : ""}`}>
              {n}<span className="text-2xl text-chalk-3"> of {d.picks.length}</span>
            </p>
            <p className="mt-1 text-sm text-chalk-2">picks she could watch</p>
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={`${d.label} kick-off times`}>
              {d.picks.map((p) => (
                <li key={p.id} className="chip chip-id !h-[22px]" style={inWindow(p) ? { color: "var(--chalk)", boxShadow: `inset 0 0 0 1px ${p.arm === "memory" ? "rgb(240 83 28 / .55)" : "rgb(57 135 229 / .55)"}` } : { color: "var(--chalk-4)" }}>
                  {fmtTime(p.kickoff, SAMPLE_TZ)}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-chalk-3">{d.note}</p>
          </div>
        );
      })}
    </div>
  );
}
