import Link from "next/link";
import { IconArrowRight, IconKey, IconLayers, IconLock } from "@/components/site/Icons";

const PILLARS = [
  {
    icon: <IconLock size={20} />,
    name: "Encrypted first",
    body: "Each memory is encrypted with Seal before it is stored, and it is filed under an anonymous ID instead of your Telegram account.",
  },
  {
    icon: <IconLayers size={20} />,
    name: "Stored on Walrus",
    body: "Every memory is its own blob on Walrus mainnet, with an ID and a storage end date. Each pick links to the memories it used.",
  },
  {
    icon: <IconKey size={20} />,
    name: "Checkable on Sui",
    body: "The account that owns the memories, its keys and every stored blob are public on Sui mainnet. Our proof page reads them live through Tatum.",
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
            <p className="mt-2 text-[0.95rem] leading-relaxed text-chalk-2">{p.body}</p>
          </li>
        ))}
      </ul>
      <p className="mt-5 max-w-3xl text-sm text-chalk-3">
        In plain terms: our service, and the Walrus Memory relayer it writes through, can read your memories so they can pick matches and answer your questions. Other users and the public can&rsquo;t. Please don&rsquo;t tell your pundit anything you wouldn&rsquo;t tell a service you trust.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Link href="/proof" className="btn btn-ghost">
          See the live proof <IconArrowRight size={16} />
        </Link>
        <p className="text-sm text-chalk-3">Public mainnet data. No wallet needed.</p>
      </div>
    </div>
  );
}
