/** The Schedule view's saved state: seeded updates overlaid with this
 *  browser's edits, imports, and deletions, plus which version is current
 *  for each project. Replace with an API once there is a backend. */

import { SEEDED_IDS as SEEDED_ID_LIST, seededSchedules } from "@/mock/schedules";
import { dayNum } from "./calendar";
import type { Schedule } from "./types";

export interface Store {
  /** Edited or added schedules; null hides a seeded one. */
  schedules: Record<string, Schedule | null>;
  /** Project id → the schedule version reported as current. */
  current: Record<string, string>;
}

export const EMPTY_STORE: Store = { schedules: {}, current: {} };
export const STORE_KEY = "cc.schedule.v1";

const SEEDED_IDS = new Set(SEEDED_ID_LIST);
export const isSeeded = (id: string) => SEEDED_IDS.has(id);

export function merged(store: Store): Schedule[] {
  const out: Schedule[] = [];
  for (const s of seededSchedules()) {
    if (!(s.id in store.schedules)) out.push(s);
    else if (store.schedules[s.id]) out.push(store.schedules[s.id]!);
  }
  for (const [id, s] of Object.entries(store.schedules)) if (s && !SEEDED_IDS.has(id)) out.push(s);
  return out;
}

/** A project's versions, newest data date first. */
export function versionsOf(list: Schedule[], projectId: string): Schedule[] {
  return list.filter((s) => s.projectId === projectId).sort((a, b) => dayNum(b.dataDate) - dayNum(a.dataDate) || b.updated.localeCompare(a.updated));
}

export function currentOf(list: Schedule[], store: Store, projectId: string): Schedule | null {
  const vs = versionsOf(list, projectId);
  return vs.find((s) => s.id === store.current[projectId]) ?? vs[0] ?? null;
}

/** Size of the saved state in characters, to warn before the browser's storage (about five million) fills. */
export const storeSize = (store: Store) => JSON.stringify(store).length;
export const STORE_WARN_SIZE = 4_000_000;
