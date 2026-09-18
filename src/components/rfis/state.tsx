"use client";

import { createContext, useContext } from "react";
import type { Row, Stage } from "@/lib/rfis";
import type { Rfi, Who } from "@/mock/rfis";

export type Tab = "dashboard" | "log" | "queues" | "impacts";
export type DetailTab = "thread" | "files" | "details";
/** The work queues: each is one stage, in the order the Owner works it. */
export type Queue = Extract<Stage, "awaiting" | "info" | "answered" | "draft">;

/** Everything the RFI tabs and drawers share. */
export interface RfisCtl {
  rfis: Rfi[];
  /** Rows for every log, ignoring the project filter. */
  allRows: Row[];
  /** Rows inside the project filter. */
  rows: Row[];
  rowById: Map<string, Row>;
  project: string | "all";
  setProject: (id: string | "all") => void;
  setTab: (t: Tab) => void;
  openRfi: (id: string, tab?: DetailTab) => void;
  openNew: () => void;
  /** Save changed or new RFIs. */
  save: (...rfis: Rfi[]) => void;
  /** Delete a draft. */
  remove: (id: string) => void;
  /** Who posts by default on a project: the signed-in user if on the team, otherwise the Owner's PM. */
  me: (projectId: string) => Who;
  /** Rows in a work queue, most urgent first. */
  queue: (q: Queue) => Row[];
}

export const RfisContext = createContext<RfisCtl | null>(null);

export function useRfis(): RfisCtl {
  const c = useContext(RfisContext);
  if (!c) throw new Error("useRfis outside RfisView");
  return c;
}
