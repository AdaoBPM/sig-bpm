"use client";

import { useState } from "react";
import { Download, Sparkles } from "lucide-react";

import {
  getDashboardStatsSync,
  getProductionTrendSync,
  getRecentOrdersSync,
} from "@/lib/dashboard-mocks";
import type { DashboardPeriodo } from "@/lib/dashboard-types";

import { DashboardClientEffects } from "./DashboardClientEffects";
import { DashboardExportCsv } from "./DashboardExportCsv";
import { DashboardFilters } from "./DashboardFilters";
import { DashboardKpiCards } from "./DashboardKpiCards";
import { DashboardProductionChart } from "./DashboardProductionChart";
import { DashboardRecentOrders } from "./DashboardRecentOrders";
import { DashboardUiDemo } from "./DashboardUiDemo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function DashboardView() {
  const [periodo, setPeriodo] = useState<DashboardPeriodo>("7d");
  const [demo, setDemo] = useState<string | null>(null);

  const stats = getDashboardStatsSync(periodo);
  const trend = getProductionTrendSync(periodo);
  const orders = getRecentOrdersSync(periodo);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Painel operacional</h1>
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="size-3" />
              Mock
            </Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Insights com shadcn/ui (Card, Tabs, Table, Sidebar) e Recharts via{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">ChartContainer</code>.
            Substitua pelos indicadores do seu SPEC.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DashboardExportCsv orders={orders} periodo={periodo} />
          <Button type="button" variant="outline" size="sm" className="gap-1.5">
            <Download className="size-3.5" />
            Relatório
          </Button>
        </div>
      </div>

      <DashboardFilters
        periodo={periodo}
        demo={demo}
        onPeriodoChange={setPeriodo}
        onDemoChange={setDemo}
      />

      <DashboardKpiCards stats={stats} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DashboardProductionChart data={trend} periodo={periodo} />
        </div>
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-black/5 bg-card p-4 shadow-sm">
            <p className="text-sm font-medium">Resumo do período</p>
            <Separator className="my-3" />
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Pedidos listados</dt>
                <dd className="font-medium tabular-nums">{orders.length}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Média produção</dt>
                <dd className="font-medium tabular-nums">
                  {Math.round(
                    trend.reduce((acc, p) => acc + p.producao, 0) / trend.length,
                  )}
                  %
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Componentes UI</dt>
                <dd className="text-right font-medium">shadcn + Recharts</dd>
              </div>
            </dl>
          </div>
          <DashboardUiDemo />
        </div>
      </div>

      <DashboardRecentOrders orders={orders} demo={demo} />
      <DashboardClientEffects />
    </div>
  );
}
