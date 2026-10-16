import { getPrismaClient } from "../../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { DepartamentoAcesso } from "../../generated/prisma/enums.js";
import { ROTULO_DEPARTAMENTO } from "../acesso/recorteDepartamento.js";
import { auditar } from "../auditoriaService.js";
import { indicadoresService } from "../relatorios/indicadoresService.js";
import { painelService } from "../relatorios/painelService.js";

/**
 * Os Relatórios Executivos (15/10/2026, Análises Gerenciais): a apresentação mensal de cada gestor sobre os seus
 * departamentos, numa competência fechada. Decisões do usuário: as abas são os departamentos do recorte do gestor (sem
 * recorte, os escolhidos ao criar); uma apresentação por gestor e mês; em elaboração, só o autor a vê; finalizada, todos
 * os que leem a tela, e o autor (ou o Administrador) a reabre; as anotações são blocos livres na grade, ao lado dos
 * cards. Os cards trazem os dados do Painel de Bordo e dos Indicadores de Resultados Empresariais até o mês do
 * relatório, só das competências fechadas.
 */

export class RelatorioExecutivoError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type UsuarioDoRelatorio = { id: string; nome: string; admin: boolean; departamentos: DepartamentoAcesso[] | null };

export const DEPARTAMENTOS: DepartamentoAcesso[] = ["PRODUCAO", "SERVICOS", "LOGISTICA", "TECNICO", "COMERCIAL", "ADMINISTRATIVO", "EXTRA_OPERACIONAL"];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const rotuloMes = (ano: number, mes: number) => `${MESES[mes - 1]}/${ano}`;

/** Um bloco da grade: a posição e o tamanho (em colunas e linhas) e o conteúdo. */
export type BlocoDoRelatorio = { id: string; x: number; y: number; w: number; h: number } & (
  | { tipo: "PAINEL"; aba: "resultados" | "performance"; quadro: string; titulo: string; sigla: string; comGrafico: boolean }
  | { tipo: "INDICADOR"; nome: string }
  | { tipo: "ANOTACAO"; nota: "POSITIVO" | "NEGATIVO" | "ATENCAO"; texto: string }
);
export type BlocosDoRelatorio = Partial<Record<DepartamentoAcesso, BlocoDoRelatorio[]>>;

type Linha = Awaited<ReturnType<ReturnType<typeof getPrismaClient>["relatorioExecutivo"]["findUniqueOrThrow"]>>;

const resumo = (r: Linha, usuario: UsuarioDoRelatorio) => ({
  id: r.id,
  ano: r.ano,
  mes: r.mes,
  rotuloMes: rotuloMes(r.ano, r.mes),
  autorNome: r.autorNome,
  departamentos: (r.departamentos as DepartamentoAcesso[]).map((d) => ({ chave: d, nome: ROTULO_DEPARTAMENTO[d] })),
  situacao: r.situacao,
  finalizadoEm: r.finalizadoEm,
  atualizadoEm: r.atualizadoEm,
  meu: r.autorId === usuario.id,
});

/** O relatório que o usuário pode ver: o dele, ou um finalizado; o Administrador vê todos. */
async function visivel(id: string, usuario: UsuarioDoRelatorio) {
  const r = await getPrismaClient().relatorioExecutivo.findUnique({ where: { id } });
  if (!r || (r.autorId !== usuario.id && r.situacao !== "FINALIZADO" && !usuario.admin)) throw new RelatorioExecutivoError(404, "Relatório não encontrado.");
  return r;
}

/** O relatório que o usuário pode alterar: o dele, em elaboração. */
async function doAutor(id: string, usuario: UsuarioDoRelatorio) {
  const r = await visivel(id, usuario);
  if (r.autorId !== usuario.id) throw new RelatorioExecutivoError(403, `Só o autor (${r.autorNome}) altera o relatório.`);
  if (r.situacao === "FINALIZADO") throw new RelatorioExecutivoError(409, "O relatório está finalizado: reabra-o para alterar.");
  return r;
}

