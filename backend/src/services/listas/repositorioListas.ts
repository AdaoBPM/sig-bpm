import { getPrismaClient } from "../../config/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { TipoListaRateio } from "../importacoes/listas/definicoesListas.js";
import type { Tx } from "../importacoes/listas/processarLista.js";

/**
 * Leitura, edição e exclusão de um registro de lista operacional. O Prisma não
 * tem delegate genérico — cada lista é um modelo —, então cada operação tem um
 * caso por modelo. A gravação em lote fica em processarLista.ts (gravar).
 */

/** O que toda lista tem, mais os campos próprios, na forma devolvida pelo Prisma. */
export type RegistroBruto = {
  id: string;
  importacaoId: string | null;
  linhaArquivo: number | null;
  quantidade: Prisma.Decimal;
  unidadeNegocio: { codigo: number; nome: string } | null;
  obra: { codigo: string; nome: string } | null;
  linha?: { codigo: string; nome: string } | null;
  [campo: string]: unknown;
};

const INCLUIR = {
  unidadeNegocio: { select: { codigo: true, nome: true } },
  obra: { select: { codigo: true, nome: true } },
} as const;
const INCLUIR_COM_LINHA = { ...INCLUIR, linha: { select: { codigo: true, nome: true } } } as const;

type Filtro = { competenciaId: string; busca?: string };

function where(f: Filtro) {
  const busca = f.busca?.trim();
  return {
    competenciaId: f.competenciaId,
    ...(busca
      ? { OR: [{ obra: { codigo: { contains: busca } } }, { obra: { nome: { contains: busca } } }] }
      : {}),
  };
}

const ORDEM = [{ importacaoId: "asc" as const }, { linhaArquivo: "asc" as const }, { criadoEm: "asc" as const }];

export async function listarRegistros(tipo: TipoListaRateio, f: Filtro, skip: number, take: number) {
  const p = getPrismaClient();
  const args = { where: where(f), orderBy: ORDEM, skip, take };
  let itens: unknown[];
  let total: number;
  switch (tipo) {
    case "PROJETO":
      [itens, total] = await Promise.all([p.projeto.findMany({ ...args, include: INCLUIR_COM_LINHA }), p.projeto.count({ where: args.where })]);
      break;
    case "PRODUCAO":
      [itens, total] = await Promise.all([p.producao.findMany({ ...args, include: INCLUIR_COM_LINHA }), p.producao.count({ where: args.where })]);
      break;
    case "PRODUCAO_PISTA":
      [itens, total] = await Promise.all([p.producaoPista.findMany({ ...args, include: INCLUIR_COM_LINHA }), p.producaoPista.count({ where: args.where })]);
      break;
    case "PRODUCAO_ARMADURA":
      [itens, total] = await Promise.all([p.producaoArmadura.findMany({ ...args, include: INCLUIR_COM_LINHA }), p.producaoArmadura.count({ where: args.where })]);
      break;
    case "PRODUCAO_METALURGIA":
      [itens, total] = await Promise.all([p.producaoMetalurgia.findMany({ ...args, include: INCLUIR_COM_LINHA }), p.producaoMetalurgia.count({ where: args.where })]);
      break;
    case "EXPEDICAO":
      [itens, total] = await Promise.all([p.expedicao.findMany({ ...args, include: INCLUIR_COM_LINHA }), p.expedicao.count({ where: args.where })]);
      break;
    case "MONTAGEM":
      [itens, total] = await Promise.all([p.montagem.findMany({ ...args, include: INCLUIR_COM_LINHA }), p.montagem.count({ where: args.where })]);
      break;
    case "ACOMPANHAMENTO":
      [itens, total] = await Promise.all([p.acompanhamento.findMany({ ...args, include: INCLUIR_COM_LINHA }), p.acompanhamento.count({ where: args.where })]);
      break;
  }
  return { itens: itens as RegistroBruto[], total };
}

/** Origem e competência de um registro — o bastante para autorizar a edição. */
export async function buscarRegistro(tipo: TipoListaRateio, id: string) {
  const p = getPrismaClient();
  const args = {
    where: { id },
    select: { id: true, importacaoId: true, competencia: { select: { id: true, ano: true, mes: true, status: true } } },
  };
  switch (tipo) {
    case "PROJETO": return p.projeto.findUnique(args);
    case "PRODUCAO": return p.producao.findUnique(args);
    case "PRODUCAO_PISTA": return p.producaoPista.findUnique(args);
    case "PRODUCAO_ARMADURA": return p.producaoArmadura.findUnique(args);
    case "PRODUCAO_METALURGIA": return p.producaoMetalurgia.findUnique(args);
    case "EXPEDICAO": return p.expedicao.findUnique(args);
    case "MONTAGEM": return p.montagem.findUnique(args);
    case "ACOMPANHAMENTO": return p.acompanhamento.findUnique(args);
  }
}

/** O registro inteiro, para o log de auditoria guardar o antes e o depois. */
export async function lerRegistroCompleto(tipo: TipoListaRateio, id: string) {
  const p = getPrismaClient();
  const args = { where: { id } };
  switch (tipo) {
    case "PROJETO": return p.projeto.findUnique(args);
    case "PRODUCAO": return p.producao.findUnique(args);
    case "PRODUCAO_PISTA": return p.producaoPista.findUnique(args);
    case "PRODUCAO_ARMADURA": return p.producaoArmadura.findUnique(args);
    case "PRODUCAO_METALURGIA": return p.producaoMetalurgia.findUnique(args);
    case "EXPEDICAO": return p.expedicao.findUnique(args);
    case "MONTAGEM": return p.montagem.findUnique(args);
    case "ACOMPANHAMENTO": return p.acompanhamento.findUnique(args);
  }
}

export async function atualizarRegistro(tx: Tx, tipo: TipoListaRateio, id: string, dados: Record<string, unknown>) {
  const args = { where: { id }, data: dados };
  switch (tipo) {
    case "PROJETO": return tx.projeto.update(args as Prisma.ProjetoUpdateArgs);
    case "PRODUCAO": return tx.producao.update(args as Prisma.ProducaoUpdateArgs);
    case "PRODUCAO_PISTA": return tx.producaoPista.update(args as Prisma.ProducaoPistaUpdateArgs);
    case "PRODUCAO_ARMADURA": return tx.producaoArmadura.update(args as Prisma.ProducaoArmaduraUpdateArgs);
    case "PRODUCAO_METALURGIA": return tx.producaoMetalurgia.update(args as Prisma.ProducaoMetalurgiaUpdateArgs);
    case "EXPEDICAO": return tx.expedicao.update(args as Prisma.ExpedicaoUpdateArgs);
    case "MONTAGEM": return tx.montagem.update(args as Prisma.MontagemUpdateArgs);
    case "ACOMPANHAMENTO": return tx.acompanhamento.update(args as Prisma.AcompanhamentoUpdateArgs);
  }
}

export async function excluirRegistro(tipo: TipoListaRateio, id: string) {
  const p = getPrismaClient();
  const args = { where: { id } };
  switch (tipo) {
    case "PROJETO": return p.projeto.delete(args);
    case "PRODUCAO": return p.producao.delete(args);
    case "PRODUCAO_PISTA": return p.producaoPista.delete(args);
    case "PRODUCAO_ARMADURA": return p.producaoArmadura.delete(args);
    case "PRODUCAO_METALURGIA": return p.producaoMetalurgia.delete(args);
    case "EXPEDICAO": return p.expedicao.delete(args);
    case "MONTAGEM": return p.montagem.delete(args);
    case "ACOMPANHAMENTO": return p.acompanhamento.delete(args);
  }
}
