"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/overlay";
import { Tabs } from "@/components/ui/controls";
import { CHAIN_COLUMNS } from "@/lib/budget";
import { useModKey } from "./useShortcuts";

type Tab = "guides" | "shortcuts" | "formulas" | "data";

const GUIDES = [
  {
    title: "Reading the budget chain",
    body: "Every cost view uses the Owner’s eleven-column chain from the Budget Summary Report. Original Budget (A), Commitments (D) and Payments (I) arrive from Workday; Adjustments (B) move only through a tracked funding action; Projected Remaining Commitments (F) is the PM’s forecast. Everything else is calculated and cannot be typed over.",
  },
  {
    title: "Why Forecast (G) is not the same as Paid (I)",
    body: "G = D + F is what the project will cost when every commitment is let. I is cash out the door. The gap between them is the Estimate to Complete shown on Forecasts and the forward curve on Cash Flow.",
  },
  {
    title: "Classifying a change",
    body: "Change orders post to 3.03 Construction – Change Orders with one classifier: OC Owner Change, AEO Architect Error & Omission, EEO Engineer Error & Omission, LC Latent Condition, or MISC. Pending PCOs name the contingency they will draw from so exposure shows up before approval.",
  },
  {
    title: "Leveling a bid",
    body: "Bidding levels each proposal by plugging any excluded scope with the Owner’s plug value, so the lowest base bid is not mistaken for the lowest cost. The recommended award is the lowest leveled, responsive, prequalified bid unless the rationale says otherwise.",
  },
];

export function ResourceCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("guides");
  const mod = useModKey();
  const shortcuts: Array<[string, string]> = [
    [`${mod} K`, "Search properties, projects, cost codes, contractors"],
    [`${mod} B`, "Collapse or expand the sidebar"],
    ["↑ ↓ then Enter", "Move through and open search results"],
    ["Esc", "Close any drawer, menu or dialog"],
    ["← →", "Switch segmented controls and tabs"],
    ["Tab / Shift Tab", "Move between controls; focus is always visible"],
  ];
  return (
    <Modal open={open} onClose={onClose} title="Resource Center" description="Guides, shortcuts, and the formulas behind every figure" className="w-[min(46rem,calc(100vw-2rem))]">
      <div className="px-5">
        <Tabs
          idBase="rc"
          label="Resource Center sections"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "guides", label: "Guides" },
            { value: "shortcuts", label: "Keyboard" },
            { value: "formulas", label: "Budget formulas" },
            { value: "data", label: "About this data" },
          ]}
        />
      </div>
      <div id="rc-panel" role="tabpanel" aria-labelledby={`rc-tab-${tab}`} className="overflow-y-auto px-5 py-4">
        {tab === "guides" && (
          <div className="space-y-5">
            {GUIDES.map((g) => (
              <article key={g.title}>
                <h3 className="text-md font-semibold text-ink">{g.title}</h3>
                <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-ink-2">{g.body}</p>
              </article>
            ))}
          </div>
        )}
        {tab === "shortcuts" && (
          <table className="dt compact">
            <tbody>
              {shortcuts.map(([k, d]) => (
                <tr key={k}>
                  <td className="w-44">
                    <kbd className="rounded-xs border border-line bg-surface-2 px-2 py-0.5 text-xs font-semibold text-ink">{k}</kbd>
                  </td>
                  <td className="text-ink-2">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === "formulas" && (
          <table className="dt compact">
            <thead>
              <tr>
                <th>Col.</th>
                <th>Measure</th>
                <th>Formula</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {CHAIN_COLUMNS.map((c) => (
                <tr key={c.key}>
                  <td className="font-bold text-accent-ink">{c.letter}</td>
                  <td className="text-ink">{c.label}</td>
                  <td className="num text-ink-2">{c.formula ?? "—"}</td>
                  <td className="text-ink-2">{c.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === "data" && (
          <div className="max-w-[68ch] space-y-3 text-sm leading-relaxed text-ink-2">
            <p>
              <strong className="text-ink">Everything in this build is synthetic demonstration data.</strong> Harborline Health, its properties, people, contractors, and dollars are invented.
              The budget structure, cost codes, change classifiers, and formula chain are the Owner’s real template.
            </p>
            <p>Three projects — Eastside ED, Capitol MRI, and Surgical Tower L4 — reuse the dollar rows of the Owner’s Budget Summary Report so the rollup can be checked against it line for line.</p>
            <p>Replace the files in <code className="rounded-xs bg-sunk px-1 text-xs">src/mock/</code> with Workday, P6, and lease-administration feeds before production use.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
