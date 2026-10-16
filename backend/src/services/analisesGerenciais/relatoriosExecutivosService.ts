import { getPrismaClient } from "../../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { DepartamentoAcesso } from "../../generated/prisma/enums.js";
import { ROTULO_DEPARTAMENTO } from "../acesso/recorteDepartamento.js";
import { auditar } from "../auditoriaService.js";
import { indicadoresService } from "../relatorios/indicadoresService.js";
import { painelService } from "../relatorios/painelService.js";

/**
 * Os Relatórios Executivos (15/10/2026, Análises Gerenciais): a apresentação de cada competência fechada, que os gestores
 * montam juntos. Decisões do usuário: um relatório por competência, criado por quem edita a tela; uma aba por
 * departamento (os sete); cada gestor edita as abas do seu recorte (sem recorte, todas); cada aba tem a sua situação —
 * em elaboração, só quem a edita (e o Administrador) a vê; finalizada, todos —, e quem a edita a finaliza e a reabre (o
 * Administrador reabre qualquer uma); o relatório fica finalizado quando todas as abas estão. As anotações são blocos
 * livres na grade, ao lado dos cards. Os cards trazem o Painel de Bordo e os Indicadores de Resultados Empresariais até
 * o mês do relatório, só das competências fechadas.
 */

export class RelatorioExecutivoError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** O usuário: se edita a tela e os departamentos do recorte (null: sem recorte, todos). */
export type UsuarioDoRelatorio = { id: string; nome: string; admin: boolean; edita: boolean; departamentos: DepartamentoAcesso[] | null };

export const DEPARTAMENTOS: DepartamentoAcesso[] = ["PRODUCAO", "SERVICOS", "LOGISTICA", "TECNICO", "COMERCIAL", "ADMINISTRATIVO", "EXTRA_OPERACIONAL"];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const rotuloMes = (ano: number, mes: number) => `${MESES[mes - 1]}/${ano}`;

/** Um bloco da grade: a posição e o tamanho (em colunas e linhas) e o conteúdo. */
export type BlocoDoRelatorio = { id: string; x: number; y: number; w: number; h: number } & (
  | { tipo: "PAINEL"; aba: "resultados" | "performance"; quadro: string; titulo: string; sigla: string; comGrafico: boolean }
  | { tipo: "INDICADOR"; nome: string }
  | { tipo: "ANOTACAO"; nota: "POSITIVO" | "NEGATIVO" | "ATENCAO"; texto: string }
);

type Aba = { departamento: DepartamentoAcesso; blocos: unknown; situacao: "EM_ELABORACAO" | "FINALIZADO"; atualizadoPor: string | null; atualizadoEm: Date; finalizadoPor: string | null; finalizadoEm: Date | null };

/** Quem edita a aba: quem edita a tela, nos departamentos do recorte (sem recorte, todos). */
const editaAba = (u: UsuarioDoRelatorio, d: DepartamentoAcesso) => u.edita && (u.departamentos === null || u.departamentos.includes(d));
/** Quem vê a aba: finalizada, todos; em elaboração, quem a edita e o Administrador. */
const veAba = (u: UsuarioDoRelatorio, a: Aba) => a.situacao === "FINALIZADO" || editaAba(u, a.departamento) || u.admin;

/** A situação do relatório: finalizado quando todas as abas estão. */
const situacaoGeral = (abas: Aba[]) => (abas.length && abas.every((a) => a.situacao === "FINALIZADO") ? "FINALIZADO" : "EM_ELABORACAO");

async function doRelatorio(id: string) {
  const r = await getPrismaClient().relatorioExecutivo.findUnique({ where: { id }, include: { abas: true } });
  if (!r) throw new RelatorioExecutivoError(404, "Relatório não encontrado.");
  return r;
}

/** A aba que o usuário pode alterar: a do recorte dele, em elaboração. */
async function abaEditavel(id: string, d: DepartamentoAcesso, u: UsuarioDoRelatorio) {
  const r = await doRelatorio(id);
  const aba = r.abas.find((a) => a.departamento === d);
  if (!aba) throw new RelatorioExecutivoError(404, "Aba não encontrada.");
  if (!editaAba(u, d)) throw new RelatorioExecutivoError(403, `A aba ${ROTULO_DEPARTAMENTO[d]} não é do seu recorte.`);
  if (aba.situacao === "FINALIZADO") throw new RelatorioExecutivoError(409, `A aba ${ROTULO_DEPARTAMENTO[d]} está finalizada: reabra-a para alterar.`);
  return { r, aba };
}

