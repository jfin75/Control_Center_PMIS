/** SYNTHETIC DEMONSTRATION DATA — see src/mock/org.ts.
 *  The contract template library and the seeded contracts and modifications.
 *  Templates are the Owner's forms: fill-in blanks grouped into sections,
 *  required and optional exhibits, and article text with {{blanks}}.
 *  Seeded contract values tie to Commitments to Date (D) in
 *  src/mock/finance.ts: the construction contract's original sum is the pay
 *  application's original contract, its change orders are the project's
 *  approved 3.03 adjustments, and each design, consultant, and vendor
 *  contract's current value is the commitment on its cost code. */

import { seeded } from "@/lib/budget";
import { addDays } from "@/lib/format";
import { costCode, type ChangeClassifier } from "./costCodes";
import { linesFor, PAY_APPS } from "./finance";
import { contractor, TODAY, type Contractor } from "./org";
import { PROJECTS, type PendingChange, type Project } from "./projects";
import type { Attachment, Who } from "./rfis";

/* ---------------------------------------------------------------------------
 * Taxonomy
 * ------------------------------------------------------------------------- */

export type Category = "construction" | "ae" | "consultant" | "vendor";

export const CATEGORIES: Record<Category, { label: string; short: string; kinds: Array<Contractor["kind"]>; code: string; prefix: string; color: string; party: string }> = {
  construction: { label: "Construction", short: "Construction", kinds: ["General Contractor", "Trade Contractor"], code: "3.02", prefix: "CN", color: "var(--series-2)", party: "Contractor" },
  ae: { label: "Architect & engineer", short: "A/E", kinds: ["Design"], code: "1.02", prefix: "AE", color: "var(--series-1)", party: "Consultant" },
  consultant: { label: "Consultant", short: "Consultant", kinds: ["Consultant", "Design"], code: "1.14", prefix: "CS", color: "var(--series-3)", party: "Consultant" },
  vendor: { label: "Vendor", short: "Vendor", kinds: ["Vendor"], code: "5.03", prefix: "VN", color: "var(--series-4)", party: "Vendor" },
};
export const CATEGORY_ORDER: Category[] = ["construction", "ae", "consultant", "vendor"];

export type Structure = "standalone" | "master" | "task";

export const STRUCTURES: Record<Structure, { label: string; long: string }> = {
  standalone: { label: "Stand-alone", long: "One agreement for one project, with its own terms." },
  master: { label: "Master terms", long: "Program-wide terms, rates, and a ceiling. Work is released by task, work, or release orders." },
  task: { label: "Task order", long: "Releases work for one project under a master agreement's terms." },
};
export const STRUCTURE_ORDER: Structure[] = ["standalone", "master", "task"];

/** What a release under a master is called, by category. */
export const ORDER_NAME: Record<Category, { name: string; abbr: string }> = {
  construction: { name: "Work order", abbr: "WO" },
  ae: { name: "Task order", abbr: "TO" },
  consultant: { name: "Task order", abbr: "TO" },
  vendor: { name: "Release order", abbr: "RO" },
};

/* ---------------------------------------------------------------------------
 * Templates
 * ------------------------------------------------------------------------- */

export type FieldType = "text" | "textarea" | "money" | "percent" | "number" | "date" | "select";

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  options?: string[];
  default?: string;
  /** Half-width in the form grid. */
  half?: boolean;
}

export interface Section {
  id: string;
  label: string;
  fields: Field[];
}

export interface ExhibitDef {
  key: string;
  title: string;
  required: boolean;
  /** The Owner's standard exhibit, attached automatically unless replaced. */
  standard?: boolean;
  hint: string;
}

export interface Article {
  heading: string;
  body: string;
}

export interface Template {
  id: string;
  name: string;
  form: string;
  category: Category;
  structure: Structure;
  description: string;
  sections: Section[];
  exhibits: ExhibitDef[];
  articles: Article[];
  /** The contract value (a master's ceiling) from its blanks. */
  value: (v: Values) => number;
  /** The label for that value. */
  valueLabel: string;
  /** Kinds of modification the contract takes. */
  mods: ModType[];
}

export type Values = Record<string, string>;

export const n = (s: string | undefined) => (s ? Number(s) || 0 : 0);

/* Field builders keep the template definitions short. */
const text = (key: string, label: string, o: Partial<Field> = {}): Field => ({ key, label, type: "text", ...o });
const area = (key: string, label: string, o: Partial<Field> = {}): Field => ({ key, label, type: "textarea", ...o });
const money = (key: string, label: string, o: Partial<Field> = {}): Field => ({ key, label, type: "money", half: true, ...o });
const percent = (key: string, label: string, o: Partial<Field> = {}): Field => ({ key, label, type: "percent", half: true, ...o });
const date = (key: string, label: string, o: Partial<Field> = {}): Field => ({ key, label, type: "date", half: true, ...o });
const select = (key: string, label: string, options: string[], o: Partial<Field> = {}): Field => ({ key, label, type: "select", options, default: options[0], half: true, ...o });

const PAY_TERMS = ["Net 30", "Net 45", "Net 60"];
const insurance = (pro: boolean, bonds: boolean): Section => ({
  id: "insurance",
  label: pro ? "Insurance" : "Insurance & bonds",
  fields: [
    money("glLimit", "General liability, per occurrence", { required: true, default: "2000000" }),
    money("umbrella", "Umbrella / excess", { required: true, default: pro ? "2000000" : "5000000" }),
    ...(pro ? [money("plLimit", "Professional liability", { required: true, default: "2000000", hint: "Per claim and aggregate, kept in force 3 years after completion." })] : []),
    ...(bonds
      ? [
          select("bonds", "Bonds", ["Performance and payment bonds, 100%", "Payment bond only", "Not required"], { required: true }),
          select("builderRisk", "Builder's risk", ["Owner provides", "Contractor provides"], { required: true }),
        ]
      : []),
  ],
});
const special: Section = {
  id: "special",
  label: "Special terms",
  fields: [
    area("special", "Special conditions", { hint: "Anything that overrides or adds to the Owner's standard terms. Legal & Risk reviews every entry.", placeholder: "Optional" }),
    text("ownerStandards", "Owner standards that apply", { default: "Harborline Design & Construction Standards, rev. 2025; ICRA Class IV where noted" }),
  ],
};
const masterTerm: Field[] = [
  date("termStart", "Term starts", { required: true }),
  date("termEnd", "Term ends", { required: true }),
  money("ceiling", "Not-to-exceed ceiling", { required: true, hint: "All orders together may not exceed it without an amendment." }),
  money("maxOrder", "Largest single order", { required: true }),
];

const INSURANCE_EXHIBIT: ExhibitDef = { key: "insurance", title: "Insurance requirements", required: true, standard: true, hint: "The Owner's standard insurance exhibit, with limits from the Insurance tab." };
const STANDARDS_EXHIBIT: ExhibitDef = { key: "standards", title: "Owner design & construction standards", required: true, standard: true, hint: "Referenced by revision; attach a project supplement if there is one." };

const CHANGES_CONSTRUCTION =
  "Changes are made only by Change Order or Construction Change Directive. Either party gives notice of a Potential Cost Incident within 7 days of the event. The Owner may issue Proposal Requests, which the {{party}} prices within 10 days with backup. Markup on changed work is {{markup}} on self-performed work.";
const CHANGES_SERVICES =
  "Services beyond this scope are performed only under an approved Additional Service Request. The {{party}} requests one before starting the work, with a fee and a schedule effect. Terms, dates, or ceilings change only by written Amendment.";

