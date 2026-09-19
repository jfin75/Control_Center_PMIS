"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FilePlus2, RotateCcw, Upload } from "lucide-react";
import { Chip, KpiStrip } from "@/components/ui/data";
import { Button, IconButton, Tabs } from "@/components/ui/controls";
import { toast } from "@/components/ui/overlay";
import { PageHeader } from "@/components/ui/Panel";
import { daysBetween, fmtDate } from "@/lib/format";
import { useStoredState } from "@/lib/prefs";
import { compute } from "@/lib/schedule/cpm";
import { healthChecks, healthScore, worstFirst } from "@/lib/schedule/health";
import { currentOf, EMPTY_STORE, isSeeded, merged, STORE_KEY, STORE_WARN_SIZE, storeSize, versionsOf, type Store } from "@/lib/schedule/store";
import type { Schedule } from "@/lib/schedule/types";
import { TODAY } from "@/mock/org";
import { projectById, PROJECTS } from "@/mock/projects";
import { ActivityDrawer } from "./ActivityDrawer";
import { Gantt } from "./Gantt";
import { Health } from "./Health";
import { ImportDialog } from "./ImportDialog";
import { NewScheduleDialog } from "./NewScheduleDialog";
import { plural, shortDate, SOURCE_LABEL, Variance } from "./parts";
import { Program } from "./Program";
import { SettingsDialog } from "./SettingsDialog";
import { ScheduleContext, useOpenSchedule, type Focus, type ScheduleCtl, type Tab } from "./state";
import { Updates } from "./Updates";

const TAB_IDS: Tab[] = ["program", "gantt", "health", "updates"];
const HISTORY = 60;

