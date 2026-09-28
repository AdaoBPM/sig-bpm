import { Prisma } from "../../generated/prisma/client.js";
import type { TipoListaRateio } from "../importacoes/listas/definicoesListas.js";
import {
  destinoDaArmadura,
  destinoDaFinalidade,
  destinoDoAcompanhamento,
} from "../importacoes/listas/destinosVolume.js";

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

/**
 * As linhas da aba Totais do BASE REALIZADO (OPERAÇÃO) — os volumes físicos de
 * que saem os percentuais de rateio. A mesma regra serve ao relatório da
 * importação e à conferência contra a planilha; o Passo 15 parte daqui.
 */
export const LINHAS_TOTAIS = [
  { codigo: "PROJETOS_MATRIZ", rotulo: "(P) Projetos Liberados: Matriz", tipo: "PROJETO", medida: "m³" },
  { codigo: "PROJETOS_FILIAL", rotulo: "(P) Projetos Liberados: Filial", tipo: "PROJETO", medida: "m³" },
  { codigo: "PREFABRICADO_MATRIZ", rotulo: "(P) Pré-Fabricado: Matriz", tipo: "PRODUCAO", medida: "m³" },
  { codigo: "PREFABRICADO_FILIAL", rotulo: "(P) Pré-Fabricado: Filial", tipo: "PRODUCAO", medida: "m³" },
  { codigo: "PREFABRICADO_PISTAS", rotulo: "(P) Pré-Fabricado: Pistas", tipo: "PRODUCAO_PISTA", medida: "und" },
  { codigo: "METALURGIA_MATRIZ", rotulo: "(P) Metalurgia: Matriz", tipo: "PRODUCAO_METALURGIA", medida: "kg" },
  { codigo: "METALURGIA_FILIAL", rotulo: "(P) Metalurgia: Filial", tipo: "PRODUCAO_METALURGIA", medida: "kg" },
  { codigo: "METALURGIA_MONTAGEM", rotulo: "(P) Metalurgia: Montagem", tipo: "PRODUCAO_METALURGIA", medida: "kg" },
  { codigo: "METALURGIA_COMPLEMENTAR", rotulo: "(P) Metalurgia: Complementar", tipo: "PRODUCAO_METALURGIA", medida: "kg" },
  { codigo: "ARMADURA_MATRIZ", rotulo: "(P) Armadura: Matriz", tipo: "PRODUCAO_ARMADURA", medida: "kg" },
  { codigo: "ARMADURA_FILIAL", rotulo: "(P) Armadura: Filial", tipo: "PRODUCAO_ARMADURA", medida: "kg" },
  { codigo: "ARMADURA_MONTAGEM", rotulo: "(P) Armadura: Montagem", tipo: "PRODUCAO_ARMADURA", medida: "kg" },
  { codigo: "ARMADURA_COMPLEMENTAR", rotulo: "(P) Armadura: Complementar", tipo: "PRODUCAO_ARMADURA", medida: "kg" },
  { codigo: "EXPEDICAO_MATRIZ", rotulo: "(S) Expedição: Matriz", tipo: "EXPEDICAO", medida: "m³" },
  { codigo: "EXPEDICAO_FILIAL", rotulo: "(S) Expedição: Filial", tipo: "EXPEDICAO", medida: "m³" },
  { codigo: "MONTAGEM", rotulo: "(S) Montagem", tipo: "MONTAGEM", medida: "m³" },
  { codigo: "ACOMPANHAMENTO_MONTAGEM", rotulo: "(S) Acompanhamento: Montagem", tipo: "ACOMPANHAMENTO", medida: "d" },
  { codigo: "ACOMPANHAMENTO_COMPLEMENTAR", rotulo: "(S) Acompanhamento: Complementar", tipo: "ACOMPANHAMENTO", medida: "d" },
] as const satisfies ReadonlyArray<{ codigo: string; rotulo: string; tipo: TipoListaRateio; medida: string }>;

export type CodigoTotais = (typeof LINHAS_TOTAIS)[number]["codigo"];

/** O mínimo de cada registro que a regra dos Totais usa. */
export type ItemVolume = {
  tipo: TipoListaRateio;
  quantidade: Decimal;
  /** 1 Matriz, 2 Filial, 3 Serviços. */
  unidade: number | null;
  linha: string | null;
  /** Venda global: obra de sigla iniciada por G. */
  obraGlobal: boolean;
  finalidade?: string | null;
  categoria?: string | null;
  etapa?: string | null;
};

/** Em que linha dos Totais o item entra — ou em nenhuma. */
export function linhaDosTotais(i: ItemVolume): CodigoTotais | null {
  const porUnidade = (prefixo: "PROJETOS" | "PREFABRICADO" | "EXPEDICAO") =>
    i.unidade === 1 ? (`${prefixo}_MATRIZ` as const) : i.unidade === 2 ? (`${prefixo}_FILIAL` as const) : null;
  switch (i.tipo) {
    case "PROJETO":
      // Só venda global entra no rateio de projeto.
      return i.obraGlobal ? porUnidade("PROJETOS") : null;
    case "PRODUCAO":
      return porUnidade("PREFABRICADO");
    case "PRODUCAO_PISTA":
      return "PREFABRICADO_PISTAS";
    case "PRODUCAO_METALURGIA": {
      const d = destinoDaFinalidade(i.finalidade ?? "");
      return d ? (`METALURGIA_${d}` as const) : null;
    }
    case "PRODUCAO_ARMADURA": {
      const d = destinoDaArmadura(i.categoria ?? "");
      return d ? (`ARMADURA_${d}` as const) : null;
    }
    case "EXPEDICAO":
      return porUnidade("EXPEDICAO");
    case "MONTAGEM":
      // Montagem de estacas não entra no rateio de montagem.
      return i.linha === "ESTACAS" ? null : "MONTAGEM";
    case "ACOMPANHAMENTO":
      return `ACOMPANHAMENTO_${destinoDoAcompanhamento(i.etapa ?? null)}` as const;
  }
}

/** Soma os itens por linha dos Totais. Linhas sem item ficam zeradas. */
export function somarTotais(itens: ItemVolume[], tipos?: TipoListaRateio[]) {
  const soma = new Map<CodigoTotais, Decimal>();
  for (const l of LINHAS_TOTAIS) {
    if (!tipos || tipos.includes(l.tipo)) soma.set(l.codigo, new Decimal(0));
  }
  for (const i of itens) {
    const codigo = linhaDosTotais(i);
    if (codigo && soma.has(codigo)) soma.set(codigo, soma.get(codigo)!.plus(i.quantidade));
  }
  return LINHAS_TOTAIS.filter((l) => soma.has(l.codigo)).map((l) => ({
    codigo: l.codigo,
    tipo: l.tipo,
    rotulo: l.rotulo,
    medida: l.medida,
    quantidade: soma.get(l.codigo)!,
  }));
}