export const TEMPLATES: Template[] = [
  /* ---- Construction ---------------------------------------------------- */
  {
    id: "con-lump",
    name: "Owner–Contractor Agreement, Stipulated Sum",
    form: "HH-C101 · rev. 2025",
    category: "construction",
    structure: "standalone",
    description: "Design-bid-build work at a fixed price. Use for competitively bid projects with complete documents.",
    sections: [
      {
        id: "scope",
        label: "Scope & time",
        fields: [
          area("scopeSummary", "Scope of work", { required: true, placeholder: "What the contractor builds, in a sentence or two. The full scope goes in Exhibit A." }),
          text("documents", "Contract documents", { required: true, placeholder: "Construction documents dated 2025-03-28, 214 sheets, and project manual" }),
          date("ntp", "Notice to proceed", { required: true }),
          date("substantial", "Substantial completion", { required: true }),
          date("final", "Final completion", { required: true }),
          money("ld", "Liquidated damages per day", { required: true, hint: "Owner's actual daily cost of delay: lost revenue, temporary space, extended staff." }),
        ],
      },
      {
        id: "comp",
        label: "Compensation",
        fields: [
          money("contractSum", "Contract sum", { required: true }),
          money("allowances", "Allowances included", { hint: "Listed in Exhibit H. Unused allowance returns to the Owner by change order." }),
          percent("retainage", "Retainage", { required: true, default: "5" }),
          select("payTerms", "Payment terms", PAY_TERMS, { required: true }),
          percent("markup", "Markup on changes", { required: true, default: "10" }),
        ],
      },
      insurance(false, true),
      special,
    ],
    exhibits: [
      { key: "scope", title: "Scope of work", required: true, hint: "Narrative scope, phasing, and exclusions." },
      { key: "docs", title: "Drawings & specifications index", required: true, hint: "Sheet list and spec table of contents with issue dates." },
      { key: "sov", title: "Schedule of values", required: true, hint: "The G703 lines pay applications bill against." },
      { key: "schedule", title: "Contract schedule", required: true, hint: "Baseline schedule with milestones and phasing." },
      { key: "gc", title: "Owner's general conditions", required: true, standard: true, hint: "HH-G201, rev. 2025." },
      INSURANCE_EXHIBIT,
      { key: "bonds", title: "Performance & payment bonds", required: true, hint: "Executed bonds from a surety licensed in Washington." },
      { key: "allowances", title: "Allowances & alternates", required: false, hint: "Allowance amounts and accepted alternates." },
      { key: "wages", title: "Prevailing wage determination", required: false, hint: "Only where public funds require it." },
    ],
    articles: [
      { heading: "Agreement", body: "This Agreement is made as of {{effective}} between {{owner}} (the “Owner”) and {{counterparty}} (the “Contractor”) for {{project}}, project {{projectCode}}." },
      { heading: "The Work", body: "The Contractor shall perform the Work described in Exhibit A: {{scopeSummary}} The Contract Documents are {{documents}}, this Agreement, and the Owner's General Conditions." },
      { heading: "Contract Time", body: "Work starts on {{ntp}}. The Contractor shall reach Substantial Completion by {{substantial}} and Final Completion by {{final}}. For each calendar day Substantial Completion is late, the Contractor owes liquidated damages of {{ld}}." },
      { heading: "Contract Sum", body: "The Owner shall pay the Contractor {{contractSum}} for the Work, adjusted only by Change Order. The Contract Sum includes allowances of {{allowances}}." },
      { heading: "Payments", body: "Applications for payment follow AIA G702/G703 against the Schedule of Values in Exhibit C. The Owner withholds {{retainage}} retainage until Substantial Completion and pays approved applications {{payTerms}}." },
      { heading: "Changes in the Work", body: CHANGES_CONSTRUCTION },
      { heading: "Insurance and Bonds", body: "The Contractor carries the insurance in the insurance exhibit, including general liability of {{glLimit}} per occurrence and umbrella coverage of {{umbrella}}. Bonds: {{bonds}}. Builder's risk: {{builderRisk}}." },
      { heading: "Standards and Special Conditions", body: "The Work follows {{ownerStandards}}. {{special}}" },
    ],
    value: (v) => n(v.contractSum),
    valueLabel: "Contract sum",
    mods: ["PCI", "PR", "CCD", "CO", "AMD"],
  },
  {
    id: "con-gmp",
    name: "CM/GC Agreement, Cost of Work Plus Fee with GMP",
    form: "HH-C133 · rev. 2025",
    category: "construction",
    structure: "standalone",
    description: "A construction manager joins during design for preconstruction services, then builds under a guaranteed maximum price set by amendment.",
    sections: [
      {
        id: "scope",
        label: "Scope & time",
        fields: [
          area("scopeSummary", "Scope of work", { required: true, placeholder: "Preconstruction services and construction of…" }),
          text("precon", "Preconstruction services", { required: true, default: "Estimates at SD, DD, and 50% CD; constructability and phasing reviews; early trade packages" }),
          date("ntp", "Preconstruction starts", { required: true }),
          date("substantial", "Substantial completion", { required: true }),
          money("ld", "Liquidated damages per day", { required: true }),
        ],
      },
      {
        id: "comp",
        label: "Compensation",
        fields: [
          money("preconFee", "Preconstruction fee", { required: true }),
          money("gmp", "Guaranteed maximum price", { hint: "Blank until the GMP amendment. The fee and CM contingency sit inside it." }),
          percent("fee", "CM fee on cost of work", { required: true, default: "4.5" }),
          money("gcs", "Fixed general conditions", { hint: "Monthly staffing and site costs, fixed for the duration." }),
          percent("cmContingency", "CM contingency inside the GMP", { default: "3" }),
          percent("savings", "Owner's share of savings", { default: "75" }),
          percent("retainage", "Retainage", { required: true, default: "5" }),
          select("payTerms", "Payment terms", PAY_TERMS, { required: true }),
          percent("markup", "Markup on changes", { required: true, default: "4.5" }),
        ],
      },
      insurance(false, true),
      special,
    ],
    exhibits: [
      { key: "scope", title: "Scope & preconstruction services", required: true, hint: "Services by design phase and the construction scope." },
      { key: "gmp", title: "GMP proposal & assumptions", required: false, hint: "Required with the GMP amendment: qualifications, allowances, and alternates." },
      { key: "sov", title: "Schedule of values", required: true, hint: "Cost of work by trade package, fee, and general conditions." },
      { key: "staffing", title: "Staffing plan & rates", required: true, hint: "Named staff, percent allocation, and billing rates." },
      { key: "gc", title: "Owner's general conditions", required: true, standard: true, hint: "HH-G201, rev. 2025." },
      INSURANCE_EXHIBIT,
      { key: "bonds", title: "Performance & payment bonds", required: true, hint: "Issued in the full GMP amount at the GMP amendment." },
    ],
    articles: [
      { heading: "Agreement", body: "This Agreement is made as of {{effective}} between {{owner}} (the “Owner”) and {{counterparty}} (the “Construction Manager”) for {{project}}, project {{projectCode}}." },
      { heading: "Services", body: "The Construction Manager provides preconstruction services ({{precon}}) and then constructs the Work: {{scopeSummary}}" },
      { heading: "Contract Time", body: "Preconstruction starts on {{ntp}}. Substantial Completion is required by {{substantial}}, with liquidated damages of {{ld}} per calendar day." },
      { heading: "Compensation", body: "The Owner pays a preconstruction fee of {{preconFee}}. For construction, the Owner pays the Cost of the Work plus a fee of {{fee}}, with fixed general conditions of {{gcs}}, not to exceed the Guaranteed Maximum Price of {{gmp}}. The GMP carries a CM contingency of {{cmContingency}}. The Owner keeps {{savings}} of any savings below the GMP." },
      { heading: "Payments", body: "The Owner withholds {{retainage}} retainage and pays approved applications {{payTerms}}. Cost of the Work is open book and subject to audit." },
      { heading: "Changes in the Work", body: CHANGES_CONSTRUCTION },
      { heading: "Insurance and Bonds", body: "General liability of {{glLimit}} per occurrence and umbrella coverage of {{umbrella}}. Bonds: {{bonds}}. Builder's risk: {{builderRisk}}." },
      { heading: "Standards and Special Conditions", body: "The Work follows {{ownerStandards}}. {{special}}" },
    ],
    value: (v) => n(v.preconFee) + n(v.gmp),
    valueLabel: "Precon fee + GMP",
    mods: ["PCI", "PR", "CCD", "CO", "AMD"],
  },
  {
    id: "con-msa",
    name: "Master Construction Services Agreement (On-Call)",
    form: "HH-C150 · rev. 2025",
    category: "construction",
    structure: "master",
    description: "Standing terms and unit rates for small construction work across the program, released by work order.",
    sections: [
      {
        id: "term",
        label: "Term & ceiling",
        fields: [
          area("scopeSummary", "Work covered", { required: true, placeholder: "Trade work covered by this agreement" }),
          ...masterTerm,
        ],
      },
      {
        id: "comp",
        label: "Rates",
        fields: [
          text("rates", "Labor & equipment rate schedule", { required: true, default: "Exhibit A, fixed through the first term year" }),
          percent("materialMarkup", "Markup on materials", { required: true, default: "12" }),
          percent("escalation", "Annual rate escalation cap", { default: "3.5" }),
          percent("retainage", "Retainage", { required: true, default: "5" }),
          select("payTerms", "Payment terms", PAY_TERMS, { required: true }),
          percent("markup", "Markup on changes", { required: true, default: "10" }),
        ],
      },
      insurance(false, true),
      special,
    ],
    exhibits: [
      { key: "rates", title: "Labor & equipment rate schedule", required: true, hint: "Hourly rates by classification and equipment rates." },
      { key: "procedure", title: "Work order procedure", required: true, standard: true, hint: "How work orders are requested, priced, and issued." },
      { key: "gc", title: "Owner's general conditions", required: true, standard: true, hint: "HH-G201, rev. 2025." },
      INSURANCE_EXHIBIT,
    ],
    articles: [
      { heading: "Agreement", body: "This Master Agreement is made as of {{effective}} between {{owner}} (the “Owner”) and {{counterparty}} (the “Contractor”)." },
      { heading: "Work Orders", body: "The Contractor performs {{scopeSummary}} when the Owner issues a Work Order. Each Work Order names a project, scope, price, and dates, and incorporates these terms. No single Work Order may exceed {{maxOrder}}." },
      { heading: "Term and Ceiling", body: "The term runs from {{termStart}} to {{termEnd}}. All Work Orders together may not exceed {{ceiling}} without a written Amendment." },
      { heading: "Rates", body: "Work is priced from {{rates}}, with materials at cost plus {{materialMarkup}}. Rates may escalate no more than {{escalation}} a year. The Owner withholds {{retainage}} retainage and pays {{payTerms}}." },
      { heading: "Changes", body: CHANGES_CONSTRUCTION },
      { heading: "Insurance and Bonds", body: "General liability of {{glLimit}} per occurrence and umbrella coverage of {{umbrella}}. Bonds: {{bonds}}. Builder's risk: {{builderRisk}}." },
      { heading: "Standards and Special Conditions", body: "Work follows {{ownerStandards}}. {{special}}" },
    ],
    value: (v) => n(v.ceiling),
    valueLabel: "Ceiling",
    mods: ["AMD"],
  },
  {
    id: "con-wo",
    name: "Construction Work Order",
    form: "HH-C151 · rev. 2025",
    category: "construction",
    structure: "task",
    description: "Releases one project's work under a master construction services agreement.",
    sections: [
      {
        id: "scope",
        label: "Scope & time",
        fields: [
          area("scopeSummary", "Scope of work", { required: true }),
          text("location", "Location", { required: true, placeholder: "Building, level, and rooms" }),
          date("start", "Start", { required: true }),
          date("finish", "Finish", { required: true }),
        ],
      },
      {
        id: "comp",
        label: "Price",
        fields: [
          select("pricing", "Pricing", ["Lump sum", "Time and materials, not to exceed"], { required: true }),
          money("amount", "Work order amount", { required: true }),
          text("proposal", "Contractor proposal", { required: true, placeholder: "Proposal number and date" }),
        ],
      },
      special,
    ],
    exhibits: [
      { key: "scope", title: "Work order scope & drawings", required: true, hint: "Scope narrative and any sketches or sheets." },
      { key: "proposal", title: "Contractor proposal", required: true, hint: "Priced from the master rate schedule." },
      { key: "schedule", title: "Work order schedule", required: false, hint: "Shutdowns, phasing, and after-hours work." },
    ],
    articles: [
      { heading: "Work Order", body: "{{owner}} issues this Work Order to {{counterparty}} under Master Agreement {{master}}, dated {{masterDate}}, for {{project}} ({{projectCode}}). The master agreement's terms govern." },
      { heading: "Scope", body: "The Contractor shall perform: {{scopeSummary}} Location: {{location}}." },
      { heading: "Time", body: "Work starts {{start}} and finishes by {{finish}}." },
      { heading: "Price", body: "{{pricing}}: {{amount}}, per proposal {{proposal}}." },
      { heading: "Special Conditions", body: "{{special}}" },
    ],
    value: (v) => n(v.amount),
    valueLabel: "Work order amount",
    mods: ["PCI", "PR", "CO", "AMD"],
  },

  /* ---- Architect & engineer --------------------------------------------- */
  {
    id: "ae-std",
    name: "Owner–Architect Agreement",
    form: "HH-P101 · rev. 2025",
    category: "ae",
    structure: "standalone",
    description: "Full design services for one project, from schematic design through closeout.",
    sections: [
      {
        id: "scope",
        label: "Services & schedule",
        fields: [
          area("scopeSummary", "Project description", { required: true }),
          text("phases", "Basic services", { required: true, default: "Schematic design, design development, construction documents, permitting, bidding, construction administration, and closeout" }),
          money("constructionBudget", "Owner's construction budget", { required: true, hint: "The architect designs to this number and reports when estimates exceed it." }),
          date("cdComplete", "Construction documents complete", { required: true }),
          date("closeout", "Services end", { required: true }),
        ],
      },
      {
        id: "comp",
        label: "Compensation",
        fields: [
          select("method", "Compensation method", ["Stipulated sum", "Percentage of construction cost", "Hourly, not to exceed"], { required: true }),
          money("fee", "Basic services fee", { required: true }),
          money("reimbursables", "Reimbursable allowance", { hint: "Printing, travel beyond 50 miles, and permit fees paid for the Owner." }),
          text("rates", "Rates for additional services", { required: true, default: "Exhibit C, held for the life of the agreement" }),
          select("payTerms", "Payment terms", PAY_TERMS, { required: true }),
        ],
      },
      insurance(true, false),
      special,
    ],
    exhibits: [
      { key: "scope", title: "Scope of basic services", required: true, hint: "Services and deliverables by phase." },
      { key: "schedule", title: "Design schedule", required: true, hint: "Phase durations and Owner review periods." },
      { key: "rates", title: "Hourly rate schedule", required: true, hint: "Rates by staff classification." },
      { key: "consultants", title: "Consultant list", required: false, hint: "Engineers and specialists under the architect." },
      INSURANCE_EXHIBIT,
      STANDARDS_EXHIBIT,
    ],
    articles: [
      { heading: "Agreement", body: "This Agreement is made as of {{effective}} between {{owner}} (the “Owner”) and {{counterparty}} (the “Architect”) for {{project}}, project {{projectCode}}." },
      { heading: "Project", body: "{{scopeSummary}} The Owner's construction budget is {{constructionBudget}}. The Architect designs to that budget and tells the Owner in writing when an estimate exceeds it." },
      { heading: "Basic Services", body: "The Architect provides: {{phases}}. Construction documents are complete by {{cdComplete}}; services end {{closeout}}." },
      { heading: "Compensation", body: "{{method}}: the Owner pays {{fee}} for basic services, plus reimbursable expenses up to {{reimbursables}}. Additional services are billed at {{rates}}. Invoices are paid {{payTerms}}." },
      { heading: "Additional Services", body: CHANGES_SERVICES },
      { heading: "Insurance", body: "Professional liability of {{plLimit}}, general liability of {{glLimit}} per occurrence, and umbrella coverage of {{umbrella}}." },
      { heading: "Standards and Special Conditions", body: "Design follows {{ownerStandards}}. {{special}}" },
    ],
    value: (v) => n(v.fee) + n(v.reimbursables),
    valueLabel: "Fee + reimbursables",
    mods: ["ASR", "AMD"],
  },
  {
    id: "ae-msa",
    name: "Master Professional Services Agreement, Design",
    form: "HH-P150 · rev. 2025",
    category: "ae",
    structure: "master",
    description: "Program-wide design terms and rates. Projects are released by task order.",
    sections: [
      { id: "term", label: "Term & ceiling", fields: [area("scopeSummary", "Services covered", { required: true }), ...masterTerm] },
      {
        id: "comp",
        label: "Rates",
        fields: [
          text("rates", "Rate schedule", { required: true, default: "Exhibit A, by staff classification" }),
          percent("escalation", "Annual rate escalation cap", { default: "3.5" }),
          select("payTerms", "Payment terms", PAY_TERMS, { required: true }),
        ],
      },
      insurance(true, false),
      special,
    ],
    exhibits: [
      { key: "rates", title: "Rate schedule", required: true, hint: "Hourly rates by staff classification." },
      { key: "procedure", title: "Task order procedure", required: true, standard: true, hint: "Request, proposal, and issue steps." },
      INSURANCE_EXHIBIT,
      STANDARDS_EXHIBIT,
    ],
    articles: [
      { heading: "Agreement", body: "This Master Agreement is made as of {{effective}} between {{owner}} (the “Owner”) and {{counterparty}} (the “Consultant”)." },
      { heading: "Task Orders", body: "The Consultant provides {{scopeSummary}} when the Owner issues a Task Order naming a project, scope, fee, and schedule. No single Task Order may exceed {{maxOrder}}." },
      { heading: "Term and Ceiling", body: "The term runs from {{termStart}} to {{termEnd}}. Task Orders together may not exceed {{ceiling}} without an Amendment." },
      { heading: "Rates", body: "Services are billed at {{rates}}, escalating no more than {{escalation}} a year. Invoices are paid {{payTerms}}." },
      { heading: "Additional Services", body: CHANGES_SERVICES },
      { heading: "Insurance", body: "Professional liability of {{plLimit}}, general liability of {{glLimit}} per occurrence, and umbrella coverage of {{umbrella}}." },
      { heading: "Standards and Special Conditions", body: "Design follows {{ownerStandards}}. {{special}}" },
    ],
    value: (v) => n(v.ceiling),
    valueLabel: "Ceiling",
    mods: ["AMD"],
  },
  {
    id: "ae-to",
    name: "Design Task Order",
    form: "HH-P151 · rev. 2025",
    category: "ae",
    structure: "task",
    description: "Releases one project's design services under a master design agreement.",
    sections: [
      {
        id: "scope",
        label: "Services & schedule",
        fields: [
          area("scopeSummary", "Services", { required: true }),
          area("deliverables", "Deliverables", { required: true, placeholder: "Drawings, reports, and submittals the task produces" }),
          date("start", "Start", { required: true }),
          date("finish", "Finish", { required: true }),
        ],
      },
      {
        id: "comp",
        label: "Fee",
        fields: [
          select("method", "Compensation method", ["Stipulated sum", "Hourly, not to exceed"], { required: true }),
          money("fee", "Fee", { required: true }),
          money("reimbursables", "Reimbursable allowance"),
          text("proposal", "Consultant proposal", { required: true, placeholder: "Proposal number and date" }),
        ],
      },
      special,
    ],
    exhibits: [
      { key: "scope", title: "Task scope & deliverables", required: true, hint: "Services, deliverables, and exclusions." },
      { key: "proposal", title: "Consultant fee proposal", required: true, hint: "Hours by classification at master rates." },
      { key: "schedule", title: "Task schedule", required: false, hint: "Milestones and Owner review periods." },
    ],
    articles: [
      { heading: "Task Order", body: "{{owner}} issues this Task Order to {{counterparty}} under Master Agreement {{master}}, dated {{masterDate}}, for {{project}} ({{projectCode}}). The master agreement's terms govern." },
      { heading: "Services", body: "{{scopeSummary}} Deliverables: {{deliverables}}" },
      { heading: "Schedule", body: "Services start {{start}} and finish by {{finish}}." },
      { heading: "Fee", body: "{{method}}: {{fee}}, plus reimbursable expenses up to {{reimbursables}}, per proposal {{proposal}}." },
      { heading: "Special Conditions", body: "{{special}}" },
    ],
    value: (v) => n(v.fee) + n(v.reimbursables),
    valueLabel: "Fee + reimbursables",
    mods: ["ASR", "AMD"],
  },

  /* ---- Consultants ------------------------------------------------------ */
  {
    id: "cs-std",
    name: "Consultant Services Agreement",
    form: "HH-P201 · rev. 2025",
    category: "consultant",
    structure: "standalone",
    description: "Commissioning, estimating, equipment planning, testing, and other specialist services for one project.",
    sections: [
      {
        id: "scope",
        label: "Services & schedule",
        fields: [
          select("service", "Service", ["Commissioning", "Cost estimating", "Equipment planning", "Special inspections & testing", "Geotechnical & environmental", "Project management", "Other"], { required: true }),
          area("scopeSummary", "Scope of services", { required: true }),
          text("keyPersonnel", "Key personnel", { required: true, placeholder: "Named lead and alternates; changes need Owner approval" }),
          date("start", "Start", { required: true }),
          date("finish", "Finish", { required: true }),
        ],
      },
      {
        id: "comp",
        label: "Compensation",
        fields: [
          select("method", "Compensation method", ["Stipulated sum", "Hourly, not to exceed"], { required: true }),
          money("fee", "Fee", { required: true }),
          money("reimbursables", "Reimbursable allowance"),
          select("payTerms", "Payment terms", PAY_TERMS, { required: true }),
        ],
      },
      insurance(true, false),
      special,
    ],
    exhibits: [
      { key: "scope", title: "Scope of services", required: true, hint: "Tasks, deliverables, and meetings." },
      { key: "proposal", title: "Fee proposal", required: true, hint: "Hours and rates by task." },
      { key: "rates", title: "Hourly rate schedule", required: false, hint: "For additional services." },
      INSURANCE_EXHIBIT,
    ],
    articles: [
      { heading: "Agreement", body: "This Agreement is made as of {{effective}} between {{owner}} (the “Owner”) and {{counterparty}} (the “Consultant”) for {{service}} services on {{project}}, project {{projectCode}}." },
      { heading: "Services", body: "{{scopeSummary}} Key personnel: {{keyPersonnel}}." },
      { heading: "Schedule", body: "Services start {{start}} and finish by {{finish}}." },
      { heading: "Compensation", body: "{{method}}: {{fee}}, plus reimbursable expenses up to {{reimbursables}}. Invoices are paid {{payTerms}}." },
      { heading: "Additional Services", body: CHANGES_SERVICES },
      { heading: "Insurance", body: "Professional liability of {{plLimit}}, general liability of {{glLimit}} per occurrence, and umbrella coverage of {{umbrella}}." },
      { heading: "Standards and Special Conditions", body: "Services follow {{ownerStandards}}. {{special}}" },
    ],
    value: (v) => n(v.fee) + n(v.reimbursables),
    valueLabel: "Fee + reimbursables",
    mods: ["ASR", "AMD"],
  },
  {
    id: "cs-msa",
    name: "Master Consultant Services Agreement",
    form: "HH-P250 · rev. 2025",
    category: "consultant",
    structure: "master",
    description: "Program-wide terms for a specialist consultant. Projects are released by task order.",
    sections: [
      {
        id: "term",
        label: "Term & ceiling",
        fields: [
          select("service", "Service", ["Commissioning", "Cost estimating", "Equipment planning", "Special inspections & testing", "Geotechnical & environmental", "Project management", "Other"], { required: true }),
          area("scopeSummary", "Services covered", { required: true }),
          ...masterTerm,
        ],
      },
      {
        id: "comp",
        label: "Rates",
        fields: [
          text("rates", "Rate schedule", { required: true, default: "Exhibit A, by staff classification" }),
          percent("escalation", "Annual rate escalation cap", { default: "3" }),
          select("payTerms", "Payment terms", PAY_TERMS, { required: true }),
        ],
      },
      insurance(true, false),
      special,
    ],
    exhibits: [
      { key: "rates", title: "Rate schedule", required: true, hint: "Hourly rates by classification." },
      { key: "procedure", title: "Task order procedure", required: true, standard: true, hint: "Request, proposal, and issue steps." },
      INSURANCE_EXHIBIT,
    ],
    articles: [
      { heading: "Agreement", body: "This Master Agreement is made as of {{effective}} between {{owner}} (the “Owner”) and {{counterparty}} (the “Consultant”) for {{service}} services." },
      { heading: "Task Orders", body: "The Consultant provides {{scopeSummary}} when the Owner issues a Task Order. No single Task Order may exceed {{maxOrder}}." },
      { heading: "Term and Ceiling", body: "The term runs from {{termStart}} to {{termEnd}}. Task Orders together may not exceed {{ceiling}} without an Amendment." },
      { heading: "Rates", body: "Services are billed at {{rates}}, escalating no more than {{escalation}} a year. Invoices are paid {{payTerms}}." },
      { heading: "Additional Services", body: CHANGES_SERVICES },
      { heading: "Insurance", body: "Professional liability of {{plLimit}}, general liability of {{glLimit}} per occurrence, and umbrella coverage of {{umbrella}}." },
      { heading: "Special Conditions", body: "{{special}}" },
    ],
    value: (v) => n(v.ceiling),
    valueLabel: "Ceiling",
    mods: ["AMD"],
  },
  {
    id: "cs-to",
    name: "Consultant Task Order",
    form: "HH-P251 · rev. 2025",
    category: "consultant",
    structure: "task",
    description: "Releases one project's services under a master consultant agreement.",
    sections: [
      {
        id: "scope",
        label: "Services & schedule",
        fields: [
          area("scopeSummary", "Services", { required: true }),
          area("deliverables", "Deliverables", { required: true }),
          date("start", "Start", { required: true }),
          date("finish", "Finish", { required: true }),
        ],
      },
      {
        id: "comp",
        label: "Fee",
        fields: [
          select("method", "Compensation method", ["Hourly, not to exceed", "Stipulated sum"], { required: true }),
          money("fee", "Fee", { required: true }),
          money("reimbursables", "Reimbursable allowance"),
          text("proposal", "Consultant proposal", { required: true, placeholder: "Proposal number and date" }),
        ],
      },
      special,
    ],
    exhibits: [
      { key: "scope", title: "Task scope & deliverables", required: true, hint: "Services, deliverables, and exclusions." },
      { key: "proposal", title: "Consultant fee proposal", required: true, hint: "Hours by classification at master rates." },
    ],
    articles: [
      { heading: "Task Order", body: "{{owner}} issues this Task Order to {{counterparty}} under Master Agreement {{master}}, dated {{masterDate}}, for {{project}} ({{projectCode}}). The master agreement's terms govern." },
      { heading: "Services", body: "{{scopeSummary}} Deliverables: {{deliverables}}" },
      { heading: "Schedule", body: "Services start {{start}} and finish by {{finish}}." },
      { heading: "Fee", body: "{{method}}: {{fee}}, plus reimbursable expenses up to {{reimbursables}}, per proposal {{proposal}}." },
      { heading: "Special Conditions", body: "{{special}}" },
    ],
    value: (v) => n(v.fee) + n(v.reimbursables),
    valueLabel: "Fee + reimbursables",
    mods: ["ASR", "AMD"],
  },

  /* ---- Vendors ---------------------------------------------------------- */
  {
    id: "vn-purchase",
    name: "Equipment Purchase & Installation Agreement",
    form: "HH-V101 · rev. 2025",
    category: "vendor",
    structure: "standalone",
    description: "Buys major equipment for one project, with delivery, installation, acceptance, and warranty.",
    sections: [
      {
        id: "scope",
        label: "Equipment & delivery",
        fields: [
          text("equipment", "Equipment", { required: true, placeholder: "Make, model, and configuration" }),
          { key: "quantity", label: "Quantity", type: "number", required: true, default: "1", half: true },
          select("install", "Installation", ["Furnish and install", "Furnish only, Owner installs"], { required: true }),
          date("delivery", "Delivery", { required: true }),
          text("acceptance", "Acceptance testing", { required: true, default: "Vendor acceptance test witnessed by the Owner's physicist or biomed" }),
        ],
      },
      {
        id: "comp",
        label: "Price & warranty",
        fields: [
          money("price", "Purchase price", { required: true }),
          percent("deposit", "Deposit at order", { default: "10" }),
          select("freight", "Freight", ["FOB destination, freight included", "FOB origin, freight extra"], { required: true }),
          text("warranty", "Warranty", { required: true, default: "24 months parts and labor from acceptance" }),
          text("uptime", "Uptime guarantee", { placeholder: "e.g. 97% measured monthly, with service credits" }),
          select("payTerms", "Payment terms", PAY_TERMS, { required: true }),
        ],
      },
      insurance(false, false),
      special,
    ],
    exhibits: [
      { key: "quote", title: "Quote & configuration", required: true, hint: "Signed quote with every line and option." },
      { key: "install", title: "Delivery & installation plan", required: true, hint: "Rigging path, site requirements, and dates." },
      { key: "warranty", title: "Warranty & service terms", required: true, hint: "Coverage, response times, and uptime credits." },
      { key: "site", title: "Site readiness requirements", required: false, hint: "Power, cooling, shielding, and structure." },
      INSURANCE_EXHIBIT,
    ],
    articles: [
      { heading: "Agreement", body: "This Agreement is made as of {{effective}} between {{owner}} (the “Owner”) and {{counterparty}} (the “Vendor”) for {{project}}, project {{projectCode}}." },
      { heading: "Equipment", body: "The Vendor shall supply {{quantity}} × {{equipment}} ({{install}}), delivered by {{delivery}}. Title passes at acceptance: {{acceptance}}." },
      { heading: "Price", body: "The purchase price is {{price}}, {{freight}}. The Owner pays a {{deposit}} deposit at order and the balance {{payTerms}} after acceptance." },
      { heading: "Warranty", body: "{{warranty}}. Uptime: {{uptime}}." },
      { heading: "Changes", body: "Changes to equipment, price, or dates are made only by Change Order or written Amendment." },
      { heading: "Insurance", body: "General liability of {{glLimit}} per occurrence and umbrella coverage of {{umbrella}}, including products and completed operations." },
      { heading: "Special Conditions", body: "{{special}}" },
    ],
    value: (v) => n(v.price),
    valueLabel: "Purchase price",
    mods: ["CO", "AMD"],
  },
  {
    id: "vn-msa",
    name: "Master Supply Agreement",
    form: "HH-V150 · rev. 2025",
    category: "vendor",
    structure: "master",
    description: "Program pricing and terms for recurring purchases such as furniture or fixtures, released by release order.",
    sections: [
      { id: "term", label: "Term & ceiling", fields: [area("scopeSummary", "Products covered", { required: true }), ...masterTerm] },
      {
        id: "comp",
        label: "Pricing",
        fields: [
          text("priceList", "Price list", { required: true, default: "Manufacturer list prices in effect on the order date" }),
          percent("discount", "Discount off list", { required: true }),
          select("freight", "Freight", ["FOB destination, freight included", "FOB origin, freight extra"], { required: true }),
          text("warranty", "Warranty", { required: true, default: "Manufacturer's warranty, minimum 10 years on seating structure" }),
          select("payTerms", "Payment terms", PAY_TERMS, { required: true }),
        ],
      },
      insurance(false, false),
      special,
    ],
    exhibits: [
      { key: "prices", title: "Price list & discounts", required: true, hint: "Discount by manufacturer and product line." },
      { key: "procedure", title: "Release order procedure", required: true, standard: true, hint: "Quote, order, delivery, and punch." },
      INSURANCE_EXHIBIT,
    ],
    articles: [
      { heading: "Agreement", body: "This Master Agreement is made as of {{effective}} between {{owner}} (the “Owner”) and {{counterparty}} (the “Vendor”)." },
      { heading: "Release Orders", body: "The Vendor supplies {{scopeSummary}} when the Owner issues a Release Order. No single Release Order may exceed {{maxOrder}}." },
      { heading: "Term and Ceiling", body: "The term runs from {{termStart}} to {{termEnd}}. Release Orders together may not exceed {{ceiling}} without an Amendment." },
      { heading: "Pricing", body: "Prices are {{priceList}}, less {{discount}}, {{freight}}. Invoices are paid {{payTerms}}." },
      { heading: "Warranty", body: "{{warranty}}." },
      { heading: "Insurance", body: "General liability of {{glLimit}} per occurrence and umbrella coverage of {{umbrella}}." },
      { heading: "Special Conditions", body: "{{special}}" },
    ],
    value: (v) => n(v.ceiling),
    valueLabel: "Ceiling",
    mods: ["AMD"],
  },
  {
    id: "vn-ro",
    name: "Release Order",
    form: "HH-V151 · rev. 2025",
    category: "vendor",
    structure: "task",
    description: "Buys one project's products at master pricing.",
    sections: [
      {
        id: "scope",
        label: "Items & delivery",
        fields: [
          area("items", "Items", { required: true, placeholder: "Product lines and quantities, or see the attached quote" }),
          text("location", "Deliver to", { required: true }),
          date("delivery", "Delivery", { required: true }),
        ],
      },
      {
        id: "comp",
        label: "Price",
        fields: [money("amount", "Release order amount", { required: true }), text("quote", "Vendor quote", { required: true, placeholder: "Quote number and date" })],
      },
      special,
    ],
    exhibits: [
      { key: "quote", title: "Vendor quote", required: true, hint: "Priced at master discounts." },
      { key: "delivery", title: "Delivery schedule", required: false, hint: "Dates by floor or phase." },
    ],
    articles: [
      { heading: "Release Order", body: "{{owner}} issues this Release Order to {{counterparty}} under Master Agreement {{master}}, dated {{masterDate}}, for {{project}} ({{projectCode}}). The master agreement's terms govern." },
      { heading: "Items", body: "{{items}} Deliver to {{location}} by {{delivery}}." },
      { heading: "Price", body: "{{amount}}, per quote {{quote}}." },
      { heading: "Special Conditions", body: "{{special}}" },
    ],
    value: (v) => n(v.amount),
    valueLabel: "Release order amount",
    mods: ["CO", "AMD"],
  },
];

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id);

