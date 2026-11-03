import Link from "next/link";
import { BOT_URL, type Pick } from "@/lib/contract";
import { SAMPLE_DAY1, SAMPLE_DAY7, SAMPLE_TZ, FIXTURE_HISTORY } from "@/lib/fixtures";
import { fmtTime } from "@/lib/client/format";
import { RATING_META } from "@/lib/client/kinds";
import { Section } from "@/components/site/Section";
import { IconArrowRight, IconTelegram } from "@/components/site/Icons";
import { PickCard, RatingGlyph } from "@/components/pick/PickCard";
import { KickoffStrip } from "@/components/charts/KickoffStrip";
import { StatsProvider } from "@/components/landing/StatsProvider";
import { HeroVisual } from "@/components/landing/HeroVisual";
import { ABFromStats, LessonsFeed, LiveNumbers, StatsSourceBadge } from "@/components/landing/LiveSections";
import { HowItLearns } from "@/components/landing/HowItLearns";
import { Ownership } from "@/components/landing/Ownership";

// Illustrative sample (clearly labelled on the page): the same viewer on day 1 and day 7.
// For the illustration the arms are revealed; in the product they stay hidden until rated.
const reveal = (p: Pick): Pick => ({ ...p, arm: p.arm ?? (p.cites.length ? "memory" : "control") });
const DAY7 = SAMPLE_DAY7.map(reveal);
const SAMPLE_CARD = DAY7.find((p) => p.competition.startsWith("AFC")) ?? DAY7[0];
const STRIP = [...FIXTURE_HISTORY, ...DAY7];

