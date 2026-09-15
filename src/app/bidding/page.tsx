import type { Metadata } from "next";
import { Suspense } from "react";
import { BiddingView } from "@/components/bidding/BiddingView";

export const metadata: Metadata = { title: "Bidding" };

export default function Page() {
  return (
    <Suspense>
      <BiddingView />
    </Suspense>
  );
}
