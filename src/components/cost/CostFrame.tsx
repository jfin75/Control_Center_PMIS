"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Download } from "lucide-react";
import { IconButton, RouteTabs } from "@/components/ui/controls";
import { PageHeader } from "@/components/ui/Panel";
import { usePrefs } from "@/lib/prefs";
import { DEFAULT_RBAC } from "@/mock/workspace";
import { PROJECTS } from "@/mock/projects";
import { EmptyState } from "@/components/ui/data";
import { ShieldCheck } from "lucide-react";

const TABS = [
  { href: "/cost/", label: "Summary" },
  { href: "/cost/budget/", label: "Budget Details" },
  { href: "/cost/forecasts/", label: "Forecasts" },
  { href: "/cost/actuals/", label: "Actual Costs" },
  { href: "/cost/cash-flow/", label: "Cash Flow" },
];

/** Selected project for every Cost view, carried in the URL so views deep-link and tabs keep context. */
export function useProjectParam(): [string | "all", (id: string | "all") => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const id = params.get("project");
  const valid = id && PROJECTS.some((p) => p.id === id) ? id : "all";
  const set = (next: string | "all") => {
    const sp = new URLSearchParams(params.toString());
    if (next === "all") sp.delete("project");
    else sp.set("project", next);
    router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`, { scroll: false });
  };
  return [valid, set];
}

export function CostFrame({ children, onExport }: { children: ReactNode; onExport?: () => void }) {
  return (
    <Suspense>
      <Inner onExport={onExport}>{children}</Inner>
    </Suspense>
  );
}

function Inner({ children, onExport }: { children: ReactNode; onExport?: () => void }) {
  const pathname = usePathname() ?? "";
  const [project, setProject] = useProjectParam();
  const { prefs } = usePrefs();
  const q = project === "all" ? "" : `?project=${project}`;
  const norm = pathname.endsWith("/") ? pathname : `${pathname}/`;
  const canView = (DEFAULT_RBAC[prefs.role]?.Cost ?? []).includes("View");

  return (
    <>
      <PageHeader
        title="Cost"
        meta="Workday Financials synced today at 06:00 · figures follow the Owner’s budget chain A–K"
        actions={
          <>
            <label htmlFor="cost-project" className="sr-only">
              Project
            </label>
            <select id="cost-project" className="field w-full max-w-[22rem] min-w-0 sm:w-auto" value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="all">All active projects ({PROJECTS.length})</option>
              {PROJECTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
            {onExport && (
              <IconButton label="Export this view (CSV)" variant="tint" onClick={onExport}>
                <Download className="size-4" aria-hidden />
              </IconButton>
            )}
          </>
        }
      />
      <RouteTabs label="Cost views" tabs={TABS.map((t) => ({ href: `${t.href}${q}`, label: t.label, active: norm === t.href }))} />
      {canView ? (
        children
      ) : (
        <div className="panel">
          <EmptyState icon={<ShieldCheck className="size-5" aria-hidden />} title={`Cost is not available to the ${prefs.role} role`}>
            Switch roles from the account menu to preview another permission set, or ask a Settings administrator for access.
          </EmptyState>
        </div>
      )}
    </>
  );
}
