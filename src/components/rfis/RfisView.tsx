"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Download, Plus, RotateCcw } from "lucide-react";
import { Chip, KpiStrip } from "@/components/ui/data";
import { Button, IconButton, Tabs } from "@/components/ui/controls";
import { Drawer, toast } from "@/components/ui/overlay";
import { PageHeader } from "@/components/ui/Panel";
import { deleteFiles } from "@/lib/attachments";
import { fmtDate, money, pct } from "@/lib/format";
import { useStoredState } from "@/lib/prefs";
import { EMPTY_STORE, hasImpact, kpis, merged, rowsOf, STAGES, storedFileIds, type Row, type Store } from "@/lib/rfis";
import { CURRENT_USER_ID, TODAY } from "@/mock/org";
import { projectById } from "@/mock/projects";
import { RFI_PROJECT_IDS, RFIS, type Rfi, type Who } from "@/mock/rfis";
import { Dashboard } from "./Dashboard";
import { exportRows } from "./export";
import { Impacts } from "./Impacts";
import { Log } from "./Log";
import { NewRfi } from "./NewRfi";
import { plural } from "./parts";
import { Queues } from "./Queues";
import { RfiDetail } from "./RfiDetail";
import { RfisContext, type DetailTab, type Queue, type RfisCtl, type Tab } from "./state";

const TAB_IDS: Tab[] = ["dashboard", "log", "queues", "impacts"];
const DETAIL_TABS: DetailTab[] = ["thread", "files", "details"];

const lastRequest = (x: Row) => [...x.r.entries].reverse().find((e) => e.kind === "request")?.date ?? "";

const QUEUE_SORT: Record<Queue, (a: Row, b: Row) => number> = {
  awaiting: (a, b) => a.r.due!.localeCompare(b.r.due!) || a.r.seq - b.r.seq,
  answered: (a, b) => a.answeredOn!.localeCompare(b.answeredOn!) || a.r.seq - b.r.seq,
  info: (a, b) => lastRequest(a).localeCompare(lastRequest(b)),
  draft: (a, b) => b.r.created.localeCompare(a.r.created),
};

