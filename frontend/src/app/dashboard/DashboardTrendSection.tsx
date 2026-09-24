import type { DashboardPeriodo } from "@/lib/dashboard-types";
import { getProductionTrend } from "@/lib/dashboard";

import { DashboardProductionChart } from "./DashboardProductionChart";

type DashboardTrendSectionProps = {
  periodo?: DashboardPeriodo;
};

export async function DashboardTrendSection({
  periodo = "7d",
}: DashboardTrendSectionProps) {
  const data = await getProductionTrend(periodo);
  return <DashboardProductionChart data={data} periodo={periodo} />;
}
