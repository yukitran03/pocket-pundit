import Link from "next/link";
import { BOT_URL } from "@/lib/contract";
import { IconTelegram } from "@/components/site/Icons";

export function TokenHelp({ reason }: { reason: "missing" | "invalid" }) {
  return (
    <section className="shell pt-14 md:pt-24" aria-labelledby="token-title">
      <div className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <p className="micro">{reason === "missing" ? "Private dashboard" : "Link expired"}</p>
          <h1 id="token-title" className="display-l mt-5">
            {reason === "missing" ? "Your dashboard opens from Telegram." : "This link has expired or isn’t valid."}
          </h1>
          <p className="lede mt-6 max-w-xl">
            {reason === "missing"
              ? "Each viewer gets a private, signed link, so there is no password to remember and nothing for us to store in your browser."
              : "Dashboard links are signed and short-lived. Ask the bot for a fresh one and it opens straight here."}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={BOT_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              <IconTelegram size={18} /> Open the bot
            </a>
            <Link href="/" className="btn btn-ghost">Back to the homepage</Link>
          </div>
        </div>
        <ol className="card self-start p-6 lg:col-span-5" aria-label="How to get your link">
          {[
            ["Open the Match Finder bot in Telegram", "t.me/finder_matching_bot"],
            ["Send the command", "/me"],
            ["Tap the link it replies with", "It opens this page with your private token"],
          ].map(([a, b], i) => (
            <li key={a} className="flex gap-4 border-b border-line py-4 first:pt-0 last:border-0 last:pb-0">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink-3 font-mono text-xs">{i + 1}</span>
              <span>
                <span className="block font-medium">{a}</span>
                <span className={`mt-0.5 block text-sm ${i === 1 ? "mono text-flare" : "text-chalk-3"}`}>{b}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
