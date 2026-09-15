import type { Metadata } from "next";
import { Suspense } from "react";
import { CostSummaryView } from "@/components/cost/CostSummaryView";

export const metadata: Metadata = { title: "Cost Summary" };

export default function Page() {
  return (
    <Suspense>
      <CostSummaryView />
    </Suspense>
  );
}