/** The task-order template that releases work under a master template. */
export const orderTemplateFor = (category: Category) => TEMPLATES.find((t) => t.category === category && t.structure === "task")!;

/* ---------------------------------------------------------------------------
 * Contracts
 * ------------------------------------------------------------------------- */

export type ContractStatus = "draft" | "review" | "signature" | "executed" | "closed";

export interface ExhibitState {
  key: string;
  /** Uses the Owner's standard exhibit (standard exhibits only). */
  standard: boolean;
  /** Marked not applicable (optional exhibits only). */
  na: boolean;
  note?: string;
  files: Attachment[];
}

export type LogKind =
  | "created"
  | "edited"
  | "submitted"
  | "returned"
  | "signature"
  | "executed"
  | "closed"
  | "priced"
  | "approved"
  | "rejected"
  | "withdrawn"
  | "converted"
  | "comment";

export interface LogEntry {
  id: string;
  kind: LogKind;
  date: string;
  by: Who;
  text?: string;
}

export interface Contract {
  id: string;
  number: string;
  templateId: string;
  title: string;
  /** Null for master agreements, which span the program. */
  projectId: string | null;
  /** The master agreement a task order releases work under. */
  parentId: string | null;
  counterpartyId: string;
  /** The Owner's contract manager. */
  ownerRepId: string;
  /** Budget line the contract commits against. */
  code: string;
  values: Values;
  exhibits: ExhibitState[];
  status: ContractStatus;
  created: string;
  /** Effective (execution) date. */
  executed?: string;
  closed?: string;
  log: LogEntry[];
}

