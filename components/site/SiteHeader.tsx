import Link from "next/link";
import { BOT_URL } from "@/lib/contract";
import { Wordmark } from "./Logo";
import { IconTelegram } from "./Icons";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-ink-0/80 backdrop-blur-md supports-[backdrop-filter]:bg-ink-0/65">
      <div className="shell flex h-16 items-center justify-between gap-4">
        <Link href="/" className="rounded-md" aria-label="Match Finder home">
          <Wordmark />
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
          <Link href="/#how" className="btn btn-quiet hidden md:inline-flex">How it learns</Link>
          <Link href="/#ab" className="btn btn-quiet hidden md:inline-flex">A/B result</Link>
          <Link href="/proof" className="btn btn-quiet">Proof</Link>
          <a href={BOT_URL} className="btn btn-primary !min-h-[38px] !px-3 !text-[0.85rem] sm:!px-3.5" target="_blank" rel="noopener noreferrer" aria-label="Open Match Finder in Telegram">
            <IconTelegram size={16} />
            <span className="hidden sm:inline">Open in Telegram</span>
            <span className="hidden min-[420px]:inline sm:hidden">Telegram</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
