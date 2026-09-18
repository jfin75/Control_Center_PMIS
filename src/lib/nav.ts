import {
  Clock,
  FileCheck2,
  FileChartColumn,
  FolderKanban,
  Gavel,
  LayoutDashboard,
  Lightbulb,
  MapPinned,
  Settings,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  hint: string;
  module: string; // RBAC module key
  children?: Array<{ label: string; href: string; hint: string }>;
}

export const NAV: NavItem[] = [
  { label: "Portfolio", href: "/portfolio/", icon: MapPinned, hint: "Properties, map, leases", module: "Portfolio" },
  { label: "Dashboard", href: "/dashboard/", icon: LayoutDashboard, hint: "Executive widgets", module: "Portfolio" },
  { label: "Planning", href: "/planning/", icon: Lightbulb, hint: "Capital requests by stage gate", module: "Planning" },
  { label: "Projects", href: "/projects/", icon: FolderKanban, hint: "Active capital projects", module: "Projects" },
  { label: "Workload", href: "/workload/", icon: UsersRound, hint: "PM capacity and project assignments", module: "Projects" },
  { label: "Bidding", href: "/bidding/", icon: Gavel, hint: "Packages, leveling, awards", module: "Bidding" },
  { label: "Submittals", href: "/submittals/", icon: FileCheck2, hint: "Register, packages, reviews, resubmittals", module: "Projects" },
  {
    label: "Cost",
    href: "/cost/",
    icon: Wallet,
    hint: "Budget chain A–K",
    module: "Cost",
    children: [
      { label: "Summary", href: "/cost/", hint: "Executive rollup" },
      { label: "Budget Details", href: "/cost/budget/", hint: "Line items by cost code" },
      { label: "Forecasts", href: "/cost/forecasts/", hint: "EAC, ETC, contingency" },
      { label: "Actual Costs", href: "/cost/actuals/", hint: "Invoices and pay apps" },
      { label: "Cash Flow", href: "/cost/cash-flow/", hint: "S-curve and 12-month forecast" },
    ],
  },
  { label: "Reports", href: "/reports/", icon: FileChartColumn, hint: "Standard owner reports", module: "Reports" },
  { label: "Time Tracking", href: "/time/", icon: Clock, hint: "Weekly timesheet", module: "Time Tracking" },
  { label: "Settings", href: "/settings/", icon: Settings, hint: "Organization, roles, integrations", module: "Settings" },
];

export function isActive(pathname: string, href: string): boolean {
  const p = pathname.endsWith("/") ? pathname : `${pathname}/`;
  if (href === "/portfolio/") return p === "/" || p.startsWith("/portfolio/");
  if (href === "/cost/") return p.startsWith("/cost/");
  return p.startsWith(href);
}
