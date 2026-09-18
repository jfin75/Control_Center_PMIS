"use client";

import { createContext, useContext } from "react";
import type { PackageRow, Row } from "@/lib/submittals";
import type { ReviewAction, Submittal, SubmittalPackage } from "@/mock/submittals";

export type Tab = "dashboard" | "register" | "packages" | "review";
export type ItemTab = "action" | "history" | "details";

export interface BuilderInit {
  projectId?: string;
  itemIds?: string[];
  existing?: SubmittalPackage;
}

/** Everything the Submittals tabs and drawers share. */
export interface SubmittalsCtl {
  subs: Submittal[];
  pkgs: SubmittalPackage[];
  /** Rows for every register, ignoring the project filter. */
  allRows: Row[];
  /** Rows inside the project filter. */
  rows: Row[];
  rowById: Map<string, Row>;
  pkgById: Map<string, SubmittalPackage>;
  packageRows: PackageRow[];
  project: string | "all";
  setProject: (id: string | "all") => void;
  setTab: (t: Tab) => void;
  openItem: (id: string, tab?: ItemTab) => void;
  openPackage: (id: string) => void;
  openBuilder: (init: BuilderInit) => void;
  openAdd: () => void;
  commit: (change: { subs?: Submittal[]; pkgs?: SubmittalPackage[]; removePkg?: string }) => void;
  /** Items still in review, most urgent first: the order "record and next" walks. */
  queue: Row[];
  recordReview: (id: string, input: { action: ReviewAction; comments: string; returnNow: boolean }) => void;
}

export const SubmittalsContext = createContext<SubmittalsCtl | null>(null);

export function useSubmittals(): SubmittalsCtl {
  const c = useContext(SubmittalsContext);
  if (!c) throw new Error("useSubmittals outside SubmittalsView");
  return c;
}
