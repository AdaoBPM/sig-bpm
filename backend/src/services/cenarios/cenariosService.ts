import { getPrismaClient } from "../../config/prisma.js";
import type { MarcacaoCenario } from "../../generated/prisma/enums.js";
import { ArquivoInvalidoError, lerAba, listarAbas } from "../../lib/xlsx.js";
import { ACESSO_TOTAL } from "../acesso/acesso.js";
import { auditar } from "../auditoriaService.js";
import { INDICADORES_DAS_LISTAS } from "../relatorios/catalogoIndicadores.js";
import { basesDoConsolidado, COD } from "../relatorios/basesResultados.js";
import { estrutura, montar } from "../relatorios/resultadosService.js";
import { calcularCenario } from "./indicadoresDoCenario.js";
import { ABAS_DRE, ABAS_METAS, acharAba, lerAbaDRE, lerAbaMetas, MESES, type AbaDRELida, type AbaMetasLida } from "./leituraCenario.js";

/**
 * Os cenários sintéticos (Criação de Cenários, 11/10/2026): a lista dos cenários gerados, a criação (vazio ou cópia
 * de outro), a importação de um arquivo, a marcação (Orçamento Empresarial, Resultados Anteriores, Resultados
 * Vendidos — uma por exercício) e as telas Resultados e Indicadores de cada cenário.
 */

export class CenarioError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

export const MARCACOES: Record<MarcacaoCenario, string> = {
  ORCAMENTO_EMPRESARIAL: "Orçamento Empresarial",
  RESULTADOS_ANTERIORES: "Resultados Anteriores",
  RESULTADOS_VENDIDOS: "Resultados Vendidos",
};

type Usuario = { id: string; nome: string };
const LOTE = 500;
const MANUAIS = new Set(INDICADORES_DAS_LISTAS);
const rotuloMes = (ano: number, mes: number) => `${MESES[mes - 1]}/${String(ano).slice(2)}`;

async function obterOuFalhar(id: string) {
  const c = await getPrismaClient().cenario.findUnique({ where: { id } });
  if (!c) throw new CenarioError(404, "Cenário não encontrado.");
  return c;
}

/** O que o cenário tem: as visões da DRE com valor e os indicadores com meta. */
async function conteudo(ids: string[]) {
  const prisma = getPrismaClient();
  const [visoes, metas] = await Promise.all([
    prisma.cenarioResultado.groupBy({ by: ["cenarioId", "visao"], where: { cenarioId: { in: ids } } }),
    prisma.cenarioIndicador.groupBy({ by: ["cenarioId", "nome"], where: { cenarioId: { in: ids } } }),
  ]);
  return (id: string) => ({
    visoes: visoes.filter((v) => v.cenarioId === id).map((v) => v.visao).sort(),
    indicadores: metas.filter((m) => m.cenarioId === id).length,
  });
}

async function gravarEmLotes<T>(itens: T[], gravar: (lote: T[]) => Promise<unknown>) {
  for (let i = 0; i < itens.length; i += LOTE) await gravar(itens.slice(i, i + LOTE));
}

