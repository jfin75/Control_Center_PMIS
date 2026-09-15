import type { Metadata } from "next";
import { TimeView } from "@/components/time/TimeView";

export const metadata: Metadata = { title: "Time Tracking" };

export default function Page() {
  return <TimeView />;
}
