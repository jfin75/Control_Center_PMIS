"use client";

import { createContext, useContext } from "react";
import type { ModRow, Row } from "@/lib/contracts";
import type { Contract, Mod, ModType } from "@/mock/contracts";
import type { Who } from "@/mock/rfis";

export type Tab = "register" | "changes" | "templates";
export type DetailTab = "summary" | "document" | "exhibits" | "changes" | "history";

/** What the contract form opens with. */
export interface FormStart {
  /** Edit this saved draft. */
  contract?: Contract;
  templateId?: string;
  parentId?: string;
  projectId?: string;
  /** Tab to open on. */
  tab?: string;
}

/** What the change form opens with. */
export interface ModStart {
  mod?: Mod;
  contractId?: string;
  type?: ModType;
}

/** Everything the contract tabs and drawers share. */
export interface ContractsCtl {
  contracts: Contract[];
  mods: Mod[];
  /** Rows for every contract, ignoring the project filter. */
  allRows: Row[];
  /** Rows inside the project filter. Masters stay in: they span every project. */
  rows: Row[];
  rowById: Map<string, Row>;
  /** Changes inside the project filter. */
  modRows: ModRow[];
  modById: Map<string, ModRow>;
  project: string | "all";
  setProject: (id: string | "all") => void;
  setTab: (t: Tab) => void;
  openContract: (id: string, tab?: DetailTab) => void;
  openMod: (id: string) => void;
  startContract: (s?: FormStart) => void;
  startMod: (s?: ModStart) => void;
  saveContracts: (...c: Contract[]) => void;
  saveMods: (...m: Mod[]) => void;
  removeContract: (id: string) => void;
  removeMod: (id: string) => void;
  /** The signed-in user, who records every action. */
  me: Who;
}

export const ContractsContext = createContext<ContractsCtl | null>(null);

export function useContracts(): ContractsCtl {
  const c = useContext(ContractsContext);
  if (!c) throw new Error("useContracts outside ContractsView");
  return c;
}
