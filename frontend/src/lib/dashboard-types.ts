export type DashboardPeriodo = "7d" | "30d" | "90d";

export type DashboardStat = {
  label: string;
  value: string;
  description: string;
  delta: string;
  trend: "up" | "down" | "neutral";
  icon: "clipboard" | "gauge" | "truck";
};

export type ProductionTrendPoint = {
  day: string;
  producao: number;
  meta: number;
};

export type RecentOrder = {
  id: string;
  cliente: string;
  status: "novo" | "aprovado" | "entregue";
  valor: number;
  data: string;
};

export function parseDashboardPeriodo(value: string | undefined): DashboardPeriodo {
  if (value === "30d" || value === "90d") return value;
  return "7d";
}

export function ordersToCsv(orders: RecentOrder[]): string {
  const header = "id,cliente,status,valor,data";
  const rows = orders.map(
    (o) => `${o.id},${o.cliente},${o.status},${o.valor},${o.data}`,
  );
  return [header, ...rows].join("\n");
}
