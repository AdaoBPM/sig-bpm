"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DashboardPeriodo } from "@/lib/dashboard-types";

const PERIODOS: { value: DashboardPeriodo; label: string }[] = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
];

type DashboardFiltersProps = {
  periodo: DashboardPeriodo;
  demo: string | null;
  onPeriodoChange: (periodo: DashboardPeriodo) => void;
  onDemoChange: (demo: string | null) => void;
};

export function DashboardFilters({
  periodo,
  demo,
  onPeriodoChange,
  onDemoChange,
}: DashboardFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Tabs
        value={periodo}
        onValueChange={(value) => onPeriodoChange(value as DashboardPeriodo)}
      >
        <TabsList>
          {PERIODOS.map(({ value, label }) => (
            <TabsTrigger key={value} value={value}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Tabs
        value={demo ?? "normal"}
        onValueChange={(value) =>
          onDemoChange(value === "normal" ? null : value)
        }
      >
        <TabsList variant="line" className="h-8">
          <TabsTrigger value="normal">Dados</TabsTrigger>
          <TabsTrigger value="vazio">Vazio</TabsTrigger>
          <TabsTrigger value="erro">Erro</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
