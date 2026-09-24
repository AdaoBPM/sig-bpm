"use client";

import { toast } from "sonner";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ordersToCsv, type RecentOrder } from "@/lib/dashboard-types";

type DashboardExportCsvProps = {
  orders: RecentOrder[];
  periodo: string;
};

export function DashboardExportCsv({ orders, periodo }: DashboardExportCsvProps) {
  function handleExport() {
    if (orders.length === 0) {
      toast.warning("Não há dados para exportar no período.");
      return;
    }

    const csv = ordersToCsv(orders);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pedidos-${periodo}-mock.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado.");
  }

  return (
    <Button type="button" size="sm" variant="default" className="gap-1.5" onClick={handleExport}>
      <Download className="size-3.5" />
      Exportar CSV
    </Button>
  );
}
