/**
 * Slim "Built with" strip under the hero. Each logo is the owner-supplied official file, shown unaltered on a
 * light chip (the Walrus file is a light-background PNG, so all three share the same chip for consistency).
 * Wording stays factual: we use these services; no partnership or endorsement is implied.
 */
const LOGOS = [
  { href: "https://tatum.io", label: "Tatum", role: "Sui reads", img: "/brands/tatum-on-light.svg", w: 97, h: 24 },
  { href: "https://www.walrus.xyz", label: "Walrus", role: "Memory storage", img: "/brands/walrus-on-light.png", w: 78, h: 24 },
  { href: "https://sui.io", label: "Sui", role: "Ownership records", img: "/brands/sui-icon.svg", w: 24, h: 24, text: "Sui" },
] as const;

export function BuiltWith() {
  return (
    <section aria-label="Built with" className="border-y border-line">
      <div className="shell flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:gap-8">
        <p className="micro shrink-0">Built with</p>
        <ul className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {LOGOS.map((l) => (
            <li key={l.label} className="flex items-center gap-3">
              <a
                href={l.href}
                target="_blank"
                rel="noopener"
                aria-label={`${l.label} (opens ${new URL(l.href).host})`}
                className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-[#f4f6f2] px-3.5 transition-transform hover:-translate-y-0.5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.img} alt={"text" in l ? "" : l.label} width={l.w} height={l.h} className="block h-6 w-auto" />
                {"text" in l ? <span className="text-[1.05rem] font-semibold tracking-tight text-[#111]">{l.text}</span> : null}
              </a>
              <span className="text-sm text-chalk-3">{l.role}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
