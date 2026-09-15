import type { Metadata } from "next";
import { Suspense } from "react";
import { BudgetDetailsView } from "@/components/cost/BudgetDetailsView";

export const metadata: Metadata = { title: "Budget Details" };

export default function Page() {
  return (
    <Suspense>
      <BudgetDetailsView />
    </Suspense>
  );
}
