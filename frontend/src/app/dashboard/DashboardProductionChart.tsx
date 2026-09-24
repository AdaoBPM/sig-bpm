"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { DashboardPeriodo, ProductionTrendPoint } from "@/lib/dashboard-types";

const chartConfig = {
  producao: {
    label: "Produção",
    color: "var(--color-bpm-primary)",
  },
  meta: {
    label: "Meta",
    color: "var(--color-bpm-secondary)",
  },
} satisfies ChartConfig;

const PERIOD_LABEL: Record<DashboardPeriodo, string> = {
  "7d": "últimos 7 dias",
  "30d": "últimos 30 dias",
  "90d": "últimos 90 dias",
};

type DashboardProductionChartProps = {
  data: ProductionTrendPoint[];
  periodo?: DashboardPeriodo;
};

export function DashboardProductionChart({
  data,
  periodo = "7d",
}: DashboardProductionChartProps) {
  const mediaProducao = Math.round(
    data.reduce((acc, item) => acc + item.producao, 0) / data.length,
  );

  return (
    <Card className="border-black/5 shadow-sm">
      <CardHeader>
        <CardTitle>Produção vs meta</CardTitle>
        <CardDescription>
          {PERIOD_LABEL[periodo]} — média {mediaProducao}% (dados mock)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-[16/7] min-h-[280px] w-full">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              unit="%"
              domain={[0, 100]}
            />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="producao"
              fill="var(--color-producao)"
              radius={[4, 4, 0, 0]}
            />
            <Bar dataKey="meta" fill="var(--color-meta)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
