import { getPrismaClient } from "../../config/prisma.js";
import { ACESSO_TOTAL, type Acesso } from "../acesso/acesso.js";
import { podeVerLinhaNaObra, podeVerLinhaNoCentro, podeVerMovimentos } from "../acesso/recorteDepartamento.js";
import { CENTRO_DE_OBRA } from "./obrasService.js";
import { RegraDREError } from "./dreService.js";

const rotulo = (ano: number, mes: number) => `${String(mes).padStart(2, "0")}/${ano}`;

/**
 * O balancete de uma conta no mês (15/10/2026; antes, as requisições e as notas fiscais, das abas Requisições (Lista) e
 * Notas Fiscais (Lista), que saíram do LISTAS REALIZADO (RESULTADOS)): o que o extrato de uma conta na DRE abre — os
 * movimentos do balancete detalhado (o cliente ou fornecedor, a emissão e o histórico de cada um). A conta é a do
 * balancete (o código reduzido, antes da reclassificação); o centro de custo (código RM) e a filial recortam, quando
 * vêm. A linha da DRE dá o recorte do Gestor por departamento, como no extrato.
 */
export const documentosService = {
  async listar(ano: number, mes: number, filtro: { linha: string; conta: string; centro: string | null; filial: number | null }, acesso: Acesso = ACESSO_TOTAL) {
    const prisma = getPrismaClient();
    const c = await prisma.competencia.findUnique({ where: { ano_mes: { ano, mes } }, select: { id: true } });
    if (!c) throw new RegraDREError(404, `A competência ${rotulo(ano, mes)} não existe.`);
    const linha = await prisma.linhaDRE.findUnique({ where: { codigo: filtro.linha }, select: { descricao: true, grupoSigla: true } });
    if (!linha) throw new RegraDREError(404, `A linha ${filtro.linha} não está na estrutura da DRE.`);
    // O Coordenador (recorte por centro de custo) consulta as linhas fechadas a ele só num centro seu.
    const doCentroDele =
      acesso.recorteCentro &&
      !!filtro.centro &&
      podeVerLinhaNoCentro(acesso, linha) &&
      !!(await prisma.centroCusto.findFirst({ where: { codigoRM: filtro.centro, id: { in: acesso.centros } }, select: { id: true } }));
    // E, com a opção das obras, numa obra (centro 1.98 ou 1.99), nas linhas que ele vê nas obras.
    const daObra = acesso.recorteCentro && !!filtro.centro && CENTRO_DE_OBRA.test(filtro.centro) && podeVerLinhaNaObra(acesso, linha);
    if (!podeVerMovimentos(acesso, linha) && !doCentroDele && !daObra) {
      throw new RegraDREError(403, acesso.recorteCentro ? "Só as movimentações dos seus centros de custo: marque o Centro de Custo do Lançamento." : `As movimentações de "${linha.descricao}" não são de um departamento seu.`);
    }
    const [conta, lancamentos, detalhados] = await Promise.all([
      prisma.contaResultado.findUnique({ where: { reduzido: filtro.conta }, select: { reduzido: true, descricao: true } }),
      prisma.lancamentoContabil.findMany({
        where: {
          competenciaId: c.id,
          contaResultado: { reduzido: filtro.conta },
          ...(filtro.centro ? { codigoCentroCusto: filtro.centro } : {}),
          ...(filtro.filial ? { filial: filtro.filial } : {}),
        },
        select: {
          id: true,
          filial: true,
          codigoCentroCusto: true,
          nomeCentroCusto: true,
          cliForn: true,
          emissao: true,
          historico: true,
          valorMovimento: true,
          centroCusto: { select: { codigoRM: true, nomeRM: true } },
        },
        // Sem emissão primeiro, como no SQLite (23/10/2026).
        orderBy: [{ emissao: { sort: "asc", nulls: "first" } }, { linhaArquivo: "asc" }],
      }),
      // O mês tem o balancete detalhado (com o detalhe de algum movimento)?
      prisma.lancamentoContabil.count({ where: { competenciaId: c.id, OR: [{ historico: { not: null } }, { cliForn: { not: null } }, { emissao: { not: null } }] } }),
    ]);
    return {
      conta: conta ?? { reduzido: filtro.conta, descricao: "" },
      /** O balancete do mês é o detalhado (sem ele, cada linha é a soma da filial, do centro e da conta). */
      detalhado: detalhados > 0,
      linhas: lancamentos.map((l) => ({
        id: l.id,
        filial: l.filial,
        codigoCentroCusto: l.centroCusto?.codigoRM ?? l.codigoCentroCusto,
        nomeCentroCusto: l.centroCusto?.nomeRM ?? l.nomeCentroCusto,
        cliForn: l.cliForn,
        emissao: l.emissao,
        historico: l.historico,
        valor: l.valorMovimento.toFixed(2),
      })),
    };
  },
};
