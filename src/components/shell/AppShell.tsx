"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { PrefsProvider, usePrefs } from "@/lib/prefs";
import { Toaster } from "@/components/ui/overlay";
import { CommandPalette } from "./CommandPalette";
import { ResourceCenter } from "./ResourceCenter";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useGlobalShortcuts } from "./useShortcuts";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <PrefsProvider>
      <Shell>{children}</Shell>
    </PrefsProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { toggleSidebar } = usePrefs();
  const [searchOpen, setSearchOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();

  // Phone-width navigation overlay: closes on route change and Esc.
  useEffect(() => setNavOpen(false), [pathname]);
  useEffect(() => {
    document.documentElement.dataset.mobileNav = navOpen ? "open" : "closed";
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setNavOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const shortcuts = useMemo(() => ({ k: openSearch, b: toggleSidebar }), [openSearch, toggleSidebar]);
  useGlobalShortcuts(shortcuts);

  return (
    <>
      <a
        href="#main"
        className="fixed top-2 left-2 z-[100] -translate-y-16 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-overlay focus:translate-y-0"
      >
        Skip to content
      </a>
      <div className="app-grid">
        <TopBar onSearch={openSearch} onResources={() => setResourcesOpen(true)} navOpen={navOpen} onMenu={() => setNavOpen((o) => !o)} />
        <Sidebar />
        {navOpen && <div aria-hidden className="mobile-only fixed inset-x-0 top-[var(--topbar-h)] bottom-0 z-40 bg-ink/30" onClick={() => setNavOpen(false)} />}
        <main id="main" tabIndex={-1} className="col-start-2 row-start-2 min-w-0 overflow-y-auto outline-none">
          <div className="mx-auto w-full max-w-[110rem] px-4 pt-6 pb-12 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ResourceCenter open={resourcesOpen} onClose={() => setResourcesOpen(false)} />
      <Toaster />
    </>
  );
}