export const relatoriosExecutivosService = {
  /**
   * As competências fechadas do exercício (a mais recente primeiro), cada uma com os relatórios que o usuário vê: os
   * finalizados, o dele (em elaboração ou finalizado) e, para o Administrador, também os em elaboração dos outros.
   */
  async listar(ano: number | null, usuario: UsuarioDoRelatorio) {
    const prisma = getPrismaClient();
    const fechadas = await prisma.competencia.findMany({ where: { status: "FECHADA" }, select: { ano: true, mes: true }, orderBy: [{ ano: "desc" }, { mes: "desc" }] });
    const anos = [...new Set(fechadas.map((c) => c.ano))];
    const exercicio = ano ?? anos[0] ?? new Date().getFullYear();
    const relatorios = await prisma.relatorioExecutivo.findMany({ where: { ano: exercicio }, orderBy: [{ autorNome: "asc" }] });
    const vistos = relatorios.filter((r) => r.situacao === "FINALIZADO" || r.autorId === usuario.id || usuario.admin);
    return {
      anos,
      ano: exercicio,
      // Os departamentos do recorte do usuário (as abas dos relatórios dele); sem recorte, ele os escolhe ao criar.
      meusDepartamentos: usuario.departamentos?.map((d) => ({ chave: d, nome: ROTULO_DEPARTAMENTO[d] })) ?? null,
      departamentos: DEPARTAMENTOS.map((d) => ({ chave: d, nome: ROTULO_DEPARTAMENTO[d] })),
      meses: fechadas
        .filter((c) => c.ano === exercicio)
        .map((c) => ({
          mes: c.mes,
          rotulo: rotuloMes(c.ano, c.mes),
          relatorios: vistos.filter((r) => r.mes === c.mes).map((r) => resumo(r, usuario)),
          temMeu: relatorios.some((r) => r.mes === c.mes && r.autorId === usuario.id),
        })),
    };
  },

  /** Cria o relatório do usuário num mês de competência fechada (um por gestor e mês). */
  async criar(dados: { ano: number; mes: number; departamentos: DepartamentoAcesso[] | null }, usuario: UsuarioDoRelatorio) {
    const prisma = getPrismaClient();
    const competencia = await prisma.competencia.findFirst({ where: { ano: dados.ano, mes: dados.mes } });
    if (!competencia || competencia.status !== "FECHADA") throw new RelatorioExecutivoError(400, `A competência ${rotuloMes(dados.ano, dados.mes)} não está fechada: os relatórios são das competências fechadas.`);
    const departamentos = usuario.departamentos ?? DEPARTAMENTOS.filter((d) => dados.departamentos?.includes(d));
    if (!departamentos.length) throw new RelatorioExecutivoError(400, usuario.departamentos ? "Seu perfil não tem departamentos no recorte: peça ao Administrador." : "Escolha ao menos um departamento.");
    if (await prisma.relatorioExecutivo.findUnique({ where: { ano_mes_autorId: { ano: dados.ano, mes: dados.mes, autorId: usuario.id } } })) {
      throw new RelatorioExecutivoError(409, `Você já tem o relatório de ${rotuloMes(dados.ano, dados.mes)}.`);
    }
    const r = await prisma.relatorioExecutivo.create({
      data: { ano: dados.ano, mes: dados.mes, autorId: usuario.id, autorNome: usuario.nome, departamentos, blocos: {} },
    });
    await auditar({ usuarioId: usuario.id, usuarioNome: usuario.nome, acao: "CRIACAO", entidade: "relatorio_executivo", entidadeId: r.id, metadados: { mes: rotuloMes(r.ano, r.mes), departamentos } });
    return resumo(r, usuario);
  },

  /** O relatório, com os blocos de cada aba e o que o usuário pode fazer nele. */
  async obter(id: string, usuario: UsuarioDoRelatorio) {
    const r = await visivel(id, usuario);
    const autor = r.autorId === usuario.id;
    return {
      ...resumo(r, usuario),
      blocos: r.blocos as BlocosDoRelatorio,
      podeEditar: autor && r.situacao === "EM_ELABORACAO",
      podeReabrir: (autor || usuario.admin) && r.situacao === "FINALIZADO",
    };
  },

  /** Os dados dos cards: o Painel de Bordo e os Indicadores até o mês do relatório, só das competências fechadas. */
  async dados(id: string, usuario: UsuarioDoRelatorio) {
    const r = await visivel(id, usuario);
    const [painel, indicadores] = await Promise.all([painelService.painel(r.ano, r.mes, true), indicadoresService.listar(r.ano, r.mes, true)]);
    return { painel, indicadores };
  },

  /** Grava os blocos das abas (o autor, em elaboração); as abas que não são do relatório ficam de fora. */
  async gravar(id: string, blocos: BlocosDoRelatorio, usuario: UsuarioDoRelatorio) {
    const r = await doAutor(id, usuario);
    const abas = r.departamentos as DepartamentoAcesso[];
    const fora = Object.keys(blocos).filter((d) => !abas.includes(d as DepartamentoAcesso));
    if (fora.length) throw new RelatorioExecutivoError(400, `O relatório não tem a aba ${fora.join(", ")}.`);
    const depois = await getPrismaClient().relatorioExecutivo.update({ where: { id }, data: { blocos: blocos as Prisma.InputJsonValue } });
    return { ...resumo(depois, usuario), blocos: depois.blocos as BlocosDoRelatorio };
  },

  /** Finaliza (torna público, só leitura) ou reabre (volta a ser só do autor) o relatório. */
  async mudarSituacao(id: string, acao: "finalizar" | "reabrir", usuario: UsuarioDoRelatorio) {
    const r = await visivel(id, usuario);
    if (acao === "finalizar") {
      await doAutor(id, usuario);
      const blocos = r.blocos as BlocosDoRelatorio;
      if (!Object.values(blocos).some((b) => b?.length)) throw new RelatorioExecutivoError(400, "O relatório está vazio: inclua cards ou anotações antes de finalizar.");
    } else {
      if (r.autorId !== usuario.id && !usuario.admin) throw new RelatorioExecutivoError(403, `Só o autor (${r.autorNome}) ou o Administrador reabre o relatório.`);
      if (r.situacao !== "FINALIZADO") throw new RelatorioExecutivoError(409, "O relatório não está finalizado.");
    }
    const depois = await getPrismaClient().relatorioExecutivo.update({
      where: { id },
      data: acao === "finalizar" ? { situacao: "FINALIZADO", finalizadoEm: new Date() } : { situacao: "EM_ELABORACAO", finalizadoEm: null },
    });
    await auditar({ usuarioId: usuario.id, usuarioNome: usuario.nome, acao: "ALTERACAO", entidade: "relatorio_executivo", entidadeId: id, metadados: { mes: rotuloMes(r.ano, r.mes), autor: r.autorNome, acao } });
    return this.obter(depois.id, usuario);
  },

  /** Exclui o relatório (o autor, em elaboração). */
  async excluir(id: string, usuario: UsuarioDoRelatorio) {
    const r = await doAutor(id, usuario);
    await getPrismaClient().relatorioExecutivo.delete({ where: { id } });
    await auditar({ usuarioId: usuario.id, usuarioNome: usuario.nome, acao: "EXCLUSAO", entidade: "relatorio_executivo", entidadeId: id, metadados: { mes: rotuloMes(r.ano, r.mes) } });
    return { excluido: true };
  },
};
