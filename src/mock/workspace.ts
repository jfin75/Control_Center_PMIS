/** SYNTHETIC DEMONSTRATION DATA — see src/mock/org.ts.
 *  Timesheets, report catalog, notifications, and settings fixtures. */

export interface TimeAccount {
  code: string;
  label: string;
}

/** Internal labor posts to these owner cost accounts (capitalizable vs. operating). */
export const TIME_ACCOUNTS: TimeAccount[] = [
  { code: "1.14", label: "Project Management" },
  { code: "1.21", label: "Special Inspections & Testing" },
  { code: "1.16", label: "Commissioning" },
  { code: "7.09", label: "DTS Consultants (PM/labor)" },
  { code: "OPS-100", label: "Non-project: program administration" },
  { code: "OPS-110", label: "Non-project: training" },
  { code: "PTO", label: "Paid time off" },
];

export interface TimeRow {
  id: string;
  projectId: string | null;
  account: string;
  hours: number[]; // Mon..Sun
  note?: string;
}

export const WEEK_START = "2026-09-14"; // Monday of the current week

export const SEED_TIMESHEET: TimeRow[] = [
  { id: "t1", projectId: "ehs-ed", account: "1.14", hours: [3, 2.5, 4, 0, 0, 0, 0] },
  { id: "t2", projectId: "hmc-l4", account: "1.14", hours: [2, 3, 1.5, 0, 0, 0, 0] },
  { id: "t3", projectId: "tdc-ups", account: "1.14", hours: [1, 1.5, 2, 0, 0, 0, 0] },
  { id: "t4", projectId: null, account: "OPS-100", hours: [2, 1, 0.5, 0, 0, 0, 0] },
];

export interface ReportDef {
  id: string;
  name: string;
  description: string;
  audience: string;
  cadence: "Monthly" | "Weekly" | "On demand" | "Quarterly";
  lastRun: string;
  formats: Array<"PDF" | "CSV" | "Excel">;
}

export const REPORTS: ReportDef[] = [
  { id: "exec-monthly", name: "Executive Monthly Summary", description: "Program budget chain A–K by project, variance drivers, schedule status, and top risks. Board-ready.", audience: "Owner Executives, Finance", cadence: "Monthly", lastRun: "2026-09-02", formats: ["PDF", "CSV", "Excel"] },
  { id: "committed-actual", name: "Committed vs. Actual Variance", description: "Commitments to date against payments by project and Level 1 classification, with % complete of commitment (K).", audience: "Cost Controllers", cadence: "Weekly", lastRun: "2026-09-11", formats: ["PDF", "CSV", "Excel"] },
  { id: "change-log", name: "Contractor PCO / Change Order Log", description: "Executed change orders and pending PCOs by classifier (OC, AEO, EEO, LC, MISC) with funding source.", audience: "PMs, Cost Controllers", cadence: "Weekly", lastRun: "2026-09-11", formats: ["PDF", "CSV", "Excel"] },
  { id: "milestones", name: "Milestone Progress", description: "Baseline vs. forecast for every milestone in the active program, with slip in days and schedule status.", audience: "PMs, Owner Executives", cadence: "Monthly", lastRun: "2026-09-02", formats: ["PDF", "CSV", "Excel"] },
  { id: "lease-expiry", name: "Lease Expiry Schedule", description: "All third-party leases expiring in the next 24 months with notice dates and annual rent at risk.", audience: "Real Estate", cadence: "Quarterly", lastRun: "2026-07-01", formats: ["PDF", "CSV", "Excel"] },
  { id: "cash-flow", name: "12-Month Cash Flow Forecast", description: "Monthly forecast spend by project for Treasury, reconciled to Forecast Cost at Completion (G).", audience: "Finance, Treasury", cadence: "Monthly", lastRun: "2026-09-02", formats: ["PDF", "CSV", "Excel"] },
];

export interface Notice {
  id: string;
  title: string;
  body: string;
  when: string;
  tone: "neg" | "warn" | "info" | "pos";
  href: string;
  unread: boolean;
}

export const NOTIFICATIONS: Notice[] = [
  { id: "n1", title: "Variance threshold crossed", body: "Eastside ED Expansion forecast is $775,000 over approved budget (H).", when: "2h ago", tone: "neg", href: "/cost/?project=ehs-ed", unread: true },
  { id: "n2", title: "Pay App #25 submitted", body: "Northbeam Builders — Surgical Tower L4, period to Aug 31.", when: "5h ago", tone: "info", href: "/cost/actuals/?project=hmc-l4", unread: true },
  { id: "n3", title: "Switchgear ETA slipped", body: "Tukwila main switchgear now Nov 27 (55 weeks vs 38 quoted).", when: "Yesterday", tone: "warn", href: "/projects/tdc-ups/", unread: true },
  { id: "n4", title: "Bid leveling ready", body: "BP-2611 ED Stage 3 Mechanical — 4 bids leveled, recommendation drafted.", when: "Yesterday", tone: "info", href: "/bidding/?pkg=bp-2611", unread: false },
  { id: "n5", title: "Lease notice window opens", body: "Federal Way renewal option notice due Oct 31.", when: "2 days ago", tone: "warn", href: "/portfolio/?property=fwpc-federalway", unread: false },
  { id: "n6", title: "Timesheet approved", body: "Week of Sep 7 — 40.0 h approved by Adaeze Okafor.", when: "3 days ago", tone: "pos", href: "/time/", unread: false },
];