/* ---------------------------------------------------------------------------
 * Modifications
 * ------------------------------------------------------------------------- */

export type ModType = "PCI" | "PR" | "CCD" | "CO" | "ASR" | "AMD";

export const MOD_TYPES: Record<ModType, { label: string; long: string; final: boolean; next: ModType[]; openLabel: string }> = {
  PCI: { label: "Potential cost incident", long: "Early notice of an event that may change cost or time. Either party raises it; it becomes a proposal request or change order.", final: false, next: ["PR", "CO"], openLabel: "Under review" },
  PR: { label: "Proposal request", long: "The Owner describes a change and asks the contractor to price it.", final: false, next: ["CCD", "CO"], openLabel: "Out for pricing" },
  CCD: { label: "Construction change directive", long: "The Owner directs the work to proceed before the price is agreed. A change order follows.", final: false, next: ["CO"], openLabel: "Directed, pricing open" },
  CO: { label: "Change order", long: "Changes the contract sum or time once both parties sign.", final: true, next: [], openLabel: "Pending signature" },
  ASR: { label: "Additional service request", long: "A design or consulting firm asks to be paid for services outside its scope, before doing the work.", final: true, next: [], openLabel: "Submitted" },
  AMD: { label: "Amendment", long: "Changes terms, dates, rates, or a master agreement's ceiling.", final: true, next: [], openLabel: "Pending signature" },
};
export const MOD_TYPE_ORDER: ModType[] = ["PCI", "PR", "CCD", "CO", "ASR", "AMD"];

