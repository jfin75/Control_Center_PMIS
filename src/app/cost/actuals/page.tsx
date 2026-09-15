import type { Metadata } from "next";
import { Suspense } from "react";
import { ActualsView } from "@/components/cost/ActualsView";

export const metadata: Metadata = { title: "Actual Costs" };

export default function Page() {
  return (
    <Suspense>
      <ActualsView />
    </Suspense>
  );
}
