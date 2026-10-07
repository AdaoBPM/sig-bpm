export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** "2026-08" → { ano: 2026, mes: 8 }, ou null se a URL não for uma competência. */
export function lerAnoMes(anoMes: string): { ano: number; mes: number } | null {
  const m = anoMes.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const mes = Number(m[2]);
  return mes >= 1 && mes <= 12 ? { ano: Number(m[1]), mes } : null;
}

export function rotuloCompetencia(ano: number, mes: number) {
  return `${String(mes).padStart(2, "0")}/${ano}`;
}

/** Valores chegam como texto decimal do backend, para não perder centavos. */
export function moeda(valor: string | number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor));
}

export function inteiro(valor: number) {
  return new Intl.NumberFormat("pt-BR").format(valor);
}

export function dataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const ROTULO_REJEICAO: Record<string, string> = {
  FILIAL_INVALIDA: "Filial inválida",
  CONTA_AUSENTE: "Sem conta",
  CONTA_NAO_CADASTRADA: "Conta fora do cadastro",
  VALOR_INVALIDO: "Valor inválido",
  TOTAL_DIVERGENTE: "Total ≠ crédito + débito",
  LINHA_DUPLICADA: "Linha repetida",
  DATA_INVALIDA: "Data inválida",
  UNIDADE_INVALIDA: "Unidade inválida",
  QUANTIDADE_INVALIDA: "Quantidade inválida",
  VERSAO_INVALIDA: "Versão inválida",
};

export const ROTULO_TIPO: Record<string, string> = {
  BALANCETE: "Balancete",
  PROJETO: "Projetos",
  PRODUCAO: "Produção (m³)",
  PRODUCAO_PISTA: "Produção (pistas)",
  PRODUCAO_ARMADURA: "Armadura",
  PRODUCAO_METALURGIA: "Metalurgia",
  EXPEDICAO: "Expedição",
  MONTAGEM: "Montagem",
  ACOMPANHAMENTO: "Acompanhamento",
  DRE_COMERCIAL: "DRE do Comercial",
  ESTOQUE_INICIAL: "Saldo inicial do estoque",
  MEDICAO: "Medições",
  DEVOLUCAO: "Devoluções",
  SAIDA: "Saídas",
};
