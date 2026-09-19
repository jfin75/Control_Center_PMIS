"use client";

import { useEffect, useId, useState } from "react";
import { CalendarPlus, X } from "lucide-react";
import { Button } from "@/components/ui/controls";
import { Modal, toast } from "@/components/ui/overlay";
import { fmtDate } from "@/lib/format";
import { describeCalendar, holidaysFor, isoValid, WEEKDAY_NAMES } from "@/lib/schedule/calendar";
import { captureBaseline, clearBaseline, compute, progressAsPlanned } from "@/lib/schedule/cpm";
import type { Schedule } from "@/lib/schedule/types";
import { Field, plural } from "./parts";
import { useOpenSchedule } from "./state";

/** Schedule-level settings: name, dates, calendar, baseline, and the monthly progress step. Edits a draft; Save writes one undo step. */
export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { s, edit } = useOpenSchedule();
  const [d, setD] = useState<Schedule>(s);
  const [holiday, setHoliday] = useState("");
  const [advance, setAdvance] = useState("");
  const [blName, setBlName] = useState(s.baselineName ?? `Baseline ${fmtDate(s.dataDate, "month")}`);
  const id = useId();
  // Start each opening from the schedule as it is now, not as it was when the dialog last closed.
  useEffect(() => {
    if (!open) return;
    setD(s);
    setBlName(s.baselineName ?? `Baseline ${fmtDate(s.dataDate, "month")}`);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const patch = (p: Partial<Schedule>) => setD((x) => ({ ...x, ...p }));
  const years = [Number(d.start.slice(0, 4)), Number(compute(d).finish.slice(0, 4))];
  const hasBl = d.acts.some((a) => a.bl);
  const valid = isoValid(d.dataDate) && isoValid(d.start) && d.name.trim() && d.calendar.week.some(Boolean);

  return (
    <Modal
      open={open}
      onClose={() => {
        setD(s);
        onClose();
      }}
      title="Dates, calendar, and baseline"
      description={`${s.name} · ${plural(s.acts.length, "activity", "activities")}`}
      className="w-[min(44rem,calc(100vw-2rem))]"
    >
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Version name" htmlFor={`${id}-name`} className="sm:col-span-2">
            <input id={`${id}-name`} className="field w-full" value={d.name} onChange={(e) => patch({ name: e.target.value })} />
          </Field>
          <Field label="Data date" htmlFor={`${id}-dd`} hint="Progress is reported up to the start of this day.">
            <input id={`${id}-dd`} type="date" className="field w-full" value={d.dataDate} onChange={(e) => e.target.value && patch({ dataDate: e.target.value })} />
          </Field>
          <Field label="Planned start" htmlFor={`${id}-start`} hint="Nothing without a predecessor starts before it.">
            <input id={`${id}-start`} type="date" className="field w-full" value={d.start} onChange={(e) => e.target.value && patch({ start: e.target.value })} />
          </Field>
          <Field label="Contract completion" htmlFor={`${id}-deadline`} hint="Float is measured against it. Leave blank to measure against the calculated finish.">
            <input id={`${id}-deadline`} type="date" className="field w-full" value={d.deadline ?? ""} onChange={(e) => patch({ deadline: e.target.value || null })} />
          </Field>
        </section>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold text-ink">Calendar</h3>
            <span className="text-xs text-ink-3">{describeCalendar(d.calendar)}</span>
          </div>
          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold text-ink-2">Working days</legend>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_NAMES.map((n, i) => (
                <label key={n} className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-line-strong px-2.5 py-1 text-sm has-checked:border-accent has-checked:bg-accent-tint has-checked:text-accent-ink">
                  <input
                    type="checkbox"
                    className="accent-[var(--accent)]"
                    checked={d.calendar.week[i]}
                    onChange={(e) => {
                      const week = [...d.calendar.week] as Schedule["calendar"]["week"];
                      week[i] = e.target.checked;
                      patch({ calendar: { ...d.calendar, week } });
                    }}
                  />
                  {n}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-ink-2">Holidays and non-working days</p>
            {d.calendar.holidays.length ? (
              <ul className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                {d.calendar.holidays.map((h) => (
                  <li key={h} className="num inline-flex items-center gap-1 rounded-sm bg-sunk py-0.5 pr-1 pl-2 text-xs text-ink-2">
                    {fmtDate(h)}
                    <button type="button" aria-label={`Remove ${fmtDate(h)}`} className="inline-flex size-4 items-center justify-center rounded-xs text-ink-3 hover:bg-line hover:text-ink" onClick={() => patch({ calendar: { ...d.calendar, holidays: d.calendar.holidays.filter((x) => x !== h) } })}>
                      <X className="size-3" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-ink-3">None. Every working weekday counts.</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label htmlFor={`${id}-hol`} className="sr-only">
                Add a non-working day
              </label>
              <input id={`${id}-hol`} type="date" className="field h-7 text-xs" value={holiday} onChange={(e) => setHoliday(e.target.value)} />
              <Button
                size="sm"
                disabled={!isoValid(holiday)}
                onClick={() => {
                  patch({ calendar: { ...d.calendar, holidays: [...new Set([...d.calendar.holidays, holiday])].sort() } });
                  setHoliday("");
                }}
              >
                Add day
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<CalendarPlus className="size-3.5" aria-hidden />}
                onClick={() => patch({ calendar: { ...d.calendar, holidays: [...new Set([...d.calendar.holidays, ...holidaysFor(years[0]!, years[1]! + 1)])].sort() } })}
              >
                Add US holidays {years[0]}–{years[1]! + 1}
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-ink">Baseline</h3>
          <p className="text-sm text-ink-2">
            {hasBl ? (
              <>
                The baseline is <span className="font-semibold text-ink">{d.baselineName ?? "unnamed"}</span>. Setting a new one replaces it on every activity.
              </>
            ) : (
              "There's no baseline yet. Set one to measure variance and run the baseline execution checks."
            )}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Baseline name" htmlFor={`${id}-bl`} className="min-w-56 flex-1">
              <input id={`${id}-bl`} className="field w-full" value={blName} onChange={(e) => setBlName(e.target.value)} />
            </Field>
            <Button
              onClick={() => {
                setD((x) => captureBaseline(x, blName.trim() || "Baseline"));
                toast("Baseline set from the current dates. Save to keep it.");
              }}
            >
              Set from current dates
            </Button>
            {hasBl && (
              <Button variant="ghost" onClick={() => setD((x) => clearBaseline(x))}>
                Clear
              </Button>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-ink">Update progress</h3>
          <p className="text-sm text-ink-2">Move the data date and status everything as planned: work scheduled to be done gets actual dates, work under way keeps only what’s left. Then correct the exceptions activity by activity.</p>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="New data date" htmlFor={`${id}-adv`}>
              <input id={`${id}-adv`} type="date" className="field" min={d.dataDate} value={advance} onChange={(e) => setAdvance(e.target.value)} />
            </Field>
            <Button
              disabled={!isoValid(advance) || advance <= d.dataDate}
              onClick={() => {
                setD((x) => progressAsPlanned(x, advance));
                toast(`Statused as planned through ${fmtDate(advance)}. Save to keep it.`);
                setAdvance("");
              }}
            >
              Status as planned
            </Button>
          </div>
        </section>
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
        <Button
          variant="ghost"
          onClick={() => {
            setD(s);
            onClose();
          }}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={!valid}
          onClick={() => {
            edit({ ...d, name: d.name.trim() });
            onClose();
            toast("Schedule settings saved");
          }}
        >
          Save
        </Button>
      </div>
    </Modal>
  );
}
