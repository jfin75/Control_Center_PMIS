"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { FilePlus2, GitPullRequestArrow, RotateCcw } from "lucide-react";
import { Chip, KpiStrip } from "@/components/ui/data";
import { Button, IconButton, Tabs } from "@/components/ui/controls";
import { Drawer, toast } from "@/components/ui/overlay";
import { PageHeader } from "@/components/ui/Panel";
import { deleteFiles } from "@/lib/attachments";
import { EMPTY_STORE, isMaster, isPending, isSeededContract, isSeededMod, kpis, mergedContracts, mergedMods, rowsOf, STATUS, storedFileIds, type Store } from "@/lib/contracts";
import { fmtDate, money, pct } from "@/lib/format";
import { useStoredState } from "@/lib/prefs";
import { TEMPLATES, type Contract, type Mod } from "@/mock/contracts";
import { CURRENT_USER_ID, TODAY } from "@/mock/org";
import { projectById, PROJECTS } from "@/mock/projects";
import { Changes } from "./Changes";
import { ContractDetail } from "./ContractDetail";
import { ContractForm } from "./ContractForm";
import { ModDetail } from "./ModDetail";
import { ModForm } from "./ModForm";
import { plural } from "./parts";
import { Register } from "./Register";
import { ContractsContext, type ContractsCtl, type DetailTab, type FormStart, type ModStart, type Tab } from "./state";
import { Templates } from "./Templates";

const TAB_IDS: Tab[] = ["register", "changes", "templates"];
const DETAIL_TABS: DetailTab[] = ["summary", "document", "exhibits", "changes", "signing", "history"];

