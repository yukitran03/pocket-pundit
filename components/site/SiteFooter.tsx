import Link from "next/link";
import { BOT_URL } from "@/lib/contract";
import { LogoMark } from "./Logo";

export const REPO_URL = "https://github.com/yukitran03/match-finder";

export function SiteFooter() {
  return (
    <footer className="mt-[var(--section-gap)] border-t border-line">
      <div className="shell grid gap-10 py-12 md:grid-cols-12">
        <div className="md:col-span-5">
          <div className="flex items-center gap-3">
            <LogoMark size={32} />
            <p className="font-display text-2xl font-extrabold uppercase leading-none">Match Finder</p>
          </div>
          <p className="mt-4 max-w-sm text-sm text-chalk-3">
            Built for the Tatum × Walrus “Total Recall” hackathon. Memories live on Walrus, encrypted with Seal. Ownership is read on Sui mainnet through Tatum.
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3 md:col-span-7">
          <div>
            <p className="micro mb-3">Product</p>
            <ul className="space-y-2">
              <li><a className="link" href={BOT_URL} target="_blank" rel="noopener noreferrer">Telegram bot</a></li>
              <li><Link className="link" href="/#how">How it learns</Link></li>
              <li><Link className="link" href="/#ab">The A/B test</Link></li>
            </ul>
          </div>
          <div>
            <p className="micro mb-3">Verify</p>
            <ul className="space-y-2">
              <li><Link className="link" href="/proof">On-chain proof</Link></li>
              <li><a className="link" href="https://walruscan.com/mainnet" target="_blank" rel="noopener noreferrer">Walruscan</a></li>
              <li><a className="link" href="https://suiscan.xyz/mainnet" target="_blank" rel="noopener noreferrer">Suiscan</a></li>
            </ul>
          </div>
          <div>
            <p className="micro mb-3">Code</p>
            <ul className="space-y-2">
              <li><a className="link" href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub repository</a></li>
            </ul>
          </div>
        </nav>
      </div>
      <div className="shell flex flex-col gap-2 border-t py-6 text-xs text-chalk-4 sm:flex-row sm:justify-between" style={{ borderColor: "var(--line-faint)" }}>
        <p>Team and competition names are shown as plain text for identification only. No affiliation implied.</p>
        <p className="mono">Sui mainnet · Walrus mainnet</p>
      </div>
    </footer>
  );
}