export type ModStatus = "draft" | "open" | "priced" | "approved" | "converted" | "rejected" | "withdrawn";

export type Funding = PendingChange["funding"];
export const FUNDING: Funding[] = ["Contractor contingency", "Design contingency", "Owner's reserve", "Budget increase"];

export interface Mod {
  id: string;
  contractId: string;
  type: ModType;
  seq: number;
  title: string;
  description: string;
  classifier: ChangeClassifier;
  code: string;
  funding: Funding | null;
  /** Estimate, then the priced amount. */
  amount: number | null;
  days: number | null;
  approvedAmount?: number;
  approvedDays?: number;
  status: ModStatus;
  /** Who raised it. */
  by: Who;
  created: string;
  submitted?: string;
  priced?: string;
  decided?: string;
  /** The modification this one was converted from, and to. */
  fromId?: string;
  toId?: string;
  /** Number on the project record, when it differs (PCO-018). */
  ref?: string;
  files: Attachment[];
  log: LogEntry[];
}

export const modNumber = (m: Pick<Mod, "type" | "seq">) => `${m.type}-${String(m.seq).padStart(3, "0")}`;

/* ---------------------------------------------------------------------------
 * Seed
 * ------------------------------------------------------------------------- */

const rnd = seeded(7070);
const owner = (id: string): Who => ({ kind: "staff", id });
const firm = (id: string): Who => ({ kind: "firm", id });
const CONTRACTS_SPECIALIST = "u-larsen";

const D = (projectId: string, code: string) => linesFor(projectId).filter((l) => l.code === code).reduce((a, l) => a + l.D, 0);
const round = (x: number, step = 1000) => Math.round(x / step) * step;
const digits = (p: Project) => p.code.replace(/\D/g, "");

/** A seeded file record: the metadata of a file the demo doesn't store. */
function record(name: string, added: string, by: Who, i: number): Attachment {
  return { id: `seed-file-${name.replace(/\W+/g, "-").toLowerCase()}-${i}`, name, size: Math.round(180_000 + rnd() * 2_400_000), type: "application/pdf", added, by, stored: false };
}

/** Every exhibit filled for an executed contract: standard where the Owner has one, a file otherwise. */
function filledExhibits(t: Template, number: string, added: string, by: Who, skipOptional = true): ExhibitState[] {
  return t.exhibits.map((x, i) => {
    if (x.standard) return { key: x.key, standard: true, na: false, files: [] };
    if (!x.required && skipOptional && rnd() < 0.5) return { key: x.key, standard: false, na: true, files: [] };
    const letter = String.fromCharCode(65 + i);
    return { key: x.key, standard: false, na: false, files: [record(`${number} Exhibit ${letter} – ${x.title}.pdf`, added, by, i)] };
  });
}

/** Template defaults, then the seed's own values. */
function valuesFor(t: Template, v: Values): Values {
  const out: Values = {};
  for (const s of t.sections) for (const f of s.fields) if (f.default !== undefined) out[f.key] = f.default;
  return { ...out, ...v };
}

let logSeq = 0;
const entry = (kind: LogKind, date: string, by: Who, text?: string): LogEntry => ({ id: `seed-log-${logSeq++}`, kind, date, by, text });

/** The paper trail of an executed contract: drafted, reviewed, signed. */
function executedLog(executed: string, repId: string, cpId: string): LogEntry[] {
  const drafted = addDays(executed, -24 - Math.floor(rnd() * 14));
  return [
    entry("created", drafted, owner(repId)),
    entry("submitted", addDays(drafted, 6), owner(repId), "To Legal & Risk"),
    entry("signature", addDays(executed, -5), owner(CONTRACTS_SPECIALIST), "Legal & Risk approved; sent for signature"),
    entry("executed", executed, owner(CONTRACTS_SPECIALIST), `Signed by ${contractor(cpId).name} and the Owner`),
  ];
}

interface Seed {
  id: string;
  number: string;
  templateId: string;
  title: string;
  projectId: string | null;
  parentId?: string | null;
  counterpartyId: string;
  ownerRepId: string;
  code: string;
  values: Values;
  status: ContractStatus;
  executed?: string;
  created?: string;
}

const contracts: Contract[] = [];
const mods: Mod[] = [];

