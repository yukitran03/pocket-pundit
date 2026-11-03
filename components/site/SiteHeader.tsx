import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { Wordmark } from "./Logo";
import { IconTelegram } from "./Icons";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-ink-0/80 backdrop-blur-md supports-[backdrop-filter]:bg-ink-0/65">
      <div className="shell flex h-16 items-center justify-between gap-3">
        <Link href="/" className="min-w-0 rounded-md" aria-label={`${BRAND.name} home`}>
          <Wordmark />
        </Link>
        <nav aria-label="Primary" className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Link href="/#how" className="btn btn-quiet hidden md:inline-flex">How it works</Link>
          <Link href="/#tonight" className="btn btn-quiet hidden md:inline-flex">Tonight</Link>
          <Link href="/#faq" className="btn btn-quiet hidden lg:inline-flex">FAQ</Link>
          <Link href="/proof" className="btn btn-quiet">Proof</Link>
          <a href={BRAND.botUrl} className="btn btn-primary !min-h-[38px] !px-3 !text-[0.85rem] sm:!px-3.5" target="_blank" rel="noopener noreferrer" aria-label={`Open ${BRAND.name} in Telegram`}>
            <IconTelegram size={16} />
            <span className="hidden sm:inline">Open in Telegram</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
