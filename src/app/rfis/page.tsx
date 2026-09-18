import type { Metadata } from "next";
import { Suspense } from "react";
import { RfisView } from "@/components/rfis/RfisView";

export const metadata: Metadata = { title: "RFIs" };

export default function Page() {
  return (
    <Suspense>
      <RfisView />
    </Suspense>
  );
}