function add(s: Seed): Contract {
  const t = templateById(s.templateId)!;
  const executed = s.status === "executed" || s.status === "closed";
  const created = s.created ?? (s.executed ? addDays(s.executed, -30) : addDays(TODAY, -12));
  const c: Contract = {
    id: s.id,
    number: s.number,
    templateId: s.templateId,
    title: s.title,
    projectId: s.projectId,
    parentId: s.parentId ?? null,
    counterpartyId: s.counterpartyId,
    ownerRepId: s.ownerRepId,
    code: s.code,
    values: valuesFor(t, s.values),
    exhibits: executed ? filledExhibits(t, s.number, s.executed!, owner(s.ownerRepId)) : t.exhibits.map((x) => ({ key: x.key, standard: !!x.standard, na: false, files: [] })),
    status: s.status,
    created,
    executed: s.executed,
    log: executed ? executedLog(s.executed!, s.ownerRepId, s.counterpartyId) : [entry("created", created, owner(s.ownerRepId))],
  };
  contracts.push(c);
  return c;
}

let modId = 0;
function addMod(c: Contract, m: Omit<Mod, "id" | "contractId" | "files" | "log" | "code" | "funding"> & Partial<Pick<Mod, "code" | "funding" | "files">>): Mod {
  const rep = owner(c.ownerRepId);
  const log: LogEntry[] = [entry("created", m.created, m.by)];
  if (m.submitted) log.push(entry("submitted", m.submitted, m.by));
  if (m.priced) log.push(entry("priced", m.priced, firm(c.counterpartyId), m.amount ? `Priced at $${m.amount.toLocaleString("en-US")}` : undefined));
  if (m.decided && m.status === "approved") log.push(entry("approved", m.decided, rep, m.type === "CO" || m.type === "AMD" ? "Executed by both parties" : "Approved"));
  if (m.decided && m.status === "rejected") log.push(entry("rejected", m.decided, rep));
  if (m.decided && m.status === "converted") log.push(entry("converted", m.decided, rep));
  const full: Mod = {
    id: `${c.id}:mod-${modId++}`,
    contractId: c.id,
    code: m.code ?? (c.code === "3.02" ? "3.03" : c.code),
    funding: m.funding ?? null,
    files: m.files ?? (m.status !== "draft" ? [record(`${modNumber(m)} backup.pdf`, m.submitted ?? m.created, m.by, modId)] : []),
    log,
    ...m,
  };
  mods.push(full);
  return full;
}

function link(from: Mod, to: Mod) {
  from.toId = to.id;
  to.fromId = from.id;
}

/* ---- Masters ------------------------------------------------------------ */

const MASTERS = {
  tessellate: add({
    id: "msa-ae-01",
    number: "MSA-AE-01",
    templateId: "ae-msa",
    title: "Architectural design services",
    projectId: null,
    counterpartyId: "c-tessellate",
    ownerRepId: CONTRACTS_SPECIALIST,
    code: "1.02",
    values: { scopeSummary: "Architectural design, interior design, and construction administration for healthcare renovations and additions", termStart: "2024-07-01", termEnd: "2027-06-30", ceiling: "0", maxOrder: "1500000" },
    status: "executed",
    executed: "2024-06-24",
  }),
  keelson: add({
    id: "msa-ae-02",
    number: "MSA-AE-02",
    templateId: "ae-msa",
    title: "MEP and electrical engineering services",
    projectId: null,
    counterpartyId: "c-keelson",
    ownerRepId: CONTRACTS_SPECIALIST,
    code: "1.05",
    values: { scopeSummary: "Mechanical, electrical, plumbing, and fire protection engineering, including critical power and medical gas", termStart: "2024-07-01", termEnd: "2027-06-30", ceiling: "0", maxOrder: "1000000" },
    status: "executed",
    executed: "2024-06-28",
  }),
  cedarmark: add({
    id: "msa-cs-01",
    number: "MSA-CS-01",
    templateId: "cs-msa",
    title: "Commissioning authority services",
    projectId: null,
    counterpartyId: "c-cedarmark",
    ownerRepId: CONTRACTS_SPECIALIST,
    code: "1.16",
    values: { service: "Commissioning", scopeSummary: "Fundamental and enhanced commissioning of HVAC, controls, critical power, and life safety systems", termStart: "2024-10-01", termEnd: "2027-09-30", ceiling: "0", maxOrder: "400000" },
    status: "executed",
    executed: "2024-09-19",
  }),
  quartermile: add({
    id: "msa-cs-02",
    number: "MSA-CS-02",
    templateId: "cs-msa",
    title: "Cost estimating services",
    projectId: null,
    counterpartyId: "c-quartermile",
    ownerRepId: CONTRACTS_SPECIALIST,
    code: "1.18",
    values: { service: "Cost estimating", scopeSummary: "Independent estimates at each design milestone, GMP reconciliation, and change order pricing review", termStart: "2025-01-01", termEnd: "2027-12-31", ceiling: "600000", maxOrder: "150000" },
    status: "executed",
    executed: "2024-12-16",
  }),
  cascade: add({
    id: "msa-vn-01",
    number: "MSA-VN-01",
    templateId: "vn-msa",
    title: "Furniture supply and installation",
    projectId: null,
    counterpartyId: "c-cascade",
    ownerRepId: "u-ngata",
    code: "6.01",
    values: { scopeSummary: "Office, clinical, and waiting-room furniture, delivered and installed", termStart: "2025-07-01", termEnd: "2028-06-30", ceiling: "0", maxOrder: "900000", discount: "42" },
    status: "executed",
    executed: "2025-06-20",
  }),
  brightwater: add({
    id: "msa-cn-01",
    number: "MSA-CN-01",
    templateId: "con-msa",
    title: "On-call electrical construction",
    projectId: null,
    counterpartyId: "c-brightwater",
    ownerRepId: CONTRACTS_SPECIALIST,
    code: "3.02",
    values: { scopeSummary: "Electrical and low-voltage work up to $250,000 an order: shutdowns, feeders, panel changes, and device moves", termStart: "2026-01-01", termEnd: "2027-12-31", ceiling: "2000000", maxOrder: "250000", bonds: "Payment bond only" },
    status: "executed",
    executed: "2025-12-12",
  }),
};

/* ---- Per project ---------------------------------------------------------- */

const orderSeq: Record<string, number> = {};
const nextOrder = (master: Contract) => {
  orderSeq[master.id] = (orderSeq[master.id] ?? 0) + 1;
  return `${master.number}-${ORDER_NAME[templateById(master.templateId)!.category].abbr}${String(orderSeq[master.id]).padStart(2, "0")}`;
};

const PRECON: Project["phase"][] = ["Preconstruction", "Design"];

