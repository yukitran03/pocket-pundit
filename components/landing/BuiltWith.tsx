/**
 * Slim "Built with" strip under the hero. Tatum's logo is their own file (wordmark recoloured for a dark
 * background, mark untouched). Walrus and Sui are plain text marks: we have no logo files for them and
 * don't invent any. Wording stays factual: we use these services, nothing more is implied.
 */
export function BuiltWith() {
  return (
    <section aria-label="Built with" className="border-y border-line">
      <div className="shell flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:gap-8">
        <p className="micro shrink-0">Built with</p>
        <ul className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <li className="flex items-center gap-3">
            <a href="https://tatum.io" target="_blank" rel="noopener" className="inline-flex rounded-md p-1.5" aria-label="Tatum (opens tatum.io)">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brands/tatum-on-dark.svg" alt="Tatum" width={97} height={24} className="block h-6 w-auto" />
            </a>
            <span className="text-sm text-chalk-3">Sui reads</span>
          </li>
          <li className="flex items-baseline gap-2.5">
            <span className="font-display text-[1.35rem] font-extrabold uppercase leading-none tracking-[0.04em] text-chalk-2">Walrus</span>
            <span className="text-sm text-chalk-3">memory storage</span>
          </li>
          <li className="flex items-baseline gap-2.5">
            <span className="font-display text-[1.35rem] font-extrabold uppercase leading-none tracking-[0.04em] text-chalk-2">Sui</span>
            <span className="text-sm text-chalk-3">ownership records</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
