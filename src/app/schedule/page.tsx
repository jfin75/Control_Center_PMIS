import type { Metadata } from "next";
import { Suspense } from "react";
import { ScheduleView } from "@/components/schedule/ScheduleView";

export const metadata: Metadata = { title: "Schedule" };

export default function Page() {
  return (
    <Suspense>
      <ScheduleView />
    </Suspense>
  );
}
