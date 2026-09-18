import type { Metadata } from "next";
import { Suspense } from "react";
import { SubmittalsView } from "@/components/submittals/SubmittalsView";

export const metadata: Metadata = { title: "Submittals" };

export default function Page() {
  return (
    <Suspense>
      <SubmittalsView />
    </Suspense>
  );
}