export default function Home() {
  return (
    <StatsProvider>
      {/* ------------------------------------------------------------ hero */}
      <section aria-labelledby="hero-title" className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(50% 60% at 78% 30%, rgb(255 240 210 / 0.05), transparent 70%)" }} />
        <div className="shell relative grid gap-6 pb-6 pt-10 md:pt-16 lg:grid-cols-12 lg:gap-0 lg:pb-16 lg:pt-20">
          <div className="relative z-10 lg:col-span-6 lg:pr-6">
            <p className="micro flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-chalk-2">Football agent with a memory</span>
              <span aria-hidden className="h-px w-6 bg-line-strong" />
              <span>Walrus · Sui mainnet</span>
            </p>
            <h1 id="hero-title" className="display-xl mt-6">
              400 fixtures tonight.
              <br />
              <span className="text-flare">Three</span> worth your evening.
            </h1>
            <p className="lede mt-7 max-w-xl">
              Match Finder is a Telegram agent that learns what <em className="not-italic text-chalk">you</em> actually enjoy watching. It remembers on Walrus, encrypted and owned by you, so tomorrow’s picks are better than today’s.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href={BOT_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                <IconTelegram size={18} /> Open in Telegram
              </a>
              <Link href="/proof" className="btn btn-ghost">
                See the proof <IconArrowRight size={16} />
              </Link>
            </div>
            <dl className="mt-12 grid max-w-lg grid-cols-3 border-y border-line">
              {[
                ["3", "picks a night"],
                ["2 + 1", "memory + control"],
                ["0", "labels: rated blind"],
              ].map(([v, l]) => (
                <div key={l} className="flex flex-col py-4 pr-3 [&+&]:border-l [&+&]:border-line [&+&]:pl-4">
                  <dt className="order-last text-xs text-chalk-3">{l}</dt>
                  <dd className="font-display text-3xl font-extrabold leading-none">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative -mx-[var(--gutter)] sm:aspect-[16/10] lg:col-span-6 lg:mx-0 lg:-mr-[var(--gutter)] lg:aspect-auto lg:min-h-[600px]">
            <HeroVisual />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ how it learns */}
      <Section
        id="how"
        index="01"
        label="The loop"
        title="It learns one evening at a time."
        lede="A daily loop with a real feedback signal. Your rating is half of it, and the match itself is the other half."
        wide
      >
        <HowItLearns />
      </Section>

      {/* ------------------------------------------------------------ sample pick, day 1 vs day 7 */}
      <Section
        id="tonight"
        index="02"
        label="Tonight"
        title="Every pick shows its working."
        lede="This is a pick card exactly as the product renders it: kickoff in your time zone, why it was picked, and the memories it recalled, each linked to its blob on Walrus."
        wide
      >
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,400px)_1fr] lg:gap-10">
          <PickCard pick={SAMPLE_CARD} tz={SAMPLE_TZ} openCites sampleLabel="Sample" />
          <div className="flex min-w-0 flex-col gap-6">
            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[var(--radius-card)] bg-[var(--line)] sm:grid-cols-2">
              <DayColumn title="Day 1" sub="Knew 2 onboarding notes" picks={SAMPLE_DAY1} />
              <DayColumn title="Day 7" sub="Knows 24 memories" picks={DAY7} highlight />
            </div>
            <KickoffStrip picks={STRIP} tz={SAMPLE_TZ} windowStart={19} windowEnd={25} caption="Where each day’s picks kicked off, local time" />
            <p className="text-sm text-chalk-3">
              Illustrative sample for one viewer in Ho Chi Minh City (window 19:00–01:00). On day 1 the agent chose big names kicking off at 03:00. By day 7 the memory picks sit inside the window and favour late drama. The control pick still goes wherever the big game is.
            </p>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------ live numbers */}
      <Section id="numbers" index="03" label="Live" title="Running on mainnet, right now." aside={<StatsSourceBadge />}>
        <LiveNumbers />
      </Section>

      {/* ------------------------------------------------------------ A/B */}
      <Section
        id="ab"
        index="04"
        label="A/B test"
        title="Memory vs no memory, rated blind."
        lede="Each brief hides one control pick chosen with memory switched off. If memory helps, the memory arm should rate higher. If it doesn’t, this chart will say so."
        aside={<StatsSourceBadge />}
      >
        <ABFromStats />
      </Section>

      {/* ------------------------------------------------------------ lessons */}
      <Section
        id="lessons"
        index="05"
        label="Lessons"
        title="What it learned this week."
        lede="Recent lessons across all viewers, anonymised: lesson text only, no names or handles. Each stored lesson links to its Walrus blob."
      >
        <LessonsFeed />
      </Section>

      {/* ------------------------------------------------------------ ownership */}
      <Section
        id="yours"
        index="06"
        label="Ownership"
        title="Your memory is yours."
        lede="What the agent knows about your taste isn’t locked in our database. It is a set of encrypted blobs on Walrus, owned by an account you can inspect on Sui."
      >
        <Ownership />
      </Section>

      {/* ------------------------------------------------------------ closing CTA */}
      <section className="shell mt-[var(--section-gap)]" aria-labelledby="cta-title">
        <div className="card relative overflow-hidden p-8 md:p-12">
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full" style={{ background: "radial-gradient(closest-side, rgb(240 83 28 / 0.25), transparent)" }} />
          <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <h2 id="cta-title" className="display-l max-w-2xl">Tell it when you can watch. It handles the other 397.</h2>
              <p className="lede mt-4 max-w-xl">Start the bot, set your time zone and window, and your first three picks arrive tonight. Send <span className="mono text-chalk">/me</span> any time for your private dashboard link.</p>
            </div>
            <a href={BOT_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary self-start md:self-end">
              <IconTelegram size={18} /> Open in Telegram
            </a>
          </div>
        </div>
      </section>
    </StatsProvider>
  );
}

function DayColumn({ title, sub, picks, highlight = false }: { title: string; sub: string; picks: Pick[]; highlight?: boolean }) {
  const sorted = [...picks].sort((a, b) => a.slot - b.slot);
  return (
    <div className="min-w-0 bg-ink-1 p-5">
      <div className="flex items-baseline justify-between">
        <h3 className={`font-display text-3xl font-extrabold leading-none ${highlight ? "text-flare" : ""}`}>{title}</h3>
        <span className="text-xs text-chalk-3">{sub}</span>
      </div>
      <ul className="mt-4 divide-y divide-[var(--line-faint)]">
        {sorted.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2.5">
            <span className="mono w-12 shrink-0 text-sm text-chalk">{fmtTime(p.kickoff, SAMPLE_TZ)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-chalk-2">{p.home} v {p.away}</span>
              <span className="flex items-center gap-1.5 text-[0.7rem] text-chalk-3">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: p.arm === "memory" ? "var(--flare)" : "var(--steel)" }} />
                {p.arm === "memory" ? `${p.cites.length} ${p.cites.length === 1 ? "memory" : "memories"} cited` : "control, memory off"}
              </span>
            </span>
            {p.rating ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-chalk-2">
                <RatingGlyph rating={p.rating} size={12} />
                {RATING_META[p.rating].label}
              </span>
            ) : (
              <span className="shrink-0 text-xs text-chalk-3">tonight</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
