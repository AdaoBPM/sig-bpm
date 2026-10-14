import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";

import { getPrismaClient } from "../../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { MarcacaoCenario, VisualizacaoCenario } from "../../generated/prisma/enums.js";
import { ArquivoInvalidoError, lerAba, listarAbas } from "../../lib/xlsx.js";
import { ACESSO_TOTAL } from "../acesso/acesso.js";
import { auditar } from "../auditoriaService.js";
import { caminhoDoArquivo, diretorioUploads } from "../importacoes/arquivosImportados.js";
import { INDICADORES_DAS_LISTAS } from "../relatorios/catalogoIndicadores.js";
import { basesDoConsolidado, COD } from "../relatorios/basesResultados.js";
import { estrutura, montar } from "../relatorios/resultadosService.js";
import { estrutura as estruturaDRE } from "../dre/dreService.js";
import { contasDaUnidade, ErroEdicao, gravarValores, linhasDaUnidade, linhasDoConsolidado, recalcular, UNIDADES, type Alteracao } from "./edicaoCenario.js";
import { indicadoresService } from "../relatorios/indicadoresService.js";
import { calcularCenario, type CalculoDoCenario } from "./indicadoresDoCenario.js";
import { montarPainel } from "../relatorios/painelService.js";
import { PAINEL_PERFORMANCE, PAINEL_RESULTADOS, type Valor } from "../relatorios/painelDeBordo.js";
import { linhasDasVisoes, mesesAcima, totaisDaDRE } from "./comparativoCenario.js";
import { ABAS_DRE, ABAS_METAS, acharAba, lerAbaDRE, lerAbaMetas, MESES, type AbaDRELida, type AbaMetasLida } from "./leituraCenario.js";
import {
  calcularAnalitico,
  calcularPremissas,
  calcularTabela,
  linhasDaTabela,
  linhasDoCadastro,
  NOME_DA_UNIDADE,
  NOME_DA_VENDA,
  VENDAS_DA_UNIDADE,
  type UnidadePremissa,
  type Venda,
} from "./premissasCenario.js";
import { contasDoGrupo, gruposDoCadastro, percentuaisDasBases, RATEIOS, rateiosSemBase } from "./centrosCenario.js";
import {
  CONTAS_DEPRECIACAO,
  contaDeDepreciacao,
  contasExtra,
  depreciacaoMensal,
  depreciacaoNosMeses,
  roi,
  UNIDADES_EXTRA,
  VENDA_BASE,
  VENDA_EXTRA,
} from "./investimentosCenario.js";
import { referenciaDoRealizado } from "./referenciaAnalitico.js";
import { distribuirLotacao, QUADROS_DE_LOTACAO, quadroDoGrupo, VENDA_LOTACAO } from "./lotacaoCenario.js";

/**
 * Os cenários sintéticos (Criação de Cenários, 11/10/2026): a lista dos cenários gerados, a criação (vazio ou cópia
 * de outro), a importação de um arquivo, a marcação (Orçamento Empresarial, Resultados Anteriores, Resultados
 * Vendidos — cada uma ativa em um cenário só por vez) e as telas Resultados e Indicadores de cada cenário.
 *
 * A visualização (11/10/2026): o cenário particular só aparece para quem o criou e para o Administrador (Editar no
 * Controle de Usuários); para os demais, ele não existe (404). O público aparece para todos com permissão.
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

/**
 * O tipo do cenário (13/10/2026): os sintéticos (a DRE importada ou digitada) e os analíticos (a DRE calculada a partir
 * das premissas). Ficam em listas separadas: um cenário só copia e importa de outro do mesmo tipo; o comparativo vale
 * entre os tipos (pela DRE; o que só os analíticos têm, como os centros de custo, só se compara entre analíticos).
 */
export type TipoCenario = "SINTETICO" | "ANALITICO";
export const TIPOS: Record<TipoCenario, string> = { SINTETICO: "Cenários Sintéticos", ANALITICO: "Cenários Analíticos" };

/** O que só os sintéticos fazem: a importação de um arquivo, a edição da DRE e (por enquanto) a referência realizada. */
function exigirSintetico(c: { nome: string; tipo: string }, oQue: string) {
  if (c.tipo === "ANALITICO") throw new CenarioError(400, `O cenário ${c.nome} é analítico: ${oQue}.`);
}

/** O que só os analíticos têm: as premissas. */
function exigirAnalitico(c: { nome: string; tipo: string }) {
  if (c.tipo !== "ANALITICO") throw new CenarioError(400, `O cenário ${c.nome} é sintético: as premissas são só dos cenários analíticos.`);
}

/** Quem pede: `admin` é o Administrador (o perfil Administrador, 14/10/2026; antes, Editar no Controle de Usuários), que vê também os cenários particulares. */
type Usuario = { id: string; nome: string; admin?: boolean };
/** O que a tela fez numa gravação de valores (o histórico de reajustes, 12/10/2026). */
export type OrigemDaGravacao = { tipo: "MARCADOS" | "VALOR"; modo: "PERCENTUAL" | "ABSOLUTO" | "DIGITADO"; reajuste: number | null; replicado: boolean };
/** As chamadas internas (testes, scripts) veem todos os cenários. */
const SISTEMA: Usuario = { id: "", nome: "Sistema", admin: true };

export const VISUALIZACOES: Record<VisualizacaoCenario, string> = { PARTICULAR: "Particular", PUBLICA: "Pública" };
/** O usuário alcança o cenário? */
const alcanca = (c: { visualizacao: VisualizacaoCenario; criadoPorId: string | null }, u: Usuario) =>
  c.visualizacao === "PUBLICA" || !!u.admin || (!!c.criadoPorId && c.criadoPorId === u.id);
/** Quem muda a visualização de um cenário: quem o criou e o Administrador. */
const mudaVisualizacao = (c: { criadoPorId: string | null }, u: Usuario) => !!u.admin || (!!c.criadoPorId && c.criadoPorId === u.id);
const LOTE = 500;
const MANUAIS = new Set(INDICADORES_DAS_LISTAS);
const rotuloMes = (ano: number, mes: number) => `${MESES[mes - 1]}/${String(ano).slice(2)}`;

/** O rótulo da versão: VER00, VER01… */
export const rotuloVersao = (v: number) => `VER${String(v).padStart(2, "0")}`;

/**
 * As travas dos dados do cenário — a DRE, os indicadores manuais e a referência (arquivo ou realizado); o nome, a
 * descrição, o comparativo e as justificativas continuam editáveis:
 * - o cenário marcado (12/10/2026: Orçamento Empresarial, Resultados Anteriores ou Resultados Vendidos);
 * - a versão congelada (13/10/2026: Congelar Versão trava o cenário, como o fechamento de uma competência; para mudar,
 *   reabre-se a versão ou cria-se uma revisão).
 */
function exigirEditavel(c: { nome: string; marcacao: MarcacaoCenario | null; versao: number; versaoSalvaEm: Date | null }) {
  if (c.versaoSalvaEm) throw new CenarioError(409, `A ${rotuloVersao(c.versao)} do cenário ${c.nome} está congelada e não se edita: reabra a versão (Reabrir Versão) ou crie uma revisão (Criar Revisão), na tela Resultados.`);
  if (c.marcacao) throw new CenarioError(409, `O cenário ${c.nome} está marcado como ${MARCACOES[c.marcacao]} e não se edita: tire a marcação (ou marque outro cenário) antes de editá-lo.`);
}

