import type { Metadata } from "next";
import { Suspense } from "react";
import { ForecastsView } from "@/components/cost/ForecastsView";

export const metadata: Metadata = { title: "Forecasts" };

export default function Page() {
  return (
    <Suspense>
      <ForecastsView />
    </Suspense>
  );
}
