import { getPrismaClient } from "../../config/prisma.js";
import { ACESSO_TOTAL, type Acesso } from "../acesso/acesso.js";
import { podeVerLinhaNaObra, podeVerLinhaNoCentro, podeVerMovimentos } from "../acesso/recorteDepartamento.js";
import { CENTRO_DE_OBRA } from "./obrasService.js";
import { RegraDREError } from "./dreService.js";

const rotulo = (ano: number, mes: number) => `${String(mes).padStart(2, "0")}/${ano}`;

/**
 * As requisições e as notas fiscais de uma conta no mês (11/10/2026): o que o extrato de uma conta na DRE abre, das
 * abas Requisições (Lista) e Notas Fiscais (Lista) importadas no mês. A conta é a do lançamento (o código reduzido); o
 * centro de custo (código RM) e a filial recortam, quando vêm. A linha da DRE dá o recorte do Gestor por departamento,
 * como no extrato.
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
    const where = {
      competenciaId: c.id,
      contaContabil: filtro.conta,
      ...(filtro.centro ? { codigoCentroCusto: filtro.centro } : {}),
      ...(filtro.filial ? { filial: filtro.filial } : {}),
    };
    const [conta, requisicoes, notas, importacoes] = await Promise.all([
      prisma.contaResultado.findUnique({ where: { reduzido: filtro.conta }, select: { reduzido: true, descricao: true } }),
      prisma.requisicaoItem.findMany({ where, orderBy: [{ dataBaixa: "asc" }, { linhaArquivo: "asc" }] }),
      prisma.notaFiscalItem.findMany({ where, orderBy: [{ dataEmissao: "asc" }, { linhaArquivo: "asc" }] }),
      prisma.importacao.findMany({
        where: { competenciaId: c.id, tipo: { in: ["REQUISICOES", "NOTAS_FISCAIS"] }, status: "CONCLUIDA", substituidaEm: null },
        select: { tipo: true },
      }),
    ]);
    const omitir = <T extends { competenciaId: string; importacaoId: string }>({ competenciaId: _c, importacaoId: _i, ...resto }: T) => resto;
    return {
      conta: conta ?? { reduzido: filtro.conta, descricao: "" },
      /** Se o mês tem as abas importadas (sem elas, as listas ficam vazias por falta de importação). */
      importadas: { requisicoes: importacoes.some((i) => i.tipo === "REQUISICOES"), notas: importacoes.some((i) => i.tipo === "NOTAS_FISCAIS") },
      requisicoes: requisicoes.map(omitir),
      notas: notas.map(omitir),
    };
  },
};
