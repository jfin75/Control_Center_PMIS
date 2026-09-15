import type { Metadata } from "next";
import { Suspense } from "react";
import { PortfolioView } from "@/components/portfolio/PortfolioView";

export const metadata: Metadata = { title: "Portfolio" };

/** The static export has no server redirects, so the root renders Portfolio directly. */
export default function Home() {
  return (
    <Suspense>
      <PortfolioView />
    </Suspense>
  );
}
