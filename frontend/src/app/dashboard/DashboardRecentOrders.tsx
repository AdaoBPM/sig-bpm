"use client";

import { AlertCircle, Inbox } from "lucide-react";

import { OrderStatusBadge } from "@/components/shared/OrderStatusBadge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/utils/formatters";
import type { RecentOrder } from "@/lib/dashboard-types";

type DashboardRecentOrdersProps = {
  orders: RecentOrder[];
  demo?: string | null;
};

export function DashboardRecentOrders({ orders, demo }: DashboardRecentOrdersProps) {
  const isLoading = demo === "loading";
  const error = demo === "erro" ? "Não foi possível carregar os pedidos." : null;
  const data = demo === "vazio" ? [] : orders;

  return (
    <Card className="border-black/5 shadow-sm">
      <CardHeader>
        <CardTitle>Últimos pedidos</CardTitle>
        <CardDescription>
          Tabela shadcn com badges de status — referência para listagens do SPEC.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Inbox className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">Nenhum pedido no período</p>
            <p className="text-xs text-muted-foreground">
              Ajuste o filtro ou importe dados reais conforme o SPEC.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.id}</TableCell>
                  <TableCell>{item.cliente}</TableCell>
                  <TableCell>
                    <OrderStatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(item.valor)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.data}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
