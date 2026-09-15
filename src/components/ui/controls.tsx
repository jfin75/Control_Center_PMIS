"use client";

import Link from "next/link";
import { useRef, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/lib/format";

type Variant = "primary" | "secondary" | "ghost" | "tint" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover shadow-thumb disabled:bg-ink-4",
  secondary: "bg-surface text-ink border border-line-strong hover:border-slate hover:bg-surface-2 disabled:text-ink-4",
  ghost: "text-ink-2 hover:bg-sunk hover:text-ink disabled:text-ink-4",
  tint: "bg-accent-tint text-accent-ink hover:bg-[var(--c-cobalt-200)] disabled:text-ink-4",
  danger: "bg-surface text-neg-ink border border-line-strong hover:bg-neg-tint",
};

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  children,
  className,
  loading,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; icon?: ReactNode; loading?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-semibold transition-[background-color,border-color,color,box-shadow] duration-[var(--dur-fast)] disabled:cursor-not-allowed",
        size === "md" ? "h-8 px-3 text-sm" : "h-7 px-2.5 text-xs",
        VARIANTS[variant],
        className,
      )}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  variant = "ghost",
  className,
  pressed,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; variant?: Variant; pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      {...rest}
      className={cx(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-md transition-colors duration-[var(--dur-fast)] disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx("size-3.5 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The reference's segmented control: sunk track, white thumb, small bold
 * uppercase labels ("N. OF DEAL | VALUE"). Arrow keys move the selection.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: ReactNode; count?: number }>;
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const idx = options.findIndex((o) => o.value === value);
  function onKey(e: KeyboardEvent) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    let n = idx;
    if (e.key === "ArrowRight") n = (idx + 1) % options.length;
    if (e.key === "ArrowLeft") n = (idx - 1 + options.length) % options.length;
    if (e.key === "Home") n = 0;
    if (e.key === "End") n = options.length - 1;
    onChange(options[n]!.value);
    refs.current[n]?.focus();
  }
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKey} className={cx("inline-flex rounded-md bg-sunk p-[3px]", className)}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-sm font-bold tracking-[0.06em] uppercase transition-[background-color,color,box-shadow] duration-[var(--dur-fast)]",
              size === "md" ? "h-7 px-3.5 text-2xs" : "h-6 px-2.5 text-[0.625rem]",
              on ? "bg-surface text-accent-ink shadow-thumb" : "text-ink-3 hover:text-ink",
            )}
          >
            {o.label}
            {o.count !== undefined && <span className={cx("num font-semibold", on ? "text-accent-ink" : "text-ink-3")}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ checked, onChange, label, hideLabel }: { checked: boolean; onChange: (v: boolean) => void; label: string; hideLabel?: boolean }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={hideLabel ? label : undefined}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-[var(--dur)]",
          checked ? "bg-accent" : "bg-line-strong",
        )}
      >
        <span
          className={cx(
            "absolute left-0.5 size-4 rounded-full bg-white shadow-thumb transition-transform duration-[var(--dur)] ease-[var(--ease-out)]",
            checked && "translate-x-4",
          )}
        />
      </button>
      {!hideLabel && <span>{label}</span>}
    </label>
  );
}

/** Route-level tabs (underline), used for nested module navigation. */
export function RouteTabs({ tabs, label }: { tabs: Array<{ href: string; label: string; active: boolean }>; label: string }) {
  return (
    <nav aria-label={label} className="scroll-x -mx-1 mb-5 overflow-y-hidden shadow-[inset_0_-1px_0_var(--line)] [--scroll-ground:var(--bg)]">
      <ul className="flex min-w-max gap-1 px-1">
        {tabs.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={cx(
                "relative inline-flex h-10 items-center px-3 text-sm font-semibold transition-colors duration-[var(--dur-fast)]",
                t.active ? "text-accent-ink" : "text-ink-3 hover:text-ink",
              )}
            >
              {t.label}
              <span
                aria-hidden
                className={cx(
                  "absolute inset-x-2 bottom-0 h-[3px] rounded-t-sm bg-accent transition-opacity duration-[var(--dur-fast)]",
                  t.active ? "opacity-100" : "opacity-0",
                )}
              />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** In-page tabs with roving focus. */
export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  label,
  idBase,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: Array<{ value: T; label: ReactNode }>;
  label: string;
  idBase: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const idx = tabs.findIndex((t) => t.value === value);
  function onKey(e: KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const n = e.key === "ArrowRight" ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length;
    onChange(tabs[n]!.value);
    refs.current[n]?.focus();
  }
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKey} className="scroll-x flex gap-1 overflow-y-hidden shadow-[inset_0_-1px_0_var(--line)]">
      {tabs.map((t, i) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            id={`${idBase}-tab-${t.value}`}
            aria-selected={on}
            aria-controls={`${idBase}-panel`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={cx(
              "relative inline-flex h-10 shrink-0 items-center gap-1.5 px-3 text-sm font-semibold transition-colors duration-[var(--dur-fast)]",
              on ? "text-accent-ink" : "text-ink-3 hover:text-ink",
            )}
          >
            {t.label}
            <span aria-hidden className={cx("absolute inset-x-2 bottom-0 h-[3px] rounded-t-sm bg-accent", on ? "opacity-100" : "opacity-0")} />
          </button>
        );
      })}
    </div>
  );
}
