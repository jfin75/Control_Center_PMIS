"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Environment, Role } from "@/mock/org";

export interface Prefs {
  sidebar: "expanded" | "collapsed";
  contrast: "standard" | "high";
  textscale: "90" | "100" | "112" | "125";
  motion: "system" | "reduced";
  env: Environment;
  role: Role;
}

export const DEFAULT_PREFS: Prefs = {
  sidebar: "expanded",
  contrast: "standard",
  textscale: "100",
  motion: "system",
  env: "production",
  role: "Cost Controller",
};

const KEY = "cc.prefs.v1";

/**
 * Inline, pre-hydration script: applies stored preferences to <html> before
 * first paint so the sidebar, contrast and text size never flash.
 */
export const PREFS_BOOT_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem('${KEY}')||'{}');var d=document.documentElement;
if(p.sidebar)d.dataset.sidebar=p.sidebar;else if(window.innerWidth<1100)d.dataset.sidebar='collapsed';
if(p.contrast)d.dataset.contrast=p.contrast;if(p.textscale)d.dataset.textscale=p.textscale;
if(p.motion)d.dataset.motion=p.motion;if(p.env)d.dataset.env=p.env;}catch(e){}})();`;

function read(): Prefs {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<Prefs>;
    const d = document.documentElement.dataset;
    return { ...DEFAULT_PREFS, sidebar: (d.sidebar as Prefs["sidebar"]) ?? DEFAULT_PREFS.sidebar, ...stored };
  } catch {
    return DEFAULT_PREFS;
  }
}

interface Ctx {
  prefs: Prefs;
  set: <K extends keyof Prefs>(k: K, v: Prefs[K]) => void;
  toggleSidebar: () => void;
}

const PrefsContext = createContext<Ctx | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    setPrefs(read());
  }, []);

  const set = useCallback(<K extends keyof Prefs>(k: K, v: Prefs[K]) => {
    setPrefs((p) => {
      const next = { ...p, [k]: v };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable: keep in memory */
      }
      return next;
    });
    const d = document.documentElement.dataset;
    if (k !== "role") (d as Record<string, string>)[k] = String(v);
  }, []);

  const toggleSidebar = useCallback(() => {
    const cur = document.documentElement.dataset.sidebar === "collapsed" ? "collapsed" : "expanded";
    set("sidebar", cur === "collapsed" ? "expanded" : "collapsed");
  }, [set]);

  const value = useMemo(() => ({ prefs, set, toggleSidebar }), [prefs, set, toggleSidebar]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): Ctx {
  const c = useContext(PrefsContext);
  if (!c) throw new Error("usePrefs outside PrefsProvider");
  return c;
}

/** Small persisted state hook for per-page conveniences (layouts, drafts). */
export function useStoredState<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void, boolean] {
  const [state, setState] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setState(JSON.parse(raw) as T);
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, [key]);
  const update = useCallback(
    (v: T | ((p: T) => T)) => {
      setState((prev) => {
        const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [key],
  );
  return [state, update, loaded];
}
