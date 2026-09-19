/** Working-day calendars. Every date the scheduler touches is turned into a
 *  working-day index: index i is the i-th working day since the epoch, and an
 *  activity that occupies days [es, ef) starts on day es and finishes at the
 *  end of day ef − 1. Arithmetic then stays in plain integers, and weekends
 *  and holidays only matter when converting back to dates. */

import type { CalendarDef } from "./types";

const DAY = 86_400_000;
/** A Sunday, well before any capital schedule. */
const EPOCH = Date.UTC(1980, 0, 6) / DAY;

export function dayNum(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1) / DAY;
}

export function isoOf(dn: number): string {
  const d = new Date(dn * DAY);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Sunday = 0. */
export const weekday = (iso: string) => (((dayNum(iso) - EPOCH) % 7) + 7) % 7;

export const isoValid = (s: string | null | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(dayNum(s));

export class WorkCalendar {
  readonly perWeek: number;
  private prefix: number[];
  private hols: number[];
  private week: boolean[];
  private dateCache = new Map<number, string>();

  constructor(def: CalendarDef) {
    this.week = def.week.some(Boolean) ? [...def.week] : [false, true, true, true, true, true, false];
    this.perWeek = this.week.filter(Boolean).length;
    this.prefix = [0];
    for (let k = 0; k < 7; k++) this.prefix.push(this.prefix[k]! + (this.week[k] ? 1 : 0));
    const hs = new Set<number>();
    for (const h of def.holidays) {
      if (!isoValid(h)) continue;
      const dn = dayNum(h);
      if (this.week[(((dn - EPOCH) % 7) + 7) % 7]) hs.add(dn);
    }
    this.hols = [...hs].sort((a, b) => a - b);
  }

  private isWorkDn(dn: number): boolean {
    if (!this.week[(((dn - EPOCH) % 7) + 7) % 7]) return false;
    return !this.holidayAt(dn);
  }

  private holidayAt(dn: number): boolean {
    let lo = 0;
    let hi = this.hols.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const v = this.hols[mid]!;
      if (v === dn) return true;
      if (v < dn) lo = mid + 1;
      else hi = mid - 1;
    }
    return false;
  }

  /** Working days strictly before day number dn. */
  private before(dn: number): number {
    const d = dn - EPOCH;
    const weeks = Math.floor(d / 7);
    const rem = d - weeks * 7;
    let lo = 0;
    let hi = this.hols.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.hols[mid]! < dn) lo = mid + 1;
      else hi = mid;
    }
    return weeks * this.perWeek + this.prefix[rem]! - lo;
  }

  isWork(iso: string): boolean {
    return this.isWorkDn(dayNum(iso));
  }

  /** Index of the first working day on or after iso: where work that starts that day begins. */
  start(iso: string): number {
    return this.before(dayNum(iso));
  }

  /** The point at the end of iso, or of the last working day before it: where work finishing that day ends. */
  end(iso: string): number {
    return this.before(dayNum(iso) + 1);
  }

  /** The date of working day i. */
  date(i: number): string {
    const hit = this.dateCache.get(i);
    if (hit) return hit;
    // Smallest dn whose working days up to and including it exceed i.
    let lo = EPOCH + Math.floor((i * 7) / this.perWeek) - 14;
    let hi = EPOCH + Math.floor(((i + 1) * 7) / this.perWeek) + 14 + Math.ceil((this.hols.length * 7) / this.perWeek);
    while (this.before(lo + 1) > i) lo -= 366;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (this.before(mid + 1) > i) hi = mid;
      else lo = mid + 1;
    }
    const iso = isoOf(lo);
    if (this.dateCache.size > 20_000) this.dateCache.clear();
    this.dateCache.set(i, iso);
    return iso;
  }

  /** The date that closes a span ending at point p (the last day worked). */
  endDate(p: number): string {
    return this.date(p - 1);
  }

  /** Working days from the start of a through the end of b, inclusive of both. */
  span(aIso: string, bIso: string): number {
    return this.end(bIso) - this.start(aIso);
  }

  /** The working day n working days after iso (n may be negative). */
  add(iso: string, n: number): string {
    return this.date(this.start(iso) + n);
  }
}

/* ---------------------------------------------------------------------------
 * Presets
 * ------------------------------------------------------------------------- */

/** US federal holidays most contractors carry, observed on the nearest weekday. */
export function usHolidays(year: number): string[] {
  const iso = (m: number, d: number) => `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const observed = (m: number, d: number) => {
    const s = iso(m, d);
    const w = weekday(s);
    return w === 6 ? isoOf(dayNum(s) - 1) : w === 0 ? isoOf(dayNum(s) + 1) : s;
  };
  const nth = (m: number, wd: number, n: number) => {
    const first = weekday(iso(m, 1));
    return iso(m, 1 + ((wd - first + 7) % 7) + (n - 1) * 7);
  };
  const lastMon = (m: number) => {
    const days = new Date(Date.UTC(year, m, 0)).getUTCDate();
    const w = weekday(iso(m, days));
    return iso(m, days - ((w - 1 + 7) % 7));
  };
  return [observed(1, 1), lastMon(5), observed(7, 4), nth(9, 1, 1), nth(11, 4, 4), observed(12, 25)].sort();
}

export function holidaysFor(from: number, to: number): string[] {
  const out: string[] = [];
  for (let y = from; y <= to; y++) out.push(...usHolidays(y));
  return out;
}

export type CalendarPreset = "5day" | "6day" | "7day";

export const CALENDAR_PRESETS: Record<CalendarPreset, { label: string; hint: string; make: (from: number, to: number) => CalendarDef }> = {
  "5day": {
    label: "5-day week with holidays",
    hint: "Monday to Friday, less six US holidays",
    make: (a, b) => ({ name: "5-day week with holidays", week: [false, true, true, true, true, true, false], holidays: holidaysFor(a, b) }),
  },
  "6day": {
    label: "6-day week with holidays",
    hint: "Monday to Saturday, for shutdown and cutover work",
    make: (a, b) => ({ name: "6-day week with holidays", week: [false, true, true, true, true, true, true], holidays: holidaysFor(a, b) }),
  },
  "7day": {
    label: "7-day week",
    hint: "Every calendar day, for vendor lead times",
    make: () => ({ name: "7-day week", week: [true, true, true, true, true, true, true], holidays: [] }),
  },
};

export const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function describeCalendar(c: CalendarDef): string {
  const days = c.week.map((on, i) => (on ? WEEKDAY_NAMES[i] : null)).filter(Boolean);
  const run = days.length === 5 && c.week.slice(1, 6).every(Boolean) ? "Mon–Fri" : days.length === 6 && c.week.slice(1).every(Boolean) ? "Mon–Sat" : days.length === 7 ? "7 days" : days.join(", ");
  return `${run}${c.holidays.length ? ` · ${c.holidays.length} ${c.holidays.length === 1 ? "holiday" : "holidays"}` : ""}`;
}
