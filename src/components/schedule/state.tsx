"use client";

import { createContext, useContext } from "react";
import type { Result } from "@/lib/schedule/cpm";
import type { Schedule } from "@/lib/schedule/types";

export type Tab = "program" | "gantt" | "health" | "updates";

/** What the Gantt is narrowed to when another tab sends the user there. */
export interface Focus {
  label: string;
  ids: string[];
}

/** Everything the Schedule tabs, drawers, and dialogs share. */
export interface ScheduleCtl {
  all: Schedule[];
  project: string | "all";
  setProject: (id: string | "all") => void;
  /** Open a project's current schedule on a tab. */
  gotoProject: (id: string, tab?: Tab) => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  /** The version on screen for the selected project, and its calculation. */
  s: Schedule | null;
  r: Result | null;
  versions: Schedule[];
  currentId: string | null;
  /** Any project's current version. */
  currentFor: (projectId: string) => Schedule | null;
  openVersion: (id: string, tab?: Tab) => void;
  makeCurrent: (id: string) => void;
  /** Save an edit to the version on screen (undoable). */
  edit: (next: Schedule) => void;
  add: (s: Schedule, opts?: { current?: boolean }) => void;
  remove: (id: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  selected: string | null;
  select: (id: string | null) => void;
  /** Open the activity or WBS drawer. */
  detail: string | null;
  openDetail: (id: string | null) => void;
  focus: Focus | null;
  showInGantt: (f: Focus | null) => void;
  startImport: () => void;
  startNew: (projectId?: string) => void;
  openSettings: () => void;
}

export const ScheduleContext = createContext<ScheduleCtl | null>(null);

export function useSchedule(): ScheduleCtl {
  const c = useContext(ScheduleContext);
  if (!c) throw new Error("useSchedule outside ScheduleView");
  return c;
}

/** For parts that only render while a version is on screen. */
export function useOpenSchedule(): ScheduleCtl & { s: Schedule; r: Result } {
  const c = useSchedule();
  if (!c.s || !c.r) throw new Error("No schedule open");
  return c as ScheduleCtl & { s: Schedule; r: Result };
}
