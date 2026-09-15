"use client";

import { X, Info } from "lucide-react";
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cx } from "@/lib/format";

/* ---------------------------------------------------------------------------
 * Tooltip — fixed-position bubble in a portal so rails and scroll areas
 * never clip it. Shows on hover and on keyboard focus.
 * ------------------------------------------------------------------------- */

export function Tooltip({
  label,
  side = "top",
  children,
  disabled,
}: {
  label: ReactNode;
  side?: "top" | "right" | "bottom";
  children: ReactElement<Record<string, unknown>>;
  disabled?: boolean;
}) {
  const id = useId();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback(
    (el: HTMLElement) => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        const r = el.getBoundingClientRect();
        if (side === "right") setPos({ x: r.right + 10, y: r.top + r.height / 2 });
        else if (side === "bottom") setPos({ x: r.left + r.width / 2, y: r.bottom + 8 });
        else setPos({ x: r.left + r.width / 2, y: r.top - 8 });
      }, 120);
    },
    [side],
  );
  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setPos(null);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (disabled || !isValidElement(children)) return children;

  const child = cloneElement(children, {
    "aria-describedby": pos ? id : undefined,
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => show(e.currentTarget),
    onMouseLeave: hide,
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      if (e.currentTarget.matches(":focus-visible")) show(e.currentTarget);
    },
    onBlur: hide,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Escape") hide();
      (children.props.onKeyDown as ((ev: React.KeyboardEvent) => void) | undefined)?.(e);
    },
  });

  return (
    <>
      {child}
      {pos &&
        createPortal(
          <span
            role="tooltip"
            id={id}
            style={{ left: pos.x, top: pos.y }}
            className={cx(
              "pointer-events-none fixed z-[80] max-w-72 rounded-md bg-ink px-2.5 py-1.5 text-xs font-medium text-white shadow-raised",
              side === "right" && "-translate-y-1/2",
              side === "top" && "-translate-x-1/2 -translate-y-full",
              side === "bottom" && "-translate-x-1/2",
            )}
          >
            {label}
          </span>,
          document.body,
        )}
    </>
  );
}

export function InfoTip({ label }: { label: string }) {
  return (
    <Tooltip label={label}>
      <button type="button" aria-label={`About: ${label}`} className="inline-flex size-5 items-center justify-center rounded-full text-ink-3 hover:text-accent-ink">
        <Info className="size-3.5" strokeWidth={2} aria-hidden />
      </button>
    </Tooltip>
  );
}

/* ---------------------------------------------------------------------------
 * Popover — anchored panel for menus. Click outside or Esc closes and
 * returns focus to the trigger.
 * ------------------------------------------------------------------------- */

export function Popover({
  trigger,
  children,
  align = "end",
  width = "w-72",
  label,
}: {
  trigger: (p: { open: boolean; toggle: () => void; ref: React.Ref<HTMLButtonElement>; "aria-expanded": boolean; "aria-controls": string }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  width?: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) btn.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) close(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    // Move focus into the panel for keyboard users.
    requestAnimationFrame(() => {
      const first = panel.current?.querySelector<HTMLElement>("button, [href], input, select, [tabindex]:not([tabindex='-1'])");
      first?.focus();
    });
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <div ref={wrap} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o), ref: btn, "aria-expanded": open, "aria-controls": id })}
      {open && (
        <div
          ref={panel}
          id={id}
          role="dialog"
          aria-label={label}
          className={cx(
            "absolute top-full z-[60] mt-2 origin-top rounded-lg border border-line bg-surface shadow-overlay",
            "animate-[pop-in_var(--dur)_var(--ease-out)]",
            align === "end" ? "right-0" : "left-0",
            width,
          )}
        >
          {children(() => close())}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Modal — native <dialog> for focus trapping and top-layer rendering.
 * ------------------------------------------------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
  hideHeader,
  initialFocus,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  hideHeader?: boolean;
  initialFocus?: React.RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      if (initialFocus?.current) requestAnimationFrame(() => initialFocus.current?.focus());
    } else if (!open && d.open) d.close();
  }, [open, initialFocus]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cx(
        "m-auto max-h-[min(44rem,calc(100dvh-4rem))] w-[min(40rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-surface p-0 shadow-overlay open:flex open:flex-col",
        "open:animate-[pop-in_var(--dur)_var(--ease-out)]",
        className,
      )}
    >
      {open && (
        <>
          <div className={cx("flex items-start justify-between gap-4 border-b border-line px-5 py-4", hideHeader && "sr-only")}>
            <div>
              <h2 id={titleId} className="text-lg font-semibold text-ink">
                {title}
              </h2>
              {description && <p className="mt-0.5 text-xs text-ink-3">{description}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 inline-flex size-8 items-center justify-center rounded-md text-ink-3 hover:bg-sunk hover:text-ink">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          {children}
        </>
      )}
    </dialog>
  );
}

