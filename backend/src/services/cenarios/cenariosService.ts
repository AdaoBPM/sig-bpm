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
import { calcularCenario } from "./indicadoresDoCenario.js";
import { linhasDasVisoes, mesesAcima, totaisDaDRE } from "./comparativoCenario.js";
import { ABAS_DRE, ABAS_METAS, acharAba, lerAbaDRE, lerAbaMetas, MESES, type AbaDRELida, type AbaMetasLida } from "./leituraCenario.js";

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

/** Quem pede: `admin` é o Administrador (Editar no Controle de Usuários), que vê também os cenários particulares. */
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

/**
 * A trava dos cenários marcados (12/10/2026): um cenário com marcação (Orçamento Empresarial, Resultados Anteriores ou
 * Resultados Vendidos) não muda de dados — a DRE, os indicadores manuais e a referência (arquivo ou realizado). O nome
 * e a descrição continuam editáveis.
 */
function exigirSemMarcacao(c: { nome: string; marcacao: MarcacaoCenario | null }) {
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
  if (existente) exigirSemMarcacao(existente);
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
  async listar(usuario: Usuario = SISTEMA) {
    const cenarios = (await getPrismaClient().cenario.findMany({ orderBy: [{ ano: "desc" }, { criadoEm: "desc" }] })).filter((c) => alcanca(c, usuario));
    const doCenario = await conteudo(cenarios.map((c) => c.id));
    return cenarios.map((c) => ({ ...c, ...doCenario(c.id), podeMudarVisualizacao: mudaVisualizacao(c, usuario) }));
  },

  async obter(id: string, usuario: Usuario = SISTEMA) {
    const c = await obterOuFalhar(id, usuario);
    return { ...c, ...(await conteudo([id]))(id), podeMudarVisualizacao: mudaVisualizacao(c, usuario) };
  },

  /** Um cenário novo: vazio, no exercício dado, ou a cópia de outro (com a DRE e as metas dele, no exercício dele). */
  async criar(dados: { nome: string; ano: number; descricao: string | null; copiarDe: string | null; visualizacao?: VisualizacaoCenario }, usuario: Usuario) {
    const prisma = getPrismaClient();
    const origem = dados.copiarDe ? await obterOuFalhar(dados.copiarDe, usuario) : null;
    const cenario = await prisma.$transaction(
      async (tx) => {
        const c = await tx.cenario.create({
          data: {
            nome: dados.nome,
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
  async indicadores(id: string, usuario: Usuario = SISTEMA) {
    const c = await obterOuFalhar(id, usuario);
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

  /**
   * Uma visão da DRE do cenário para a edição (12/10/2026): como `resultados`, mas com todas as linhas da visão
   * (também as vazias, para editar) e os doze meses; `editaveis` são as contas que se editam (nenhuma no
   * Consolidado, que soma as unidades).
   */
  async edicao(id: string, visao: 0 | 1 | 2 | 3 | 4 | 5, usuario: Usuario = SISTEMA) {
    const c = await obterOuFalhar(id, usuario);
    const visoes = basesDoConsolidado(visao) ? [visao, 0] : [visao];
    const [linhas, est, rs] = await Promise.all([
      estrutura(),
      estruturaDRE(),
      getPrismaClient().cenarioResultado.findMany({ where: { cenarioId: id, visao: { in: visoes } }, select: { visao: true, mes: true, valor: true, linhaDRE: { select: { codigo: true } } } }),
    ]);
    const mapas = (v: number) => {
      const porMes = Array.from({ length: 12 }, () => new Map<string, number>());
      for (const r of rs) if (r.visao === v) porMes[r.mes - 1].set(r.linhaDRE.codigo, Number(r.valor));
      return porMes;
    };
    const valores = mapas(visao);
    const consolidado = basesDoConsolidado(visao) ? mapas(0) : valores;
    if (visao === 4 || visao === 5) valores.forEach((m, i) => consolidado[i].has(COD.RO) && m.set(COD.RO, consolidado[i].get(COD.RO)!));
    const todas = visao === 0 ? linhasDoConsolidado(est) : linhasDaUnidade(est, visao);
    const meses = Array.from({ length: 12 }, () => true);
    return {
      ano: c.ano,
      ate: 12,
      meses: Array.from({ length: 12 }, (_, k) => ({ mes: k + 1, rotulo: rotuloMes(c.ano, k + 1), apurado: true })),
      linhas: montar(linhas, visao, meses, valores, consolidado, ACESSO_TOTAL, todas).map((l) => ({ ...l, podeDetalhar: false })),
      editaveis: visao === 0 ? [] : [...contasDaUnidade(est, visao)],
    };
  },

  /**
   * Grava valores mensais de contas de uma unidade e recalcula os totais e o Consolidado (12/10/2026). `origem` diz o
   * que a tela fez — o reajuste dos marcados ou a edição de um valor, com o reajuste — para o histórico de reajustes.
   */
  async gravarValores(id: string, visao: number, alteracoes: Alteracao[], usuario: Usuario, origem?: OrigemDaGravacao) {
    const c = await obterOuFalhar(id, usuario);
    exigirSemMarcacao(c);
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
   */
  async referenciaRealizado(id: string, ano: number, usuario: Usuario, opcoes: { modo: "MES_A_MES" | "MEDIA"; de?: number; ate?: number } = { modo: "MES_A_MES" }) {
    const c = await obterOuFalhar(id, usuario);
    exigirSemMarcacao(c);
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
    return this.obter(id, usuario);
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
   * O comparativo do cenário (12/10/2026): o cenário comparado, os cenários que o usuário pode escolher e os totais da
   * DRE com a variação máxima (em %) de cada um (nula: o total não se verifica).
   */
  async comparativo(id: string, usuario: Usuario = SISTEMA) {
    const c = await obterOuFalhar(id, usuario);
    const outros = (await getPrismaClient().cenario.findMany({ where: { id: { not: id } }, orderBy: [{ ano: "desc" }, { criadoEm: "desc" }] })).filter((o) => alcanca(o, usuario));
    const limites = (c.variacoesMaximas ?? {}) as Record<string, number>;
    const { totais } = totaisDaDRE(await estruturaDRE());
    const comparado = c.comparadoComId ? await getPrismaClient().cenario.findUnique({ where: { id: c.comparadoComId }, select: { id: true, nome: true, ano: true } }) : null;
    return {
      comparadoCom: comparado,
      opcoes: outros.map((o) => ({ id: o.id, nome: o.nome, ano: o.ano, marcacao: o.marcacao })),
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
    exigirSemMarcacao(await obterOuFalhar(id, usuario));
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
