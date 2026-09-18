# Control Center

An Owner-focused PMIS for a capital program: Portfolio, Dashboard, Planning, Projects, Workload, Bidding, Cost, Reports, Time Tracking, and Settings. It's one static Next.js build that ships to **Vercel** and runs as a **Tauri** desktop app on macOS and Windows.

> **All data in `src/mock/` is synthetic.** Harborline Health, its properties, people, contractors, and dollars are made up. The budget structure (Level 1 classifications, cost codes 1.01–9.01, change classifiers, and the A–K formula chain) comes from the Owner's template in `Private/Budget Fortmat/`. Three projects reuse the dollar rows from the Owner's Budget Summary Report, so the rollup can be checked against it line by line.

## Stack

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, built with `output: "export"` (no server runtime)
- `lucide-react` for icons, `recharts` for charts, `maplibre-gl` with OpenFreeMap Positron tiles (no API key), `@dnd-kit` for dashboard drag and drop
- Figtree (self-hosted via `next/font`) with tabular figures

## Run

```bash
npm install          # also copies the MapLibre worker into public/maplibre
npm run dev          # http://localhost:3000
npm run build        # static site in ./out
npm run typecheck
```

### Deploy to Vercel

Import the repo. Vercel detects Next.js and serves the static export. You don't need any environment variables.

### Desktop (Tauri v2)

You need the Rust toolchain and the platform prerequisites from the Tauri docs.

```bash
npm run desktop:dev     # runs next dev inside a native window
npm run desktop:build   # builds ./out, then bundles .msi/.exe (Windows) or .app/.dmg (macOS)
```

`src-tauri/tauri.conf.json` points `frontendDist` at `../out`. Its CSP allows only this app and `tiles.openfreemap.org`. Before shipping, change `identifier` (currently `com.example.controlcenter`). File exports use browser downloads. In the macOS webview those downloads need `tauri-plugin-dialog` and `tauri-plugin-fs` to save to disk, which aren't wired in yet.

## Where things live

| Path | What |
|---|---|
| `src/styles/tokens.css` | Design tokens pulled from `Private/UI samples` (palette, radii, shadows, motion, a11y modes) |
| `src/app/globals.css` | Tailwind theme wired to the tokens (the default palette is cleared on purpose) |
| `src/lib/budget.ts` | The A–K budget chain. Every derived figure in the app comes from here |
| `src/mock/` | Synthetic data plus the Owner's real cost-code structure (`costCodes.ts`) |
| `src/components/shell/` | Top bar, collapsible sidebar (`Ctrl/⌘+B`), omnibox (`Ctrl/⌘+K`), Resource Center |
| `src/components/<module>/` | One folder per module |

## Replacing mock data

- Workday Financials: A (Original Budget), D (Commitments), I (Payments), invoices
- Primavera P6: milestones, SPI
- Lease administration: leases, rent roll
- Esri ArcGIS: parcel geometry. Today the site boundary is estimated from acreage.

Put a data layer behind `src/lib/selectors.ts` and `src/mock/finance.ts`. The views only use those functions.
