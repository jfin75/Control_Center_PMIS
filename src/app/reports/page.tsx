import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportsView } from "@/components/reports/ReportsView";

export const metadata: Metadata = { title: "Reports" };

export default function Page() {
  return (
    <Suspense>
      <ReportsView />
    </Suspense>
  );
}
