import Link from "next/link";

export default function NotFound() {
  return (
    <section className="shell pt-16 md:pt-28" aria-labelledby="nf-title">
      <p className="micro">404 · Out of play</p>
      <h1 id="nf-title" className="display-xl mt-5 max-w-4xl">
        That one went <span className="text-flare">wide</span>.
      </h1>
      <p className="lede mt-6 max-w-xl">The page you were looking for isn’t here. If you were opening your dashboard, use the fresh link the bot sends when you type /me.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/" className="btn btn-primary">Back to kick-off</Link>
        <Link href="/proof" className="btn btn-ghost">See the on-chain proof</Link>
      </div>
    </section>
  );
}
