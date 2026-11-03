import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND } from "@/lib/brand";
import { IconChevron } from "@/components/site/Icons";

const Cmd = ({ children }: { children: ReactNode }) => <span className="mono text-[0.92em] text-chalk">{children}</span>;

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "Is it free?",
    a: <>Yes. Open {BRAND.name} in Telegram and start. There are no ads, no odds and no betting.</>,
  },
  {
    q: "Does it spoil scores?",
    a: (
      <>
        No. Picks never show a score. After full time it asks how the match was before it tells you the result, and live alerts hide the score too. If you would rather see scores, send <Cmd>/spoilers on</Cmd>.
      </>
    ),
  },
  {
    q: "Which leagues does it cover?",
    a: (
      <>
        More than 150 competitions a week, menHundreds of competitions worldwide, men&rsquo;s and women&rsquo;s:rsquo;s and womenHundreds of competitions worldwide, men&rsquo;s and women&rsquo;s:rsquo;s: the big European leagues and the Champions League, the Asian and African club competitions, South America and more. You pick the ones you follow when you start, and your pundit learns the rest from your ratings.
      </>
    ),
  },
  {
    q: "What does it store, and who can read it?",
    a: (
      <>
        Short notes about your taste: how you rated each match, what you told it, and what it concluded (for example, that weeknight kick-offs after 01:00 don&rsquo;t work for you). Each note is encrypted before it is stored on Walrus, under an anonymous ID, so nothing public points back to your Telegram account. Our service, and the Walrus Memory relayer it writes through, read your notes to choose your picks and answer <Cmd>/ask</Cmd>. Other users and the public can&rsquo;t.
      </>
    ),
  },
  {
    q: "Can I change or delete what it knows?",
    a: (
      <>
        You can correct anything it has learned from your dashboard (send <Cmd>/me</Cmd>) or with <Cmd>/teach</Cmd>, and you can stop the bot at any time. Each memory is stored on Walrus for a fixed period that we don&rsquo;t renew, and your dashboard shows when each one ends.
      </>
    ),
  },
  {
    q: "Do I need a crypto wallet?",
    a: (
      <>
        No. There is no wallet, no token and nothing to sign. Everything happens in Telegram. The records on Sui are there for anyone who wants to <Link href="/proof" className="link">check them</Link>.
      </>
    ),
  },
];

export function Faq() {
  return (
    <div className="divide-y divide-[var(--line)] overflow-hidden rounded-[var(--radius-card)] bg-ink-1 hairline">
      {FAQ.map((f) => (
        <details key={f.q} className="group">
          <summary className="flex min-h-[60px] items-center justify-between gap-4 px-5 py-4 text-[1.05rem] font-semibold hover:bg-ink-2/60 md:px-6">
            <h3>{f.q}</h3>
            <IconChevron size={18} className="shrink-0 text-chalk-3 transition-transform group-open:rotate-90" />
          </summary>
          <div className="max-w-3xl px-5 pb-5 text-chalk-2 md:px-6">{f.a}</div>
        </details>
      ))}
    </div>
  );
}
