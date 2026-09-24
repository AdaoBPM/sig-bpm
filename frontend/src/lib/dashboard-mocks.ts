import type {
  DashboardPeriodo,
  DashboardStat,
  ProductionTrendPoint,
  RecentOrder,
} from "./dashboard-types";

export const STATS_BY_PERIOD: Record<DashboardPeriodo, DashboardStat[]> = {
  "7d": [
    {
      label: "Pedidos pendentes",
      value: "12",
      description: "Aguardando aprovação",
      delta: "+2",
      trend: "up",
      icon: "clipboard",
    },
    {
      label: "Produção hoje",
      value: "84%",
      description: "Meta do turno",
      delta: "+5%",
      trend: "up",
      icon: "gauge",
    },
    {
      label: "Entregas no prazo",
      value: "96%",
      description: "SLA logístico",
      delta: "-1%",
      trend: "down",
      icon: "truck",
    },
  ],
  "30d": [
    {
      label: "Pedidos pendentes",
      value: "38",
      description: "Backlog mensal",
      delta: "+6",
      trend: "up",
      icon: "clipboard",
    },
    {
      label: "Produção média",
      value: "81%",
      description: "Média dos turnos",
      delta: "+2%",
      trend: "up",
      icon: "gauge",
    },
    {
      label: "Entregas no prazo",
      value: "93%",
      description: "SLA logístico",
      delta: "-2%",
      trend: "down",
      icon: "truck",
    },
  ],
  "90d": [
    {
      label: "Pedidos pendentes",
      value: "104",
      description: "Acumulado trimestre",
      delta: "+14",
      trend: "up",
      icon: "clipboard",
    },
    {
      label: "Produção média",
      value: "79%",
      description: "Média consolidada",
      delta: "0%",
      trend: "neutral",
      icon: "gauge",
    },
    {
      label: "Entregas no prazo",
      value: "91%",
      description: "SLA logístico",
      delta: "+1%",
      trend: "up",
      icon: "truck",
    },
  ],
};

export const TREND_BY_PERIOD: Record<DashboardPeriodo, ProductionTrendPoint[]> = {
  "7d": [
    { day: "Seg", producao: 72, meta: 80 },
    { day: "Ter", producao: 85, meta: 80 },
    { day: "Qua", producao: 78, meta: 80 },
    { day: "Qui", producao: 91, meta: 80 },
    { day: "Sex", producao: 84, meta: 80 },
  ],
  "30d": [
    { day: "S1", producao: 76, meta: 80 },
    { day: "S2", producao: 82, meta: 80 },
    { day: "S3", producao: 79, meta: 80 },
    { day: "S4", producao: 88, meta: 80 },
  ],
  "90d": [
    { day: "Jan", producao: 74, meta: 80 },
    { day: "Fev", producao: 78, meta: 80 },
    { day: "Mar", producao: 81, meta: 80 },
  ],
};

export const ORDERS_BY_PERIOD: Record<DashboardPeriodo, RecentOrder[]> = {
  "7d": [
    { id: "PED-1042", cliente: "Construtora Alfa", status: "novo", valor: 42800.5, data: "26/06" },
    { id: "PED-1040", cliente: "Obras Beta", status: "aprovado", valor: 19200, data: "25/06" },
    { id: "PED-1038", cliente: "Eng. Gama", status: "entregue", valor: 67500, data: "24/06" },
  ],
  "30d": [
    { id: "PED-1042", cliente: "Construtora Alfa", status: "novo", valor: 42800.5, data: "26/06" },
    { id: "PED-1031", cliente: "Delta Pré-Moldados", status: "aprovado", valor: 31500, data: "18/06" },
    { id: "PED-1024", cliente: "Epsilon Obras", status: "entregue", valor: 89000, data: "10/06" },
    { id: "PED-1019", cliente: "Zeta Engenharia", status: "entregue", valor: 22100, data: "05/06" },
  ],
  "90d": [
    { id: "PED-1042", cliente: "Construtora Alfa", status: "novo", valor: 42800.5, data: "26/06" },
    { id: "PED-0988", cliente: "Grupo Horizonte", status: "entregue", valor: 156000, data: "12/04" },
    { id: "PED-0971", cliente: "Infra Norte", status: "aprovado", valor: 44200, data: "28/03" },
  ],
};

export function getDashboardStatsSync(periodo: DashboardPeriodo): DashboardStat[] {
  return STATS_BY_PERIOD[periodo];
}

export function getProductionTrendSync(periodo: DashboardPeriodo): ProductionTrendPoint[] {
  return TREND_BY_PERIOD[periodo];
}

export function getRecentOrdersSync(periodo: DashboardPeriodo): RecentOrder[] {
  return ORDERS_BY_PERIOD[periodo];
}
