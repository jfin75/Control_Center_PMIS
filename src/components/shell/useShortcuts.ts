"use client";

import { useEffect, useState } from "react";

export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

/** "⌘" on macOS, "Ctrl" elsewhere. Resolved after mount to keep SSR output stable. */
export function useModKey(): string {
  const [k, setK] = useState("Ctrl");
  useEffect(() => setK(isMac() ? "⌘" : "Ctrl"), []);
  return k;
}

function typing(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/** Global Cmd/Ctrl shortcuts. `b` is skipped while typing so it never steals bold/select. */
export function useGlobalShortcuts(map: Record<string, () => void>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = isMac() ? e.metaKey : e.ctrlKey;
      if (!mod || e.altKey || e.shiftKey) return;
      const key = e.key.toLowerCase();
      const fn = map[key];
      if (!fn) return;
      if (key === "b" && typing(e.target)) return;
      e.preventDefault();
      fn();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [map]);
}