/** O cenário, se o usuário o alcança; o particular de outro usuário é "não encontrado". */
async function obterOuFalhar(id: string, usuario: Usuario) {
  const c = await getPrismaClient().cenario.findUnique({ where: { id } });
  if (!c || !alcanca(c, usuario)) throw new CenarioError(404, "Cenário não encontrado.");
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

/**
 * A DRE de um cenário numa visão, mês a mês: os valores da visão e as bases (as do Consolidado em Despesas e Extra e no
 * RN, cuja tabela abre com a ROL do Consolidado, como em Resultados Realizados) e os meses com valor.
 */
async function dreDoCenario(cenarioId: string, visao: 0 | 1 | 2 | 3 | 4 | 5) {
  const visoes = basesDoConsolidado(visao) ? [visao, 0] : [visao];
  const rs = await getPrismaClient().cenarioResultado.findMany({ where: { cenarioId, visao: { in: visoes } }, select: { visao: true, mes: true, valor: true, linhaDRE: { select: { codigo: true } } } });
  const mapas = (v: number) => {
    const porMes = Array.from({ length: 12 }, () => new Map<string, number>());
    for (const r of rs) if (r.visao === v) porMes[r.mes - 1].set(r.linhaDRE.codigo, Number(r.valor));
    return porMes;
  };
  const valores = mapas(visao);
  const consolidado = basesDoConsolidado(visao) ? mapas(0) : valores;
  if (visao === 4 || visao === 5) valores.forEach((m, i) => consolidado[i].has(COD.RO) && m.set(COD.RO, consolidado[i].get(COD.RO)!));
  return { valores, consolidado, comValor: valores.map((m) => m.size > 0) };
}

/**
 * O resumo dos resultados do cenário (13/10/2026, a coluna Resultados da lista): o total do exercício no Consolidado
 * da ROL, do CPV, do EBITDA e do RL, com o % de cada um como na coluna do total da tela Resultados. Null sem DRE.
 */
async function resumoDoCenario(cenarioId: string, linhas: Awaited<ReturnType<typeof estrutura>>) {
  const d = await dreDoCenario(cenarioId, 0);
  if (!d.comValor.some(Boolean)) return null;
  const totais = new Map(montar(linhas, 0, d.comValor, d.valores, d.consolidado, ACESSO_TOTAL).map((l) => [l.codigo, l.total]));
  const de = (codigo: string) => ({ valor: totais.get(codigo)?.valor ?? 0, pct: totais.get(codigo)?.pct ?? null });
  return { rol: de(COD.RO), cpv: de("CPV.CUSTO_DE_PRODUTO_VENDIDO_CPV"), ebitda: de("EBITDA.LUCRO_OPERACIONAL_EBITDA"), rl: de("RL.RESULTADO_LIQUIDO_RL") };
}

/**
 * As famílias de versões (13/10/2026): por família (o id da VER00), a maior versão e quantas versões há. A vigente é a
 * maior; com mais de uma versão, o nome fica travado (é o mesmo em todas, para comparar as versões).
 */
async function familias() {
  const porFamilia = new Map<string, { maior: number; versoes: number }>();
  for (const v of await getPrismaClient().cenario.findMany({ select: { id: true, familiaId: true, versao: true } })) {
    const f = v.familiaId ?? v.id;
    const atual = porFamilia.get(f) ?? { maior: 0, versoes: 0 };
    porFamilia.set(f, { maior: Math.max(atual.maior, v.versao), versoes: atual.versoes + 1 });
  }
  return (c: { id: string; familiaId: string | null; versao: number }) => {
    const f = porFamilia.get(c.familiaId ?? c.id) ?? { maior: c.versao, versoes: 1 };
    return { vigente: c.versao === f.maior, nomeTravado: f.versoes > 1 };
  };
}

/** O cenário comparado (o comparativo), se houver. */
async function comparadoDe(c: { comparadoComId: string | null }) {
  return c.comparadoComId ? getPrismaClient().cenario.findUnique({ where: { id: c.comparadoComId }, select: { id: true, nome: true, ano: true } }) : null;
}

type CelulaTotal = { valor: number | null; pct: number | null; unitario: number | null };
const TOTAL_ZERO: CelulaTotal = { valor: 0, pct: null, unitario: null };

/**
 * Os totais do exercício do cenário comparado numa visão, por linha (13/10/2026): o valor, o % e o R$/m³ do total,
 * como a coluna do total da tabela dele. Vão no lugar do orçado dos Resultados Realizados (só o total, sem o mês).
 */
async function totaisDoComparado(comparadoId: string, visao: 0 | 1 | 2 | 3 | 4 | 5, linhas: Awaited<ReturnType<typeof estrutura>>) {
  const d = await dreDoCenario(comparadoId, visao);
  return new Map(montar(linhas, visao, d.comValor, d.valores, d.consolidado, ACESSO_TOTAL).map((l) => [l.codigo, l.total as CelulaTotal]));
}
/** A linha com o total do comparado (no campo do orçado, só o total). */
const comTotalComparado = <L extends { codigo: string; tipo: string }>(l: L, totais: Map<string, CelulaTotal> | null) =>
  totais ? { ...l, orcado: l.tipo === "SECAO" ? null : { total: totais.get(l.codigo) ?? TOTAL_ZERO } } : l;

async function gravarEmLotes<T>(itens: T[], gravar: (lote: T[]) => Promise<unknown>) {
  for (let i = 0; i < itens.length; i += LOTE) await gravar(itens.slice(i, i + LOTE));
}

/** As abas do arquivo que a importação lê: a DRE por visão e as metas, com o exercício dos rótulos. */
async function lerArquivo(conteudo: Buffer) {
  const prisma = getPrismaClient();
  let abas: string[];
  try {
    abas = listarAbas(conteudo);
  } catch (error) {
    if (error instanceof ArquivoInvalidoError) throw new CenarioError(400, error.message);
    throw error;
  }
  const linhasDRE = await prisma.linhaDRE.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" }, select: { id: true, codigo: true, descricao: true } });
  const nomes = (await prisma.indicadorEstrutura.findMany({ select: { nome: true } })).map((i) => i.nome);
  const dre: AbaDRELida[] = [];
  const ignoradas: string[] = [];
  let metas: AbaMetasLida | null = null;
  try {
    const ler = (aba: string) => lerAba(conteudo, () => aba).linhas;
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
  return { ano: anos[0], dre, metas, ignoradas };
}

const igual = (a: number, b: number) => Math.abs(a - b) <= Math.max(1e-6, Math.abs(b) * 1e-9);

/** Os valores novos contra os do cenário: quantos entram, mudam e saem (o que ficaria igual não conta). */
function comparar(novos: Map<string, number>, atuais: Map<string, number>) {
  let novas = 0;
  let alteradas = 0;
  for (const [k, v] of novos) {
    const a = atuais.get(k);
    if (a === undefined) novas++;
    else if (!igual(v, a)) alteradas++;
  }
  const removidas = [...atuais.keys()].filter((k) => !novos.has(k)).length;
  return { novas, alteradas, removidas, semMudanca: novas + alteradas + removidas === 0 };
}

/**
 * A prévia da importação: o que o arquivo traz, aba por aba, e, num cenário que já existe, o que muda nele. O
 * bloqueio (o exercício do arquivo diferente do do cenário) impede a importação.
 */
async function previa(lido: Awaited<ReturnType<typeof lerArquivo>>, cenarioId: string | null, usuario: Usuario) {
  const prisma = getPrismaClient();
  const existente = cenarioId ? await obterOuFalhar(cenarioId, usuario) : null;
  if (existente) exigirEditavel(existente);
  const [resultados, metasAtuais] = existente
    ? await Promise.all([
        prisma.cenarioResultado.findMany({ where: { cenarioId: existente.id }, select: { visao: true, linhaDREId: true, mes: true, valor: true } }),
        prisma.cenarioIndicador.findMany({ where: { cenarioId: existente.id }, select: { nome: true, mes: true, valor: true, origem: true } }),
      ])
    : [[], []];
  const visoesAtuais = new Set(resultados.map((r) => r.visao));
  return {
    ano: lido.ano,
    cenario: existente ? { id: existente.id, nome: existente.nome, ano: existente.ano } : null,
    bloqueio: existente && existente.ano !== lido.ano ? `O arquivo é de ${lido.ano}, e o cenário, de ${existente.ano}: importe num cenário de ${lido.ano} ou num cenário novo.` : null,
    visoes: lido.dre.map((d) => {
      const atuais = new Map(resultados.filter((r) => r.visao === d.visao).map((r) => [`${r.linhaDREId}|${r.mes}`, Number(r.valor)]));
      const novos = new Map(d.valores.map((v) => [`${v.linhaDREId}|${v.mes}`, v.valor]));
      return {
        visao: d.visao,
        nome: ABAS_DRE.find((a) => a.visao === d.visao)!.nome,
        aba: d.aba,
        meses: d.meses,
        linhas: d.linhas,
        semPar: d.semPar,
        valores: d.valores.length,
        /** NOVA: o cenário não tem a visão; SUBSTITUI: tem, e o arquivo a substitui. */
        acao: atuais.size === 0 ? ("NOVA" as const) : ("SUBSTITUI" as const),
        mudancas: comparar(novos, atuais),
      };
    }),
    /** As visões que o arquivo não traz: ficam como estão (com valores) ou vazias. */
    faltam: ABAS_DRE.filter((a) => !lido.dre.some((d) => d.visao === a.visao)).map((a) => ({ nome: a.nome, temValores: visoesAtuais.has(a.visao) })),
    metas: lido.metas
      ? (() => {
          const atuais = new Map(metasAtuais.map((m) => [`${m.nome}|${m.mes}`, Number(m.valor)]));
          const novos = new Map(lido.metas.valores.map((v) => [`${v.nome}|${v.mes}`, v.valor]));
          return {
            aba: lido.metas.aba,
            indicadores: lido.metas.indicadores,
            meses: new Set(lido.metas.valores.map((v) => v.mes)).size,
            ignorados: lido.metas.ignorados,
            acao: atuais.size === 0 ? ("NOVA" as const) : ("SUBSTITUI" as const),
            mudancas: comparar(novos, atuais),
            /** Os lançamentos manuais digitados que a importação substitui. */
            digitados: metasAtuais.filter((m) => m.origem === "DIGITADO").length,
          };
        })()
      : null,
    metasAtuais: metasAtuais.length,
    ignoradas: lido.ignoradas,
  };
}

export type PreviaCenario = Awaited<ReturnType<typeof previa>>;

export const cenariosService = {
  async listar(usuario: Usuario = SISTEMA, tipo: TipoCenario = "SINTETICO") {
    const cenarios = (await getPrismaClient().cenario.findMany({ where: { tipo }, orderBy: [{ ano: "desc" }, { criadoEm: "desc" }] })).filter((c) => alcanca(c, usuario));
    const [doCenario, linhas, daFamilia] = await Promise.all([conteudo(cenarios.map((c) => c.id)), estrutura(), familias()]);
    const resumos = await Promise.all(cenarios.map((c) => resumoDoCenario(c.id, linhas)));
    return cenarios.map((c, k) => ({ ...c, ...doCenario(c.id), ...daFamilia(c), resultados: resumos[k], podeMudarVisualizacao: mudaVisualizacao(c, usuario) }));
  },

  async obter(id: string, usuario: Usuario = SISTEMA) {
    const c = await obterOuFalhar(id, usuario);
    return { ...c, ...(await conteudo([id]))(id), ...(await familias())(c), podeMudarVisualizacao: mudaVisualizacao(c, usuario) };
  },

  /**
   * Um cenário novo: vazio, no exercício dado, ou a cópia de outro do mesmo tipo (com a DRE e as metas dele, no
   * exercício dele).
   */
  async criar(dados: { nome: string; ano: number; descricao: string | null; copiarDe: string | null; visualizacao?: VisualizacaoCenario; tipo?: TipoCenario }, usuario: Usuario) {
    const prisma = getPrismaClient();
    const tipo = dados.tipo ?? "SINTETICO";
    const origem = dados.copiarDe ? await obterOuFalhar(dados.copiarDe, usuario) : null;
    if (origem && origem.tipo !== tipo) throw new CenarioError(400, `${TIPOS[tipo]} só copiam de ${TIPOS[tipo]}: ${origem.nome} é de outro tipo.`);
    const cenario = await prisma.$transaction(
      async (tx) => {
        const c = await tx.cenario.create({
          data: {
            nome: dados.nome,
            tipo,
            ano: origem?.ano ?? dados.ano,
            descricao: dados.descricao,
            visualizacao: dados.visualizacao ?? "PUBLICA",
            criadoPor: usuario.nome,
            criadoPorId: usuario.id || null,
            nomeArquivo: origem?.nomeArquivo ?? null,
            importadoEm: origem?.importadoEm ?? null,
          },
        });
        if (origem) {
          const resultados = await tx.cenarioResultado.findMany({ where: { cenarioId: origem.id } });
          await gravarEmLotes(resultados, (lote) => tx.cenarioResultado.createMany({ data: lote.map((r) => ({ ...r, cenarioId: c.id })) }));
          const indicadores = await tx.cenarioIndicador.findMany({ where: { cenarioId: origem.id } });
          await gravarEmLotes(indicadores, (lote) => tx.cenarioIndicador.createMany({ data: lote.map((r) => ({ ...r, cenarioId: c.id })) }));
          // As premissas do analítico (13/10/2026).
          const premissas = await tx.cenarioPremissa.findMany({ where: { cenarioId: origem.id } });
          await gravarEmLotes(premissas, (lote) => tx.cenarioPremissa.createMany({ data: lote.map((p) => ({ ...p, cenarioId: c.id })) }));
          const centros = await tx.cenarioCentro.findMany({ where: { cenarioId: origem.id } });
          await gravarEmLotes(centros, (lote) => tx.cenarioCentro.createMany({ data: lote.map((x) => ({ ...x, cenarioId: c.id })) }));
          const investimentos = await tx.cenarioInvestimento.findMany({ where: { cenarioId: origem.id } });
          await gravarEmLotes(investimentos, (lote) => tx.cenarioInvestimento.createMany({ data: lote.map(({ id: _id, ...x }) => ({ ...x, cenarioId: c.id })) }));
        }
        return c;
      },
      { timeout: 60_000 },
    );
    await auditar({ usuarioId: usuario.id, usuarioNome: usuario.nome, acao: "CRIACAO", entidade: "cenario", entidadeId: cenario.id, depois: cenario, metadados: origem ? { copiaDe: origem.nome } : undefined });
    return this.obter(cenario.id, usuario);
  },

  /**
   * O nome, a descrição e a visualização. A visualização só muda por quem criou o cenário ou pelo Administrador, e um
   * cenário marcado não fica particular (a marcação vale para todos: o Orçamento Empresarial dá o orçado de Resultados
   * Realizados).
   */
  async atualizar(id: string, dados: { nome: string; descricao: string | null; visualizacao?: VisualizacaoCenario }, usuario: Usuario) {
    const antes = await obterOuFalhar(id, usuario);
    // Com revisões criadas, o nome é o mesmo em todas as versões e não muda (13/10/2026).
    if (dados.nome !== antes.nome && (await familias())(antes).nomeTravado) {
      throw new CenarioError(409, `O cenário ${antes.nome} tem revisões: o nome é o mesmo em todas as versões e não muda.`);
    }
    const visualizacao = dados.visualizacao ?? antes.visualizacao;
    if (visualizacao !== antes.visualizacao) {
      if (!mudaVisualizacao(antes, usuario)) throw new CenarioError(409, "Só quem criou o cenário ou o Administrador muda a visualização dele.");
      if (visualizacao === "PARTICULAR" && antes.marcacao) {
        throw new CenarioError(409, `O cenário está marcado como ${MARCACOES[antes.marcacao]}: um cenário marcado fica público. Tire a marcação antes de torná-lo particular.`);
      }
    }
    const depois = await getPrismaClient().cenario.update({ where: { id }, data: { nome: dados.nome, descricao: dados.descricao, visualizacao } });
    await auditar({ usuarioId: usuario.id, usuarioNome: usuario.nome, acao: "ALTERACAO", entidade: "cenario", entidadeId: id, antes, depois });
    return this.obter(id, usuario);
  },

  /** Exclui o cenário; um cenário marcado (Orçamento Empresarial, Resultados Anteriores, Resultados Vendidos) não se exclui. */
  async excluir(id: string, usuario: Usuario) {
    const antes = await obterOuFalhar(id, usuario);
    if (antes.marcacao) {
      throw new CenarioError(409, `O cenário ${antes.nome} está marcado como ${MARCACOES[antes.marcacao]}: tire a marcação (ou marque outro cenário) antes de excluí-lo.`);
    }
    await getPrismaClient().cenario.delete({ where: { id } });
    await auditar({ usuarioId: usuario.id, usuarioNome: usuario.nome, acao: "EXCLUSAO", entidade: "cenario", entidadeId: id, antes });
  },

  /** Marca o cenário (ou tira a marcação); a marcação sai do outro cenário que a tinha (de qualquer exercício). */
  async marcar(id: string, marcacao: MarcacaoCenario | null, usuario: Usuario) {
    const prisma = getPrismaClient();
    const antes = await obterOuFalhar(id, usuario);
    if (marcacao && antes.visualizacao === "PARTICULAR") {
      throw new CenarioError(409, `O cenário ${antes.nome} é particular: a marcação vale para todos os usuários. Torne-o público (Editar) antes de marcá-lo.`);
    }
    const anterior = marcacao ? await prisma.cenario.findFirst({ where: { marcacao, id: { not: id } }, select: { id: true, nome: true } }) : null;
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
   * Importação, passo 1: guarda o arquivo (pelo hash) e devolve a prévia — o que cada aba traz e o que muda no
   * cenário (`cenarioId`) ou, sem ele, no cenário novo. Nada é gravado no cenário.
   */
  async analisar(dados: { cenarioId: string | null; nomeArquivo: string; conteudo: Buffer }, usuario: Usuario = SISTEMA) {
    if (dados.cenarioId) exigirSintetico(await obterOuFalhar(dados.cenarioId, usuario), "a importação de arquivo é só dos cenários sintéticos");
    const lido = await lerArquivo(dados.conteudo);
    const hash = createHash("sha256").update(dados.conteudo).digest("hex");
    await mkdir(diretorioUploads(), { recursive: true });
    const caminho = caminhoDoArquivo(hash);
    try {
      await access(caminho);
    } catch {
      await writeFile(caminho, dados.conteudo);
    }
    return { hash, nomeArquivo: dados.nomeArquivo, ...(await previa(lido, dados.cenarioId, usuario)) };
  },

  /**
   * Importação, passo 2 (o usuário confirmou): relê o arquivo guardado e grava. As abas da DRE substituem as mesmas
   * visões do cenário, e a aba das metas substitui as metas (inclusive as digitadas). Sem `cenarioId`, cria o
   * cenário no exercício escolhido (`ano`), que precisa ser o dos meses do arquivo.
   */
  async importar(
    dados: { hash: string; cenarioId: string | null; nome: string | null; ano: number | null; descricao: string | null; nomeArquivo: string; visualizacao?: VisualizacaoCenario },
    usuario: Usuario,
  ) {
    const prisma = getPrismaClient();
    if (dados.cenarioId) exigirSintetico(await obterOuFalhar(dados.cenarioId, usuario), "a importação de arquivo é só dos cenários sintéticos");
    let conteudo: Buffer;
    try {
      conteudo = await readFile(caminhoDoArquivo(dados.hash));
    } catch {
      throw new CenarioError(404, "O arquivo analisado não foi encontrado. Escolha o arquivo de novo.");
    }
    const lido = await lerArquivo(conteudo);
    const p = await previa(lido, dados.cenarioId, usuario);
    if (p.bloqueio) throw new CenarioError(400, p.bloqueio);
    if (!p.cenario && !dados.nome) throw new CenarioError(400, "Dê um nome ao cenário.");
    if (!p.cenario && dados.ano !== null && dados.ano !== lido.ano) throw new CenarioError(400, `O arquivo é de ${lido.ano}, e o exercício escolhido, ${dados.ano}.`);
    const { ano, dre, metas } = lido;

    const agora = new Date();
    const cenario = await prisma.$transaction(
      async (tx) => {
        const c = p.cenario
          ? await tx.cenario.update({ where: { id: p.cenario.id }, data: { nomeArquivo: dados.nomeArquivo, importadoEm: agora } })
          : await tx.cenario.create({
              data: {
                nome: dados.nome!,
                ano,
                descricao: dados.descricao,
                visualizacao: dados.visualizacao ?? "PUBLICA",
                criadoPor: usuario.nome,
                criadoPorId: usuario.id || null,
                nomeArquivo: dados.nomeArquivo,
                importadoEm: agora,
              },
            });
        for (const d of dre) {
          await tx.cenarioResultado.deleteMany({ where: { cenarioId: c.id, visao: d.visao } });
          await gravarEmLotes(d.valores, (lote) => tx.cenarioResultado.createMany({ data: lote.map((v) => ({ cenarioId: c.id, visao: d.visao, ...v })) }));
        }
        // Os totais das unidades e o Consolidado são calculados (12/10/2026), como na edição pela ferramenta.
        if (dre.length) await recalcular(tx, c.id, Array.from({ length: 12 }, (_, k) => k + 1), UNIDADES);
        if (metas) {
          await tx.cenarioIndicador.deleteMany({ where: { cenarioId: c.id } });
          await gravarEmLotes(metas.valores, (lote) => tx.cenarioIndicador.createMany({ data: lote.map((v) => ({ cenarioId: c.id, ...v, origem: "IMPORTADO" })) }));
        }
        return c;
      },
      { timeout: 120_000 },
    );
    await auditar({
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      acao: "IMPORTACAO",
      entidade: "cenario",
      entidadeId: cenario.id,
      metadados: { arquivo: dados.nomeArquivo, hash: dados.hash, novo: !p.cenario, visoes: p.visoes.map((v) => v.aba), metas: p.metas?.aba ?? null },
    });
    await prisma.cenarioReajuste.create({
      data: { cenarioId: cenario.id, usuarioId: usuario.id || null, usuarioNome: usuario.nome, tipo: "REFERENCIA", descricao: `Arquivo ${dados.nomeArquivo}` },
    });
    return { cenario: await this.obter(cenario.id, usuario), previa: { hash: dados.hash, nomeArquivo: dados.nomeArquivo, ...p } };
  },

  /** Uma visão da DRE do cenário (0 Consolidado, 1 a 5 as unidades), mês a mês, como as abas de Resultados Realizados. */
  async resultados(id: string, visao: 0 | 1 | 2 | 3 | 4 | 5, usuario: Usuario = SISTEMA) {
    const c = await obterOuFalhar(id, usuario);
    const [linhas, d, comparado] = await Promise.all([estrutura(), dreDoCenario(id, visao), comparadoDe(c)]);
    // Com um cenário comparado (13/10/2026), cada linha traz o total dele; entram também as linhas que só ele tem.
    const totais = comparado ? await totaisDoComparado(comparado.id, visao, linhas) : null;
    return {
      ano: c.ano,
      ate: 12,
      meses: Array.from({ length: 12 }, (_, k) => ({ mes: k + 1, rotulo: rotuloMes(c.ano, k + 1), apurado: d.comValor[k] })),
      comparado: comparado ? { nome: comparado.nome, ano: comparado.ano } : null,
      linhas: montar(linhas, visao, d.comValor, d.valores, d.consolidado, ACESSO_TOTAL, totais ? new Set(totais.keys()) : undefined).map((l) =>
        comTotalComparado({ ...l, podeDetalhar: false }, totais),
      ),
    };
  },

  /**
   * O Painel de Bordo do cenário (13/10/2026), como o de Resultados Realizados: os mesmos quadros (Resultados e
   * Performance), com o cenário no lugar do realizado e o cenário comparado (o comparativo) no lugar do orçado — sem
   * comparado, essa parte fica vazia. O mês de referência é `ate` (dezembro, sem ele); o acumulado vai de janeiro a ele.
   */
  async painel(id: string, ate: number, usuario: Usuario = SISTEMA) {
    const c = await obterOuFalhar(id, usuario);
    const comparado = await comparadoDe(c);
    const [doCenario, doComparado] = await Promise.all([calcularCenario(id), comparado ? calcularCenario(comparado.id) : null]);
    const valores = (k: CalculoDoCenario | null) => {
      const porNome = new Map((k?.indicadores ?? []).map((i) => [i.indicador.nome, i]));
      const doMes = (mes: number): Valor => (n) => porNome.get(n)?.partes[mes - 1]?.valor ?? null;
      const acumulado: Valor = (n) => {
        const i = porNome.get(n);
        return k && i ? k.acumulado(i, ate) : null;
      };
      return { doMes, acumulado };
    };
    const cen = valores(doCenario);
    const comp = valores(doComparado);
    const periodos = { mes: [cen.doMes(ate), comp.doMes(ate)] as [Valor, Valor], acumulado: [cen.acumulado, comp.acumulado] as [Valor, Valor] };
    const serie = Array.from({ length: ate }, (_, k) => ({ rotulo: MESES[k], realizado: cen.doMes(k + 1), orcado: comp.doMes(k + 1) }));
    return {
      ano: c.ano,
      ate,
      rotuloMes: `${MESES[ate - 1]}/${c.ano}`,
      rotuloAcumulado: `ACUMULADO/${c.ano}`,
      mesApurado: true,
      cenarioOrcado: comparado?.nome ?? null,
      mesesSemMeta: [],
      comparado: comparado ? { nome: comparado.nome, ano: comparado.ano } : null,
      abas: [
        { chave: "resultados", titulo: "Resultados", quadros: montarPainel(PAINEL_RESULTADOS, periodos, serie) },
        { chave: "performance", titulo: "Performance", quadros: montarPainel(PAINEL_PERFORMANCE, periodos, serie) },
      ],
    };
  },

  /** Os indicadores do cenário, mês a mês e acumulados, com a classe de cada um (as abas da tela). */
  async indicadores(id: string, usuario: Usuario = SISTEMA) {
    const c = await obterOuFalhar(id, usuario);
    const comparado = await comparadoDe(c);
    const [calculo, doComparado] = await Promise.all([calcularCenario(id), comparado ? calcularCenario(comparado.id) : null]);
    // Com um cenário comparado (13/10/2026), o acumulado dele no lugar do orçado acumulado (pelo nome do indicador).
    const comparados = new Map((doComparado?.indicadores ?? []).map((i) => [i.indicador.nome, i]));
    const acumuladoComparado = (nome: string) => {
      const i = comparados.get(nome);
      return doComparado && i ? doComparado.acumulado(i, 12) : null;
    };
    return {
      ano: c.ano,
      ate: 12,
      comparado: comparado ? { nome: comparado.nome, ano: comparado.ano } : null,
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
        totalOrcado: acumuladoComparado(i.indicador.nome),
      })),
    };
  },

  /**
   * Uma visão da DRE do cenário para a edição (12/10/2026): como `resultados`, mas com todas as linhas da visão
   * (também as vazias, para editar) e os doze meses; `editaveis` são as contas que se editam (nenhuma no
   * Consolidado, que soma as unidades).
   */
  async edicao(id: string, visao: 0 | 1 | 2 | 3 | 4 | 5, usuario: Usuario = SISTEMA) {
    const c = await obterOuFalhar(id, usuario);
    exigirSintetico(c, "a DRE é calculada a partir das premissas e não se edita");
    const [linhas, est, d, comparado] = await Promise.all([estrutura(), estruturaDRE(), dreDoCenario(id, visao), comparadoDe(c)]);
    const totais = comparado ? await totaisDoComparado(comparado.id, visao, linhas) : null;
    const todas = visao === 0 ? linhasDoConsolidado(est) : linhasDaUnidade(est, visao);
    const meses = Array.from({ length: 12 }, () => true);
    return {
      ano: c.ano,
      ate: 12,
      meses: Array.from({ length: 12 }, (_, k) => ({ mes: k + 1, rotulo: rotuloMes(c.ano, k + 1), apurado: true })),
      comparado: comparado ? { nome: comparado.nome, ano: comparado.ano } : null,
      linhas: montar(linhas, visao, meses, d.valores, d.consolidado, ACESSO_TOTAL, todas).map((l) => comTotalComparado({ ...l, podeDetalhar: false }, totais)),
      editaveis: visao === 0 ? [] : [...contasDaUnidade(est, visao)],
    };
  },

  /**
   * Grava valores mensais de contas de uma unidade e recalcula os totais e o Consolidado (12/10/2026). `origem` diz o
   * que a tela fez — o reajuste dos marcados ou a edição de um valor, com o reajuste — para o histórico de reajustes.
   */
  async gravarValores(id: string, visao: number, alteracoes: Alteracao[], usuario: Usuario, origem?: OrigemDaGravacao) {
    const c = await obterOuFalhar(id, usuario);
    exigirSintetico(c, "a DRE é calculada a partir das premissas e não se edita");
    exigirEditavel(c);
    let r: Awaited<ReturnType<typeof gravarValores>>;
    try {
      r = await gravarValores(id, visao, alteracoes);
    } catch (error) {
      if (error instanceof ErroEdicao) throw new CenarioError(400, error.message);
      throw error;
    }
    await getPrismaClient().cenarioReajuste.create({
      data: {
        cenarioId: id,
        usuarioId: usuario.id || null,
        usuarioNome: usuario.nome,
        tipo: origem?.tipo ?? "VALOR",
        modo: origem?.modo ?? "DIGITADO",
        reajuste: origem?.reajuste ?? null,
        visao,
        replicado: !!origem?.replicado,
        contas: r.contas,
        meses: r.meses,
        valores: r.alteradas,
        somaAntes: r.somaAntes,
        somaDepois: r.somaDepois,
      },
    });
    await auditar({
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      acao: "ALTERACAO",
      entidade: "cenario",
      entidadeId: id,
      metadados: { cenario: c.nome, visao, valores: r.alteradas, meses: r.meses, linhas: r.contas.map((x) => x.codigo).slice(0, 50), origem: origem ?? null },
    });
    return { alteradas: r.alteradas, meses: r.meses };
  },

  /**
   * A referência do cenário pelo resultado realizado (12/10/2026): a DRE das competências fechadas de um exercício
   * (o Consolidado e as cinco unidades, mês a mês) substitui a DRE do cenário; os meses sem competência fechada
   * ficam vazios. Os indicadores realizados desses meses (os de Resultados Realizados) substituem os do cenário, como
   * a aba das metas de um arquivo (12/10/2026): os que saem da DRE o cenário recalcula; os das listas, os
   * lançamentos manuais e os GME ficam com o realizado. Com `modo` MEDIA (12/10/2026), a média do período `de`–`ate`
   * (todo de competências fechadas) vai para os doze meses do cenário, na DRE e nos indicadores.
   *
   * No cenário analítico (14/10/2026), a DRE é calculada: a referência carrega as premissas (as Médias de Referência
   * do período — todos os meses fechados, no Mês a Mês —, e os doze meses iguais a elas), os grupos de centros de
   * custo, a depreciação base e o extra-operacional (mês a mês ou a média), e os indicadores; os investimentos ficam.
   * Devolve também os avisos do que não coube nas premissas.
   */
  async referenciaRealizado(id: string, ano: number, usuario: Usuario, opcoes: { modo: "MES_A_MES" | "MEDIA"; de?: number; ate?: number } = { modo: "MES_A_MES" }) {
    const c = await obterOuFalhar(id, usuario);
    exigirEditavel(c);
    const analitico = c.tipo === "ANALITICO";
    const prisma = getPrismaClient();
    const todas = await prisma.competencia.findMany({ where: { ano, status: "FECHADA" }, select: { id: true, mes: true }, orderBy: { mes: "asc" } });
    if (todas.length === 0) throw new CenarioError(400, `Nenhuma competência de ${ano} está fechada.`);
    // A média replicada (12/10/2026): o período escolhido, todo de competências fechadas.
    const media = opcoes.modo === "MEDIA";
    const de = opcoes.de ?? todas[0].mes;
    const ate = opcoes.ate ?? todas[todas.length - 1].mes;
    if (media) {
      if (de > ate) throw new CenarioError(400, "O mês inicial do período vem depois do final.");
      const abertas = Array.from({ length: ate - de + 1 }, (_, k) => de + k).filter((m) => !todas.some((f) => f.mes === m));
      if (abertas.length) throw new CenarioError(400, `O período tem meses sem competência fechada: ${abertas.map((m) => `${String(m).padStart(2, "0")}/${ano}`).join(", ")}.`);
    }
    const fechadas = media ? todas.filter((f) => f.mes >= de && f.mes <= ate) : todas;
    const mesDe = new Map(fechadas.map((f) => [f.id, f.mes]));
    const rs = await prisma.resultadoApurado.findMany({
      where: { competenciaId: { in: fechadas.map((f) => f.id) }, centroCustoId: null },
      select: { competenciaId: true, linhaDREId: true, valor: true, unidadeNegocio: { select: { codigo: true } } },
    });
    const meses = fechadas.map((f) => String(f.mes).padStart(2, "0"));
    const periodo = meses.length === 1 ? meses[0] : `${meses[0]} a ${meses[meses.length - 1]}`;
    const realizados = await indicadoresService.listar(ano, fechadas[fechadas.length - 1].mes, true);
    const doze = Array.from({ length: 12 }, (_, k) => k + 1);
    // A DRE: mês a mês, os valores de cada competência; na média, a soma de cada linha no período ÷ o número de meses,
    // em todos os doze meses (os totais, recalculados das contas médias, também são as médias).
    const somas = new Map<string, Prisma.Decimal>();
    if (media) {
      for (const r of rs) {
        const k = `${r.unidadeNegocio?.codigo ?? 0}|${r.linhaDREId}`;
        somas.set(k, (somas.get(k) ?? new Prisma.Decimal(0)).plus(r.valor));
      }
    }
    const dre: Array<{ visao: number; linhaDREId: string; mes: number; valor: Prisma.Decimal }> = media
      ? [...somas].flatMap(([k, soma]) => {
          const [visao, linhaDREId] = k.split("|");
          const valor = new Prisma.Decimal(soma.div(fechadas.length).toFixed(4));
          return doze.map((mes) => ({ visao: Number(visao), linhaDREId, mes, valor }));
        })
      : rs.map((r) => ({ visao: r.unidadeNegocio?.codigo ?? 0, linhaDREId: r.linhaDREId, mes: mesDe.get(r.competenciaId)!, valor: r.valor }));
    // Os indicadores realizados: mês a mês, os dos meses fechados; na média, a média simples dos meses do período com
    // valor, nos doze meses (os que saem da DRE o cenário recalcula das contas médias).
    const noPeriodo = (k: number) => fechadas.some((f) => f.mes === k + 1);
    const indicadores = realizados.indicadores.flatMap((i) => {
      if (!media) return i.meses.flatMap((v, k) => (v === null || !Number.isFinite(v) || !noPeriodo(k) ? [] : [{ nome: i.nome, mes: k + 1, valor: new Prisma.Decimal(v.toFixed(8)) }]));
      const vs = i.meses.filter((v, k): v is number => v !== null && Number.isFinite(v) && noPeriodo(k));
      if (!vs.length) return [];
      const valor = new Prisma.Decimal((vs.reduce((s, v) => s + v, 0) / vs.length).toFixed(8));
      return doze.map((mes) => ({ nome: i.nome, mes, valor }));
    });
    const nomeArquivo = media ? `Média do realizado de ${ano} (${periodo}), nos 12 meses` : `Resultado realizado de ${ano} (${periodo})`;
    if (analitico) {
      const ref = await referenciaDoRealizado(ano, fechadas.map((f) => f.mes));
      const idDaConta = new Map((await estruturaDRE()).map((l) => [l.codigo, l.id]));
      const grupos = await gruposDoCadastro();
      // Na média, cada valor mensal vira a soma no período ÷ o número de meses, nos doze meses.
      const mediar = <T extends { mes: number; valor: number }>(xs: T[], chave: (x: T) => string) => {
        if (!media) return xs;
        const somas = new Map<string, { x: T; soma: number }>();
        for (const x of xs) somas.set(chave(x), { x, soma: (somas.get(chave(x))?.soma ?? 0) + x.valor });
        return [...somas.values()].flatMap(({ x, soma }) => doze.map((mes) => ({ ...x, mes, valor: soma / fechadas.length })));
      };
      const decimal = (v: number) => new Prisma.Decimal(v.toFixed(4));
      await prisma.$transaction(
        async (tx) => {
          await tx.cenarioPremissa.deleteMany({ where: { cenarioId: id } });
          // As Médias de Referência (o mês 0) e os doze meses, que começam iguais a elas.
          const premissas = ref.premissas.flatMap((p) => [0, ...doze].map((mes) => ({ cenarioId: id, unidade: p.unidade, venda: p.venda, chave: p.chave, mes, valor: new Prisma.Decimal(p.valor.toFixed(6)) })));
          const mensais = mediar(ref.mensais, (x) => `${x.venda}|${x.chave}`).map((x) => ({ cenarioId: id, unidade: x.unidade, venda: x.venda, chave: x.chave, mes: x.mes, valor: decimal(x.valor) }));
          await gravarEmLotes([...premissas, ...mensais], (lote) => tx.cenarioPremissa.createMany({ data: lote }));
          await tx.cenarioCentro.deleteMany({ where: { cenarioId: id } });
          const centros = mediar(ref.centros, (x) => `${x.grupo}|${x.codigo}`).flatMap((x) => {
            const linhaDREId = idDaConta.get(x.codigo);
            return linhaDREId && Math.abs(x.valor) >= 0.00005 ? [{ cenarioId: id, grupo: x.grupo, linhaDREId, mes: x.mes, valor: decimal(x.valor) }] : [];
          });
          await gravarEmLotes(centros, (lote) => tx.cenarioCentro.createMany({ data: lote }));
          // O quadro de lotação dos grupos (14/10/2026): o realizado só tem os quadros (os indicadores), que se dividem
          // entre os grupos de cada um pela mão de obra deles no mês.
          const quadrosRealizados = new Map(realizados.indicadores.filter((i) => QUADROS_DE_LOTACAO.has(i.nome)).map((i) => [i.nome, i.meses]));
          const doQuadro = (nome: string, mes: number) => {
            const vs = quadrosRealizados.get(nome) ?? [];
            if (!media) return vs[mes - 1] ?? null;
            const doPeriodo = fechadas.map((f) => vs[f.mes - 1]).filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v));
            return doPeriodo.length ? doPeriodo.reduce((s, v) => s + v, 0) / doPeriodo.length : null;
          };
          const lotacao: Array<{ cenarioId: string; unidade: number; venda: string; chave: string; mes: number; valor: Prisma.Decimal }> = [];
          const semGrupo = new Set<string>();
          for (const mes of media ? doze : fechadas.map((f) => f.mes)) {
            const pesos = new Map<string, number>();
            for (const x of centros) if (x.mes === mes) {
              const codigo = [...idDaConta].find(([, i]) => i === x.linhaDREId)?.[0] ?? "";
              if (/\.MO[DI]\./.test(codigo)) pesos.set(x.grupo, (pesos.get(x.grupo) ?? 0) + Number(x.valor));
            }
            const r = distribuirLotacao(grupos, (nome) => doQuadro(nome, mes), pesos);
            r.semGrupo.forEach((n) => semGrupo.add(n));
            for (const [chave, v] of r.lotacao) lotacao.push({ cenarioId: id, unidade: 0, venda: VENDA_LOTACAO, chave, mes, valor: new Prisma.Decimal(v) });
          }
          if (semGrupo.size) ref.avisos.push(`Quadro de lotação sem grupo de centros de custo para recebê-lo: ${[...semGrupo].join(", ")}.`);
          await gravarEmLotes(lotacao, (lote) => tx.cenarioPremissa.createMany({ data: lote }));
          await tx.cenarioIndicador.deleteMany({ where: { cenarioId: id } });
          const semQuadros = indicadores.filter((v) => !QUADROS_DE_LOTACAO.has(v.nome));
          await gravarEmLotes(semQuadros, (lote) => tx.cenarioIndicador.createMany({ data: lote.map((v) => ({ cenarioId: id, ...v, origem: "IMPORTADO" as const })) }));
          await calcularAnalitico(tx, id);
          await tx.cenario.update({ where: { id }, data: { nomeArquivo, importadoEm: new Date() } });
        },
        { timeout: 300_000 },
      );
      await auditar({
        usuarioId: usuario.id,
        usuarioNome: usuario.nome,
        acao: "IMPORTACAO",
        entidade: "cenario",
        entidadeId: id,
        metadados: { cenario: c.nome, referencia: media ? "media do realizado" : "realizado", ano, meses, premissas: ref.premissas.length, centros: ref.centros.length, avisos: ref.avisos },
      });
      await prisma.cenarioReajuste.create({ data: { cenarioId: id, usuarioId: usuario.id || null, usuarioNome: usuario.nome, tipo: "REFERENCIA", descricao: nomeArquivo } });
      return { ...(await this.obter(id, usuario)), avisos: ref.avisos };
    }
    await prisma.$transaction(
      async (tx) => {
        await tx.cenarioResultado.deleteMany({ where: { cenarioId: id } });
        await gravarEmLotes(dre, (lote) => tx.cenarioResultado.createMany({ data: lote.map((r) => ({ cenarioId: id, ...r })) }));
        await recalcular(tx, id, media ? doze : fechadas.map((f) => f.mes), UNIDADES);
        await tx.cenarioIndicador.deleteMany({ where: { cenarioId: id } });
        await gravarEmLotes(indicadores, (lote) => tx.cenarioIndicador.createMany({ data: lote.map((v) => ({ cenarioId: id, ...v, origem: "IMPORTADO" as const })) }));
        await tx.cenario.update({ where: { id }, data: { nomeArquivo, importadoEm: new Date() } });
      },
      { timeout: 120_000 },
    );
    await auditar({ usuarioId: usuario.id, usuarioNome: usuario.nome, acao: "IMPORTACAO", entidade: "cenario", entidadeId: id, metadados: { cenario: c.nome, referencia: media ? "media do realizado" : "realizado", ano, meses, indicadores: indicadores.length } });
    await prisma.cenarioReajuste.create({ data: { cenarioId: id, usuarioId: usuario.id || null, usuarioNome: usuario.nome, tipo: "REFERENCIA", descricao: nomeArquivo } });
    return { ...(await this.obter(id, usuario)), avisos: [] as string[] };
  },

  /**
   * A referência de um cenário analítico por outro analítico (14/10/2026; os analíticos só importam de analíticos): as
   * premissas, os centros de custo, os investimentos e os indicadores da origem substituem os do cenário, e a DRE se
   * recalcula. As justificativas e o comparativo ficam.
   */
  async referenciaCenario(id: string, origemId: string, usuario: Usuario) {
    const c = await obterOuFalhar(id, usuario);
    exigirAnalitico(c);
    exigirEditavel(c);
    if (origemId === id) throw new CenarioError(400, "Escolha outro cenário: a referência não pode ser o próprio cenário.");
    const origem = await obterOuFalhar(origemId, usuario);
    if (origem.tipo !== "ANALITICO") throw new CenarioError(400, `Os cenários analíticos só importam de cenários analíticos: ${origem.nome} é sintético.`);
    const prisma = getPrismaClient();
    const nomeArquivo = `Cenário ${origem.nome} ${rotuloVersao(origem.versao)}${origem.ano !== c.ano ? ` (${origem.ano})` : ""}`;
    await prisma.$transaction(
      async (tx) => {
        await tx.cenarioPremissa.deleteMany({ where: { cenarioId: id } });
        await tx.cenarioCentro.deleteMany({ where: { cenarioId: id } });
        await tx.cenarioInvestimento.deleteMany({ where: { cenarioId: id } });
        await tx.cenarioIndicador.deleteMany({ where: { cenarioId: id } });
        const premissas = await tx.cenarioPremissa.findMany({ where: { cenarioId: origem.id } });
        await gravarEmLotes(premissas, (lote) => tx.cenarioPremissa.createMany({ data: lote.map((p) => ({ ...p, cenarioId: id })) }));
        const centros = await tx.cenarioCentro.findMany({ where: { cenarioId: origem.id } });
        await gravarEmLotes(centros, (lote) => tx.cenarioCentro.createMany({ data: lote.map((x) => ({ ...x, cenarioId: id })) }));
        const investimentos = await tx.cenarioInvestimento.findMany({ where: { cenarioId: origem.id } });
        await gravarEmLotes(investimentos, (lote) => tx.cenarioInvestimento.createMany({ data: lote.map(({ id: _id, criadoEm: _c, atualizadoEm: _a, ...x }) => ({ ...x, cenarioId: id })) }));
        const indicadores = await tx.cenarioIndicador.findMany({ where: { cenarioId: origem.id } });
        await gravarEmLotes(indicadores, (lote) => tx.cenarioIndicador.createMany({ data: lote.map((r) => ({ ...r, cenarioId: id })) }));
        await calcularAnalitico(tx, id);
        await tx.cenario.update({ where: { id }, data: { nomeArquivo, importadoEm: new Date() } });
      },
      { timeout: 300_000 },
    );
    await auditar({ usuarioId: usuario.id, usuarioNome: usuario.nome, acao: "IMPORTACAO", entidade: "cenario", entidadeId: id, metadados: { cenario: c.nome, referencia: "cenario", origem: nomeArquivo } });
    await prisma.cenarioReajuste.create({ data: { cenarioId: id, usuarioId: usuario.id || null, usuarioNome: usuario.nome, tipo: "REFERENCIA", descricao: nomeArquivo } });
    return this.obter(id, usuario);
  },

  /** A correspondência tarefa × linha (14/10/2026), da referência realizada dos analíticos, com as linhas possíveis. */
  async correspondencias() {
    const prisma = getPrismaClient();
    const [itens, linhas] = await Promise.all([
      prisma.correspondenciaTarefa.findMany({ include: { linha: { select: { codigo: true, nome: true } } }, orderBy: [{ tarefa: "asc" }, { filial: "asc" }] }),
      linhasDoCadastro(true),
    ]);
    return {
      itens: itens.map((i) => ({ filial: i.filial, tarefa: i.tarefa, linha: i.linha.codigo })),
      linhas: linhas.map((l) => ({ codigo: l.codigo, nome: l.nome, unidade: l.unidade, nomeUnidade: NOME_DA_UNIDADE[l.unidade] })),
    };
  },

  /** Grava a correspondência inteira (14/10/2026): a lista substitui a anterior. */
  async gravarCorrespondencias(itens: Array<{ filial: number | null; tarefa: string; linha: string }>, usuario: Usuario) {
    const prisma = getPrismaClient();
    const linhas = await prisma.linha.findMany({ where: { tipo: { in: ["PRODUTO", "OBRA"] }, ativo: true }, select: { id: true, codigo: true } });
    const idDa = new Map(linhas.map((l) => [l.codigo, l.id]));
    const vistos = new Set<string>();
    const novos = itens.map((i) => {
      const tarefa = i.tarefa.trim().replace(/\s+/g, " ").toUpperCase();
      if (!tarefa) throw new CenarioError(400, "Há uma correspondência sem a tarefa.");
      const linhaId = idDa.get(i.linha);
      if (!linhaId) throw new CenarioError(400, `A linha ${i.linha} não existe no cadastro Linhas.`);
      const k = `${i.filial ?? ""}|${tarefa}`;
      if (vistos.has(k)) throw new CenarioError(400, `A tarefa ${tarefa} aparece duas vezes ${i.filial ? `na filial ${i.filial}` : "em Qualquer Filial"}.`);
      vistos.add(k);
      return { filial: i.filial, tarefa, linhaId };
    });
    const antes = await prisma.correspondenciaTarefa.count();
    await prisma.$transaction(async (tx) => {
      await tx.correspondenciaTarefa.deleteMany({});
      for (const n of novos) await tx.correspondenciaTarefa.create({ data: n });
    });
    await auditar({ usuarioId: usuario.id, usuarioNome: usuario.nome, acao: "ALTERACAO", entidade: "correspondencia_tarefa", entidadeId: "todas", antes: { itens: antes }, depois: { itens: novos.length } });
    return this.correspondencias();
  },

  /**
   * O histórico de reajustes do cenário (12/10/2026), do mais recente ao mais antigo. Cada conta vem com o
   * departamento e a atribuição da linha dela na Estrutura da DRE atual (13/10/2026: o modal das contas).
   */
  async reajustes(id: string, usuario: Usuario = SISTEMA) {
    await obterOuFalhar(id, usuario);
    const [rs, est] = await Promise.all([getPrismaClient().cenarioReajuste.findMany({ where: { cenarioId: id }, orderBy: { criadoEm: "desc" } }), estruturaDRE()]);
    const porCodigo = new Map(est.map((l) => [l.codigo, l]));
    return rs.map((r) => ({
      ...r,
      reajuste: r.reajuste === null ? null : Number(r.reajuste),
      somaAntes: r.somaAntes === null ? null : Number(r.somaAntes),
      somaDepois: r.somaDepois === null ? null : Number(r.somaDepois),
      contas: ((r.contas ?? []) as Array<{ codigo: string; descricao: string }>).map((c) => ({
        ...c,
        departamento: porCodigo.get(c.codigo)?.grupo ?? null,
        atribuicao: porCodigo.get(c.codigo)?.atribuicao ?? null,
      })),
      meses: (r.meses ?? []) as number[],
    }));
  },

  /**
   * Congelar Versão (13/10/2026; antes, Salvar Versão): trava o cenário, como o fechamento de uma competência — a DRE,
   * os indicadores manuais e a referência não se editam mais. Para mudar, reabre-se a versão ou cria-se uma revisão.
   * (As colunas seguem com o nome antigo: versao_salva_em e versao_salva_por são o congelamento.)
   */
  async congelarVersao(id: string, usuario: Usuario) {
    const c = await obterOuFalhar(id, usuario);
    if (c.versaoSalvaEm) throw new CenarioError(409, `A ${rotuloVersao(c.versao)} do cenário ${c.nome} já está congelada.`);
    const depois = await getPrismaClient().cenario.update({ where: { id }, data: { versaoSalvaEm: new Date(), versaoSalvaPor: usuario.nome } });
    await auditar({
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      acao: "ALTERACAO",
      entidade: "cenario",
      entidadeId: id,
      antes: { versaoSalvaEm: null },
      depois: { versaoSalvaEm: depois.versaoSalvaEm },
      metadados: { congelarVersao: rotuloVersao(c.versao) },
    });
    return this.obter(id, usuario);
  },

  /**
   * Reabrir Versão (13/10/2026): destrava a versão congelada, como a reabertura de uma competência — a DRE, os
   * indicadores manuais e a referência voltam a se editar (no cenário marcado, a marcação continua travando). As
   * revisões criadas dela não mudam. Fica no log de auditoria.
   */
  async reabrirVersao(id: string, usuario: Usuario) {
    const c = await obterOuFalhar(id, usuario);
    if (!c.versaoSalvaEm) throw new CenarioError(409, `A ${rotuloVersao(c.versao)} do cenário ${c.nome} não está congelada.`);
    await getPrismaClient().cenario.update({ where: { id }, data: { versaoSalvaEm: null, versaoSalvaPor: null } });
    await auditar({
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      acao: "ALTERACAO",
      entidade: "cenario",
      entidadeId: id,
      antes: { versaoSalvaEm: c.versaoSalvaEm, versaoSalvaPor: c.versaoSalvaPor },
      depois: { versaoSalvaEm: null },
      metadados: { reabrirVersao: rotuloVersao(c.versao) },
    });
    return this.obter(id, usuario);
  },

  /**
   * Criar Revisão (13/10/2026): a cópia de uma versão congelada numa versão nova da mesma família (a maior + 1: VER01,
   * VER02…), aberta para edição — um cenário novo, com a DRE, os indicadores, o comparativo e as justificativas da
   * versão de origem. A marcação não passa: remarca-se à mão.
   */
  async criarRevisao(id: string, usuario: Usuario) {
    const prisma = getPrismaClient();
    const origem = await obterOuFalhar(id, usuario);
    if (!origem.versaoSalvaEm) throw new CenarioError(409, `Congele a ${rotuloVersao(origem.versao)} (Congelar Versão) antes de criar uma revisão.`);
    const familia = origem.familiaId ?? origem.id;
    const ultima = await prisma.cenario.aggregate({ where: { OR: [{ id: familia }, { familiaId: familia }] }, _max: { versao: true } });
    const versao = (ultima._max.versao ?? origem.versao) + 1;
    const revisao = await prisma.$transaction(
      async (tx) => {
        const c = await tx.cenario.create({
          data: {
            nome: origem.nome,
            ano: origem.ano,
            tipo: origem.tipo,
            descricao: origem.descricao,
            visualizacao: origem.visualizacao,
            criadoPor: usuario.nome,
            criadoPorId: usuario.id || null,
            nomeArquivo: origem.nomeArquivo,
            importadoEm: origem.importadoEm,
            comparadoComId: origem.comparadoComId,
            variacoesMaximas: origem.variacoesMaximas ?? undefined,
            versao,
            familiaId: familia,
            revisaoDeId: origem.id,
          },
        });
        const resultados = await tx.cenarioResultado.findMany({ where: { cenarioId: origem.id } });
        await gravarEmLotes(resultados, (lote) => tx.cenarioResultado.createMany({ data: lote.map((r) => ({ ...r, cenarioId: c.id })) }));
        const indicadores = await tx.cenarioIndicador.findMany({ where: { cenarioId: origem.id } });
        await gravarEmLotes(indicadores, (lote) => tx.cenarioIndicador.createMany({ data: lote.map((r) => ({ ...r, cenarioId: c.id })) }));
        const justificativas = await tx.cenarioJustificativa.findMany({ where: { cenarioId: origem.id } });
        await gravarEmLotes(justificativas, (lote) => tx.cenarioJustificativa.createMany({ data: lote.map((j) => ({ ...j, cenarioId: c.id })) }));
        const premissas = await tx.cenarioPremissa.findMany({ where: { cenarioId: origem.id } });
        await gravarEmLotes(premissas, (lote) => tx.cenarioPremissa.createMany({ data: lote.map((p) => ({ ...p, cenarioId: c.id })) }));
        const centros = await tx.cenarioCentro.findMany({ where: { cenarioId: origem.id } });
        await gravarEmLotes(centros, (lote) => tx.cenarioCentro.createMany({ data: lote.map((x) => ({ ...x, cenarioId: c.id })) }));
        const investimentos = await tx.cenarioInvestimento.findMany({ where: { cenarioId: origem.id } });
        await gravarEmLotes(investimentos, (lote) => tx.cenarioInvestimento.createMany({ data: lote.map(({ id: _id, ...x }) => ({ ...x, cenarioId: c.id })) }));
        return c;
      },
      { timeout: 120_000 },
    );
    await auditar({
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      acao: "CRIACAO",
      entidade: "cenario",
      entidadeId: revisao.id,
      depois: revisao,
      metadados: { revisaoDe: `${origem.nome} ${rotuloVersao(origem.versao)}`, versao: rotuloVersao(versao) },
    });
    return this.obter(revisao.id, usuario);
  },

  /**
   * As premissas de uma unidade de um cenário analítico (13/10/2026): as tabelas (Global e Mercantil; em Serviços, só
   * Global) com as linhas, a Média de Referência e os doze meses — as premissas (as gravadas, ou o padrão) e os
   * cálculos —, e se o cenário se edita (não marcado nem congelado).
   */
  async premissas(id: string, unidade: UnidadePremissa, usuario: Usuario = SISTEMA) {
    const c = await obterOuFalhar(id, usuario);
    exigirAnalitico(c);
    const [est, linhas, gravadas] = await Promise.all([estruturaDRE(), linhasDoCadastro(), getPrismaClient().cenarioPremissa.findMany({ where: { cenarioId: id, unidade } })]);
    const estrutura = linhasDaTabela(est, linhas, unidade);
    return {
      ano: c.ano,
      unidade,
      nome: NOME_DA_UNIDADE[unidade],
      meses: Array.from({ length: 12 }, (_, k) => ({ mes: k + 1, rotulo: rotuloMes(c.ano, k + 1) })),
      editavel: !c.marcacao && !c.versaoSalvaEm,
      tabelas: VENDAS_DA_UNIDADE[unidade].map((venda) => {
        const daVenda = new Map(gravadas.filter((p) => p.venda === venda).map((p) => [`${p.chave}|${p.mes}`, Number(p.valor)]));
        const { valores, referencia } = calcularTabela(est, linhas, unidade, c.ano, (chave, mes) => daVenda.get(`${chave}|${mes}`));
        return {
          venda,
          titulo: NOME_DA_VENDA[venda],
          linhas: estrutura.map((l) => ({
            ...l,
            referencia: referencia.get(l.chave) ?? null,
            valores: valores.get(l.chave) ?? Array(12).fill(null),
            // Os meses com a premissa gravada (os demais valem o padrão: os dias úteis do calendário, ou zero).
            gravados: Array.from({ length: 12 }, (_, k) => daVenda.has(`${l.chave}|${k + 1}`)),
          })),
        };
      }),
    };
  },

  /**
   * Grava premissas de uma unidade (13/10/2026): o valor de cada (venda, chave, mês) — nulo volta ao padrão — e
   * recalcula a DRE do cenário. Só as premissas da tabela se gravam (os cálculos não), nos meses 1 a 12 (a Média de
   * Referência vem da referência). Vai para o histórico de reajustes, como a edição da DRE dos sintéticos.
   */
  async gravarPremissas(
    id: string,
    unidade: UnidadePremissa,
    alteracoes: Array<{ venda: Venda; chave: string; mes: number; valor: number | null }>,
    usuario: Usuario,
    origem?: OrigemDaGravacao,
  ) {
    const c = await obterOuFalhar(id, usuario);
    exigirAnalitico(c);
    exigirEditavel(c);
    const prisma = getPrismaClient();
    const [est, linhas] = await Promise.all([estruturaDRE(), linhasDoCadastro()]);
    const daTabela = new Map(linhasDaTabela(est, linhas, unidade).filter((l) => l.tipo === "PREMISSA").map((l) => [l.chave, l]));
    const vendas = VENDAS_DA_UNIDADE[unidade];
    const fora = alteracoes.filter((a) => !daTabela.has(a.chave) || !vendas.includes(a.venda));
    if (fora.length) throw new CenarioError(400, `Não são premissas de ${NOME_DA_UNIDADE[unidade]}: ${[...new Set(fora.map((a) => a.chave))].slice(0, 3).join(", ")}.`);
    // A última alteração de cada premissa e mês vale.
    const finais = new Map(alteracoes.map((a) => [`${a.venda}|${a.chave}|${a.mes}`, a]));
    const anteriores = await prisma.cenarioPremissa.findMany({ where: { cenarioId: id, unidade, mes: { in: [...new Set([...finais.values()].map((a) => a.mes))] } } });
    const antes = new Map(anteriores.map((p) => [`${p.venda}|${p.chave}|${p.mes}`, Number(p.valor)]));
    let somaAntes = 0;
    let somaDepois = 0;
    for (const [k, a] of finais) {
      somaAntes += antes.get(k) ?? 0;
      somaDepois += a.valor ?? 0;
    }
    await prisma.$transaction(
      async (tx) => {
        for (const a of finais.values()) {
          const chave = { cenarioId: id, unidade, venda: a.venda, chave: a.chave, mes: a.mes };
          if (a.valor === null) await tx.cenarioPremissa.deleteMany({ where: chave });
          else {
            const valor = new Prisma.Decimal(a.valor.toFixed(4));
            await tx.cenarioPremissa.upsert({ where: { cenarioId_unidade_venda_chave_mes: chave }, create: { ...chave, valor }, update: { valor } });
          }
        }
        await calcularAnalitico(tx, id);
      },
      { timeout: 120_000 },
    );
    const meses = [...new Set([...finais.values()].map((a) => a.mes))].sort((x, y) => x - y);
    const contas = [...new Map([...finais.values()].map((a) => {
      const l = daTabela.get(a.chave)!;
      return [`${a.venda}|${a.chave}`, { codigo: a.chave, descricao: [NOME_DA_VENDA[a.venda], l.grupo, l.rotulo].filter(Boolean).join(" · ") }];
    })).values()];
    await prisma.cenarioReajuste.create({
      data: {
        cenarioId: id,
        usuarioId: usuario.id || null,
        usuarioNome: usuario.nome,
        tipo: origem?.tipo ?? "VALOR",
        modo: origem?.modo ?? "DIGITADO",
        reajuste: origem?.reajuste ?? null,
        visao: unidade,
        replicado: !!origem?.replicado,
        contas,
        meses,
        valores: finais.size,
        somaAntes,
        somaDepois,
        descricao: `Premissas · ${NOME_DA_UNIDADE[unidade]}`,
      },
    });
    await auditar({
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      acao: "ALTERACAO",
      entidade: "cenario",
      entidadeId: id,
      metadados: { cenario: c.nome, premissas: NOME_DA_UNIDADE[unidade], valores: finais.size, meses, chaves: contas.map((x) => x.codigo).slice(0, 50), origem: origem ?? null },
    });
    return { alteradas: finais.size, meses };
  },

  /**
   * Os centros de custo de um cenário analítico (13/10/2026): os grupos da Controladoria (sem os de estoque e de
   * investimento), com o balde, o destino do valor e o total do exercício de cada um.
   */
  async centros(id: string, usuario: Usuario = SISTEMA) {
    const c = await obterOuFalhar(id, usuario);
    exigirAnalitico(c);
    const [grupos, totais] = await Promise.all([gruposDoCadastro(), getPrismaClient().cenarioCentro.groupBy({ by: ["grupo"], where: { cenarioId: id }, _sum: { valor: true } })]);
    const total = new Map(totais.map((t) => [t.grupo, Number(t._sum.valor ?? 0)]));
    return {
      ano: c.ano,
      meses: Array.from({ length: 12 }, (_, k) => ({ mes: k + 1, rotulo: rotuloMes(c.ano, k + 1) })),
      editavel: !c.marcacao && !c.versaoSalvaEm,
      grupos: grupos.map((g) => ({ ...g, total: total.get(g.grupo) ?? 0 })),
    };
  },

  /** As contas de um grupo de centros no cenário, com os doze meses (13/10/2026). */
  async centro(id: string, grupo: string, usuario: Usuario = SISTEMA) {
    const c = await obterOuFalhar(id, usuario);
    exigirAnalitico(c);
    const g = (await gruposDoCadastro()).find((x) => x.grupo === grupo);
    if (!g) throw new CenarioError(404, "Grupo de centros de custo não encontrado.");
    const [est, gravados, lotacao] = await Promise.all([
      estruturaDRE(),
      getPrismaClient().cenarioCentro.findMany({ where: { cenarioId: id, grupo } }),
      getPrismaClient().cenarioPremissa.findMany({ where: { cenarioId: id, venda: VENDA_LOTACAO, chave: grupo } }),
    ]);
    const porLinha = new Map(gravados.map((x) => [`${x.linhaDREId}|${x.mes}`, Number(x.valor)]));
    const porMes = new Map(lotacao.map((x) => [x.mes, Number(x.valor)]));
    const totais = est.filter((l) => l.tipo !== "ITEM");
    return {
      grupo: g,
      // O quadro de lotação do grupo (14/10/2026): os colaboradores de cada mês e os quadros em que ele entra.
      lotacao: {
        valores: Array.from({ length: 12 }, (_, k) => porMes.get(k + 1) ?? 0),
        gravados: Array.from({ length: 12 }, (_, k) => porMes.has(k + 1)),
        quadro: quadroDoGrupo(g).descricao,
      },
      contas: contasDoGrupo(est, g).map((l) => ({
        codigo: l.codigo,
        descricao: l.descricao,
        // A atribuição (Mão de Obra Direta…), pelo total dela (CPP.MOD…).
        atribuicao: totais.find((t) => t.codigo.startsWith(`${l.codigo.split(".").slice(0, 2).join(".")}.`))?.descricao ?? l.atribuicao ?? "",
        valores: Array.from({ length: 12 }, (_, k) => porLinha.get(`${l.id}|${k + 1}`) ?? 0),
        gravados: Array.from({ length: 12 }, (_, k) => porLinha.has(`${l.id}|${k + 1}`)),
      })),
    };
  },

  /**
   * Grava valores de um grupo de centros (13/10/2026): o valor de cada (conta, mês) — nulo ou zero apaga — e recalcula a
   * DRE do cenário. Só as contas do grupo se gravam. Vai para o histórico ("Centros de Custo · grupo").
   */
  async gravarCentro(id: string, grupo: string, alteracoes: Array<{ linha: string; mes: number; valor: number | null }>, usuario: Usuario, origem?: OrigemDaGravacao) {
    const c = await obterOuFalhar(id, usuario);
    exigirAnalitico(c);
    exigirEditavel(c);
    const prisma = getPrismaClient();
    const g = (await gruposDoCadastro()).find((x) => x.grupo === grupo);
    if (!g) throw new CenarioError(404, "Grupo de centros de custo não encontrado.");
    const est = await estruturaDRE();
    const contas = new Map(contasDoGrupo(est, g).map((l) => [l.codigo, l]));
    const fora = [...new Set(alteracoes.filter((a) => !contas.has(a.linha)).map((a) => a.linha))];
    if (fora.length) throw new CenarioError(400, `Não são contas do grupo ${grupo}: ${fora.slice(0, 3).join(", ")}.`);
    const finais = new Map(alteracoes.map((a) => [`${a.linha}|${a.mes}`, a]));
    const anteriores = await prisma.cenarioCentro.findMany({ where: { cenarioId: id, grupo } });
    const antes = new Map(anteriores.map((x) => [`${x.linhaDREId}|${x.mes}`, Number(x.valor)]));
    let somaAntes = 0;
    let somaDepois = 0;
    for (const a of finais.values()) {
      somaAntes += antes.get(`${contas.get(a.linha)!.id}|${a.mes}`) ?? 0;
      somaDepois += a.valor ?? 0;
    }
    await prisma.$transaction(
      async (tx) => {
        for (const a of finais.values()) {
          const chave = { cenarioId: id, grupo, linhaDREId: contas.get(a.linha)!.id, mes: a.mes };
          if (!a.valor) await tx.cenarioCentro.deleteMany({ where: chave });
          else {
            const valor = new Prisma.Decimal(a.valor.toFixed(4));
            await tx.cenarioCentro.upsert({ where: { cenarioId_grupo_linhaDREId_mes: chave }, create: { ...chave, valor }, update: { valor } });
          }
        }
        await calcularAnalitico(tx, id);
      },
      { timeout: 120_000 },
    );
    const meses = [...new Set([...finais.values()].map((a) => a.mes))].sort((x, y) => x - y);
    const alteradas = [...new Set([...finais.values()].map((a) => a.linha))].map((codigo) => ({ codigo, descricao: `${grupo} · ${contas.get(codigo)!.descricao}` }));
    await prisma.cenarioReajuste.create({
      data: {
        cenarioId: id,
        usuarioId: usuario.id || null,
        usuarioNome: usuario.nome,
        tipo: origem?.tipo ?? "VALOR",
        modo: origem?.modo ?? "DIGITADO",
        reajuste: origem?.reajuste ?? null,
        replicado: !!origem?.replicado,
        contas: alteradas,
        meses,
        valores: finais.size,
        somaAntes,
        somaDepois,
        descricao: `Centros de Custo · ${grupo}`,
      },
    });
    await auditar({
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      acao: "ALTERACAO",
      entidade: "cenario",
      entidadeId: id,
      metadados: { cenario: c.nome, grupo, valores: finais.size, meses, contas: alteradas.map((x) => x.codigo), origem: origem ?? null },
    });
    return { alteradas: finais.size, meses };
  },

  /**
   * Grava o quadro de lotação de um grupo de centros (14/10/2026): os colaboradores de cada mês (nulo ou zero apaga). Os
   * quadros de lotação dos indicadores saem deles; a DRE não muda. Vai para o histórico ("Centros de Custo · grupo ·
   * Quadro de Lotação").
   */
  async gravarLotacao(id: string, grupo: string, alteracoes: Array<{ mes: number; valor: number | null }>, usuario: Usuario, origem?: OrigemDaGravacao) {
    const c = await obterOuFalhar(id, usuario);
    exigirAnalitico(c);
    exigirEditavel(c);
    const prisma = getPrismaClient();
    if (!(await gruposDoCadastro()).some((x) => x.grupo === grupo)) throw new CenarioError(404, "Grupo de centros de custo não encontrado.");
    if (alteracoes.some((a) => a.valor !== null && a.valor < 0)) throw new CenarioError(400, "O quadro de lotação não pode ser negativo.");
    const finais = new Map(alteracoes.map((a) => [a.mes, a]));
    const anteriores = await prisma.cenarioPremissa.findMany({ where: { cenarioId: id, venda: VENDA_LOTACAO, chave: grupo } });
    const antes = new Map(anteriores.map((x) => [x.mes, Number(x.valor)]));
    let somaAntes = 0;
    let somaDepois = 0;
    for (const a of finais.values()) {
      somaAntes += antes.get(a.mes) ?? 0;
      somaDepois += a.valor ?? 0;
    }
    await prisma.$transaction(async (tx) => {
      for (const a of finais.values()) {
        const chave = { cenarioId: id, unidade: 0, venda: VENDA_LOTACAO, chave: grupo, mes: a.mes };
        if (!a.valor) await tx.cenarioPremissa.deleteMany({ where: chave });
        else {
          const valor = new Prisma.Decimal(a.valor.toFixed(4));
          await tx.cenarioPremissa.upsert({ where: { cenarioId_unidade_venda_chave_mes: chave }, create: { ...chave, valor }, update: { valor } });
        }
      }
    });
    const meses = [...finais.keys()].sort((x, y) => x - y);
    await prisma.cenarioReajuste.create({
      data: {
        cenarioId: id,
        usuarioId: usuario.id || null,
        usuarioNome: usuario.nome,
        tipo: origem?.tipo ?? "VALOR",
        modo: origem?.modo ?? "DIGITADO",
        reajuste: origem?.reajuste ?? null,
        replicado: !!origem?.replicado,
        contas: [{ codigo: "LOTACAO", descricao: `${grupo} · Quadro de Lotação` }],
        meses,
        valores: finais.size,
        somaAntes,
        somaDepois,
        descricao: `Centros de Custo · ${grupo} · Quadro de Lotação`,
      },
    });
    await auditar({ usuarioId: usuario.id, usuarioNome: usuario.nome, acao: "ALTERACAO", entidade: "cenario", entidadeId: id, metadados: { cenario: c.nome, grupo, lotacao: finais.size, meses, origem: origem ?? null } });
    return { alteradas: finais.size, meses };
  },

  /**
   * A aba Investimentos de um cenário analítico (13/10/2026): por unidade, a Depreciação Base (digitada), a dos
   * investimentos e a total, mês a mês; e a lista dos investimentos, com a depreciação mensal e o ROI.
   */
  async investimentos(id: string, usuario: Usuario = SISTEMA) {
    const c = await obterOuFalhar(id, usuario);
    exigirAnalitico(c);
    const prisma = getPrismaClient();
    const [base, lista] = await Promise.all([
      prisma.cenarioPremissa.findMany({ where: { cenarioId: id, venda: VENDA_BASE } }),
      prisma.cenarioInvestimento.findMany({ where: { cenarioId: id }, orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }] }),
    ]);
    const investimentos = lista.map((i) => ({
      ...i,
      valorTotal: Number(i.valorTotal),
      valorPosUso: Number(i.valorPosUso),
      receitaBrutaPrevista: i.receitaBrutaPrevista === null ? null : Number(i.receitaBrutaPrevista),
    }));
    const linhas = CONTAS_DEPRECIACAO.flatMap((d) => {
      const chave = `${d.unidade}|${d.conta}`;
      const gravado = new Map(base.filter((p) => p.chave === chave).map((p) => [p.mes, Number(p.valor)]));
      const valoresBase = Array.from({ length: 12 }, (_, k) => gravado.get(k + 1) ?? 0);
      const dosInvestimentos = Array<number>(12).fill(0);
      for (const i of investimentos.filter((x) => x.unidade === d.unidade && x.conta === d.conta)) depreciacaoNosMeses(i).forEach((v, k) => (dosInvestimentos[k] += v));
      const secao = d.nomeUnidade.toUpperCase();
      const linha = (k: string, rotulo: string, tipo: "PREMISSA" | "CALCULO", valores: number[], gravados: boolean[]) => ({ chave: k, secao, grupo: null, rotulo, und: "R$", tipo, casas: 2, referencia: null, valores, gravados });
      return [
        linha(chave, `Depreciação Base (${d.rotulo.replace(/^Depreciação d[oa] /, "")})`, "PREMISSA", valoresBase, valoresBase.map((_, k) => gravado.has(k + 1))),
        linha(`${chave}|INVESTIMENTOS`, "Depreciação dos Investimentos", "CALCULO", dosInvestimentos, dosInvestimentos.map(() => false)),
        linha(`${chave}|TOTAL`, "Depreciação Total", "CALCULO", valoresBase.map((v, k) => v + dosInvestimentos[k]), valoresBase.map(() => false)),
      ];
    });
    return {
      ano: c.ano,
      meses: Array.from({ length: 12 }, (_, k) => ({ mes: k + 1, rotulo: rotuloMes(c.ano, k + 1) })),
      editavel: !c.marcacao && !c.versaoSalvaEm,
      contas: CONTAS_DEPRECIACAO,
      depreciacao: linhas,
      investimentos: investimentos.map((i) => ({ ...i, depreciacaoMensal: depreciacaoMensal(i), roi: roi(i) })),
    };
  },

  /** A aba Extra-Operacional de um cenário analítico (13/10/2026): as contas de Despesas e Extra e do RN, mês a mês. */
  async extraOperacional(id: string, usuario: Usuario = SISTEMA) {
    const c = await obterOuFalhar(id, usuario);
    exigirAnalitico(c);
    const [est, gravadas] = await Promise.all([estruturaDRE(), getPrismaClient().cenarioPremissa.findMany({ where: { cenarioId: id, venda: VENDA_EXTRA } })]);
    const valor = new Map(gravadas.map((p) => [`${p.chave}|${p.mes}`, Number(p.valor)]));
    return {
      ano: c.ano,
      meses: Array.from({ length: 12 }, (_, k) => ({ mes: k + 1, rotulo: rotuloMes(c.ano, k + 1) })),
      editavel: !c.marcacao && !c.versaoSalvaEm,
      tabelas: UNIDADES_EXTRA.map((u) => ({
        unidade: u.unidade,
        nome: u.nome,
        linhas: contasExtra(est, u.unidade).map((l) => {
          const chave = `${u.unidade}|${l.codigo}`;
          const grupo = est.find((t) => t.tipo !== "ITEM" && t.grupoSigla === l.grupoSigla && t.codigo.split(".").length >= 2)?.descricao ?? l.grupoSigla;
          return {
            chave,
            secao: grupo.toUpperCase(),
            grupo: null,
            rotulo: l.descricao,
            und: "R$",
            tipo: "PREMISSA" as const,
            casas: 2,
            referencia: null,
            valores: Array.from({ length: 12 }, (_, k) => valor.get(`${chave}|${k + 1}`) ?? 0),
            gravados: Array.from({ length: 12 }, (_, k) => valor.has(`${chave}|${k + 1}`)),
          };
        }),
      })),
    };
  },

  /**
   * Grava valores mensais da Depreciação Base (`tipo` BASE) ou do Extra-Operacional (EXTRA) (13/10/2026): a chave de
   * cada linha é "unidade|conta"; nulo ou zero apaga. Recalcula a DRE do cenário; vai para o histórico.
   */
  async gravarMensais(id: string, tipo: "BASE" | "EXTRA", alteracoes: Array<{ linha: string; mes: number; valor: number | null }>, usuario: Usuario, origem?: OrigemDaGravacao) {
    const c = await obterOuFalhar(id, usuario);
    exigirAnalitico(c);
    exigirEditavel(c);
    const prisma = getPrismaClient();
    const est = await estruturaDRE();
    const descricao = new Map(est.map((l) => [l.codigo, l.descricao]));
    const validas = new Set(
      tipo === "BASE" ? CONTAS_DEPRECIACAO.map((d) => `${d.unidade}|${d.conta}`) : UNIDADES_EXTRA.flatMap((u) => contasExtra(est, u.unidade).map((l) => `${u.unidade}|${l.codigo}`)),
    );
    const fora = [...new Set(alteracoes.filter((a) => !validas.has(a.linha)).map((a) => a.linha))];
    if (fora.length) throw new CenarioError(400, `Contas inválidas: ${fora.slice(0, 3).join(", ")}.`);
    const venda = tipo === "BASE" ? VENDA_BASE : VENDA_EXTRA;
    const finais = new Map(alteracoes.map((a) => [`${a.linha}|${a.mes}`, a]));
    const anteriores = await prisma.cenarioPremissa.findMany({ where: { cenarioId: id, venda } });
    const antes = new Map(anteriores.map((p) => [`${p.chave}|${p.mes}`, Number(p.valor)]));
    let somaAntes = 0;
    let somaDepois = 0;
    for (const [k, a] of finais) {
      somaAntes += antes.get(k) ?? 0;
      somaDepois += a.valor ?? 0;
    }
    await prisma.$transaction(
      async (tx) => {
        for (const a of finais.values()) {
          const chave = { cenarioId: id, unidade: Number(a.linha.split("|")[0]), venda, chave: a.linha, mes: a.mes };
          if (!a.valor) await tx.cenarioPremissa.deleteMany({ where: chave });
          else {
            const valor = new Prisma.Decimal(a.valor.toFixed(4));
            await tx.cenarioPremissa.upsert({ where: { cenarioId_unidade_venda_chave_mes: chave }, create: { ...chave, valor }, update: { valor } });
          }
        }
        await calcularAnalitico(tx, id);
      },
      { timeout: 120_000 },
    );
    const meses = [...new Set([...finais.values()].map((a) => a.mes))].sort((x, y) => x - y);
    const nomeUnidade = (u: string) => ({ 1: "Matriz", 2: "Filial", 3: "Serviços", 4: "Despesas e Extra", 5: "RN" })[Number(u)] ?? u;
    const contas = [...new Set([...finais.values()].map((a) => a.linha))].map((k) => {
      const [u, conta] = k.split("|");
      return { codigo: conta, descricao: `${nomeUnidade(u)} · ${descricao.get(conta) ?? conta}` };
    });
    await prisma.cenarioReajuste.create({
      data: {
        cenarioId: id,
        usuarioId: usuario.id || null,
        usuarioNome: usuario.nome,
        tipo: origem?.tipo ?? "VALOR",
        modo: origem?.modo ?? "DIGITADO",
        reajuste: origem?.reajuste ?? null,
        replicado: !!origem?.replicado,
        contas,
        meses,
        valores: finais.size,
        somaAntes,
        somaDepois,
        descricao: tipo === "BASE" ? "Investimentos · Depreciação Base" : "Extra-Operacional",
      },
    });
    await auditar({ usuarioId: usuario.id, usuarioNome: usuario.nome, acao: "ALTERACAO", entidade: "cenario", entidadeId: id, metadados: { cenario: c.nome, tipo, valores: finais.size, meses } });
    return { alteradas: finais.size, meses };
  },

  /**
   * Cria, altera ou exclui um investimento (13/10/2026) e recalcula a DRE do cenário. A conta é a de depreciação da
   * unidade; o início, um mês do exercício; a vida útil, em meses (a partir de 1); o valor pós uso não passa do total.
   */
  async gravarInvestimento(
    id: string,
    investimentoId: string | null,
    dados: { unidade: number; descricao: string; ganhoPrevisto: string | null; receitaBrutaPrevista: number | null; inicio: number; valorTotal: number; valorPosUso: number; vidaUtil: number } | null,
    usuario: Usuario,
  ) {
    const c = await obterOuFalhar(id, usuario);
    exigirAnalitico(c);
    exigirEditavel(c);
    const prisma = getPrismaClient();
    const atual = investimentoId ? await prisma.cenarioInvestimento.findFirst({ where: { id: investimentoId, cenarioId: id } }) : null;
    if (investimentoId && !atual) throw new CenarioError(404, "Investimento não encontrado.");
    if (dados) {
      if (!contaDeDepreciacao(dados.unidade)) throw new CenarioError(400, "Unidade inválida.");
      if (dados.valorPosUso > dados.valorTotal) throw new CenarioError(400, "O valor pós uso não pode passar do valor total.");
    }
    await prisma.$transaction(
      async (tx) => {
        if (!dados) await tx.cenarioInvestimento.delete({ where: { id: investimentoId! } });
        else {
          const valores = {
            unidade: dados.unidade,
            conta: contaDeDepreciacao(dados.unidade)!.conta,
            descricao: dados.descricao,
            ganhoPrevisto: dados.ganhoPrevisto,
            receitaBrutaPrevista: dados.receitaBrutaPrevista === null ? null : new Prisma.Decimal(dados.receitaBrutaPrevista.toFixed(2)),
            inicio: dados.inicio,
            valorTotal: new Prisma.Decimal(dados.valorTotal.toFixed(2)),
            valorPosUso: new Prisma.Decimal(dados.valorPosUso.toFixed(2)),
            vidaUtil: dados.vidaUtil,
          };
          if (atual) await tx.cenarioInvestimento.update({ where: { id: atual.id }, data: valores });
          else await tx.cenarioInvestimento.create({ data: { ...valores, cenarioId: id, ordem: await tx.cenarioInvestimento.count({ where: { cenarioId: id } }) } });
        }
        await calcularAnalitico(tx, id);
      },
      { timeout: 120_000 },
    );
    await prisma.cenarioReajuste.create({
      data: {
        cenarioId: id,
        usuarioId: usuario.id || null,
        usuarioNome: usuario.nome,
        tipo: "VALOR",
        modo: "DIGITADO",
        contas: [{ codigo: contaDeDepreciacao(dados?.unidade ?? atual!.unidade)!.conta, descricao: dados?.descricao ?? atual!.descricao }],
        descricao: `Investimentos · ${!dados ? "Excluído" : atual ? "Alterado" : "Novo"}: ${dados?.descricao ?? atual!.descricao}`,
      },
    });
    await auditar({ usuarioId: usuario.id, usuarioNome: usuario.nome, acao: !dados ? "EXCLUSAO" : atual ? "ALTERACAO" : "CRIACAO", entidade: "cenario_investimento", entidadeId: investimentoId ?? id, antes: atual ?? undefined, depois: dados ?? undefined, metadados: { cenario: c.nome } });
    return this.investimentos(id, usuario);
  },

  /**
   * Os rateios de um cenário analítico (13/10/2026): por chave e destino, a base de cada mês nas premissas (o volume) e
   * o percentual (o destino sobre a chave; zero sem base no mês).
   */
  async rateios(id: string, usuario: Usuario = SISTEMA) {
    const c = await obterOuFalhar(id, usuario);
    exigirAnalitico(c);
    const prisma = getPrismaClient();
    const [est, linhas, gravadas, grupos, valores] = await Promise.all([
      estruturaDRE(),
      linhasDoCadastro(),
      prisma.cenarioPremissa.findMany({ where: { cenarioId: id } }),
      gruposDoCadastro(),
      prisma.cenarioCentro.findMany({ where: { cenarioId: id }, include: { linhaDRE: { select: { codigo: true } } } }),
    ]);
    const { bases } = calcularPremissas(est, linhas, c.ano, gravadas);
    const percentuais = percentuaisDasBases(bases);
    const nomes = new Map(RATEIOS.map((r) => [r.chave, r.rotulo.split(":")[0]]));
    return {
      ano: c.ano,
      meses: Array.from({ length: 12 }, (_, k) => ({ mes: k + 1, rotulo: rotuloMes(c.ano, k + 1) })),
      // Os valores dos grupos que ficam fora de todas as unidades: a chave sem base nas premissas no mês.
      semBase: rateiosSemBase(
        grupos,
        valores.map((x) => ({ grupo: x.grupo, codigo: x.linhaDRE.codigo, mes: x.mes, valor: Number(x.valor) })),
        percentuais,
      ).map((x) => ({ ...x, nome: nomes.get(x.chave) ?? x.chave, rotuloMes: rotuloMes(c.ano, x.mes) })),
      rateios: RATEIOS.map((r) => ({
        ...r,
        bases: bases.get(`${r.chave}|${r.destino}`) ?? Array<number>(12).fill(0),
        percentuais: percentuais.map((p) => p.get(`${r.chave}|${r.destino}`) ?? 0),
      })),
    };
  },

  /**
   * O comparativo do cenário (12/10/2026): o cenário comparado, os cenários que o usuário pode escolher e os totais da
   * DRE com a variação máxima (em %) de cada um (nula: o total não se verifica).
   */
  async comparativo(id: string, usuario: Usuario = SISTEMA) {
    const c = await obterOuFalhar(id, usuario);
    // Os dois tipos (13/10/2026): o analítico se compara também com um sintético (o Orçamento Empresarial, por exemplo).
    const outros = (await getPrismaClient().cenario.findMany({ where: { id: { not: id } }, orderBy: [{ ano: "desc" }, { criadoEm: "desc" }] })).filter((o) => alcanca(o, usuario));
    const limites = (c.variacoesMaximas ?? {}) as Record<string, number>;
    const { totais } = totaisDaDRE(await estruturaDRE());
    const comparado = c.comparadoComId ? await getPrismaClient().cenario.findUnique({ where: { id: c.comparadoComId }, select: { id: true, nome: true, ano: true } }) : null;
    // A versão vigente (13/10/2026): a maior da família (o filtro "Apenas Vigentes" do modal de escolha).
    const ultimas = new Map<string, number>();
    for (const v of await getPrismaClient().cenario.findMany({ select: { id: true, familiaId: true, versao: true } })) {
      const familia = v.familiaId ?? v.id;
      ultimas.set(familia, Math.max(ultimas.get(familia) ?? 0, v.versao));
    }
    return {
      comparadoCom: comparado,
      opcoes: outros.map((o) => ({ id: o.id, nome: o.nome, ano: o.ano, tipo: o.tipo as TipoCenario, marcacao: o.marcacao, versao: o.versao, vigente: o.versao === ultimas.get(o.familiaId ?? o.id) })),
      totais: totais.map((t) => ({ ...t, limite: typeof limites[t.codigo] === "number" ? limites[t.codigo] : null })),
    };
  },

  /**
   * Grava o comparativo: o cenário comparado (nulo desliga o comparativo; as variações máximas ficam guardadas) e as
   * variações máximas dos totais. Não mexe nos dados do cenário: vale também para o cenário marcado.
   */
  async gravarComparativo(id: string, dados: { comparadoComId: string | null; limites: Record<string, number | null> }, usuario: Usuario) {
    const antes = await obterOuFalhar(id, usuario);
    if (dados.comparadoComId === id) throw new CenarioError(400, "Escolha outro cenário para comparar.");
    if (dados.comparadoComId) await obterOuFalhar(dados.comparadoComId, usuario);
    const codigos = new Set(totaisDaDRE(await estruturaDRE()).totais.map((t) => t.codigo));
    const fora = Object.keys(dados.limites).filter((k) => !codigos.has(k));
    if (fora.length) throw new CenarioError(400, `Não são totais da DRE: ${fora.slice(0, 3).join(", ")}.`);
    const variacoesMaximas = Object.fromEntries(Object.entries(dados.limites).filter((e): e is [string, number] => e[1] !== null));
    const depois = await getPrismaClient().cenario.update({ where: { id }, data: { comparadoComId: dados.comparadoComId, variacoesMaximas } });
    await auditar({
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      acao: "ALTERACAO",
      entidade: "cenario",
      entidadeId: id,
      antes: { comparadoComId: antes.comparadoComId, variacoesMaximas: antes.variacoesMaximas },
      depois: { comparadoComId: depois.comparadoComId, variacoesMaximas: depois.variacoesMaximas },
      metadados: { comparativo: true },
    });
    return this.comparativo(id, usuario);
  },

  /**
   * As justificativas do comparativo: em cada visão da DRE, as contas (ou os totais sem contas) com algum mês acima da
   * variação máxima do total delas, os meses (o valor, o comparado e a variação) e a justificativa gravada.
   */
  async justificativas(id: string, usuario: Usuario = SISTEMA) {
    const prisma = getPrismaClient();
    const c = await obterOuFalhar(id, usuario);
    const comparado = c.comparadoComId ? await prisma.cenario.findUnique({ where: { id: c.comparadoComId }, select: { id: true, nome: true, ano: true } }) : null;
    if (!comparado) return { comparadoCom: null, visoes: [] };
    const limites = (c.variacoesMaximas ?? {}) as Record<string, number>;
    const est = await estruturaDRE();
    const { verificadas } = totaisDaDRE(est);
    const dasVisoes = linhasDasVisoes(est);
    const [valores, comparados, gravadas] = await Promise.all([
      prisma.cenarioResultado.findMany({ where: { cenarioId: id }, select: { visao: true, linhaDREId: true, mes: true, valor: true } }),
      prisma.cenarioResultado.findMany({ where: { cenarioId: comparado.id }, select: { visao: true, linhaDREId: true, mes: true, valor: true } }),
      prisma.cenarioJustificativa.findMany({ where: { cenarioId: id } }),
    ]);
    const mapa = (rs: typeof valores) => {
      const m = new Map<string, Map<number, number>>();
      for (const r of rs) {
        const k = `${r.visao}|${r.linhaDREId}`;
        if (!m.has(k)) m.set(k, new Map());
        m.get(k)!.set(r.mes, Number(r.valor));
      }
      return m;
    };
    const doCenario = mapa(valores);
    const doComparado = mapa(comparados);
    const vazio = new Map<number, number>();
    const justificativa = new Map(gravadas.map((j) => [`${j.visao}|${j.linhaDREId}`, j]));
    return {
      comparadoCom: comparado,
      visoes: ABAS_DRE.map(({ visao, nome }) => ({
        visao,
        nome,
        itens: verificadas.flatMap(({ linha, total }) => {
          const limite = limites[total.codigo];
          if (typeof limite !== "number" || !dasVisoes.get(visao)!.has(linha.codigo)) return [];
          const k = `${visao}|${linha.id}`;
          const meses = mesesAcima(doCenario.get(k) ?? vazio, doComparado.get(k) ?? vazio, limite);
          if (!meses.length) return [];
          const j = justificativa.get(k);
          return [
            {
              codigo: linha.codigo,
              descricao: linha.descricao,
              total: total.descricao,
              ehTotal: linha.codigo === total.codigo,
              limite,
              meses,
              justificativa: j ? { texto: j.texto, usuarioNome: j.usuarioNome, atualizadoEm: j.atualizadoEm } : null,
            },
          ];
        }),
      })),
    };
  },

  /** Grava a justificativa de uma linha numa visão; o texto vazio a apaga. Vale também para o cenário marcado. */
  async gravarJustificativa(id: string, dados: { visao: number; linha: string; texto: string }, usuario: Usuario) {
    const prisma = getPrismaClient();
    await obterOuFalhar(id, usuario);
    const linha = await prisma.linhaDRE.findUnique({ where: { codigo: dados.linha }, select: { id: true, descricao: true } });
    if (!linha) throw new CenarioError(400, "Conta não encontrada na Estrutura da DRE.");
    const chave = { cenarioId_visao_linhaDREId: { cenarioId: id, visao: dados.visao, linhaDREId: linha.id } };
    const antes = await prisma.cenarioJustificativa.findUnique({ where: chave });
    if (!dados.texto) {
      if (antes) await prisma.cenarioJustificativa.delete({ where: chave });
    } else {
      await prisma.cenarioJustificativa.upsert({
        where: chave,
        create: { cenarioId: id, visao: dados.visao, linhaDREId: linha.id, texto: dados.texto, usuarioNome: usuario.nome },
        update: { texto: dados.texto, usuarioNome: usuario.nome },
      });
    }
    await auditar({
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      acao: "ALTERACAO",
      entidade: "cenario",
      entidadeId: id,
      antes: antes ? { texto: antes.texto } : undefined,
      depois: dados.texto ? { texto: dados.texto } : undefined,
      metadados: { justificativa: linha.descricao, visao: dados.visao },
    });
  },

  /** Grava os lançamentos manuais de um indicador (os 12 meses; vazio apaga o mês). */
  async salvarManual(id: string, nome: string, valores: Array<number | null>, usuario: Usuario) {
    const c = await obterOuFalhar(id, usuario);
    exigirEditavel(c);
    if (!MANUAIS.has(nome)) throw new CenarioError(400, `${nome} não é um lançamento manual: sai da DRE do cenário.`);
    if (c.tipo === "ANALITICO" && QUADROS_DE_LOTACAO.has(nome))
      throw new CenarioError(400, `${nome} sai do Quadro de Lotação dos centros de custo (Premissas / Centros de Custo) e não se digita.`);
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
