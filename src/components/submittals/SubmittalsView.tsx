"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Download, PackagePlus, Plus, RotateCcw } from "lucide-react";
import { Chip, KpiStrip } from "@/components/ui/data";
import { Button, IconButton, Tabs } from "@/components/ui/controls";
import { Drawer, toast } from "@/components/ui/overlay";
import { PageHeader } from "@/components/ui/Panel";
import { downloadCsv } from "@/lib/exporters";
import { addDays, fmtDate, pct } from "@/lib/format";
import { useStoredState } from "@/lib/prefs";
import {
  BUCKETS,
  EMPTY_STORE,
  STATUS,
  kpis,
  merged,
  packageRow,
  partyName,
  recordReview,
  rowsOf,
  type Store,
} from "@/lib/submittals";
import { TODAY } from "@/mock/org";
import { projectById } from "@/mock/projects";
import { REGISTER_PROJECT_IDS, REVIEW_ACTIONS, SUBMITTAL_PACKAGES } from "@/mock/submittals";
import { AddItem } from "./AddItem";
import { Dashboard } from "./Dashboard";
import { ItemDetail } from "./ItemDetail";
import { PackageBuilder } from "./PackageBuilder";
import { PackageDetail, Packages } from "./Packages";
import { Register } from "./Register";
import { ReviewQueue } from "./ReviewQueue";
import { plural } from "./parts";
import { SubmittalsContext, type BuilderInit, type ItemTab, type SubmittalsCtl, type Tab } from "./state";

const TAB_IDS: Tab[] = ["dashboard", "register", "packages", "review"];

