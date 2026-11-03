import Link from "next/link";
import { IconArrowRight, IconKey, IconLayers, IconLock } from "@/components/site/Icons";

const PILLARS = [
  {
    icon: <IconLock size={20} />,
    name: "Encrypted with Seal",
    body: "Memories are encrypted with Seal before they are written to Walrus. Decryption is gated by your MemWal account and the keys it delegates.",
    check: "Your picks only recall from your own namespace.",
  },
  {
    icon: <IconLayers size={20} />,
    name: "Stored on Walrus",
    body: "Each memory is a Walrus blob on mainnet with a blob ID, a Sui Blob object and a storage end epoch. That is what the dim tiles in your taste room show.",
    check: "Every cited blob ID links straight to Walruscan.",
  },
  {
    icon: <IconKey size={20} />,
    name: "Ownership on Sui, read via Tatum",
    body: "The MemWal account object, its delegate keys and each memory’s Blob object are read from Sui mainnet through Tatum’s gRPC and GraphQL gateways.",
    check: "The proof page reconciles on-chain blobs with the relayer’s count.",
  },
];

export function Ownership() {
  return (
    <div>
      <ul className="grid gap-px overflow-hidden rounded-[var(--radius-card)] bg-[var(--line)] md:grid-cols-3">
        {PILLARS.map((p) => (
          <li key={p.name} className="flex flex-col bg-ink-1 p-6">
            <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-ink-2 text-flare hairline">{p.icon}</span>
            <h3 className="mt-5 text-lg font-semibold">{p.name}</h3>
            <p className="mt-2 text-sm leading-relaxed text-chalk-3">{p.body}</p>
            <p className="mt-auto flex gap-2 pt-5 text-sm text-chalk-2">
              <span aria-hidden className="mt-[0.6em] h-px w-3 shrink-0 bg-flare" />
              {p.check}
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Link href="/proof" className="btn btn-ghost">
          Check it on-chain <IconArrowRight size={16} />
        </Link>
        <p className="text-sm text-chalk-3">No wallet needed: everything on the proof page is public mainnet state.</p>
      </div>
    </div>
  );
}
