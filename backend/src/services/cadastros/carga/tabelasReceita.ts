import { Prisma } from "../../../generated/prisma/client.js";
import type { Tx } from "../../importacoes/listas/processarLista.js";
import { lerTabela } from "./planilhaCadastros.js";

/**
 * As duas tabelas que a receita prévia consulta, das abas `Tipos de Movimento`
 * e `Tabela de Estacas` do SIG BPM 2026 - UNIDADES E CENTROS DE CUSTO:
 *
 *  - os tipos de movimento de venda: uma devolução só vira receita (negativa)
 *    quando o movimento está na tabela (Receita (Devoluções), colunas H e I);
 *  - o preço de tabela das estacas por m³ (VV e RL PROD.), que valora a
 *    variação do estoque de estacas na produção e na expedição.
 */

export type LinhaTipoMovimento = { MOVIMENTO: string | null; "DESCRIÇÃO": string | null; "RETORNA ESTOQUE?": string | null };
export type LinhaTabelaEstaca = {
  GRUPO: string | null;
  "SEÇÃO": string | null;
  "PEÇA": string | null;
  "VV (R$/m³)": string | null;
  "RL PROD. (R$/m³)": string | null;
};
export type TabelasReceita = { tiposMovimento: LinhaTipoMovimento[]; estacas: LinhaTabelaEstaca[] };

export function lerTabelasReceita(buffer: Uint8Array): TabelasReceita {
  return {
    tiposMovimento: lerTabela<LinhaTipoMovimento>(buffer, "Tipos de Movimento"),
    estacas: lerTabela<LinhaTabelaEstaca>(buffer, "Tabela de Estacas"),
  };
}

/** Início da vigência da tabela de estacas carregada da planilha. */
const VIGENCIA_PLANILHA = new Date(Date.UTC(2026, 0, 1));

/**
 * Grava as duas tabelas como estão na planilha: o que saiu da planilha sai do
 * cadastro. A tabela de estacas é substituída na vigência da planilha; a
 * historização de preço por vigência entra com a edição na tela (Passo 25).
 */
export async function gravarTabelasReceita(tx: Tx, t: TabelasReceita) {
  const tipos = t.tiposMovimento.filter((l) => l.MOVIMENTO);
  for (const [i, l] of tipos.entries()) {
    const dados = {
      descricao: l["DESCRIÇÃO"] ?? l.MOVIMENTO!,
      retornaEstoque: (l["RETORNA ESTOQUE?"] ?? "").toUpperCase().startsWith("S"),
      ordem: i + 1,
      ativo: true,
    };
    await tx.tipoMovimento.upsert({ where: { codigo: l.MOVIMENTO! }, create: { codigo: l.MOVIMENTO!, ...dados }, update: dados });
  }
  // Movimento que saiu da planilha fica inativo: pode estar ligado a listas já importadas.
  await tx.tipoMovimento.updateMany({ where: { codigo: { notIn: tipos.map((l) => l.MOVIMENTO!) } }, data: { ativo: false } });

  const estacas = t.estacas.filter((l) => l.GRUPO && l["SEÇÃO"]);
  await tx.tabelaEstaca.deleteMany({ where: { vigenciaInicio: VIGENCIA_PLANILHA } });
  await tx.tabelaEstaca.createMany({
    data: estacas.map((l, i) => ({
      grupo: l.GRUPO!,
      secao: l["SEÇÃO"]!,
      peca: l["PEÇA"] ?? `${l.GRUPO}${l["SEÇÃO"]!.slice(0, 2)}`,
      precoUnitario: new Prisma.Decimal(l["VV (R$/m³)"] ?? 0),
      precoLiquido: new Prisma.Decimal(l["RL PROD. (R$/m³)"] ?? 0),
      vigenciaInicio: VIGENCIA_PLANILHA,
      ordem: i + 1,
    })),
  });
  return { tiposMovimento: tipos.length, estacas: estacas.length };
}