export function ScheduleView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [store, setStore] = useStoredState<Store>(STORE_KEY, EMPTY_STORE);
  const [importing, setImporting] = useState(false);
  const [creating, setCreating] = useState<string | null | false>(false);
  const [settings, setSettings] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const hist = useRef<{ past: Schedule[]; future: Schedule[]; id: string | null }>({ past: [], future: [], id: null });
  const [, bump] = useState(0);

  const all = useMemo(() => merged(store), [store]);
  const projectParam = params.get("project");
  const project = projectParam && PROJECTS.some((p) => p.id === projectParam) ? projectParam : "all";
  const tabParam = params.get("tab") as Tab | null;
  const tab: Tab = tabParam && TAB_IDS.includes(tabParam) ? tabParam : project === "all" ? "program" : "gantt";
  const versions = useMemo(() => (project === "all" ? [] : versionsOf(all, project)), [all, project]);
  const current = project === "all" ? null : currentOf(all, store, project);
  const vParam = params.get("v");
  const s = versions.find((x) => x.id === vParam) ?? current;
  const r = useMemo(() => (s ? compute(s) : null), [s]);
  const detail = params.get("act");

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) sp.delete(k);
        else sp.set(k, v);
      }
      router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`, { scroll: false });
    },
    [params, pathname, router],
  );

  // Undo history belongs to one version; switching versions starts it fresh.
  if (hist.current.id !== (s?.id ?? null)) hist.current = { past: [], future: [], id: s?.id ?? null };

  const write = useCallback((next: Schedule) => setStore((st) => ({ ...st, schedules: { ...st.schedules, [next.id]: next } })), [setStore]);

  // localStorage holds about five million characters; say so before an import or edit silently fails to save.
  const warned = useRef(false);
  useEffect(() => {
    if (warned.current || storeSize(store) < STORE_WARN_SIZE) return;
    warned.current = true;
    toast("Saved schedules are close to this browser's storage limit. Delete old versions to make room.");
  }, [store]);

  useEffect(() => {
    setSelected(null);
    setFocus(null);
  }, [s?.id]);

  const ctl: ScheduleCtl = {
    all,
    project,
    setProject: (id) => update({ project: id === "all" ? null : id, v: null, act: null, tab: id === "all" ? null : tab === "program" ? null : tab }),
    gotoProject: (id, t) => update({ project: id, v: null, act: null, tab: t && t !== "gantt" ? t : null }),
    tab,
    setTab: (t) => update({ tab: t === (project === "all" ? "program" : "gantt") ? null : t, act: t === "gantt" ? detail : null }),
    s,
    r,
    versions,
    currentId: current?.id ?? null,
    currentFor: (pid) => currentOf(all, store, pid),
    openVersion: (id, t) => {
      const v = all.find((x) => x.id === id);
      if (!v) return;
      update({ project: v.projectId, v: id === currentOf(all, store, v.projectId)?.id ? null : id, tab: t && t !== "gantt" ? t : null, act: null });
    },
    makeCurrent: (id) => {
      const v = all.find((x) => x.id === id);
      if (!v) return;
      setStore((st) => ({ ...st, current: { ...st.current, [v.projectId]: id } }));
      toast(`${v.name} is now the current schedule for ${projectById(v.projectId)?.code ?? "the project"}`);
    },
    edit: (next) => {
      if (!s) return;
      const h = hist.current;
      h.past = [...h.past.slice(-HISTORY + 1), s];
      h.future = [];
      write({ ...next, updated: TODAY });
      bump((n) => n + 1);
    },
    add: (x, opts) => {
      setStore((st) => ({ schedules: { ...st.schedules, [x.id]: x }, current: opts?.current === false ? st.current : { ...st.current, [x.projectId]: x.id } }));
    },
    remove: (id) => {
      const v = all.find((x) => x.id === id);
      setStore((st) => {
        const schedules = { ...st.schedules };
        if (isSeeded(id)) schedules[id] = null;
        else delete schedules[id];
        const cur = { ...st.current };
        if (v && cur[v.projectId] === id) delete cur[v.projectId];
        return { schedules, current: cur };
      });
      if (s?.id === id) update({ v: null, act: null });
    },
    undo: () => {
      const h = hist.current;
      const prev = h.past.pop();
      if (!prev || !s) return;
      h.future.push(s);
      write(prev);
      bump((n) => n + 1);
    },
    redo: () => {
      const h = hist.current;
      const next = h.future.pop();
      if (!next || !s) return;
      h.past.push(s);
      write(next);
      bump((n) => n + 1);
    },
    canUndo: hist.current.past.length > 0,
    canRedo: hist.current.future.length > 0,
    selected,
    select: setSelected,
    detail,
    openDetail: (id) => {
      if (id) setSelected(id);
      update({ act: id });
    },
    focus,
    showInGantt: (f) => {
      setFocus(f);
      update({ tab: null, act: null });
    },
    startImport: () => setImporting(true),
    startNew: (pid) => setCreating(pid ?? (project === "all" ? null : project)),
    openSettings: () => setSettings(true),
  };

  const p = project === "all" ? null : projectById(project)!;
  const changed = Object.keys(store.schedules).length + Object.keys(store.current).length;

  return (
    <ScheduleContext.Provider value={ctl}>
      <PageHeader
        title="Schedule"
        meta={
          p && s
            ? `${p.code} · ${p.name} · ${s.name} · ${SOURCE_LABEL[s.source.kind]}${s.source.label ? ` ${s.source.label}` : ""} · data date ${fmtDate(s.dataDate)}`
            : p
              ? `${p.code} · ${p.name} · no detailed schedule yet`
              : `${plural(new Set(all.map((x) => x.projectId)).size, "project")} with detailed schedules · ${plural(all.length, "version")} · as of ${fmtDate(TODAY)}`
        }
        actions={
          <>
            <label htmlFor="schedule-project" className="sr-only">
              Project
            </label>
            <select id="schedule-project" className="field w-full max-w-[20rem] min-w-0 sm:w-auto" value={project} onChange={(e) => ctl.setProject(e.target.value)}>
              <option value="all">All projects</option>
              {PROJECTS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.code} · {x.name}
                </option>
              ))}
            </select>
            {versions.length > 1 && s && (
              <>
                <label htmlFor="schedule-version" className="sr-only">
                  Schedule version
                </label>
                <select id="schedule-version" className="field w-full max-w-[16rem] min-w-0 sm:w-auto" value={s.id} onChange={(e) => ctl.openVersion(e.target.value, tab)}>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                      {v.id === current?.id ? " (current)" : ""}
                    </option>
                  ))}
                </select>
              </>
            )}
            <Button icon={<Upload className="size-3.5" aria-hidden />} onClick={() => setImporting(true)}>
              Import
            </Button>
            <Button variant="primary" icon={<FilePlus2 className="size-3.5" aria-hidden />} onClick={() => ctl.startNew()}>
              New schedule
            </Button>
            {changed > 0 && (
              <IconButton
                label="Reset to the seeded schedules"
                onClick={() => {
                  setStore(EMPTY_STORE);
                  update({ v: null, act: null });
                  toast("Schedules reset to the seeded updates");
                }}
              >
                <RotateCcw className="size-4" aria-hidden />
              </IconButton>
            )}
          </>
        }
      />

      {p && s && r ? <ProjectKpis /> : null}

      {(p ? !!s : true) && (
        <div className="mb-5">
          <Tabs
            idBase="schedule"
            label="Schedule tools"
            value={tab}
            onChange={ctl.setTab}
            tabs={[
              { value: "program", label: "Program" },
              { value: "gantt", label: "Gantt" },
              { value: "health", label: "Health check" },
              { value: "updates", label: p ? `Updates · ${versions.length}` : "Updates" },
            ]}
          />
        </div>
      )}

      <div id="schedule-panel" role="tabpanel" aria-labelledby={`schedule-tab-${tab}`}>
        {tab === "program" && <Program />}
        {tab === "gantt" && <Gantt />}
        {tab === "health" && <Health />}
        {tab === "updates" && <Updates />}
      </div>

      <ActivityDrawer />
      <ImportDialog open={importing} onClose={() => setImporting(false)} />
      <NewScheduleDialog start={creating} onClose={() => setCreating(false)} />
      {s && <SettingsDialog key={s.id} open={settings} onClose={() => setSettings(false)} />}
    </ScheduleContext.Provider>
  );
}

function ProjectKpis() {
  const { s, r } = useOpenSchedule();
  const checks = healthChecks(s, r);
  const score = healthScore(checks);
  const open = r.list.filter((c) => c.status !== "complete");
  const lp = r.list.filter((c) => c.longest);
  const next = lp.filter((c) => c.status !== "complete").sort((a, b) => a.es - b.es)[0];
  const total = r.list.reduce((t, c) => t + Math.max(1, c.a.dur), 0);
  const pctDone = total ? Math.round(r.list.reduce((t, c) => t + c.pct * Math.max(1, c.a.dur), 0) / total) : 0;
  const bei = checks.find((c) => c.id === "bei");
  const slip = r.blFinish ? daysBetween(r.blFinish, r.finish) : null;
  const failing = worstFirst(checks);
  return (
    <KpiStrip
      className="mb-5"
      items={[
        {
          label: "Forecast finish",
          accent: "var(--c-sky-400)",
          value: fmtDate(r.finish, "short") + (r.finish.slice(0, 4) !== TODAY.slice(0, 4) ? `, ${r.finish.slice(0, 4)}` : ""),
          sub: r.blFinish ? (
            <>
              <Variance days={slip} /> against the {shortDate(r.blFinish)} baseline
            </>
          ) : (
            "No baseline set"
          ),
        },
        {
          label: s.deadline ? "Float to contract completion" : "Float to finish",
          accent: (r.finishFloat ?? 0) < 0 ? "var(--c-coral-500)" : "var(--c-teal-500)",
          value: r.finishFloat === null ? "—" : `${r.finishFloat < 0 ? "−" : ""}${Math.abs(r.finishFloat)} wd`,
          chip: (r.finishFloat ?? 0) < 0 ? <Chip tone="neg">Behind</Chip> : undefined,
          sub: s.deadline ? `Working days against ${shortDate(s.deadline)}` : "Set a contract completion date to measure float against it",
        },
        {
          label: "Longest path",
          accent: "var(--c-coral-500)",
          value: plural(lp.length, "activity", "activities"),
          sub: next ? `Next: ${next.a.code} ${next.a.name}` : "Nothing left open",
        },
        {
          label: "Progress",
          accent: "var(--c-teal-500)",
          value: `${pctDone}%`,
          chip: bei && !bei.na ? <Chip tone={bei.pass ? "pos" : "warn"}>BEI {bei.value}</Chip> : undefined,
          sub: `${plural(r.list.length - open.length, "activity", "activities")} complete, ${open.filter((c) => c.status === "active").length} in progress`,
        },
        {
          label: "Schedule health",
          accent: "var(--c-navy-500)",
          value: `${score.passed} of ${score.of}`,
          chip: failing.length ? <Chip tone={failing.length > 3 ? "neg" : "warn"}>{failing.length} failing</Chip> : <Chip tone="pos">Clean</Chip>,
          sub: failing.length ? failing.slice(0, 3).map((c) => c.label).join(", ") : "Every check passes",
        },
      ]}
    />
  );
}
