import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { AppShell } from "@/components/shell/AppShell";
import { PREFS_BOOT_SCRIPT } from "@/lib/prefs";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Control Center · Harborline Health", template: "%s · Control Center" },
  description: "Owner-focused capital program PMIS: portfolio, planning, projects, bidding, and cost control.",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

/*
 * Direction contract (kept in emitted markup for the finish review).
 */
const CONTRACT = `<!--
THESIS: An Owner's capital control room where every figure traces to the Owner's own A–K budget chain; refuses the contractor-side PM tool (RFI/submittal-first, gray enterprise grids).
OWN-WORLD: Pinned reference world (Private/UI samples): white borderless panels on a #F6F9FD canvas, cobalt #3681E6 fills with bold figures inside bars, navy/sky/teal/amber/coral series, uppercase segmented toggles, 10px panel radius, whisper shadows, Figtree with tabular figures.
STORY: An executive sees exposure first (variance, contingency, schedule risk); a cost controller follows the same number from summary to line item to invoice; a PM acts on it.
FIRST VIEWPORT: 52px top bar (org, environment, Ctrl+K omnibox, a11y, docs, bell, account); 232px sidebar collapsing to a 64px rail; Portfolio: title, five-cell KPI strip, then a full-width map panel with property list and a right slide-over.
FORM: Brief-pinned world and precisely specified surfaces; concept roll not run (pinned direction beats the roll). Seed key: none (pinned).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={figtree.variable} data-sidebar="expanded" data-env="production" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_BOOT_SCRIPT }} />
      </head>
      <body>
        <div hidden dangerouslySetInnerHTML={{ __html: CONTRACT }} />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
