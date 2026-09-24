import { cacheLife } from "next/cache";

import {
  getDashboardStatsSync,
  getProductionTrendSync,
  getRecentOrdersSync,
} from "./dashboard-mocks";
import type { DashboardPeriodo } from "./dashboard-types";

export async function getDashboardStats(
  periodo: DashboardPeriodo = "7d",
) {
  "use cache";
  cacheLife("minutes");
  void periodo;
  return getDashboardStatsSync(periodo);
}

export async function getProductionTrend(
  periodo: DashboardPeriodo = "7d",
) {
  "use cache";
  cacheLife("minutes");
  void periodo;
  return getProductionTrendSync(periodo);
}

export async function getRecentOrders(
  periodo: DashboardPeriodo = "7d",
) {
  "use cache";
  cacheLife("minutes");
  void periodo;
  return getRecentOrdersSync(periodo);
}