export function SubmittalsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [store, setStore] = useStoredState<Store>("cc.submittals.v1", EMPTY_STORE);
  const [builder, setBuilder] = useState<BuilderInit | null>(null);
  const [adding, setAdding] = useState(false);

  const { subs, pkgs } = useMemo(() => merged(store), [store]);
  const allRows = useMemo(() => rowsOf(subs, pkgs), [subs, pkgs]);

  const projectParam = params.get("project");
  const project = projectParam && REGISTER_PROJECT_IDS.includes(projectParam) ? projectParam : "all";
  const tabParam = params.get("tab") as Tab | null;
  const tab: Tab = tabParam && TAB_IDS.includes(tabParam) ? tabParam : "dashboard";
  const itemId = params.get("item");
  const itemTab = (params.get("view") as ItemTab | null) ?? "action";
  const pkgId = params.get("pkg");

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

  const rows = useMemo(() => (project === "all" ? allRows : allRows.filter((r) => r.s.projectId === project)), [allRows, project]);
  const rowById = useMemo(() => new Map(allRows.map((r) => [r.s.id, r])), [allRows]);
  const pkgById = useMemo(() => new Map(pkgs.map((p) => [p.id, p])), [pkgs]);
  const packageRows = useMemo(() => {
    const byId = new Map(subs.map((s) => [s.id, s]));
    return pkgs.map((p) => packageRow(p, byId));
  }, [pkgs, subs]);
  const queue = useMemo(
    () => rows.filter((r) => r.bucket === "open").sort((a, b) => a.last!.due.localeCompare(b.last!.due) || a.last!.submitted.localeCompare(b.last!.submitted)),
    [rows],
  );

  const commit = useCallback<SubmittalsCtl["commit"]>(
    ({ subs: s = [], pkgs: p = [], removePkg }) =>
      setStore((st) => {
        const nextPkgs: Store["pkgs"] = { ...st.pkgs, ...Object.fromEntries(p.map((x) => [x.id, x])) };
        if (removePkg) {
          if (SUBMITTAL_PACKAGES.some((b) => b.id === removePkg)) nextPkgs[removePkg] = null;
          else delete nextPkgs[removePkg];
        }
        return { subs: { ...st.subs, ...Object.fromEntries(s.map((x) => [x.id, x])) }, pkgs: nextPkgs };
      }),
    [setStore],
  );

  const ctl: SubmittalsCtl = {
    subs,
    pkgs,
    allRows,
    rows,
    rowById,
    pkgById,
    packageRows,
    project,
    setProject: (id) => update({ project: id === "all" ? null : id }),
    setTab: (t) => update({ tab: t === "dashboard" ? null : t }),
    openItem: (id, view) => update({ item: id, view: view && view !== "action" ? view : null, pkg: null }),
    openPackage: (id) => update({ pkg: id, item: null, view: null }),
    openBuilder: (init) => {
      update({ item: null, view: null, pkg: null });
      setBuilder(init);
    },
    openAdd: () => setAdding(true),
    commit,
    queue,
    recordReview: (id, input) => {
      const s = subs.find((x) => x.id === id);
      if (!s) return;
      const last = s.revisions[s.revisions.length - 1]!;
      const step = last.steps.findIndex((st) => !st.date);
      const next = recordReview(s, input);
      commit({ subs: [next] });
      const rev = next.revisions[next.revisions.length - 1]!;
      toast(
        rev.action
          ? `Returned to ${partyName({ kind: "firm", id: s.byId })}: ${REVIEW_ACTIONS[rev.action].label}`
          : `${REVIEW_ACTIONS[input.action].label} recorded for ${partyName(last.steps[step]!.party)}; forwarded to ${partyName(rev.steps[step + 1]!.party)}`,
      );
    },
  };

  const k = kpis(rows);
  const itemRow = itemId ? (rowById.get(itemId) ?? null) : null;
  const pkg = pkgId ? (pkgById.get(pkgId) ?? null) : null;
  const changed = Object.keys(store.subs).length + Object.keys(store.pkgs).length;
  const p = project === "all" ? null : projectById(project)!;
  const dueSoon = rows.filter((r) => r.bucket === "toSubmit" && r.late === 0 && r.submitBy <= addDays(TODAY, 30)).length;
  const pkgCount = packageRows.filter((r) => project === "all" || r.p.projectId === project).length;

  const exportCsv = () =>
    downloadCsv(
      `submittal-register-${p ? p.code : "all"}-${TODAY}.csv`,
      ["Project", "Spec section", "Section title", "Number", "Rev", "Title", "Type", "Responsible", "Status", "Ball in court", "Submit by", "First submitted", "Review due", "Returned", "Action", "Needed on site", "Lead (weeks)", "Float (days)", "Days late"],
      rows.map((r) => [
        projectById(r.s.projectId)!.code,
        r.s.section,
        r.s.sectionTitle,
        r.number,
        r.rev,
        r.s.title,
        r.s.type,
        partyName({ kind: "firm", id: r.s.byId }),
        STATUS[r.status].label,
        r.ball?.name ?? "",
        r.submitBy,
        r.s.revisions[0]?.submitted ?? "",
        r.last && !r.last.action ? r.last.due : "",
        r.last?.returned ?? "",
        r.last?.action ? `${r.last.action} — ${REVIEW_ACTIONS[r.last.action].label}` : "",
        r.s.requiredOnSite,
        r.s.leadWeeks,
        r.bucket === "closed" ? "" : r.float,
        r.late || "",
      ]),
    );

  return (
    <SubmittalsContext.Provider value={ctl}>
      <PageHeader
        title="Submittals"
        meta={
          p
            ? `${p.code} · ${p.name} · ${plural(k.total, "item")} on the register · as of ${fmtDate(TODAY)}`
            : `${REGISTER_PROJECT_IDS.length} project registers · ${plural(k.total, "item")} · review periods per Division 01 · as of ${fmtDate(TODAY)}`
        }
        actions={
          <>
            <label htmlFor="subs-project" className="sr-only">
              Project
            </label>
            <select id="subs-project" className="field w-full max-w-[22rem] min-w-0 sm:w-auto" value={project} onChange={(e) => ctl.setProject(e.target.value)}>
              <option value="all">All projects with registers ({REGISTER_PROJECT_IDS.length})</option>
              {REGISTER_PROJECT_IDS.map((id) => {
                const x = projectById(id)!;
                return (
                  <option key={id} value={id}>
                    {x.code} · {x.name}
                  </option>
                );
              })}
            </select>
            <Button icon={<Plus className="size-3.5" aria-hidden />} onClick={() => setAdding(true)}>
              Add item
            </Button>
            <Button variant="primary" icon={<PackagePlus className="size-3.5" aria-hidden />} onClick={() => ctl.openBuilder({ projectId: project === "all" ? undefined : project })}>
              New package
            </Button>
            <IconButton label="Export the register (CSV)" variant="tint" onClick={exportCsv}>
              <Download className="size-4" aria-hidden />
            </IconButton>
            {changed > 0 && (
              <IconButton
                label="Reset to the seeded register"
                onClick={() => {
                  setStore(EMPTY_STORE);
                  toast("Register reset to the seeded data");
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
            label: "Total open",
            accent: BUCKETS.open.color,
            value: k.open,
            chip: k.openOverdue ? <Chip tone="neg">{k.openOverdue} overdue</Chip> : undefined,
            sub: k.open ? `In review, ${k.avgDaysInReview.toFixed(0)} days on average` : "Nothing in review",
          },
          {
            label: "Total remaining",
            value: k.remaining,
            sub: `Not yet closed, of ${k.total} on the register`,
          },
          {
            label: "Total rejected",
            accent: BUCKETS.rejected.color,
            value: k.rejected,
            chip: k.rejectedLate ? <Chip tone="neg">{k.rejectedLate} late</Chip> : undefined,
            sub: `${k.rejectedHard} rejected, ${k.rejected - k.rejectedHard} revise & resubmit · ${k.returnsRejected} returns rejected to date`,
          },
          {
            label: "To be submitted",
            accent: BUCKETS.toSubmit.color,
            value: k.toSubmit,
            chip: k.toSubmitLate ? <Chip tone="warn">{k.toSubmitLate} late</Chip> : undefined,
            sub: `${dueSoon} due to submit in the next 30 days`,
          },
          {
            label: "Percent complete",
            accent: BUCKETS.closed.color,
            value: pct(k.pctComplete),
            sub: `${k.closed} closed · ${pct(k.firstPass)} approved on first submittal`,
          },
        ]}
      />

      <div className="mb-5">
        <Tabs
          idBase="subs"
          label="Submittal tools"
          value={tab}
          onChange={ctl.setTab}
          tabs={[
            { value: "dashboard", label: "Dashboard" },
            { value: "register", label: `Register · ${rows.length}` },
            { value: "packages", label: `Packages · ${pkgCount}` },
            { value: "review", label: `Review queue · ${queue.length}` },
          ]}
        />
      </div>

      <div id="subs-panel" role="tabpanel" aria-labelledby={`subs-tab-${tab}`}>
        {tab === "dashboard" && <Dashboard />}
        {tab === "register" && <Register />}
        {tab === "packages" && <Packages />}
        {tab === "review" && <ReviewQueue />}
      </div>

      <Drawer open={!!itemRow} onClose={() => update({ item: null, view: null })} label="Submittal detail" modal width="w-[min(46rem,100vw)]">
        {itemRow && <ItemDetail key={`${itemRow.s.id}:${itemRow.s.revisions.length}:${itemRow.last?.steps.filter((s) => s.date).length ?? 0}`} r={itemRow} tab={itemTab} onTab={(v) => update({ view: v === "action" ? null : v })} onClose={() => update({ item: null, view: null })} />}
      </Drawer>

      <Drawer open={!!pkg && !itemRow} onClose={() => update({ pkg: null })} label="Submittal package" modal width="w-[min(46rem,100vw)]">
        {pkg && <PackageDetail key={pkg.id + (pkg.transmitted ?? "")} pkg={pkg} onClose={() => update({ pkg: null })} />}
      </Drawer>

      <Drawer open={!!builder} onClose={() => setBuilder(null)} label="Submittal package builder" modal width="w-[min(48rem,100vw)]">
        {builder && <PackageBuilder init={builder} onClose={() => setBuilder(null)} />}
      </Drawer>

      <AddItem open={adding} onClose={() => setAdding(false)} />
    </SubmittalsContext.Provider>
  );
}
