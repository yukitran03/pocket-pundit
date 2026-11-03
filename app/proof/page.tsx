import type { Metadata } from "next";
import { ProofView } from "@/components/proof/ProofView";

export const metadata: Metadata = {
  title: "On-chain proof",
  description: "Verify Match Finder's memories on Sui mainnet: the MemWal account, its delegate keys, and every Walrus Blob object, read live via Tatum.",
};

const PROVES = [
  ["Account object", "The MemWalAccount exists on Sui mainnet and is owned by a single address. Memory is not a row in our database: it has an on-chain owner."],
  ["Active flag", "The account is live and can authorise reads and writes. An inactive account would stop all recall."],
  ["Delegate keys", "The keys allowed to act for the account, each labelled. If a key isn’t listed here, it can’t write memories."],
  ["Epoch and checkpoint", "The page read fresh chain state just now, through Tatum’s gRPC and GraphQL gateways, not a cached snapshot."],
  ["Blob objects vs relayer", "Every memory the agent says it wrote should have a Walrus Blob object on-chain. Matched means it does. Missing is usually a write still waiting for certification."],
  ["end_epoch", "How long Walrus has committed to storing each blob. It is why memories dim in the taste room as they approach expiry."],
];

export default function ProofPage() {
  return (
    <div className="shell pt-10 md:pt-16">
      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <p className="micro">Public · no wallet needed</p>
          <h1 className="display-l mt-4">Don’t trust us. Check the chain.</h1>
          <p className="lede mt-5 max-w-2xl">
            Match Finder’s memories live on Walrus mainnet and are owned by a MemWal account on Sui. This page reads that state live through Tatum and lines it up against what the agent believes it stored.
          </p>
        </div>
      </div>

      <div className="mt-10 md:mt-12">
        <ProofView />
      </div>

      <section className="mt-16 md:mt-24" aria-labelledby="proves-h">
        <div className="grid gap-x-10 gap-y-6 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="micro"><span className="text-flare">Why it matters</span></p>
            <h2 id="proves-h" className="display-m mt-2">What each item proves</h2>
          </div>
          <dl className="grid gap-px overflow-hidden rounded-[var(--radius-card)] bg-[var(--line)] sm:grid-cols-2 lg:col-span-8">
            {PROVES.map(([k, v]) => (
              <div key={k} className="bg-ink-1 p-5">
                <dt className="font-semibold">{k}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-chalk-3">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </div>
  );
}
