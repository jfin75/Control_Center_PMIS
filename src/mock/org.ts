/**
 * SYNTHETIC DEMONSTRATION DATA — every organization, person, property,
 * project, contractor and dollar in src/mock is invented. Replace with real
 * feeds (Workday, lease admin, scheduling) before any production use.
 */

export const TODAY = "2026-09-14";
export const FISCAL_YEAR = "FY27"; // Jul 2026 – Jun 2027

export const ORG = {
  /** Placeholder name. Swap for the real Owner name and logo. */
  name: "Harborline Health",
  program: "Capital Program Office",
  region: "Puget Sound",
  address: "1400 Commerce Street, Tacoma, WA 98402",
  fiscalYearStart: "July",
  currency: "USD",
};

export type Environment = "production" | "staging" | "sandbox";
export const ENVIRONMENTS: Array<{ id: Environment; label: string; note: string }> = [
  { id: "production", label: "Production", note: "Live Finance feeds" },
  { id: "staging", label: "Staging", note: "Nightly Workday copy" },
  { id: "sandbox", label: "Sandbox", note: "Training data, safe to edit" },
];

export type Role = "Owner Executive" | "PM" | "Cost Controller" | "Field Inspector";
export const ROLES: Role[] = ["Owner Executive", "PM", "Cost Controller", "Field Inspector"];

export interface Person {
  id: string;
  name: string;
  title: string;
  role: Role | "Property Manager" | "Procurement";
  email: string;
  phone: string;
  tone: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
}

export const PEOPLE: Person[] = [
  { id: "u-okafor", name: "Adaeze Okafor", title: "VP, Capital Program", role: "Owner Executive", email: "a.okafor@harborline.example", phone: "(253) 555-0141", tone: 1 },
  { id: "u-lindqvist", name: "Mats Lindqvist", title: "Director, Facilities Planning", role: "Owner Executive", email: "m.lindqvist@harborline.example", phone: "(253) 555-0177", tone: 8 },
  { id: "u-reyes", name: "Camila Reyes", title: "Senior Project Manager", role: "PM", email: "c.reyes@harborline.example", phone: "(253) 555-0102", tone: 2 },
  { id: "u-tran", name: "Duc Tran", title: "Project Manager", role: "PM", email: "d.tran@harborline.example", phone: "(425) 555-0119", tone: 3 },
  { id: "u-haddad", name: "Layla Haddad", title: "Project Manager", role: "PM", email: "l.haddad@harborline.example", phone: "(425) 555-0164", tone: 4 },
  { id: "u-novak", name: "Peter Novak", title: "Senior Project Manager", role: "PM", email: "p.novak@harborline.example", phone: "(253) 555-0188", tone: 5 },
  { id: "u-mensah", name: "Kwame Mensah", title: "Owner's Representative", role: "PM", email: "k.mensah@harborline.example", phone: "(360) 555-0125", tone: 6 },
  { id: "u-farah", name: "Noor Farah", title: "Associate Project Manager", role: "PM", email: "n.farah@harborline.example", phone: "(253) 555-0129", tone: 7 },
  { id: "u-sato", name: "Emi Sato", title: "Cost Controller", role: "Cost Controller", email: "e.sato@harborline.example", phone: "(253) 555-0133", tone: 7 },
  { id: "u-bauer", name: "Hannah Bauer", title: "Senior Cost Analyst", role: "Cost Controller", email: "h.bauer@harborline.example", phone: "(253) 555-0151", tone: 1 },
  { id: "u-whitehorse", name: "Jonah Whitehorse", title: "Field Inspector", role: "Field Inspector", email: "j.whitehorse@harborline.example", phone: "(360) 555-0192", tone: 2 },
  { id: "u-castillo", name: "Rosa Castillo", title: "Field Engineer", role: "Field Inspector", email: "r.castillo@harborline.example", phone: "(425) 555-0110", tone: 4 },
  { id: "u-obrien", name: "Siobhan O’Brien", title: "Real Estate Property Manager", role: "Property Manager", email: "s.obrien@harborline.example", phone: "(253) 555-0170", tone: 3 },
  { id: "u-iyer", name: "Arjun Iyer", title: "Real Estate Property Manager", role: "Property Manager", email: "a.iyer@harborline.example", phone: "(425) 555-0158", tone: 5 },
  { id: "u-kowalczyk", name: "Marta Kowalczyk", title: "Real Estate Property Manager", role: "Property Manager", email: "m.kowalczyk@harborline.example", phone: "(360) 555-0136", tone: 6 },
  { id: "u-ngata", name: "Tevita Ngata", title: "Procurement Manager", role: "Procurement", email: "t.ngata@harborline.example", phone: "(253) 555-0147", tone: 7 },
  { id: "u-larsen", name: "Ingrid Larsen", title: "Contracts Specialist", role: "Procurement", email: "i.larsen@harborline.example", phone: "(253) 555-0115", tone: 8 },
];

