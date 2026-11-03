import type { ReactNode } from "react";

/** Editorial section: a narrow rail with the index and label, content in the remaining columns. */
export function Section({
  id,
  index,
  label,
  title,
  lede,
  aside,
  children,
  className = "",
  wide = false,
  rail,
}: {
  id?: string;
  index: string;
  label: string;
  title: ReactNode;
  lede?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Let the content break out of the 9-column text measure to the full grid. */
  wide?: boolean;
  /** Optional decoration under the rail label (desktop only, never in the flow on phones). */
  rail?: ReactNode;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={`shell mt-[var(--section-gap)] ${className}`}>
      <div className="grid gap-x-10 gap-y-5 lg:grid-cols-12">
        <div className="lg:col-span-3" data-reveal>
          <p className="micro flex items-center gap-3 lg:sticky lg:top-24">
            <span className="text-flare">{index}</span>
            <span aria-hidden className="rail-line h-px w-8 bg-line-strong" />
            <span>{label}</span>
          </p>
          {rail ? <div aria-hidden className="mt-8 hidden lg:block">{rail}</div> : null}
        </div>
        <div className="min-w-0 lg:col-span-9">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between" data-reveal>
            <div className="max-w-3xl">
              <h2 id={headingId} className="display-l">{title}</h2>
              {lede ? <div className="lede mt-4 max-w-2xl">{lede}</div> : null}
            </div>
            {aside ? <div className="shrink-0">{aside}</div> : null}
          </div>
          {children && !wide ? <div className="mt-9 md:mt-11" data-reveal style={{ "--reveal-delay": "90ms" } as React.CSSProperties}>{children}</div> : null}
        </div>
      </div>
      {children && wide ? <div className="mt-9 md:mt-11" data-reveal style={{ "--reveal-delay": "90ms" } as React.CSSProperties}>{children}</div> : null}
    </section>
  );
}
