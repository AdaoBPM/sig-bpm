import type { DashboardPeriodo } from "@/lib/dashboard-types";
import { getDashboardStats } from "@/lib/dashboard";

type DashboardStatsProps = {
  periodo?: DashboardPeriodo;
};

export async function DashboardStats({ periodo = "7d" }: DashboardStatsProps) {
  const stats = await getDashboardStats(periodo);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((card) => (
        <div
          key={card.label}
          className="rounded-sm border border-gray-200 bg-white p-6"
        >
          <p className="text-sm text-gray-600">{card.label}</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900">
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}
