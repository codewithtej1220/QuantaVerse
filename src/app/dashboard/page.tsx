import type { Metadata } from "next";

import { DashboardView } from "@/components/dashboard/dashboard-view";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Mastery level, skill graph, badges and a 12-week practice log — every number counted from circuits you actually ran.",
};

export default function DashboardPage() {
  return <DashboardView />;
}