export function RfisView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [store, setStore] = useStoredState<Store>("cc.rfis.v1", EMPTY_STORE);
  const [adding, setAdding] = useState(false);

  const rfis = useMemo(() => merged(store), [store]);
  const allRows = useMemo(() => rowsOf(rfis), [rfis]);

  const projectParam = params.get("project");
  const project = projectParam && RFI_PROJECT_IDS.includes(projectParam) ? projectParam : "all";
  const tabParam = params.get("tab") as Tab | null;
  const tab: Tab = tabParam && TAB_IDS.includes(tabParam) ? tabParam : "dashboard";
  const rfiId = params.get("rfi");
  const viewParam = params.get("view") as DetailTab | null;
  const detailTab: DetailTab = viewParam && DETAIL_TABS.includes(viewParam) ? viewParam : "thread";

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

  const rows = useMemo(() => (project === "all" ? allRows : allRows.filter((x) => x.r.projectId === project)), [allRows, project]);
  const rowById = useMemo(() => new Map(allRows.map((x) => [x.r.id, x])), [allRows]);

  const save = useCallback(
    (...list: Rfi[]) => setStore((st) => ({ rfis: { ...st.rfis, ...Object.fromEntries(list.map((r) => [r.id, r])) } })),
    [setStore],
  );

  const ctl: RfisCtl = {
    rfis,
    allRows,
    rows,
    rowById,
    project,
    setProject: (id) => update({ project: id === "all" ? null : id }),
    setTab: (t) => update({ tab: t === "dashboard" ? null : t }),
    openRfi: (id, view) => update({ rfi: id, view: view && view !== "thread" ? view : null }),
    openNew: () => setAdding(true),
    save,
    remove: (id) => {
      setStore((st) => {
        const next = { ...st.rfis };
        if (RFIS.some((r) => r.id === id)) next[id] = null;
        else delete next[id];
        return { rfis: next };
      });
      update({ rfi: null, view: null });
    },
    me: (projectId) => {
      const p = projectById(projectId);
      const onTeam = p?.team.some((t) => t.kind === "staff" && t.refId === CURRENT_USER_ID);
      return { kind: "staff", id: onTeam || !p ? CURRENT_USER_ID : p.pmId } satisfies Who;
    },
    queue: (q) => rows.filter((x) => x.stage === q).sort(QUEUE_SORT[q]),
  };

  const k = kpis(rows);
  const detail = rfiId ? (rowById.get(rfiId) ?? null) : null;
  const changed = Object.keys(store.rfis).length;
  const p = project === "all" ? null : projectById(project)!;
  const thisMonth = rows.filter((x) => x.r.closed && x.stage === "closed" && x.r.closed.slice(0, 7) === TODAY.slice(0, 7)).length;

  return (
    <RfisContext.Provider value={ctl}>
      <PageHeader
        title="RFIs"
        meta={
          p
            ? `${p.code} · ${p.name} · ${plural(k.issued, "RFI")} issued · as of ${fmtDate(TODAY)}`
            : `${RFI_PROJECT_IDS.length} project logs · ${plural(k.issued, "RFI")} issued · response times per Division 01 · as of ${fmtDate(TODAY)}`
        }
        actions={
          <>
            <label htmlFor="rfis-project" className="sr-only">
              Project
            </label>
            <select id="rfis-project" className="field w-full max-w-[22rem] min-w-0 sm:w-auto" value={project} onChange={(e) => ctl.setProject(e.target.value)}>
              <option value="all">All projects with RFI logs ({RFI_PROJECT_IDS.length})</option>
              {RFI_PROJECT_IDS.map((id) => {
                const x = projectById(id)!;
                return (
                  <option key={id} value={id}>
                    {x.code} · {x.name}
                  </option>
                );
              })}
            </select>
            <Button variant="primary" icon={<Plus className="size-3.5" aria-hidden />} onClick={() => setAdding(true)}>
              New RFI
            </Button>
            <IconButton label="Export the RFI log (CSV)" variant="tint" onClick={() => exportRows(rows, p ? p.code : "all")}>
              <Download className="size-4" aria-hidden />
            </IconButton>
            {changed > 0 && (
              <IconButton
                label="Reset to the seeded RFI logs"
                onClick={() => {
                  const ids = storedFileIds(rfis);
                  setStore(EMPTY_STORE);
                  update({ rfi: null, view: null });
                  void deleteFiles(ids).catch(() => undefined);
                  toast("RFI logs reset to the seeded data");
                }}
              >
                <RotateCcw className="size-4" aria-hidden />
              </IconButton>
            )}
          </>
        }
      />

      <KpiStrip
        className="mb-5"
        items={[
          {
            label: "Open",
            accent: STAGES.awaiting.color,
            value: k.open,
            chip: k.overdue ? <Chip tone="neg">{k.overdue} overdue</Chip> : undefined,
            sub: `${k.awaiting} awaiting response · ${k.info} with the contractor`,
          },
          {
            label: "Answered, not closed",
            accent: STAGES.answered.color,
            value: k.answered,
            chip: k.answeredStale ? <Chip tone="warn">{k.answeredStale} over a week</Chip> : undefined,
            sub: "Waiting on the Owner to close or return",
          },
          {
            label: "Closed",
            accent: STAGES.closed.color,
            value: k.closed,
            sub: `${pct(k.pctClosed)} of issued · ${thisMonth} this month`,
          },
          {
            label: "Avg response time",
            value: `${k.avgReview.toFixed(1)} d`,
            chip: <Chip tone={k.onTimeRate >= 0.7 ? "pos" : "warn"}>{pct(k.onTimeRate)} on time</Chip>,
            sub: `Reviewer days to answer · ${plural(k.recentAnswers, "answer")} in the last 90 days`,
          },
          {
            label: "Cost exposure",
            accent: "var(--c-coral-500)",
            value: money(k.exposure, { compact: true }),
            chip: k.unlinked ? <Chip tone="neg">{k.unlinked} without PCO</Chip> : undefined,
            sub: `${plural(rows.filter(hasImpact).length, "RFI")} · ${plural(k.scheduleDays, "schedule day")} claimed`,
          },
        ]}
      />

      <div className="mb-5">
        <Tabs
          idBase="rfis"
          label="RFI tools"
          value={tab}
          onChange={ctl.setTab}
          tabs={[
            { value: "dashboard", label: "Dashboard" },
            { value: "log", label: `Log · ${rows.length - k.voided}` },
            { value: "queues", label: `Work queues · ${k.open + k.answered}` },
            { value: "impacts", label: `Impacts · ${rows.filter(hasImpact).length}` },
          ]}
        />
      </div>

      <div id="rfis-panel" role="tabpanel" aria-labelledby={`rfis-tab-${tab}`}>
        {tab === "dashboard" && <Dashboard />}
        {tab === "log" && <Log />}
        {tab === "queues" && <Queues />}
        {tab === "impacts" && <Impacts />}
      </div>

      <Drawer open={!!detail} onClose={() => update({ rfi: null, view: null })} label="RFI detail" modal width="w-[min(46rem,100vw)]">
        {detail && <RfiDetail key={detail.r.id} x={detail} tab={detailTab} onTab={(v) => update({ view: v === "thread" ? null : v })} onClose={() => update({ rfi: null, view: null })} />}
      </Drawer>

      <NewRfi open={adding} onClose={() => setAdding(false)} />
    </RfisContext.Provider>
  );
}
