import type { ReactNode } from "react";
import { cx } from "@/lib/format";
import { InfoTip } from "./overlay";

/** The reference's white panel floating on the pale canvas. Never nest panels. */
export function Panel({
  title,
  info,
  actions,
  children,
  className,
  bodyClassName,
  id,
  as: Tag = "section",
  flush = false,
}: {
  title?: ReactNode;
  info?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
  as?: "section" | "div" | "article";
  flush?: boolean;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <Tag className={cx("panel flex min-w-0 flex-col", className)} aria-labelledby={title ? headingId : undefined} id={id}>
      {(title || actions) && (
        <header className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 pt-4 pb-3">
          {title && (
            <h2 id={headingId} className="flex items-center gap-1.5 text-md font-semibold tracking-[-0.005em] text-ink">
              {title}
              {info && <InfoTip label={info} />}
            </h2>
          )}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx(flush ? "" : "px-5 pb-5", !title && !actions && !flush && "pt-5", "min-w-0 flex-1", bodyClassName)}>{children}</div>
    </Tag>
  );
}

export function PageHeader({
  title,
  meta,
  actions,
  children,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-[-0.015em] text-ink">{title}</h1>
        {meta && <p className="mt-1 text-xs text-ink-3">{meta}</p>}
        {children}
      </div>
      {actions && <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A labelled fact, for definition-style detail panes. */
export function Fact({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cx("min-w-0", className)}>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="num mt-0.5 text-base font-semibold text-ink">{value}</dd>
      {sub && <dd className="mt-0.5 text-xs text-ink-2">{sub}</dd>}
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mt-8 mb-3 flex items-baseline justify-between gap-4 first:mt-0">
      <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">{children}</h2>
      {aside && <div className="text-xs text-ink-3">{aside}</div>}
    </div>
  );
}