export const cenariosService = {
  async listar() {
    const cenarios = await getPrismaClient().cenario.findMany({ orderBy: [{ ano: "desc" }, { criadoEm: "desc" }] });
    const doCenario = await conteudo(cenarios.map((c) => c.id));
    return cenarios.map((c) => ({ ...c, ...doCenario(c.id) }));
  },

  async obter(id: string) {
    const c = await obterOuFalhar(id);
    return { ...c, ...(await conteudo([id]))(id) };
  },

  /** Um cenário novo: vazio, no exercício dado, ou a cópia de outro (com a DRE e as metas dele, no exercício dele). */
  async criar(dados: { nome: string; ano: number; descricao: string | null; copiarDe: string | null }, usuario: Usuario) {
    const prisma = getPrismaClient();
    const origem = dados.copiarDe ? await obterOuFalhar(dados.copiarDe) : null;
    const cenario = await prisma.$transaction(
      async (tx) => {
        const c = await tx.cenario.create({
          data: { nome: dados.nome, ano: origem?.ano ?? dados.ano, descricao: dados.descricao, criadoPor: usuario.nome, nomeArquivo: origem?.nomeArquivo ?? null, importadoEm: origem?.importadoEm ?? null },
        });
        if (origem) {
          const resultados = await tx.cenarioResultado.findMany({ where: { cenarioId: origem.id } });
          await gravarEmLotes(resultados, (lote) => tx.cenarioResultado.createMany({ data: lote.map((r) => ({ ...r, cenarioId: c.id })) }));
          const indicadores = await tx.cenarioIndicador.findMany({ where: { cenarioId: origem.id } });
          await gravarEmLotes(indicadores, (lote) => tx.cenarioIndicador.createMany({ data: lote.map((r) => ({ ...r, cenarioId: c.id })) }));
        }
        return c;
      },
      { timeout: 60_000 },
    );
    await auditar({ usuarioId: usuario.id, usuarioNome: usuario.nome, acao: "CRIACAO", entidade: "cenario", entidadeId: cenario.id, depois: cenario, metadados: origem ? { copiaDe: origem.nome } : undefined });
    return this.obter(cenario.id);
  },

  async atualizar(id: string, dados: { nome: string; descricao: string | null }, usuario: Usuario) {
    const antes = await obterOuFalhar(id);
    const depois = await getPrismaClient().cenario.update({ where: { id }, data: dados });
    await auditar({ usuarioId: usuario.id, usuarioNome: usuario.nome, acao: "ALTERACAO", entidade: "cenario", entidadeId: id, antes, depois });
    return this.obter(id);
  },

  async excluir(id: string, usuario: Usuario) {
    const antes = await obterOuFalhar(id);
    await getPrismaClient().cenario.delete({ where: { id } });
    await auditar({ usuarioId: usuario.id, usuarioNome: usuario.nome, acao: "EXCLUSAO", entidade: "cenario", entidadeId: id, antes });
  },

  /** Marca o cenário (ou tira a marcação); a marcação sai do outro cenário do exercício que a tinha. */
  async marcar(id: string, marcacao: MarcacaoCenario | null, usuario: Usuario) {
    const prisma = getPrismaClient();
    const antes = await obterOuFalhar(id);
    const anterior = marcacao ? await prisma.cenario.findFirst({ where: { ano: antes.ano, marcacao, id: { not: id } }, select: { id: true, nome: true } }) : null;
    await prisma.$transaction(async (tx) => {
      if (anterior) await tx.cenario.update({ where: { id: anterior.id }, data: { marcacao: null } });
      await tx.cenario.update({ where: { id }, data: { marcacao } });
    });
    await auditar({
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      acao: "ALTERACAO",
      entidade: "cenario",
      entidadeId: id,
      antes: { marcacao: antes.marcacao },
      depois: { marcacao },
      metadados: anterior ? { desmarcado: anterior.nome } : undefined,
    });
    return { desmarcado: anterior?.nome ?? null };
  },

  /**
   * Importa um arquivo: as abas da DRE que ele tiver substituem as mesmas visões do cenário, e a aba das metas
   * substitui as metas (inclusive as digitadas). Sem `cenarioId`, cria o cenário, no exercício do arquivo.
   */
  async importar(dados: { cenarioId: string | null; nome: string | null; descricao: string | null; nomeArquivo: string; conteudo: Buffer }, usuario: Usuario) {
    const prisma = getPrismaClient();
    let abas: string[];
    try {
      abas = listarAbas(dados.conteudo);
    } catch (error) {
      if (error instanceof ArquivoInvalidoError) throw new CenarioError(400, error.message);
      throw error;
    }
    const linhasDRE = await prisma.linhaDRE.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" }, select: { id: true, codigo: true, descricao: true } });
    const nomes = (await prisma.indicadorEstrutura.findMany({ select: { nome: true } })).map((i) => i.nome);
    const ler = (aba: string) => lerAba(dados.conteudo, () => aba).linhas;

    const dre: AbaDRELida[] = [];
    const ignoradas: string[] = [];
    let metas: AbaMetasLida | null = null;
    try {
      for (const a of ABAS_DRE) {
        const aba = acharAba(abas, a.abas);
        if (!aba) continue;
        const lida = lerAbaDRE(a.visao, aba, ler(aba), linhasDRE);
        if (lida) dre.push(lida);
        else ignoradas.push(aba);
      }
      const abaMetas = acharAba(abas, ABAS_METAS);
      if (abaMetas) {
        metas = lerAbaMetas(abaMetas, ler(abaMetas), nomes);
        if (!metas) ignoradas.push(abaMetas);
      }
    } catch (error) {
      if (error instanceof ArquivoInvalidoError) throw new CenarioError(400, error.message);
      throw error;
    }
    if (dre.length === 0 && !metas) {
      throw new CenarioError(
        400,
        `O arquivo não tem nenhuma aba de cenário. As abas lidas são: ${ABAS_DRE.map((a) => a.abas[0]).join(", ")} (a DRE por unidade) e Metas ou Metas (Orçamento) (as metas dos indicadores). Abas encontradas: ${abas.join(", ")}.`,
      );
    }
    const anos = [...new Set([...dre.map((d) => d.ano), ...(metas ? [metas.ano] : [])].filter((a) => a > 0))];
    if (anos.length !== 1) throw new CenarioError(400, anos.length ? `As abas são de exercícios diferentes (${anos.join(", ")}).` : "Não achei o exercício nos rótulos dos meses.");
    const ano = anos[0];
    const existente = dados.cenarioId ? await obterOuFalhar(dados.cenarioId) : null;
    if (existente && existente.ano !== ano) throw new CenarioError(400, `O arquivo é de ${ano}, e o cenário, de ${existente.ano}.`);
    if (!existente && !dados.nome) throw new CenarioError(400, "Dê um nome ao cenário.");

    const agora = new Date();
    const cenario = await prisma.$transaction(
      async (tx) => {
        const c = existente
          ? await tx.cenario.update({ where: { id: existente.id }, data: { nomeArquivo: dados.nomeArquivo, importadoEm: agora } })
          : await tx.cenario.create({ data: { nome: dados.nome!, ano, descricao: dados.descricao, criadoPor: usuario.nome, nomeArquivo: dados.nomeArquivo, importadoEm: agora } });
        for (const d of dre) {
          await tx.cenarioResultado.deleteMany({ where: { cenarioId: c.id, visao: d.visao } });
          await gravarEmLotes(d.valores, (lote) => tx.cenarioResultado.createMany({ data: lote.map((v) => ({ cenarioId: c.id, visao: d.visao, ...v })) }));
        }
        if (metas) {
          await tx.cenarioIndicador.deleteMany({ where: { cenarioId: c.id } });
          await gravarEmLotes(metas.valores, (lote) => tx.cenarioIndicador.createMany({ data: lote.map((v) => ({ cenarioId: c.id, ...v, origem: "IMPORTADO" })) }));
        }
        return c;
      },
      { timeout: 120_000 },
    );
    const resumo = {
      ano,
      visoes: dre.map((d) => ({ visao: d.visao, nome: ABAS_DRE.find((a) => a.visao === d.visao)!.nome, aba: d.aba, meses: d.meses, linhas: d.linhas, semPar: d.semPar })),
      /** Abas com o nome de uma unidade que não são uma DRE. */
      ignoradas,
      faltam: ABAS_DRE.filter((a) => !dre.some((d) => d.visao === a.visao)).map((a) => a.nome),
      metas: metas ? { aba: metas.aba, indicadores: metas.indicadores, ignorados: metas.ignorados } : null,
    };
    await auditar({
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      acao: "IMPORTACAO",
      entidade: "cenario",
      entidadeId: cenario.id,
      metadados: { arquivo: dados.nomeArquivo, novo: !existente, visoes: resumo.visoes.map((v) => v.aba), metas: resumo.metas?.aba ?? null },
    });
    return { cenario: await this.obter(cenario.id), resumo };
  },

  /** Uma visão da DRE do cenário (0 Consolidado, 1 a 5 as unidades), mês a mês, como as abas de Resultados Realizados. */
  async resultados(id: string, visao: 0 | 1 | 2 | 3 | 4 | 5) {
    const c = await obterOuFalhar(id);
    const visoes = basesDoConsolidado(visao) ? [visao, 0] : [visao];
    const [linhas, rs] = await Promise.all([
      estrutura(),
      getPrismaClient().cenarioResultado.findMany({ where: { cenarioId: id, visao: { in: visoes } }, select: { visao: true, mes: true, valor: true, linhaDRE: { select: { codigo: true } } } }),
    ]);
    const mapas = (v: number) => {
      const porMes = Array.from({ length: 12 }, () => new Map<string, number>());
      for (const r of rs) if (r.visao === v) porMes[r.mes - 1].set(r.linhaDRE.codigo, Number(r.valor));
      return porMes;
    };
    const valores = mapas(visao);
    const consolidado = basesDoConsolidado(visao) ? mapas(0) : valores;
    // Em Despesas e Extra e no RN, a ROL do Consolidado abre a tabela, como em Resultados Realizados.
    if (visao === 4 || visao === 5) valores.forEach((m, i) => consolidado[i].has(COD.RO) && m.set(COD.RO, consolidado[i].get(COD.RO)!));
    const comValor = valores.map((m) => m.size > 0);
    return {
      ano: c.ano,
      ate: 12,
      meses: Array.from({ length: 12 }, (_, k) => ({ mes: k + 1, rotulo: rotuloMes(c.ano, k + 1), apurado: comValor[k] })),
      linhas: montar(linhas, visao, comValor, valores, consolidado, ACESSO_TOTAL).map((l) => ({ ...l, podeDetalhar: false })),
    };
  },

  /** Os indicadores do cenário, mês a mês e acumulados, com a classe de cada um (as abas da tela). */
  async indicadores(id: string) {
    const c = await obterOuFalhar(id);
    const calculo = await calcularCenario(id);
    return {
      ano: c.ano,
      ate: 12,
      meses: Array.from({ length: 12 }, (_, k) => ({ mes: k + 1, rotulo: rotuloMes(c.ano, k + 1), apurado: true })),
      indicadores: calculo.indicadores.map((i) => ({
        grupo: i.indicador.grupo,
        numero: i.indicador.numero,
        nome: i.indicador.nome,
        sentido: i.indicador.sentido,
        unidade: i.indicador.unidade,
        metodologia: i.indicador.metodologia,
        acumulado: i.indicador.acumulado,
        classe: i.classe,
        meses: i.partes.map((p) => p?.valor ?? null),
        total: calculo.acumulado(i, 12),
        digitados: i.digitados,
        orcado: [],
        totalOrcado: null,
      })),
    };
  },

  /** Grava os lançamentos manuais de um indicador (os 12 meses; vazio apaga o mês). */
  async salvarManual(id: string, nome: string, valores: Array<number | null>, usuario: Usuario) {
    await obterOuFalhar(id);
    if (!MANUAIS.has(nome)) throw new CenarioError(400, `${nome} não é um lançamento manual: sai da DRE do cenário.`);
    const prisma = getPrismaClient();
    const antes = await prisma.cenarioIndicador.findMany({ where: { cenarioId: id, nome }, orderBy: { mes: "asc" } });
    await prisma.$transaction(async (tx) => {
      await tx.cenarioIndicador.deleteMany({ where: { cenarioId: id, nome } });
      const novos = valores.map((v, k) => ({ v, mes: k + 1 })).filter((x) => x.v !== null);
      await tx.cenarioIndicador.createMany({
        data: novos.map(({ v, mes }) => {
          // O mês que não mudou continua com a origem dele.
          const anterior = antes.find((a) => a.mes === mes);
          const igual = anterior && Math.abs(Number(anterior.valor) - v!) < 1e-9;
          return { cenarioId: id, nome, mes, valor: v!, origem: igual ? anterior.origem : "DIGITADO" };
        }),
      });
    });
    await auditar({
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      acao: "ALTERACAO",
      entidade: "cenario",
      entidadeId: id,
      antes: { nome, valores: antes.map((a) => ({ mes: a.mes, valor: a.valor })) },
      depois: { nome, valores: valores.map((v, k) => ({ mes: k + 1, valor: v })) },
      metadados: { lancamentoManual: nome },
    });
  },
};
