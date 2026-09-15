# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(Also packaged as a desktop app for macOS and Windows via Tauri, wrapping the same static web build. Design language stays web; no per-OS native adaptation.)

## Stack

Next.js App Router + React 19 + TypeScript + Tailwind CSS v4, built with `output: 'export'` (fully static) so the identical build deploys to Vercel and drops into a Tauri shell with no server. Data is client-side mock (`src/mock/`) until a backend is chosen. Chosen by the user from offered options (2026-09-14).

## Users

Owner-side capital program staff at a regional healthcare system:

- **Owner Executives** reviewing portfolio value, capital exposure, and program health, usually in a weekly or monthly review.
- **Project Managers / Owner Reps** running approved capital projects day to day: budget, commitments, change orders, milestones, risk.
- **Cost Controllers** reconciling budget, commitments, forecasts, pay applications, and Finance (Workday) actuals.
- **Field Inspectors / Engineers** logging time and checking project status from site.
- **Procurement** teams issuing RFPs, leveling bids, and recommending awards.
- **Real Estate Property Managers** owning leases, occupancy, and building data.

## Product Purpose

A single Owner-focused Project Management Information System (PMIS) that follows a capital dollar from property and planning intake, through bidding and award, into project execution and cost control, and back into the real estate portfolio. Success means an executive and a cost controller can look at the same number and agree where it came from.

## Positioning

Built from the Owner's side of the table, not the contractor's: the budget structure is the Owner's own capital budget template (Level 1 classifications and 1.01–9.01 category codes) with a Finance-auditable formula chain, and it ties construction spend to the real estate assets it improves.

## Operating Context

- Capital budget follows the Owner's template (`Private/Budget Fortmat/`):
  - Level 1 Classifications: Professional Services, Real Estate, Construction, Enabling, Equipment, Furniture, DTS, Owners Purchased Services & Equipment, Owner's Reserve.
  - Category codes 1.01–9.01 (e.g. 1.02 Design – A/E Contract, 3.03 Construction – Change Orders, 7.06 DTS – Epic/Clinical Apps.).
  - Change order classifiers: OC (Owner Change), AEO (Architect Error & Omission), EEO (Engineer Error & Omission), LC (Latent Condition), MISC.
  - Budget summary formula chain: A Original Budget, B Approved Budget Adjustments, C = A+B Total Approved Budget, D Commitments to Date, E = C−D Balance Remaining, F Projected Remaining Commitments, G = D+F Forecast Cost at Completion, H = C−G Projected Cost Variance, I Payments to Date, J = C−I Funds Remaining Available, K = I/D % Complete of Commitment.
  - A, D, and I are populated automatically from Finance; B changes only through a tracked add/deduct funding action; F is a PM input with PM Leadership review.
- CSI MasterFormat divisions are a secondary filter on Construction lines.
- Pay applications follow AIA G702/G703 conventions.
- Finance system of record is Workday (manual journals, receipt accruals).
- Used at a desk on large monitors during reviews, and on laptops in the field.

## Capabilities and Constraints

- Modules: Portfolio, Dashboard, Planning, Projects, Bidding, Cost (Summary, Budget Details, Forecasts, Actual Costs, Cash Flow), Reports, Time Tracking, Settings.
- Roles (RBAC): Owner Executive, PM, Cost Controller, Field Inspector.
- Must run fully offline-capable as a static bundle (no server runtime).
- Undecided: backend/data source, authentication provider, real organization name and logo, map tile provider for production.

## Brand Commitments

- Visual language is pinned by the user's reference screenshots in `Private/UI samples/` (light, airy analytics dashboard: white panels on a pale blue-white canvas, cobalt primary, navy/sky/teal/amber/coral data colors). Components must adhere to that imagery.
- Organization name and logo are placeholders until the user supplies real ones.

## Evidence on Hand

- `Private/Budget Fortmat/Budget Template Format.csv`, `Budget Summary Report.csv`, `Dropdown List.csv`, `Budget Template V2_4.xlsx`: the real budget structure and formula chain.
- `Private/UI samples/Capture 1–5.JPG`: visual reference.
- No real properties, projects, contractors, people, or financials exist in the repo. All mock data is synthetic and must be labeled as such; do not present it as real.

## Product Principles

1. **One number, one source.** Every figure traces to the formula chain or a named Finance feed; derived values are computed, never typed.
2. **Owner's structure first.** The Owner's classifications and codes lead; industry taxonomies (CSI, Uniformat) are lenses, not the spine.
3. **Density with a clear hierarchy.** Staff live in this tool all day; show more, but make the one number that matters unmistakable.
4. **Exposure over activity.** Surface variance, contingency drawdown, and schedule risk before throughput metrics.
5. **Desktop-grade ergonomics.** Keyboard-first navigation, fast search, no dead ends.

## Accessibility & Inclusion

WCAG 2.2 AA. User-adjustable contrast and text scaling in the top bar. Status is never conveyed by color alone.