/* ---------------------------------------------------------------------------
 * Drawer — right slide-over. Non-modal by default so the map or grid behind
 * stays usable; `modal` turns it into a focused sheet.
 * ------------------------------------------------------------------------- */

export function Drawer({
  open,
  onClose,
  label,
  children,
  modal = false,
  width = "w-[min(var(--drawer-w),100vw)]",
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  modal?: boolean;
  width?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!modal) return;
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open, modal]);

  useEffect(() => {
    if (modal) return;
    if (open) {
      lastFocus.current = document.activeElement as HTMLElement;
      requestAnimationFrame(() => asideRef.current?.focus());
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape" && !e.defaultPrevented) onClose();
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    } else if (lastFocus.current && document.contains(lastFocus.current)) {
      lastFocus.current.focus();
      lastFocus.current = null;
    }
  }, [open, modal, onClose]);

  if (modal) {
    return (
      <dialog
        ref={ref}
        aria-label={label}
        onCancel={(e) => {
          e.preventDefault();
          onClose();
        }}
        onClick={(e) => {
          if (e.target === ref.current) onClose();
        }}
        className={cx(
          "fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh max-w-none rounded-l-xl border-l border-line bg-surface p-0 shadow-overlay open:flex open:flex-col",
          "open:animate-[slide-in_var(--dur-slow)_var(--ease-out)]",
          width,
        )}
      >
        {open && children}
      </dialog>
    );
  }

  return (
    <aside
      ref={asideRef}
      tabIndex={-1}
      aria-label={label}
      inert={!open}
      className={cx(
        "fixed top-[var(--topbar-h)] right-0 bottom-0 z-40 flex flex-col border-l border-line bg-surface shadow-overlay outline-none",
        "transition-[translate,visibility] duration-[var(--dur-slow)] ease-[var(--ease-out)]",
        open ? "visible translate-x-0" : "invisible translate-x-full",
        width,
      )}
    >
      {children}
    </aside>
  );
}

export function DrawerHeader({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="flex items-start gap-3 border-b border-line px-5 pt-4 pb-4">
      <div className="min-w-0 flex-1">{children}</div>
      <button type="button" onClick={onClose} aria-label="Close panel" className="-mr-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-ink-3 hover:bg-sunk hover:text-ink">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Toast — one polite live region for confirmations.
 * ------------------------------------------------------------------------- */

let pushToast: ((msg: string) => void) | null = null;
export function toast(msg: string) {
  pushToast?.(msg);
}

export function Toaster() {
  const [items, setItems] = useState<Array<{ id: number; msg: string }>>([]);
  useEffect(() => {
    pushToast = (msg) => {
      const id = Date.now() + Math.random();
      setItems((xs) => [...xs, { id, msg }]);
      window.setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3600);
    };
    return () => {
      pushToast = null;
    };
  }, []);
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed right-5 bottom-5 z-[90] flex flex-col items-end gap-2">
      {items.map((t) => (
        <div key={t.id} className="animate-[pop-in_var(--dur)_var(--ease-out)] rounded-md bg-ink px-3.5 py-2.5 text-sm font-medium text-white shadow-overlay">
          {t.msg}
        </div>
      ))}
    </div>
  );
}