export const relatoriosExecutivosService = {
  /**
   * Os relatórios (a competência mais recente primeiro), com a situação, o andamento (as abas finalizadas) e as abas do
   * usuário; e as competências fechadas ainda sem relatório (o Novo Relatório).
   */
  async listar(usuario: UsuarioDoRelatorio) {
    const prisma = getPrismaClient();
    const [relatorios, fechadas] = await Promise.all([
      prisma.relatorioExecutivo.findMany({ include: { abas: true }, orderBy: [{ ano: "desc" }, { mes: "desc" }] }),
      prisma.competencia.findMany({ where: { status: "FECHADA" }, select: { ano: true, mes: true }, orderBy: [{ ano: "desc" }, { mes: "desc" }] }),
    ]);
    const comRelatorio = new Set(relatorios.map((r) => `${r.ano}|${r.mes}`));
    return {
      relatorios: relatorios.map((r) => ({
        id: r.id,
        ano: r.ano,
        mes: r.mes,
        rotuloMes: rotuloMes(r.ano, r.mes),
        situacao: situacaoGeral(r.abas),
        finalizadas: r.abas.filter((a) => a.situacao === "FINALIZADO").length,
        total: r.abas.length,
        // As abas que o usuário edita, com a situação de cada uma.
        minhas: DEPARTAMENTOS.filter((d) => editaAba(usuario, d)).flatMap((d) => {
          const a = r.abas.find((x) => x.departamento === d);
          return a ? [{ chave: d, nome: ROTULO_DEPARTAMENTO[d], situacao: a.situacao }] : [];
        }),
        criadoPor: r.criadoPorNome,
        criadoEm: r.criadoEm,
        atualizadoEm: r.abas.reduce((m, a) => (a.atualizadoEm > m ? a.atualizadoEm : m), r.atualizadoEm),
      })),
      livres: fechadas.filter((c) => !comRelatorio.has(`${c.ano}|${c.mes}`)).map((c) => ({ ano: c.ano, mes: c.mes, rotulo: rotuloMes(c.ano, c.mes) })),
      meusDepartamentos: DEPARTAMENTOS.filter((d) => editaAba(usuario, d)).map((d) => ({ chave: d, nome: ROTULO_DEPARTAMENTO[d] })),
    };
  },

  /** Cria o relatório de uma competência fechada (um por competência), com as sete abas vazias. */
  async criar(dados: { ano: number; mes: number }, usuario: UsuarioDoRelatorio) {
    const prisma = getPrismaClient();
    const competencia = await prisma.competencia.findFirst({ where: { ano: dados.ano, mes: dados.mes } });
    if (!competencia || competencia.status !== "FECHADA") throw new RelatorioExecutivoError(400, `A competência ${rotuloMes(dados.ano, dados.mes)} não está fechada: os relatórios são das competências fechadas.`);
    if (await prisma.relatorioExecutivo.findUnique({ where: { ano_mes: { ano: dados.ano, mes: dados.mes } } })) {
      throw new RelatorioExecutivoError(409, `${rotuloMes(dados.ano, dados.mes)} já tem relatório: abra-o na lista.`);
    }
    const r = await prisma.relatorioExecutivo.create({
      data: {
        ano: dados.ano,
        mes: dados.mes,
        criadoPorId: usuario.id,
        criadoPorNome: usuario.nome,
        abas: { create: DEPARTAMENTOS.map((departamento) => ({ departamento, blocos: [] })) },
      },
    });
    await auditar({ usuarioId: usuario.id, usuarioNome: usuario.nome, acao: "CRIACAO", entidade: "relatorio_executivo", entidadeId: r.id, metadados: { mes: rotuloMes(r.ano, r.mes) } });
    return { id: r.id, rotuloMes: rotuloMes(r.ano, r.mes) };
  },

  /** O relatório, com as abas: a situação de cada uma, os blocos das que o usuário vê e o que ele pode fazer em cada. */
  async obter(id: string, usuario: UsuarioDoRelatorio) {
    const r = await doRelatorio(id);
    const abas = DEPARTAMENTOS.flatMap((d) => {
      const a = r.abas.find((x) => x.departamento === d);
      if (!a) return [];
      const ve = veAba(usuario, a);
      return [
        {
          chave: d,
          nome: ROTULO_DEPARTAMENTO[d],
          situacao: a.situacao,
          visivel: ve,
          blocos: ve ? (a.blocos as BlocoDoRelatorio[]) : [],
          podeEditar: editaAba(usuario, d) && a.situacao === "EM_ELABORACAO",
          podeReabrir: a.situacao === "FINALIZADO" && (editaAba(usuario, d) || usuario.admin),
          atualizadoPor: a.atualizadoPor,
          atualizadoEm: a.atualizadoEm,
          finalizadoPor: a.finalizadoPor,
          finalizadoEm: a.finalizadoEm,
        },
      ];
    });
    return {
      id: r.id,
      ano: r.ano,
      mes: r.mes,
      rotuloMes: rotuloMes(r.ano, r.mes),
      situacao: situacaoGeral(r.abas),
      criadoPor: r.criadoPorNome,
      criadoEm: r.criadoEm,
      abas,
      // O criador (ou o Administrador) exclui o relatório enquanto nenhuma aba estiver finalizada.
      podeExcluir: (r.criadoPorId === usuario.id || usuario.admin) && usuario.edita && r.abas.every((a) => a.situacao === "EM_ELABORACAO"),
    };
  },

  /** Os dados dos cards: o Painel de Bordo e os Indicadores até o mês do relatório, só das competências fechadas. */
  async dados(id: string) {
    const r = await doRelatorio(id);
    const [painel, indicadores] = await Promise.all([painelService.painel(r.ano, r.mes, true), indicadoresService.listar(r.ano, r.mes, true)]);
    return { painel, indicadores };
  },

  /** Grava os blocos de uma aba (de quem a edita, em elaboração). */
  async gravarAba(id: string, departamento: DepartamentoAcesso, blocos: BlocoDoRelatorio[], usuario: UsuarioDoRelatorio) {
    await abaEditavel(id, departamento, usuario);
    await getPrismaClient().relatorioExecutivoAba.update({
      where: { relatorioId_departamento: { relatorioId: id, departamento } },
      data: { blocos: blocos as Prisma.InputJsonValue, atualizadoPor: usuario.nome },
    });
    return this.obter(id, usuario);
  },

  /** Finaliza a aba (fica visível para todos, só leitura) ou a reabre (volta a ser só de quem a edita). */
  async mudarAba(id: string, departamento: DepartamentoAcesso, acao: "finalizar" | "reabrir", usuario: UsuarioDoRelatorio) {
    const prisma = getPrismaClient();
    const r = await doRelatorio(id);
    if (acao === "finalizar") await abaEditavel(id, departamento, usuario);
    else {
      const aba = r.abas.find((a) => a.departamento === departamento);
      if (!aba) throw new RelatorioExecutivoError(404, "Aba não encontrada.");
      if (!editaAba(usuario, departamento) && !usuario.admin) throw new RelatorioExecutivoError(403, `A aba ${ROTULO_DEPARTAMENTO[departamento]} não é do seu recorte.`);
      if (aba.situacao !== "FINALIZADO") throw new RelatorioExecutivoError(409, "A aba não está finalizada.");
    }
    await prisma.relatorioExecutivoAba.update({
      where: { relatorioId_departamento: { relatorioId: id, departamento } },
      data: acao === "finalizar" ? { situacao: "FINALIZADO", finalizadoPor: usuario.nome, finalizadoEm: new Date() } : { situacao: "EM_ELABORACAO", finalizadoPor: null, finalizadoEm: null, atualizadoPor: usuario.nome },
    });
    await auditar({
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      acao: "ALTERACAO",
      entidade: "relatorio_executivo",
      entidadeId: id,
      metadados: { mes: rotuloMes(r.ano, r.mes), aba: ROTULO_DEPARTAMENTO[departamento], acao },
    });
    return this.obter(id, usuario);
  },

  /** Exclui o relatório (quem o criou ou o Administrador), enquanto nenhuma aba estiver finalizada. */
  async excluir(id: string, usuario: UsuarioDoRelatorio) {
    const r = await doRelatorio(id);
    if ((r.criadoPorId !== usuario.id && !usuario.admin) || !usuario.edita) throw new RelatorioExecutivoError(403, `Só quem criou o relatório (${r.criadoPorNome}) ou o Administrador o exclui.`);
    if (r.abas.some((a) => a.situacao === "FINALIZADO")) throw new RelatorioExecutivoError(409, "O relatório tem abas finalizadas: reabra-as antes de excluir.");
    await getPrismaClient().relatorioExecutivo.delete({ where: { id } });
    await auditar({ usuarioId: usuario.id, usuarioNome: usuario.nome, acao: "EXCLUSAO", entidade: "relatorio_executivo", entidadeId: id, metadados: { mes: rotuloMes(r.ano, r.mes) } });
    return { excluido: true };
  },
};