export const CURRENT_USER_ID = "u-sato";

export function person(id: string): Person {
  const p = PEOPLE.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown person ${id}`);
  return p;
}

export interface Contractor {
  id: string;
  name: string;
  trade: string;
  kind: "General Contractor" | "Trade Contractor" | "Design" | "Consultant" | "Vendor";
  city: string;
  prequalified: boolean;
  emr: number; // experience modification rate (safety)
}

export const CONTRACTORS: Contractor[] = [
  { id: "c-northbeam", name: "Northbeam Builders", trade: "General construction", kind: "General Contractor", city: "Seattle", prequalified: true, emr: 0.71 },
  { id: "c-alderline", name: "Alderline Construction", trade: "General construction", kind: "General Contractor", city: "Tacoma", prequalified: true, emr: 0.78 },
  { id: "c-harrow", name: "Harrow & Finch Contractors", trade: "General construction", kind: "General Contractor", city: "Bellevue", prequalified: true, emr: 0.84 },
  { id: "c-graystone", name: "Graystone Mechanical", trade: "Div 22/23 — Plumbing & HVAC", kind: "Trade Contractor", city: "Kent", prequalified: true, emr: 0.69 },
  { id: "c-brightwater", name: "Brightwater Electric", trade: "Div 26/27/28 — Electrical & low voltage", kind: "Trade Contractor", city: "Everett", prequalified: true, emr: 0.74 },
  { id: "c-ironwood", name: "Ironwood Steel Erectors", trade: "Div 05 — Metals", kind: "Trade Contractor", city: "Tacoma", prequalified: true, emr: 0.88 },
  { id: "c-summit", name: "Summit Crest Interiors", trade: "Div 09 — Finishes", kind: "Trade Contractor", city: "Lynnwood", prequalified: true, emr: 0.81 },
  { id: "c-ravenna", name: "Ravenna Glass & Curtainwall", trade: "Div 08 — Openings", kind: "Trade Contractor", city: "Seattle", prequalified: false, emr: 0.93 },
  { id: "c-foothold", name: "Foothold Sitework", trade: "Div 31/32 — Earthwork & exterior", kind: "Trade Contractor", city: "Puyallup", prequalified: true, emr: 0.77 },
  { id: "c-clearline", name: "Clearline Fire Protection", trade: "Div 21 — Fire suppression", kind: "Trade Contractor", city: "Renton", prequalified: true, emr: 0.72 },
  { id: "c-pacific-mw", name: "Tern Point Millwork", trade: "Div 06 — Casework", kind: "Trade Contractor", city: "Olympia", prequalified: true, emr: 0.86 },
  { id: "c-tessellate", name: "Tessellate Architecture", trade: "Architect of record", kind: "Design", city: "Seattle", prequalified: true, emr: 0 },
  { id: "c-keelson", name: "Keelson Engineering", trade: "MEP engineering", kind: "Design", city: "Bellevue", prequalified: true, emr: 0 },
  { id: "c-bluecoast", name: "Bluecoast Civil", trade: "Civil & structural engineering", kind: "Design", city: "Tacoma", prequalified: true, emr: 0 },
  { id: "c-cedarmark", name: "Cedarmark Commissioning", trade: "Commissioning authority", kind: "Consultant", city: "Seattle", prequalified: true, emr: 0 },
  { id: "c-meridian-eq", name: "Lumenfield Equipment Planning", trade: "Medical equipment planning", kind: "Consultant", city: "Portland", prequalified: true, emr: 0 },
  { id: "c-orca", name: "Orcaline Imaging Systems", trade: "Imaging equipment", kind: "Vendor", city: "Bothell", prequalified: true, emr: 0 },
  { id: "c-quartermile", name: "Quartermile Cost Consultants", trade: "Cost estimating", kind: "Consultant", city: "Seattle", prequalified: true, emr: 0 },
];

export function contractor(id: string): Contractor {
  const c = CONTRACTORS.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown contractor ${id}`);
  return c;
}
