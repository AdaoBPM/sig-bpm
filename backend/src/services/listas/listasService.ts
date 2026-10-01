import { randomUUID } from "node:crypto";

import { getPrismaClient } from "../../config/prisma.js";
import type { ValorCelula } from "../../lib/xlsx.js";
import { DEFINICOES_LISTAS, type TipoListaRateio } from "../importacoes/listas/definicoesListas.js";
import { gravar, prepararGravacao } from "../importacoes/listas/processarLista.js";
import { totaisDaCompetencia } from "../volumes/volumesService.js";
import { CAMPOS_DIGITACAO, DigitacaoInvalida, lerDigitado } from "./digitacaoListas.js";
import {
  atualizarRegistro,
  buscarRegistro,
  excluirRegistro,
  lerRegistroCompleto,
  listarRegistros,
  type RegistroBruto,
} from "./repositorioListas.js";
import { auditar } from "../auditoriaService.js";

/** Erro de regra — vira 400/404/409 no controller, não 500. */
export class RegraListaError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

function rotulo(ano: number, mes: number) {
  return `${String(mes).padStart(2, "0")}/${ano}`;
}

/** Campos próprios mostrados na tabela, por lista: [campo do modelo, rótulo]. */
const DETALHES: Record<TipoListaRateio, Array<[string, string]>> = {
  PROJETO: [["produto", "Produto"], ["nomePeca", "Peça"]],
  PRODUCAO: [["produto", "Produto"], ["nomePeca", "Peça"]],
  PRODUCAO_PISTA: [],
  PRODUCAO_ARMADURA: [["categoria", "Linha"]],
  PRODUCAO_METALURGIA: [["finalidade", "Finalidade"]],
  EXPEDICAO: [["nomePeca", "Peça"], ["pesoKg", "Peso (kg)"], ["volumeInformado", "Volume informado"]],
  MONTAGEM: [["grupo", "Grupo"]],
  ACOMPANHAMENTO: [["etapa", "Etapa"]],
};

function texto(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && "toFixed" in (v as object)) return (v as { toFixed: (n: number) => string }).toFixed(3);
  return String(v);
}

/** Os valores do registro com os nomes de coluna do formulário, para a edição. */
function valoresDoFormulario(tipo: TipoListaRateio, r: RegistroBruto): Record<string, string | null> {
  const unidade = r.unidadeNegocio ? `Unidade 0${r.unidadeNegocio.codigo}` : null;
  const q = r.quantidade.toString();
  switch (tipo) {
    case "PROJETO":
      return { Unidade: unidade, "Sigla Obra": r.obra?.codigo ?? null, Obra: r.obra?.nome ?? null, Produto: texto(r.produto), "Nome Peça": texto(r.nomePeca), "Volume (m³)": q };
    case "PRODUCAO":
      return { Unidade: unidade, Obra: r.obra?.codigo ?? null, "Nome da Obra": r.obra?.nome ?? null, Produto: texto(r.produto), "Nome Peça": texto(r.nomePeca), "Volume (m³)": q };
    case "PRODUCAO_PISTA":
      return { Linha: r.linha?.codigo ?? null, Pistas: q };
    case "PRODUCAO_ARMADURA":
      return { "Unidade/Linha": texto(r.categoria), Peso: q };
    case "PRODUCAO_METALURGIA":
      return { FINALIDADE: texto(r.finalidade), Peso: q };
    case "EXPEDICAO":
      return { Obra: r.obra?.codigo ?? null, "Nome da Obra": r.obra?.nome ?? null, "Nome da Peça": texto(r.nomePeca), "Peso (kg)": String(r.pesoKg ?? "0"), "Volume (m³)": String(r.volumeInformado ?? "0") };
    case "MONTAGEM":
      return { Obra: r.obra?.codigo ?? null, "Nome da Obra": r.obra?.nome ?? null, Grupo: texto(r.grupo), "Volume (m³)": q };
    case "ACOMPANHAMENTO":
      return { Projeto: r.obra?.codigo ?? null, Obra: r.obra?.nome ?? null, Etapa: texto(r.etapa), "Dias de Acomp.": q };
  }
}

function apresentar(tipo: TipoListaRateio, r: RegistroBruto) {
  return {
    id: r.id,
    origem: r.importacaoId ? ("IMPORTADA" as const) : ("DIGITADA" as const),
    linhaArquivo: r.linhaArquivo,
    obra: r.obra,
    unidade: r.unidadeNegocio?.nome ?? null,
    linha: r.linha?.nome ?? null,
    quantidade: r.quantidade.toFixed(3),
    detalhes: DETALHES[tipo].map(([campo, rot]) => ({ rotulo: rot, valor: texto(r[campo]) })),
    valores: r.importacaoId ? null : valoresDoFormulario(tipo, r),
  };
}

async function competencia(ano: number, mes: number) {
  const c = await getPrismaClient().competencia.findUnique({
    where: { ano_mes: { ano, mes } },
    select: { id: true, ano: true, mes: true, status: true },
  });
  if (!c) throw new RegraListaError(404, `A competência ${rotulo(ano, mes)} não existe.`);
  return c;
}