export function ContractsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [store, setStore] = useStoredState<Store>("cc.contracts.v1", EMPTY_STORE);
  const [form, setForm] = useState<FormStart | null>(null);
  const [modForm, setModForm] = useState<ModStart | null>(null);

  const contracts = useMemo(() => mergedContracts(store), [store]);
  const mods = useMemo(() => mergedMods(store), [store]);
  const allRows = useMemo(() => rowsOf(contracts, mods), [contracts, mods]);

  const projectParam = params.get("project");
  const project = projectParam && PROJECTS.some((p) => p.id === projectParam) ? projectParam : "all";
  const tabParam = params.get("tab") as Tab | null;
  const tab: Tab = tabParam && TAB_IDS.includes(tabParam) ? tabParam : "register";
  const contractId = params.get("contract");
  const modId = params.get("mod");
  const viewParam = params.get("view") as DetailTab | null;
  const detailTab: DetailTab = viewParam && DETAIL_TABS.includes(viewParam) ? viewParam : "summary";

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

  // A project view keeps the masters its orders release under, so the ceiling stays in sight.
  const rows = useMemo(() => {
    if (project === "all") return allRows;
    const mine = allRows.filter((r) => r.c.projectId === project);
    const parents = new Set(mine.map((r) => r.c.parentId).filter(Boolean));
    return allRows.filter((r) => r.c.projectId === project || parents.has(r.c.id));
  }, [allRows, project]);
  const rowById = useMemo(() => new Map(allRows.map((r) => [r.c.id, r])), [allRows]);
  const allModRows = useMemo(() => allRows.flatMap((r) => r.mods), [allRows]);
  const modRows = useMemo(() => (project === "all" ? allModRows : allModRows.filter((x) => x.c.projectId === project)), [allModRows, project]);
  const modById = useMemo(() => new Map(allModRows.map((x) => [x.m.id, x])), [allModRows]);

  const me = useMemo(() => ({ kind: "staff" as const, id: CURRENT_USER_ID }), []);

  const ctl: ContractsCtl = {
    contracts,
    mods,
    allRows,
    rows,
    rowById,
    modRows,
    modById,
    project,
    setProject: (id) => update({ project: id === "all" ? null : id }),
    setTab: (t) => update({ tab: t === "register" ? null : t }),
    openContract: (id, view) => update({ contract: id, mod: null, view: view && view !== "summary" ? view : null }),
    openMod: (id) => update({ mod: id, contract: null, view: null }),
    startContract: (s) => setForm(s ?? {}),
    startMod: (s) => setModForm(s ?? {}),
    saveContracts: (...list: Contract[]) => setStore((st) => ({ ...st, contracts: { ...st.contracts, ...Object.fromEntries(list.map((c) => [c.id, c])) } })),
    saveMods: (...list: Mod[]) => setStore((st) => ({ ...st, mods: { ...st.mods, ...Object.fromEntries(list.map((m) => [m.id, m])) } })),
    removeContract: (id) => {
      setStore((st) => {
        const next = { ...st.contracts };
        if (isSeededContract(id)) next[id] = null;
        else delete next[id];
        return { ...st, contracts: next };
      });
      update({ contract: null, view: null });
    },
    removeMod: (id) => {
      setStore((st) => {
        const next = { ...st.mods };
        if (isSeededMod(id)) next[id] = null;
        else delete next[id];
        return { ...st, mods: next };
      });
      update({ mod: null });
    },
    me,
  };

  const k = kpis(rows);
  const p = project === "all" ? null : projectById(project)!;
  const detail = contractId ? (rowById.get(contractId) ?? null) : null;
  const modDetail = modId ? (modById.get(modId) ?? null) : null;
  const changed = Object.keys(store.contracts).length + Object.keys(store.mods).length;
  const openMods = modRows.filter((x) => isPending(x.m)).length;
  const workRows = rows.filter((r) => !isMaster(r));

  return (
    <ContractsContext.Provider value={ctl}>
      <PageHeader
        title="Contracts"
        meta={
          p
            ? `${p.code} · ${p.name} · ${plural(workRows.length, "contract")} · as of ${fmtDate(TODAY)}`
            : `${plural(rows.length, "contract")} across the program · ${TEMPLATES.length} Owner templates · as of ${fmtDate(TODAY)}`
        }
        actions={
          <>
            <label htmlFor="contracts-project" className="sr-only">
              Project
            </label>
            <select id="contracts-project" className="field w-full max-w-[22rem] min-w-0 sm:w-auto" value={project} onChange={(e) => ctl.setProject(e.target.value)}>
              <option value="all">All projects and master agreements</option>
              {PROJECTS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.code} · {x.name}
                </option>
              ))}
            </select>
            <Button icon={<GitPullRequestArrow className="size-3.5" aria-hidden />} onClick={() => ctl.startMod()}>
              New change
            </Button>
            <Button variant="primary" icon={<FilePlus2 className="size-3.5" aria-hidden />} onClick={() => ctl.startContract()}>
              New contract
            </Button>
            {changed > 0 && (
              <IconButton
                label="Reset to the seeded contracts"
                onClick={() => {
                  const ids = storedFileIds(contracts, mods);
                  setStore(EMPTY_STORE);
                  update({ contract: null, mod: null, view: null });
                  void deleteFiles(ids).catch(() => undefined);
                  toast("Contracts reset to the seeded data");
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
            label: "Committed",
            accent: STATUS.executed.color,
            value: money(k.committed, { compact: true }),
            sub: `${plural(k.executed, "executed contract")} and orders · posts to Commitments (D)`,
          },
          {
            label: "Approved changes",
            accent: "var(--c-navy-500)",
            value: money(k.approved, { compact: true, signed: true }),
            chip: k.original ? <Chip tone={k.approved / k.original > 0.05 ? "warn" : "neutral"}>{pct(k.approved / k.original, 1)} of original</Chip> : undefined,
            sub: `${plural(k.approvedCount, "change order, ASR, or amendment", "change orders, ASRs, and amendments")} executed`,
          },
          {
            label: "Pending changes",
            accent: "var(--c-coral-500)",
            value: money(k.pending, { compact: true }),
            chip: k.pendingStale ? <Chip tone="neg">{k.pendingStale} over 30 days</Chip> : undefined,
            sub: `${plural(k.pendingCount, "open PCI, PR, CCD, CO, or ASR", "open PCIs, PRs, CCDs, COs, and ASRs")} · not yet in the contract value`,
          },
          {
            label: "In progress",
            accent: STATUS.review.color,
            value: k.inProgress,
            sub: `${k.byStatus.draft} draft · ${k.byStatus.review} in Legal review · ${k.byStatus.signature} out for signature`,
          },
          {
            label: "Master capacity left",
            accent: "var(--c-sky-400)",
            value: money(k.ceiling - k.released, { compact: true }),
            chip: k.mastersHot ? <Chip tone="warn">{k.mastersHot} above 80%</Chip> : undefined,
            sub: `${money(k.released, { compact: true })} released of ${money(k.ceiling, { compact: true })} across ${plural(k.masters, "master")}`,
          },
        ]}
      />

      <div className="mb-5">
        <Tabs
          idBase="contracts"
          label="Contract tools"
          value={tab}
          onChange={ctl.setTab}
          tabs={[
            { value: "register", label: `Register · ${rows.length}` },
            { value: "changes", label: `Changes · ${openMods} open` },
            { value: "templates", label: `Templates · ${TEMPLATES.length}` },
          ]}
        />
      </div>

      <div id="contracts-panel" role="tabpanel" aria-labelledby={`contracts-tab-${tab}`}>
        {tab === "register" && <Register />}
        {tab === "changes" && <Changes />}
        {tab === "templates" && <Templates />}
      </div>

      <Drawer open={!!detail} onClose={() => update({ contract: null, view: null })} label="Contract detail" modal width="w-[min(50rem,100vw)]">
        {detail && <ContractDetail key={detail.c.id} r={detail} tab={detailTab} onTab={(v) => update({ view: v === "summary" ? null : v })} onClose={() => update({ contract: null, view: null })} />}
      </Drawer>
      <Drawer open={!!modDetail} onClose={() => update({ mod: null })} label="Change detail" modal width="w-[min(44rem,100vw)]">
        {modDetail && <ModDetail key={modDetail.m.id} x={modDetail} onClose={() => update({ mod: null })} />}
      </Drawer>

      <ContractForm start={form} onClose={() => setForm(null)} />
      <ModForm start={modForm} onClose={() => setModForm(null)} />
    </ContractsContext.Provider>
  );
}

