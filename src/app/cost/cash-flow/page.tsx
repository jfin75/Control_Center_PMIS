import type { Metadata } from "next";
import { Suspense } from "react";
import { CashFlowView } from "@/components/cost/CashFlowView";

export const metadata: Metadata = { title: "Cash Flow" };

export default function Page() {
  return (
    <Suspense>
      <CashFlowView />
    </Suspense>
  );
}