export const PERMISSIONS = ["View", "Edit", "Approve", "Export", "Administer"] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const RBAC_MODULES = ["Portfolio", "Planning", "Projects", "Bidding", "Cost", "Reports", "Time Tracking", "Settings"] as const;

export const DEFAULT_RBAC: Record<string, Record<string, Permission[]>> = {
  "Owner Executive": {
    Portfolio: ["View", "Export"], Planning: ["View", "Approve", "Export"], Projects: ["View", "Approve", "Export"], Bidding: ["View", "Approve"],
    Cost: ["View", "Approve", "Export"], Reports: ["View", "Export"], "Time Tracking": ["View", "Approve"], Settings: ["View"],
  },
  PM: {
    Portfolio: ["View"], Planning: ["View", "Edit"], Projects: ["View", "Edit", "Export"], Bidding: ["View", "Edit"],
    Cost: ["View", "Edit", "Export"], Reports: ["View", "Export"], "Time Tracking": ["View", "Edit"], Settings: [],
  },
  "Cost Controller": {
    Portfolio: ["View"], Planning: ["View"], Projects: ["View", "Export"], Bidding: ["View"],
    Cost: ["View", "Edit", "Approve", "Export", "Administer"], Reports: ["View", "Export", "Administer"], "Time Tracking": ["View", "Approve"], Settings: ["View"],
  },
  "Field Inspector": {
    Portfolio: ["View"], Planning: [], Projects: ["View"], Bidding: [],
    Cost: [], Reports: ["View"], "Time Tracking": ["View", "Edit"], Settings: [],
  },
};

export interface NotificationRule {
  id: string;
  when: string;
  then: string;
  channel: "In-app" | "Email" | "In-app + Email" | "Teams";
  enabled: boolean;
}

export const NOTIFICATION_RULES: NotificationRule[] = [
  { id: "r1", when: "Projected cost variance (H) falls below −2% of approved budget (C)", then: "Notify PM, Cost Controller, Executive sponsor", channel: "In-app + Email", enabled: true },
  { id: "r2", when: "A cost code’s commitments (D) exceed 90% of its approved budget", then: "Notify Cost Controller", channel: "In-app", enabled: true },
  { id: "r3", when: "Pay application submitted", then: "Notify PM and Cost Controller for review", channel: "In-app + Email", enabled: true },
  { id: "r4", when: "Milestone forecast slips more than 10 working days", then: "Notify PM and Executive sponsor", channel: "Email", enabled: true },
  { id: "r5", when: "Bid package due date is within 3 days", then: "Notify Procurement", channel: "Teams", enabled: false },
  { id: "r6", when: "Lease expiry or option notice within 120 days", then: "Notify Property Manager", channel: "In-app + Email", enabled: true },
  { id: "r7", when: "Timesheet not submitted by Monday 10:00", then: "Remind the employee", channel: "Email", enabled: true },
];

export interface Integration {
  id: string;
  name: string;
  purpose: string;
  status: "Connected" | "Error" | "Not connected";
  lastSync: string | null;
  feeds: string;
}

export const INTEGRATIONS: Integration[] = [
  { id: "workday", name: "Workday Financials", purpose: "Source of A (Original Budget), D (Commitments), I (Payments)", status: "Connected", lastSync: "Today 06:00", feeds: "Budgets, POs, supplier invoices, journals" },
  { id: "p6", name: "Primavera P6", purpose: "Baseline and forecast milestone dates", status: "Connected", lastSync: "Today 05:30", feeds: "Milestones, SPI" },
  { id: "docusign", name: "DocuSign", purpose: "Change order and contract execution", status: "Connected", lastSync: "Today 09:12", feeds: "Envelope status" },
  { id: "signvault", name: "SignVault", purpose: "PAdES e-signature for contracts, change orders, and task orders", status: "Connected", lastSync: "Today 08:40", feeds: "Envelopes, signer progress, audit trails, sealed PDFs" },
  { id: "arcgis", name: "Esri ArcGIS", purpose: "Parcel boundaries and zoning layers", status: "Error", lastSync: "Sep 12, 22:00", feeds: "Parcels, zoning" },
  { id: "lease", name: "Lease administration", purpose: "Lease schedule and rent roll", status: "Not connected", lastSync: null, feeds: "Leases, options, CAM" },
];

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
}

export const WEBHOOKS: Webhook[] = [
  { id: "wh1", url: "https://integrations.harborline.example/pmis/change-orders", events: ["change_order.executed", "pco.submitted"], active: true },
  { id: "wh2", url: "https://treasury.harborline.example/hooks/cash-forecast", events: ["forecast.published"], active: true },
];

export const WEBHOOK_EVENTS = [
  "budget.adjusted",
  "commitment.created",
  "change_order.executed",
  "pco.submitted",
  "pay_app.submitted",
  "pay_app.approved",
  "forecast.published",
  "milestone.slipped",
  "bid_package.awarded",
];
