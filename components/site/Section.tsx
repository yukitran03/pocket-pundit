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
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={`shell mt-[var(--section-gap)] ${className}`}>
      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <p className="micro flex items-center gap-3 lg:sticky lg:top-24">
            <span className="text-flare">{index}</span>
            <span aria-hidden className="h-px w-8 bg-line-strong" />
            <span>{label}</span>
          </p>
        </div>
        <div className="min-w-0 lg:col-span-9">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <h2 id={headingId} className="display-l">{title}</h2>
              {lede ? <div className="lede mt-5 max-w-2xl">{lede}</div> : null}
            </div>
            {aside ? <div className="shrink-0">{aside}</div> : null}
          </div>
          {children && !wide ? <div className="mt-10 md:mt-12">{children}</div> : null}
        </div>
      </div>
      {children && wide ? <div className="mt-10 md:mt-12">{children}</div> : null}
    </section>
  );
}
