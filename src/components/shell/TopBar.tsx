"use client";

import Link from "next/link";
import { useState } from "react";
import { Accessibility, Bell, BookOpen, Check, ChevronDown, LogOut, Menu, Minus, Plus, Search, Settings, UserRound, X } from "lucide-react";
import { Popover } from "@/components/ui/overlay";
import { Segmented } from "@/components/ui/controls";
import { Avatar } from "@/components/ui/data";
import { cx } from "@/lib/format";
import { usePrefs, type Prefs } from "@/lib/prefs";
import { CURRENT_USER_ID, ENVIRONMENTS, ORG, ROLES, person } from "@/mock/org";
import { NOTIFICATIONS } from "@/mock/workspace";
import { useModKey } from "./useShortcuts";

export function BrandMark({ className }: { className?: string }) {
  // A pier reaching into a horizon line: the Owner's footprint meeting the water.
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden>
      <rect width="28" height="28" rx="7" fill="var(--c-cobalt-600)" />
      <path d="M8 7.5v13M20 7.5v13" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M8 14h12" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M5 21.5c2.2 0 2.2-1.4 4.5-1.4s2.3 1.4 4.5 1.4 2.3-1.4 4.5-1.4 2.3 1.4 4.5 1.4" stroke="var(--c-sky-400)" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

const TEXT_STEPS: Prefs["textscale"][] = ["90", "100", "112", "125"];

export function TopBar({ onSearch, onResources, navOpen, onMenu }: { onSearch: () => void; onResources: () => void; navOpen: boolean; onMenu: () => void }) {
  const { prefs, set } = usePrefs();
  const mod = useModKey();
  const me = person(CURRENT_USER_ID);
  const [notices, setNotices] = useState(NOTIFICATIONS);
  const unread = notices.filter((n) => n.unread).length;
  const env = ENVIRONMENTS.find((e) => e.id === prefs.env)!;

  return (
    <header className="relative col-span-2 flex items-center gap-2 border-b border-line bg-surface pr-3 pl-3 sm:gap-3">
      <span aria-hidden className="env-band absolute inset-x-0 top-0 h-[3px]" />

      {/* Left: organization and environment */}
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          onClick={onMenu}
          aria-expanded={navOpen}
          aria-controls="primary-nav"
          aria-label={navOpen ? "Close navigation" : "Open navigation"}
          className="mobile-only -mr-1 inline-flex size-9 items-center justify-center rounded-md text-ink-2 hover:bg-sunk"
        >
          {navOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
        <Link href="/portfolio/" className="flex items-center gap-2.5 rounded-md py-1 pr-1.5" aria-label={`${ORG.name} — home`}>
          <BrandMark className="size-7 shrink-0" />
          <span className="hide-on-phone text-md leading-none font-bold tracking-[-0.01em] whitespace-nowrap text-ink">
            {ORG.name}
          </span>
        </Link>
        <Popover
          label="Switch environment"
          align="start"
          width="w-64"
          trigger={({ toggle, ref, ...aria }) => (
            <button
              ref={ref}
              {...aria}
              type="button"
              onClick={toggle}
              className="hide-on-phone inline-flex h-7 items-center gap-1.5 rounded-sm border border-line px-2 text-xs font-semibold text-ink-2 hover:border-line-strong hover:text-ink"
            >
              <span aria-hidden className={cx("size-1.5 rounded-full", prefs.env === "production" ? "bg-pos" : prefs.env === "staging" ? "bg-warn" : "bg-teal")} />
              {env.label}
              <ChevronDown className="size-3 text-ink-3" aria-hidden />
            </button>
          )}
        >
          {(close) => (
            <div className="p-1.5" role="menu" aria-label="Environments">
              {ENVIRONMENTS.map((e) => (
                <button
                  key={e.id}
                  role="menuitemradio"
                  aria-checked={e.id === prefs.env}
                  type="button"
                  onClick={() => {
                    set("env", e.id);
                    close();
                  }}
                  className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left hover:bg-sunk"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{e.label}</span>
                    <span className="block text-xs text-ink-3">{e.note}</span>
                  </span>
                  {e.id === prefs.env && <Check className="size-4 text-accent-ink" aria-hidden />}
                </button>
              ))}
              <p className="mx-2.5 mt-1 mb-1.5 border-t border-line pt-2 text-2xs leading-4 text-ink-3">All environments in this build show synthetic demo data.</p>
            </div>
          )}
        </Popover>
      </div>

      {/* Center: omnibox */}
      <div className="flex flex-1 justify-center px-1">
        <button
          type="button"
          onClick={onSearch}
          aria-label={`Search (${mod}+K)`}
          className="group flex h-9 w-full max-w-[34rem] items-center gap-2.5 rounded-md border border-line bg-surface-2 px-3 text-left text-sm text-ink-3 transition-colors hover:border-line-strong hover:bg-surface"
        >
          <Search className="size-4 shrink-0 text-ink-3 group-hover:text-ink-2" aria-hidden />
          <span className="hide-on-phone flex-1 truncate">Search properties, projects, cost codes, contractors</span>
          <kbd className="hide-on-phone rounded-xs border border-line bg-surface px-1.5 text-2xs font-semibold text-ink-3">{mod} K</kbd>
        </button>
      </div>

      {/* Right: accessibility, resources, notifications, account */}
      <div className="flex items-center gap-1">
        <Popover
          label="Display and accessibility"
          width="w-72"
          trigger={({ toggle, ref, ...aria }) => (
            <button ref={ref} {...aria} type="button" onClick={toggle} aria-label="Display and accessibility" title="Display and accessibility" className="inline-flex size-9 items-center justify-center rounded-md text-ink-2 hover:bg-sunk hover:text-ink">
              <Accessibility className="size-[1.125rem]" aria-hidden />
            </button>
          )}
        >
          {() => (
            <div className="space-y-4 p-4">
              <div>
                <div className="mb-1.5 text-xs font-semibold text-ink-2">Contrast</div>
                <Segmented
                  label="Contrast"
                  value={prefs.contrast}
                  onChange={(v) => set("contrast", v)}
                  options={[
                    { value: "standard", label: "Standard" },
                    { value: "high", label: "High" },
                  ]}
                />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-ink-2">
                  <span id="ts-label">Text size</span>
                  <span className="num text-ink">{prefs.textscale === "112" ? "112.5" : prefs.textscale}%</span>
                </div>
                <div className="flex items-center gap-2" role="group" aria-labelledby="ts-label">
                  <button
                    type="button"
                    aria-label="Smaller text"
                    disabled={prefs.textscale === TEXT_STEPS[0]}
                    onClick={() => set("textscale", TEXT_STEPS[Math.max(0, TEXT_STEPS.indexOf(prefs.textscale) - 1)]!)}
                    className="inline-flex size-8 items-center justify-center rounded-md border border-line-strong text-ink-2 hover:bg-sunk disabled:opacity-40"
                  >
                    <Minus className="size-3.5" aria-hidden />
                  </button>
                  <div className="flex flex-1 gap-1" aria-hidden>
                    {TEXT_STEPS.map((s) => (
                      <span key={s} className={cx("h-1.5 flex-1 rounded-full", TEXT_STEPS.indexOf(s) <= TEXT_STEPS.indexOf(prefs.textscale) ? "bg-accent" : "bg-line")} />
                    ))}
                  </div>
                  <button
                    type="button"
                    aria-label="Larger text"
                    disabled={prefs.textscale === TEXT_STEPS[TEXT_STEPS.length - 1]}
                    onClick={() => set("textscale", TEXT_STEPS[Math.min(TEXT_STEPS.length - 1, TEXT_STEPS.indexOf(prefs.textscale) + 1)]!)}
                    className="inline-flex size-8 items-center justify-center rounded-md border border-line-strong text-ink-2 hover:bg-sunk disabled:opacity-40"
                  >
                    <Plus className="size-3.5" aria-hidden />
                  </button>
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-xs font-semibold text-ink-2">Motion</div>
                <Segmented
                  label="Motion"
                  value={prefs.motion}
                  onChange={(v) => set("motion", v)}
                  options={[
                    { value: "system", label: "System" },
                    { value: "reduced", label: "Reduced" },
                  ]}
                />
              </div>
            </div>
          )}
        </Popover>

        <button type="button" onClick={onResources} aria-label="Resource Center" title="Resource Center" className="inline-flex size-9 items-center justify-center rounded-md text-ink-2 hover:bg-sunk hover:text-ink">
          <BookOpen className="size-[1.125rem]" aria-hidden />
        </button>

        <Popover
          label="Notifications"
          width="w-[22rem]"
          trigger={({ toggle, ref, ...aria }) => (
            <button
              ref={ref}
              {...aria}
              type="button"
              onClick={toggle}
              aria-label={`Notifications, ${unread} unread`}
              title="Notifications"
              className="relative inline-flex size-9 items-center justify-center rounded-md text-ink-2 hover:bg-sunk hover:text-ink"
            >
              <Bell className="size-[1.125rem]" aria-hidden />
              {unread > 0 && (
                <span aria-hidden className="num absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-neg px-1 text-[0.625rem] font-bold text-ink ring-2 ring-surface">
                  {unread}
                </span>
              )}
            </button>
          )}
        >
          {(close) => (
            <div>
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="text-md font-semibold text-ink">Notifications</h2>
                <button
                  type="button"
                  disabled={!unread}
                  onClick={() => setNotices((ns) => ns.map((n) => ({ ...n, unread: false })))}
                  className="text-xs font-semibold text-accent-ink hover:underline disabled:text-ink-4 disabled:no-underline"
                >
                  Mark all read
                </button>
              </div>
              <ul className="max-h-[26rem] overflow-y-auto py-1">
                {notices.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={n.href}
                      onClick={() => {
                        setNotices((ns) => ns.map((x) => (x.id === n.id ? { ...x, unread: false } : x)));
                        close();
                      }}
                      className="flex gap-3 px-4 py-2.5 hover:bg-surface-2"
                    >
                      <span
                        aria-hidden
                        className={cx("mt-1.5 size-2 shrink-0 rounded-full", n.tone === "neg" ? "bg-neg" : n.tone === "warn" ? "bg-warn" : n.tone === "pos" ? "bg-pos" : "bg-info")}
                      />
                      <span className="min-w-0 flex-1">
                        <span className={cx("block text-sm text-ink", n.unread ? "font-bold" : "font-medium")}>
                          {n.title}
                          {n.unread && <span className="sr-only"> (unread)</span>}
                        </span>
                        <span className="mt-0.5 block text-xs leading-4 text-ink-2">{n.body}</span>
                        <span className="mt-1 block text-2xs text-ink-3">{n.when}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Popover>

        <Popover
          label="Account"
          width="w-72"
          trigger={({ toggle, ref, ...aria }) => (
            <button ref={ref} {...aria} type="button" onClick={toggle} aria-label={`Account: ${me.name}`} className="ml-1 flex items-center gap-2 rounded-md py-1 pr-1.5 pl-1 hover:bg-sunk">
              <Avatar name={me.name} tone={me.tone} />
              <span className="hide-on-phone hidden text-left lg:block">
                <span className="block text-sm leading-4 font-semibold text-ink">{me.name}</span>
                <span className="block text-2xs leading-4 text-ink-3">{prefs.role}</span>
              </span>
              <ChevronDown className="hide-on-phone size-3.5 text-ink-3" aria-hidden />
            </button>
          )}
        >
          {(close) => (
            <div>
              <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                <Avatar name={me.name} tone={me.tone} size="lg" />
                <div className="min-w-0">
                  <div className="truncate text-md font-semibold text-ink">{me.name}</div>
                  <div className="truncate text-xs text-ink-3">{me.email}</div>
                </div>
              </div>
              <div className="border-b border-line p-1.5" role="group" aria-label="Preview as role">
                <div className="px-2.5 pt-1.5 pb-1 text-2xs font-semibold text-ink-3">View as role</div>
                {ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="menuitemradio"
                    aria-checked={prefs.role === r}
                    onClick={() => set("role", r)}
                    className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm text-ink hover:bg-sunk"
                  >
                    {r}
                    {prefs.role === r && <Check className="size-4 text-accent-ink" aria-hidden />}
                  </button>
                ))}
              </div>
              <div className="p-1.5">
                <Link href="/settings/" onClick={close} className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink hover:bg-sunk">
                  <UserRound className="size-4 text-ink-3" aria-hidden /> Profile
                </Link>
                <Link href="/settings/" onClick={close} className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink hover:bg-sunk">
                  <Settings className="size-4 text-ink-3" aria-hidden /> Settings
                </Link>
                <button type="button" onClick={close} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink hover:bg-sunk">
                  <LogOut className="size-4 text-ink-3" aria-hidden /> Sign out
                </button>
              </div>
            </div>
          )}
        </Popover>
      </div>
    </header>
  );
}