for (const p of PROJECTS) {
  let seq = 0;
  const num = (cat: Category) => `${CATEGORIES[cat].prefix}-${digits(p)}-${String(++seq).padStart(2, "0")}`;
  const team = (id: string) => p.team.some((t) => t.refId === id);
  const pm = p.pmId;

  /* Construction: the pay application's original contract, plus the approved change orders. */
  const app = PAY_APPS.find((a) => a.projectId === p.id);
  const cmgc = p.team.some((t) => t.refId === p.gcId && /CM\/GC/.test(t.role)) || PRECON.includes(p.phase);
  const original = app?.originalContract ?? D(p.id, "3.02");
  const executed = addDays(p.start, -21);
  const gc = add({
    id: `${p.id}:gc`,
    number: num("construction"),
    templateId: cmgc ? "con-gmp" : "con-lump",
    title: cmgc ? (PRECON.includes(p.phase) ? "CM/GC preconstruction and construction" : "CM/GC construction, GMP") : "General construction",
    projectId: p.id,
    counterpartyId: p.gcId,
    ownerRepId: pm,
    code: "3.02",
    values: cmgc
      ? PRECON.includes(p.phase)
        ? { scopeSummary: p.summary, ntp: p.start, substantial: p.milestones[p.milestones.length - 2]?.baseline ?? p.baselineFinish, ld: String(round(p.totals.A / 3000, 500)), preconFee: String(original), gcs: "", bonds: "Not required", builderRisk: "Owner provides" }
        : { scopeSummary: p.summary, ntp: p.start, substantial: p.milestones[p.milestones.length - 2]?.baseline ?? p.baselineFinish, ld: String(round(p.totals.A / 3000, 500)), preconFee: String(round(original * 0.012)), gmp: String(original - round(original * 0.012)), gcs: String(round(original * 0.08)) }
      : {
          scopeSummary: p.summary,
          documents: `Construction documents and project manual, issued for construction ${p.milestones.find((m) => /documents/i.test(m.name))?.actual ?? addDays(p.start, -60)}`,
          ntp: p.start,
          substantial: p.milestones.find((m) => /substantial/i.test(m.name))?.baseline ?? addDays(p.baselineFinish, -30),
          final: p.baselineFinish,
          ld: String(round(p.totals.A / 3000, 500)),
          contractSum: String(original),
          allowances: String(round(original * 0.02)),
        },
    status: "executed",
    executed,
  });

  // Approved change orders from the project's 3.03 adjustments, each preceded by the PCI that raised it.
  const cos = p.adjustments.filter((a) => a.code === "3.03" && a.amount > 0);
  cos.forEach((a, i) => {
    const seqNo = Number(/CO #(\d+)/.exec(a.description)?.[1] ?? i + 1);
    const title = a.description.replace(/^CO #\d+ – /, "");
    const opened = addDays(a.approved, -38 - Math.floor(rnd() * 20));
    const pci = addMod(gc, {
      type: "PCI",
      seq: i + 1,
      title,
      description: `${title}. Raised by the contractor; see the backup for the field conditions and rough order of magnitude.`,
      classifier: a.classifier ?? "MISC",
      amount: round(a.amount * (0.85 + rnd() * 0.3), 500),
      days: rnd() < 0.5 ? Math.ceil(rnd() * 12) : 0,
      status: "converted",
      by: firm(p.gcId),
      created: opened,
      submitted: opened,
      decided: addDays(opened, 12),
    });
    const co = addMod(gc, {
      type: "CO",
      seq: seqNo,
      title,
      description: `${title}. Priced by the contractor, reviewed by the Owner's PM and cost consultant, and funded as shown.`,
      classifier: a.classifier ?? "MISC",
      funding: a.classifier === "AEO" || a.classifier === "EEO" ? "Design contingency" : a.classifier === "LC" ? "Contractor contingency" : "Owner's reserve",
      amount: a.amount,
      days: pci.days,
      approvedAmount: a.amount,
      approvedDays: pci.days ?? 0,
      status: "approved",
      by: firm(p.gcId),
      created: addDays(opened, 12),
      submitted: addDays(opened, 14),
      priced: addDays(opened, 20),
      decided: a.approved,
    });
    link(pci, co);
  });

  // Pending changes on the project record, as potential cost incidents on the construction contract.
  for (const pc of p.pending.filter((x) => x.code === "3.03")) {
    const seqNo = Number(pc.number.replace(/\D/g, ""));
    addMod(gc, {
      type: "PCI",
      seq: seqNo,
      title: pc.title,
      description: `${pc.title}. ${pc.classifier === "OC" ? "Owner-requested scope." : pc.classifier === "LC" ? "Condition found in the field that the documents did not show." : pc.classifier === "EEO" || pc.classifier === "AEO" ? "Gap in the design documents." : "Cost the contract did not anticipate."}`,
      classifier: pc.classifier,
      funding: pc.funding,
      amount: pc.amount,
      days: pc.classifier === "LC" ? 10 : pc.classifier === "OC" ? 7 : 0,
      status: pc.status === "Pending review" ? "open" : "priced",
      by: firm(p.gcId),
      created: pc.submitted,
      submitted: pc.submitted,
      priced: pc.status === "Pending review" ? undefined : addDays(pc.submitted, 6),
      ref: pc.number,
    });
  }

  /* Architect / engineer of record on 1.02: a task order under the firm's master, or a stand-alone agreement on the largest projects. */
  const aeFee = D(p.id, "1.02");
  const aeFirm = team("c-tessellate") ? "c-tessellate" : (p.team.find((t) => t.kind === "firm" && contractor(t.refId).kind === "Design")?.refId ?? null);
  let ae: Contract | null = null;
  if (aeFee > 0 && aeFirm) {
    const master = aeFirm === "c-tessellate" ? MASTERS.tessellate : aeFirm === "c-keelson" ? MASTERS.keelson : null;
    const standalone = !master || p.totals.A >= 15_000_000;
    const asrs = standalone || p.id === "sodo-backfill" ? round(aeFee * 0.07) : 0;
    const base = aeFee - asrs;
    const reimb = round(base * 0.03);
    const start = addDays(p.start, -420);
    ae = add({
      id: `${p.id}:ae`,
      number: standalone ? num("ae") : nextOrder(master!),
      templateId: standalone ? "ae-std" : "ae-to",
      title: `${contractor(aeFirm).trade} services`,
      projectId: p.id,
      parentId: standalone ? null : master!.id,
      counterpartyId: aeFirm,
      ownerRepId: pm,
      code: "1.02",
      values: standalone
        ? { scopeSummary: p.summary, constructionBudget: String(round(p.totals.A * 0.62, 50_000)), cdComplete: p.milestones.find((m) => /documents/i.test(m.name))?.baseline ?? addDays(p.start, -60), closeout: addDays(p.baselineFinish, 90), fee: String(base - reimb), reimbursables: String(reimb) }
        : { scopeSummary: `Design services for ${p.name}.`, deliverables: "Design development and construction documents, permit set, bid support, and construction administration.", start, finish: addDays(p.baselineFinish, 60), fee: String(base - reimb), reimbursables: String(reimb), proposal: `${contractor(aeFirm).name.split(" ")[0]} P-${digits(p).slice(2)}-01` },
      status: "executed",
      executed: start,
    });
    if (asrs > 0) {
      const a1 = round(asrs * 0.6);
      addMod(ae, {
        type: "ASR",
        seq: 1,
        title: p.id === "ehs-ed" ? "Stage 2 phasing redesign to hold bay count" : p.id === "sodo-backfill" ? "Re-plan floor 6 after east wing descope" : "Additional design for Owner program changes",
        description: "Services beyond basic scope, requested by the Owner. Priced hourly at master rates.",
        classifier: "OC",
        code: "1.02",
        funding: "Design contingency",
        amount: a1,
        days: 0,
        approvedAmount: a1,
        approvedDays: 0,
        status: "approved",
        by: firm(aeFirm),
        created: addDays(TODAY, -160),
        submitted: addDays(TODAY, -158),
        priced: addDays(TODAY, -158),
        decided: addDays(TODAY, -140),
      });
      addMod(ae, {
        type: "ASR",
        seq: 2,
        title: p.id === "ehs-ed" ? "Construction administration for extended Stage 2–3 duration" : "Additional permit resubmittal and plan review responses",
        description: "Extended or repeated services caused by schedule changes outside the design firm's control.",
        classifier: "MISC",
        code: "1.02",
        funding: "Design contingency",
        amount: asrs - a1,
        days: 0,
        approvedAmount: asrs - a1,
        approvedDays: 0,
        status: "approved",
        by: firm(aeFirm),
        created: addDays(TODAY, -75),
        submitted: addDays(TODAY, -74),
        priced: addDays(TODAY, -74),
        decided: addDays(TODAY, -61),
      });
    }
  }

  /* MEP engineering on 1.05, under Keelson's master. */
  const mepFee = D(p.id, "1.05");
  if (mepFee > 0 && team("c-keelson") && aeFirm !== "c-keelson") {
    const start = addDays(p.start, -400);
    add({
      id: `${p.id}:mep`,
      number: nextOrder(MASTERS.keelson),
      templateId: "ae-to",
      title: "MEP engineering services",
      projectId: p.id,
      parentId: MASTERS.keelson.id,
      counterpartyId: "c-keelson",
      ownerRepId: pm,
      code: "1.05",
      values: { scopeSummary: `MEP engineering for ${p.name}.`, deliverables: "MEP design, load calculations, coordination drawings review, and construction administration.", start, finish: addDays(p.baselineFinish, 45), method: "Hourly, not to exceed", fee: String(mepFee), reimbursables: "0", proposal: `KE-${digits(p)}-M` },
      status: "executed",
      executed: start,
    });
  }

  /* Commissioning on 1.16 under Cedarmark's master. */
  const cxFee = D(p.id, "1.16");
  if (cxFee > 0 && team("c-cedarmark")) {
    const start = addDays(p.start, -90);
    add({
      id: `${p.id}:cx`,
      number: nextOrder(MASTERS.cedarmark),
      templateId: "cs-to",
      title: "Commissioning authority",
      projectId: p.id,
      parentId: MASTERS.cedarmark.id,
      counterpartyId: "c-cedarmark",
      ownerRepId: pm,
      code: "1.16",
      values: { scopeSummary: "Commissioning of HVAC, controls, emergency power, and nurse call.", deliverables: "Cx plan, design review, pre-functional checklists, functional tests, and the final Cx report.", start, finish: addDays(p.baselineFinish, 300), fee: String(cxFee), reimbursables: "0", proposal: `CC-${digits(p)}` },
      status: "executed",
      executed: start,
    });
  }

  /* Cost estimating on 1.18 under Quartermile's master. */
  const estFee = D(p.id, "1.18");
  if (estFee > 0) {
    const start = addDays(p.start, -300);
    add({
      id: `${p.id}:est`,
      number: nextOrder(MASTERS.quartermile),
      templateId: "cs-to",
      title: "Independent cost estimating",
      projectId: p.id,
      parentId: MASTERS.quartermile.id,
      counterpartyId: "c-quartermile",
      ownerRepId: pm,
      code: "1.18",
      values: { scopeSummary: "Independent estimates at each design milestone and review of change order pricing.", deliverables: "SD, DD, and CD estimates; change order pricing reviews.", start, finish: p.baselineFinish, method: "Stipulated sum", fee: String(estFee), reimbursables: "0", proposal: `QM-${digits(p)}` },
      status: "executed",
      executed: start,
    });
  }

  /* Equipment planning on 1.28, stand-alone. */
  const eqpFee = D(p.id, "1.28");
  if (eqpFee > 0 && team("c-meridian-eq")) {
    const start = addDays(p.start, -200);
    add({
      id: `${p.id}:eqp`,
      number: num("consultant"),
      templateId: "cs-std",
      title: "Medical equipment planning",
      projectId: p.id,
      counterpartyId: "c-meridian-eq",
      ownerRepId: pm,
      code: "1.28",
      values: { service: "Equipment planning", scopeSummary: "Equipment list, vendor-neutral specifications, procurement support, and installation coordination.", keyPersonnel: "Lead planner and one associate", start, finish: addDays(p.baselineFinish, 30), method: "Stipulated sum", fee: String(eqpFee) },
      status: "executed",
      executed: start,
    });
  }

  /* Major equipment on 5.03 from a vendor on the team. */
  const vendorId = p.team.find((t) => t.kind === "firm" && contractor(t.refId).kind === "Vendor")?.refId;
  const eqFee = D(p.id, "5.03");
  if (vendorId && eqFee > 0) {
    const co1 = round(eqFee * 0.035);
    const vn = add({
      id: `${p.id}:vn`,
      number: num("vendor"),
      templateId: "vn-purchase",
      title: "Imaging equipment purchase and installation",
      projectId: p.id,
      counterpartyId: vendorId,
      ownerRepId: "u-ngata",
      code: "5.03",
      values: { equipment: "MRI coil set, contrast injector, and MR-conditional patient monitoring", install: "Furnish and install", delivery: "2026-12-14", price: String(eqFee - co1), uptime: "97% measured monthly, with service credits" },
      status: "executed",
      executed: "2026-05-22",
    });
    addMod(vn, {
      type: "CO",
      seq: 1,
      title: "Add cardiac imaging package and second coil set",
      description: "Clinical request after vendor selection; priced at the quoted option discount.",
      classifier: "OC",
      code: "5.03",
      funding: "Owner's reserve",
      amount: co1,
      days: 0,
      approvedAmount: co1,
      approvedDays: 0,
      status: "approved",
      by: owner("u-ngata"),
      created: "2026-06-18",
      submitted: "2026-06-18",
      priced: "2026-06-25",
      decided: "2026-07-09",
    });
  }

  /* Furniture on 6.01 under Cascade's master. */
  const ffFee = D(p.id, "6.01");
  if (ffFee > 0) {
    const on = addDays(p.start, 120);
    add({
      id: `${p.id}:ff`,
      number: nextOrder(MASTERS.cascade),
      templateId: "vn-ro",
      title: "Furniture",
      projectId: p.id,
      parentId: MASTERS.cascade.id,
      counterpartyId: "c-cascade",
      ownerRepId: pm,
      code: "6.01",
      values: { items: "Seating, workstations, and patient-room furniture per the furniture plan.", location: `${p.name}, per the furniture plan`, delivery: addDays(p.baselineFinish, -30), amount: String(ffFee), quote: `CCF-Q${digits(p)}` },
      status: "executed",
      executed: on,
    });
  }

  // The engineer-of-record's pending PCO on a design-phase project is an additional service, not a construction change.
  for (const pc of p.pending.filter((x) => x.code !== "3.03")) {
    if (!ae) continue;
    addMod(ae, {
      type: "ASR",
      seq: Number(pc.number.replace(/\D/g, "")),
      title: pc.title,
      description: `${pc.title}, by a structural subconsultant under the engineer of record.`,
      classifier: pc.classifier,
      code: pc.code,
      funding: pc.funding,
      amount: pc.amount,
      days: 0,
      status: "open",
      by: firm(ae.counterpartyId),
      created: pc.submitted,
      submitted: pc.submitted,
      ref: pc.number,
    });
  }
}

/* ---- Hand-placed changes so every kind and state appears ----------------- */

const byId = (id: string) => contracts.find((c) => c.id === id)!;

{
  const gc = byId("ehs-ed:gc");
  addMod(gc, {
    type: "PR",
    seq: 1,
    title: "Relocate hand sinks at triage per Infection Prevention review",
    description: "Move two hand sinks at triage stations T3 and T4 closer to the entry per the IP walk on Sep 2. Price plumbing, casework, and patching; hold the Stage 2 sequence.",
    classifier: "OC",
    amount: 24_000,
    days: 3,
    status: "open",
    by: owner("u-reyes"),
    created: "2026-09-03",
    submitted: "2026-09-04",
  });
  const pr2 = addMod(gc, {
    type: "PR",
    seq: 2,
    title: "Temporary ICRA anteroom at corridor B",
    description: "Build a hard-wall anteroom with negative air at the corridor B tie-in so night work can continue during Stage 2.",
    classifier: "OC",
    amount: 18_400,
    days: 0,
    status: "converted",
    by: owner("u-reyes"),
    created: "2026-08-11",
    submitted: "2026-08-11",
    priced: "2026-08-18",
    decided: "2026-08-20",
  });
  const ccd = addMod(gc, {
    type: "CCD",
    seq: 1,
    title: "Temporary ICRA anteroom at corridor B",
    description: "Directed to proceed on time and materials while the price is agreed, so night work is not stopped.",
    classifier: "OC",
    funding: "Owner's reserve",
    amount: 18_400,
    days: 0,
    status: "open",
    by: owner("u-reyes"),
    created: "2026-08-20",
    submitted: "2026-08-20",
  });
  link(pr2, ccd);
  addMod(gc, {
    type: "PCI",
    seq: 23,
    title: "Additional fire-rated shaft wall at stair 3",
    description: "Field walk found the existing shaft is not rated above the ceiling. Contractor is drafting a price.",
    classifier: "LC",
    amount: 12_000,
    days: 2,
    status: "draft",
    by: owner("u-reyes"),
    created: "2026-09-12",
  });
}

{
  const gc = byId("tdc-ups:gc");
  addMod(gc, {
    type: "PR",
    seq: 1,
    title: "Temporary load bank testing, second weekend",
    description: "Price a second load bank weekend if the first cutover window runs long.",
    classifier: "MISC",
    amount: 22_500,
    days: 0,
    status: "rejected",
    by: owner("u-tran"),
    created: "2026-06-02",
    submitted: "2026-06-02",
    priced: "2026-06-09",
    decided: "2026-06-12",
  });
  addMod(gc, {
    type: "AMD",
    seq: 1,
    title: "Extend substantial completion for the switchgear factory slip",
    description: "Adds 119 calendar days to the contract time, with no change to the contract sum. Liquidated damages do not run during the extension.",
    classifier: "MISC",
    amount: 0,
    days: 119,
    status: "priced",
    by: firm("c-brightwater"),
    created: "2026-08-24",
    submitted: "2026-08-24",
    priced: "2026-08-31",
  });
}

{
  const ae = byId("ehs-ed:ae");
  addMod(ae, {
    type: "ASR",
    seq: 3,
    title: "Design for negative-pressure conversion, bays 12–14",
    description: "Mechanical and architectural design to support PCO-018. Needed before the contractor can finalize price.",
    classifier: "OC",
    code: "1.02",
    funding: "Owner's reserve",
    amount: 26_800,
    days: 0,
    status: "priced",
    by: firm("c-tessellate"),
    created: "2026-08-21",
    submitted: "2026-08-21",
    priced: "2026-08-27",
    ref: "PCO-018",
  });
}

addMod(MASTERS.cedarmark, {
  type: "AMD",
  seq: 1,
  title: "Raise ceiling by $250,000 for FY27 task orders",
  description: "Three new projects plan commissioning in FY27. The ceiling rises from its current value; rates and term are unchanged.",
  classifier: "MISC",
  code: "1.16",
  amount: 250_000,
  days: 0,
  status: "open",
  by: owner(CONTRACTS_SPECIALIST),
  created: "2026-09-08",
  submitted: "2026-09-09",
});
addMod(MASTERS.tessellate, {
  type: "AMD",
  seq: 1,
  title: "FY27 rate schedule, +3.2%",
  description: "Annual rate escalation within the 3.5% cap. No change to the ceiling.",
  classifier: "MISC",
  code: "1.02",
  amount: 0,
  days: 0,
  approvedAmount: 0,
  approvedDays: 0,
  status: "approved",
  by: firm("c-tessellate"),
  created: "2026-06-02",
  submitted: "2026-06-02",
  priced: "2026-06-02",
  decided: "2026-06-27",
});

/* ---- Contracts still being drafted --------------------------------------- */

{
  const t = templateById("con-wo")!;
  const wo = add({
    id: "lasc-or:wo",
    number: nextOrder(MASTERS.brightwater),
    templateId: t.id,
    title: "OR 3 isolated power panel replacement",
    projectId: "lasc-or",
    parentId: MASTERS.brightwater.id,
    counterpartyId: "c-brightwater",
    ownerRepId: "u-reyes",
    code: "3.02",
    values: { scopeSummary: "Replace the isolated power panel and line isolation monitor in OR 3 during the tie-in weekend.", location: "Level 1, OR 3", start: "2026-10-17", finish: "2026-10-19", amount: "68500", proposal: "BWE-2291, Sep 4 2026" },
    status: "review",
    created: "2026-09-05",
  });
  wo.exhibits = wo.exhibits.map((x) => (x.key === "schedule" ? { ...x, na: true } : { ...x, files: [record(`${wo.number} ${templateById("con-wo")!.exhibits.find((e) => e.key === x.key)!.title}.pdf`, "2026-09-05", owner("u-reyes"), 90)] }));
  wo.log.push(entry("submitted", "2026-09-08", owner("u-reyes"), "To Legal & Risk"));
}

{
  const pSpd = PROJECTS.find((p) => p.id === "kvsc-spd")!;
  const c = add({
    id: "kvsc-spd:geo",
    number: `CS-${digits(pSpd)}-03`,
    templateId: "cs-std",
    title: "Geotechnical investigation for the washer utility trench",
    projectId: "kvsc-spd",
    counterpartyId: "c-bluecoast",
    ownerRepId: "u-novak",
    code: "1.19",
    values: { service: "Geotechnical & environmental", scopeSummary: "Borings and a report for the new utility trench and equipment pads.", start: "2026-10-05", finish: "2026-11-20", fee: "38500" },
    status: "draft",
    created: "2026-09-11",
  });
  c.exhibits = c.exhibits.map((x) => (x.key === "proposal" ? { ...x, files: [record("Bluecoast geotechnical proposal.pdf", "2026-09-11", owner("u-novak"), 91)] } : x));
}

{
  const c = add({
    id: "sodo-backfill:ff-draft",
    number: `VN-${digits(PROJECTS.find((p) => p.id === "sodo-backfill")!)}-02`,
    templateId: "vn-purchase",
    title: "Portable digital radiography units",
    projectId: "sodo-backfill",
    counterpartyId: "c-orca",
    ownerRepId: "u-ngata",
    code: "5.04",
    values: { equipment: "Portable digital radiography unit with wireless detector", quantity: "2", install: "Furnish and install", delivery: "2027-05-10", price: "186000", deposit: "0", uptime: "" },
    status: "signature",
    created: "2026-08-19",
  });
  c.exhibits = filledExhibits(templateById("vn-purchase")!, c.number, "2026-08-26", owner("u-ngata"));
  c.log.push(entry("submitted", "2026-08-26", owner("u-ngata"), "To Legal & Risk"), entry("signature", "2026-09-10", owner(CONTRACTS_SPECIALIST), "Legal & Risk approved; sent for signature"));
}

/* ---- Master ceilings: released work plus headroom ------------------------ */

for (const m of Object.values(MASTERS)) {
  if (m.values.ceiling !== "0") continue;
  const released = contracts.filter((c) => c.parentId === m.id).reduce((a, c) => a + templateById(c.templateId)!.value(c.values), 0);
  m.values.ceiling = String(Math.ceil((released * 1.35) / 250_000) * 250_000);
}

export const CONTRACTS: Contract[] = contracts;
export const MODS: Mod[] = mods;

/** Budget line label for a contract or change. */
export const codeLabel = (code: string) => `${code} ${costCode(code).name}`;