function exigirAberta(c: { ano: number; mes: number; status: string }) {
  if (c.status === "FECHADA") {
    throw new RegraListaError(409, `A competência ${rotulo(c.ano, c.mes)} está fechada. Digitar nela exige reabri-la.`);
  }
}

function lerOuRecusar(tipo: TipoListaRateio, valores: Record<string, ValorCelula>, ano: number, mes: number) {
  try {
    return lerDigitado(tipo, valores, ano, mes);
  } catch (error) {
    if (error instanceof DigitacaoInvalida) throw new RegraListaError(400, error.message);
    throw error;
  }
}

/** Registro digitado da competência aberta — importados não se editam aqui. */
async function registroEditavel(tipo: TipoListaRateio, id: string) {
  const r = await buscarRegistro(tipo, id);
  if (!r) throw new RegraListaError(404, "Registro não encontrado.");
  exigirAberta(r.competencia);
  if (r.importacaoId) {
    throw new RegraListaError(
      409,
      "Registro importado: corrija o arquivo e importe de novo. Só registros digitados se editam aqui.",
    );
  }
  return r;
}

export const listasService = {
  /** Os campos do formulário de cada lista, para a tela se montar. */
  campos() {
    return Object.fromEntries(
      (Object.keys(CAMPOS_DIGITACAO) as TipoListaRateio[]).map((t) => [
        t,
        { rotulo: DEFINICOES_LISTAS[t].rotulo, campos: CAMPOS_DIGITACAO[t] },
      ]),
    );
  },

  async listar(
    tipo: TipoListaRateio,
    ano: number,
    mes: number,
    filtro: { busca?: string; pagina: number; porPagina: number },
  ) {
    const c = await competencia(ano, mes);
    const [{ itens, total }, totais] = await Promise.all([
      listarRegistros(tipo, { competenciaId: c.id, busca: filtro.busca }, (filtro.pagina - 1) * filtro.porPagina, filtro.porPagina),
      totaisDaCompetencia(c.id),
    ]);
    return {
      competencia: c,
      itens: itens.map((r) => apresentar(tipo, r)),
      total,
      pagina: filtro.pagina,
      porPagina: filtro.porPagina,
      // As linhas da aba Totais que esta lista alimenta, com tudo o que está gravado.
      totais: totais.filter((t) => t.tipo === tipo).map((t) => ({ ...t, quantidade: t.quantidade.toFixed(3) })),
    };
  },

  async criar(tipo: TipoListaRateio, ano: number, mes: number, valores: Record<string, ValorCelula>, usuarioId: string) {
    const c = await competencia(ano, mes);
    exigirAberta(c);
    const registro = lerOuRecusar(tipo, valores, ano, mes);
    // O id é dado aqui (createMany não o devolve), para o log apontar o registro criado.
    const id = randomUUID();
    await getPrismaClient().$transaction(async (tx) => {
      const { dados } = await prepararGravacao(tx, tipo, [registro], { competenciaId: c.id, importacaoId: null, criadoPor: usuarioId });
      (dados[0] as Record<string, unknown>).id = id;
      await gravar(tx, tipo, dados);
    });
    await auditar({ usuarioId, acao: "CRIACAO", entidade: "lista_operacional", entidadeId: id, depois: await lerRegistroCompleto(tipo, id), metadados: { tipo, competencia: `${String(mes).padStart(2, "0")}/${ano}` } });
  },

  async atualizar(tipo: TipoListaRateio, id: string, valores: Record<string, ValorCelula>, usuarioId: string) {
    const r = await registroEditavel(tipo, id);
    const antes = await lerRegistroCompleto(tipo, id);
    const registro = lerOuRecusar(tipo, valores, r.competencia.ano, r.competencia.mes);
    await getPrismaClient().$transaction(async (tx) => {
      const { dados } = await prepararGravacao(tx, tipo, [registro], {
        competenciaId: r.competencia.id,
        importacaoId: null,
        criadoPor: "", // descartado abaixo
      });
      // Autor, competência e origem não mudam na edição.
      const alteracao: Record<string, unknown> = { ...dados[0] };
      delete alteracao.criadoPor;
      delete alteracao.competenciaId;
      delete alteracao.importacaoId;
      await atualizarRegistro(tx, tipo, id, alteracao);
    });
    await auditar({ usuarioId, acao: "ALTERACAO", entidade: "lista_operacional", entidadeId: id, antes, depois: await lerRegistroCompleto(tipo, id), metadados: { tipo } });
  },

  async excluir(tipo: TipoListaRateio, id: string, usuarioId: string) {
    await registroEditavel(tipo, id);
    const antes = await lerRegistroCompleto(tipo, id);
    await excluirRegistro(tipo, id);
    await auditar({ usuarioId, acao: "EXCLUSAO", entidade: "lista_operacional", entidadeId: id, antes, metadados: { tipo } });
  },
};

