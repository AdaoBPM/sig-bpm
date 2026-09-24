import { PEDIDOS_STATUS } from "./constants";

export type PedidoListagem = {
  id: string;
  cliente: string;
  status: (typeof PEDIDOS_STATUS)[keyof typeof PEDIDOS_STATUS];
  valor: number;
  criadoEm: string;
};

export const PEDIDOS_MOCK: PedidoListagem[] = [
  {
    id: "PED-1042",
    cliente: "Construtora Alfa",
    status: PEDIDOS_STATUS.NOVO,
    valor: 42800.5,
    criadoEm: "26/06/2026",
  },
  {
    id: "PED-1040",
    cliente: "Obras Beta Ltda",
    status: PEDIDOS_STATUS.APROVADO,
    valor: 19200,
    criadoEm: "25/06/2026",
  },
  {
    id: "PED-1038",
    cliente: "Engenharia Gama",
    status: PEDIDOS_STATUS.ENTREGUE,
    valor: 67500,
    criadoEm: "24/06/2026",
  },
  {
    id: "PED-1031",
    cliente: "Delta Pré-Moldados",
    status: PEDIDOS_STATUS.APROVADO,
    valor: 31500,
    criadoEm: "18/06/2026",
  },
];

export const STATUS_LABEL: Record<PedidoListagem["status"], string> = {
  [PEDIDOS_STATUS.NOVO]: "Novo",
  [PEDIDOS_STATUS.APROVADO]: "Aprovado",
  [PEDIDOS_STATUS.ENTREGUE]: "Entregue",
};
