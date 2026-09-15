"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Suspense } from "react";
import { cx } from "@/lib/format";
import { NAV, isActive } from "@/lib/nav";
import { usePrefs } from "@/lib/prefs";
import { DEFAULT_RBAC } from "@/mock/workspace";
import { Tooltip } from "@/components/ui/overlay";
import { useModKey } from "./useShortcuts";

export function Sidebar() {
  return (
    <Suspense fallback={<nav aria-label="Primary" className="row-start-2 border-r border-line bg-surface" />}>
      <SidebarInner />
    </Suspense>
  );
}

function SidebarInner() {
  const pathname = usePathname() ?? "/";
  const { prefs, toggleSidebar } = usePrefs();
  const collapsed = prefs.sidebar === "collapsed";
  const mod = useModKey();
  const perms = DEFAULT_RBAC[prefs.role] ?? {};

  return (
    <nav id="primary-nav" aria-label="Primary" className="primary-nav col-start-1 row-start-2 flex min-h-0 flex-col overflow-hidden border-r border-line bg-surface">
      <ul className="flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto px-3 py-4">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const allowed = (perms[item.module] ?? []).includes("View");
          const Icon = item.icon;
          const link = (
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-disabled={!allowed || undefined}
              onClick={(e) => {
                if (!allowed) e.preventDefault();
              }}
              className={cx(
                "group relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-semibold whitespace-nowrap transition-colors duration-[var(--dur-fast)]",
                active ? "bg-accent-tint text-accent-ink" : "text-ink-2 hover:bg-sunk hover:text-ink",
                !allowed && "cursor-not-allowed opacity-45 hover:bg-transparent",
              )}
            >
              <Icon className={cx("size-[1.125rem] shrink-0", active ? "text-accent-ink" : "text-ink-3 group-hover:text-ink-2")} strokeWidth={active ? 2.25 : 2} aria-hidden />
              <span className="nav-label truncate">{item.label}</span>
              {!allowed && <span className="sr-only"> (not available for {prefs.role})</span>}
            </Link>
          );
          return (
            <li key={item.href}>
              <Tooltip label={allowed ? item.label : `${item.label} — not available for ${prefs.role}`} side="right" disabled={!collapsed}>
                {link}
              </Tooltip>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-line px-3 py-3 max-sm:hidden">
        <Tooltip label={`${collapsed ? "Expand" : "Collapse"} sidebar (${mod}+B)`} side="right" disabled={!collapsed}>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm font-medium whitespace-nowrap text-ink-2 hover:bg-sunk hover:text-ink"
          >
            {collapsed ? <PanelLeftOpen className="size-[1.125rem] shrink-0 text-ink-3" aria-hidden /> : <PanelLeftClose className="size-[1.125rem] shrink-0 text-ink-3" aria-hidden />}
            <span className="nav-label flex flex-1 items-center justify-between">
              Collapse
              <kbd className="rounded-xs border border-line bg-surface-2 px-1.5 font-sans text-2xs font-semibold text-ink-3">{mod} B</kbd>
            </span>
          </button>
        </Tooltip>
      </div>
    </nav>
  );
}
