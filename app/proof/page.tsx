import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { ProofView } from "@/components/proof/ProofView";
import { ScrollReveal, SmoothScroll } from "@/components/fx/Motion";

export const metadata: Metadata = {
  title: "On-chain proof",
  description: `Check ${BRAND.name}'s memories on Sui mainnet: the account that owns them, its keys, and every Walrus blob, read live through Tatum.`,
};

const PROVES = [
  ["Account", "The memories belong to an account on Sui mainnet, and that account is active."],
  ["Keys", "Only the keys listed here can write memories for the account. Each one is labelled."],
  ["Epoch and checkpoint", "This page read fresh chain state just now, through Tatum, not a cached copy."],
  ["Matched vs missing", "Every memory the agent says it saved should have a Walrus blob on Sui. Missing usually means a write is still being certified."],
  ["Locked briefs", "Each evening's picks are written down before kick-off, so they can't be edited after the result is known."],
  ["Storage end", "How long Walrus has committed to keep each blob. Memories fade on your dashboard as that date gets close."],
];

export default function ProofPage() {
  return (
    <div className="shell pt-10 md:pt-16">
      <SmoothScroll />
      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <p className="micro">Public · no wallet needed</p>
          <h1 className="display-l mt-4">Don’t take our word for it. Check the chain.</h1>
          <p className="lede mt-5 max-w-2xl">
            {BRAND.name} keeps what it learns on Walrus mainnet, owned by an account on Sui. This page reads that state live through Tatum and compares it with what the agent says it saved.
          </p>
        </div>
      </div>

      <div className="mt-10 md:mt-12">
        <ProofView />
      </div>

      <section className="mt-16 md:mt-24" aria-labelledby="proves-h">
        <div className="grid gap-x-10 gap-y-6 lg:grid-cols-12">
          <div className="lg:col-span-4" data-reveal>
            <p className="micro"><span className="text-flare">Why it matters</span></p>
            <h2 id="proves-h" className="display-m mt-2">What each part proves</h2>
          </div>
          <dl className="grid gap-px overflow-hidden rounded-[var(--radius-card)] bg-[var(--line)] sm:grid-cols-2 lg:col-span-8" data-reveal>
            {PROVES.map(([k, v]) => (
              <div key={k} className="bg-ink-1 p-5">
                <dt className="font-semibold">{k}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-chalk-3">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <ScrollReveal />
    </div>
  );
}
