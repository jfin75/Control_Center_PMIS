import type { Metadata } from "next";
import { Suspense } from "react";
import { ContractsView } from "@/components/contracts/ContractsView";

export const metadata: Metadata = { title: "Contracts" };

export default function Page() {
  return (
    <Suspense>
      <ContractsView />
    </Suspense>
  );
}
