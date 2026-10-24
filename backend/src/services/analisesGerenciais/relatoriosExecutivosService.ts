import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { copyFile, cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";

import { getPrismaClient } from "../../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { AbaRelatorioExecutivo, DepartamentoAcesso } from "../../generated/prisma/enums.js";
import { auditar, auditoriaEmSequencia } from "../auditoriaService.js";
import { diretorioUploads } from "../importacoes/arquivosImportados.js";
import { indicadoresService } from "../relatorios/indicadoresService.js";
import { painelService } from "../relatorios/painelService.js";
import { resultadosService } from "../relatorios/resultadosService.js";
import { ACESSO_TOTAL } from "../acesso/acesso.js";
import { cenarioMarcado, type Comparacao } from "../cenarios/indicadoresDoCenario.js";

/**
 * Os Relatórios Executivos (15/10/2026, Análises Gerenciais): a apresentação de cada competência fechada, que os gestores
 * montam juntos. Decisões do usuário: um relatório por competência, criado por quem edita a tela; as oito abas (17/10/2026; a Capa e o Encerramento, 20/10/2026;
 * antes, uma por departamento) — Capa, Introdução, Demonstrativo de Resultados e Encerramento, que todos os que editam a tela editam, e
 * as performances Comercial, da Produção, de Serviços e Administrativa; desde 23/10/2026, sem o recorte de departamentos:
 * quem lê a tela vê todas as abas (em elaboração ou finalizadas) e quem edita a tela edita, finaliza e reabre todas; cada
 * aba tem a sua situação, e o relatório fica finalizado quando todas as abas estão. As anotações são blocos
 * livres na grade, ao lado dos cards. Os cards trazem o Painel de Bordo e os Indicadores de Resultados Empresariais até
 * o mês do relatório, só das competências fechadas.
 */

export class RelatorioExecutivoError extends Error {
  constructor(
    public status: number,
    message: string,
    /** O código do erro (23/10/2026: CONFLITO, o grupo gravado por outro depois de aberto) e os detalhes para a tela. */
    public codigo?: string,
    public detalhes?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** O usuário: se edita a tela e os departamentos do recorte (null: sem recorte, todos). */
export type UsuarioDoRelatorio = { id: string; nome: string; admin: boolean; edita: boolean; departamentos: DepartamentoAcesso[] | null };

/**
 * As abas (17/10/2026), na ordem: o nome curto (o da barra do topo), o título (o da tela e do slide) e o departamento do
 * recorte (nulo: geral, de todos os que editam a tela).
 */
export const ABAS: Array<{ chave: AbaRelatorioExecutivo; nome: string; titulo: string; departamento: DepartamentoAcesso | null }> = [
  // A Capa (20/10/2026), geral como a Introdução: os slides dela não entram na contagem (o contador e o Sumário começam na Introdução).
  { chave: "CAPA", nome: "Capa", titulo: "Capa", departamento: null },
  { chave: "FATOS", nome: "Introdução", titulo: "Introdução", departamento: null },
  { chave: "RESULTADOS", nome: "Resultados", titulo: "Demonstrativo de Resultados", departamento: null },
  { chave: "COMERCIAL", nome: "Comercial", titulo: "Performance Comercial", departamento: "COMERCIAL" },
  { chave: "PRODUCAO", nome: "Produção", titulo: "Performance da Produção", departamento: "PRODUCAO" },
  { chave: "SERVICOS", nome: "Serviços", titulo: "Performance de Serviços", departamento: "SERVICOS" },
  { chave: "ADMINISTRATIVO", nome: "Administrativo", titulo: "Performance Administrativa", departamento: "ADMINISTRATIVO" },
  // O Encerramento (20/10/2026), geral e no fim; como a Capa, os slides dele não entram na contagem nem no Sumário.
  { chave: "ENCERRAMENTO", nome: "Encerramento", titulo: "Encerramento", departamento: null },
];
export const CHAVES_DAS_ABAS = ABAS.map((a) => a.chave);
const DA_ABA = new Map(ABAS.map((a) => [a.chave, a]));
const nomeDaAba = (d: AbaRelatorioExecutivo) => DA_ABA.get(d)?.nome ?? d;
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const rotuloMes = (ano: number, mes: number) => `${MESES[mes - 1]}/${ano}`;

/** As fontes dos textos (20/10/2026: as cinco da barra de formatação; 22/10/2026, mais cinco abertas). */
export const FONTES_DO_TEXTO = ["ARIAL", "CALIBRI", "SEGOE", "VERDANA", "GEORGIA", "ROBOTO", "OPEN_SANS", "MONTSERRAT", "LATO", "POPPINS"] as const;
export type FonteDoTexto = (typeof FONTES_DO_TEXTO)[number];
/** A formatação de um nível do Sumário (20/10/2026): o tamanho em px, a cor (#rrggbb) e a fonte. */
export type EstiloDoSumario = { negrito?: boolean; italico?: boolean; sublinhado?: boolean; tamanho?: number; cor?: string; fonte?: FonteDoTexto };

/** Um bloco da grade: a posição e o tamanho (em colunas e linhas) e o conteúdo. */
export type BlocoDoRelatorio = { id: string; x: number; y: number; w: number; h: number } & (
  | { tipo: "PAINEL"; aba: "resultados" | "performance"; quadro: string; titulo: string; sigla: string; comGrafico: boolean; /** As opções do gráfico do card (16/10/2026), como no Configurar Gráficos do Painel; sem elas, as do navegador. */ tipoGrafico?: "barras" | "area"; comRotulos?: boolean; cores?: "padrao" | "daltonismo" }
  | { tipo: "INDICADOR"; nome: string; grafico?: "MESES" | "ACUMULADO"; /** As opções do gráfico, como nos cards do Painel (22/10/2026). */ tipoGrafico?: "barras" | "area"; comRotulos?: boolean }
  | { tipo: "ANOTACAO"; nota: "POSITIVO" | "NEGATIVO" | "ATENCAO"; texto: string; /** O título (16/10/2026; sem ele, o nome da nota). */ titulo?: string; /** O texto formatado (17/10/2026), em HTML (limpo na tela, ao mostrar). */ html?: string; tamanhoTitulo?: number; /** A fonte do título e o espaçamento entre as linhas (20/10/2026). */ fonteTitulo?: FonteDoTexto; espacamento?: number }
  /** Uma foto (16/10/2026): o arquivo (na pasta do relatório; vazio, o quadro esperando a imagem), a legenda e a proporção (largura ÷ altura). */
  | { tipo: "FOTO"; arquivo: string; legenda: string; proporcao: number; /** A legenda formatada (17/10/2026), em HTML. */ legendaHtml?: string; /** A Imagem Livre (21/10/2026): só a imagem, sem o fundo, a moldura e a legenda. */ livre?: boolean; /** Os ajustes da imagem (21/10/2026). */ ajustes?: AjustesDeImagem }
  /**
   * Um vídeo (20/10/2026): um arquivo do computador (na pasta do relatório, até 200 MB) ou um link do YouTube, Instagram,
   * Facebook ou LinkedIn (`url`, o endereço colado; a tela monta o player incorporado), com a legenda e a proporção. Vazio
   * (sem arquivo e sem link), o quadro esperando o vídeo.
   */
  | { tipo: "VIDEO"; origem: "ARQUIVO" | "LINK"; arquivo: string; url: string; legenda: string; proporcao: number; legendaHtml?: string }
  /** O Texto Livre (20/10/2026): o texto formatado das anotações, sem o destaque, o título, o ícone e o fundo. */
  | { tipo: "TEXTO"; texto: string; html?: string; espacamento?: number }
  /**
   * O Sumário (20/10/2026): a lista das telas (as abas, da Introdução em diante) marcadas, com o número do primeiro slide
   * de cada uma, e, em "TELAS_E_SLIDES", também os slides delas; a tela monta a lista e os números a cada vez.
   */
  /** O sublinhado entre o nome e o número e a formatação das telas e dos slides (20/10/2026). */
  | { tipo: "SUMARIO"; listar: "TELAS" | "TELAS_E_SLIDES"; telas: AbaRelatorioExecutivo[]; linha?: "PONTOS" | "TRACOS" | "LINHA" | "NENHUM"; estilos?: { telas?: EstiloDoSumario; slides?: EstiloDoSumario } }
  /**
   * A tabela de Resultados (22/10/2026): a visão da DRE (0 Consolidado, 1 a 5 as unidades), as linhas escolhidas (os
   * códigos; sem elas, todas), o nível (1 Totais, 2 Atribuições, 3 Contas) e os meses anteriores recolhidos ou não.
   */
  | { tipo: "TABELA"; visao: 0 | 1 | 2 | 3 | 4 | 5; nivel: 1 | 2 | 3; linhas?: string[]; recolhido?: boolean }
);

/**
 * A Imagem de Fundo de uma página (20/10/2026): a foto (na pasta do relatório) cobre o slide inteiro, por cima do
 * cabeçalho, atrás dos blocos. `zoom` (1 a 4) aumenta a imagem a partir do tamanho que cobre a tela, e `x` e `y` (0 a 1)
 * a posicionam (0: encostada à esquerda ou em cima; 1: à direita ou embaixo).
 */
/** Os ajustes de uma imagem (21/10/2026): brilho e saturação em % (100 = como veio), matiz em graus, desfoque em px e transparência em %; sem um deles, o padrão. */
export type AjustesDeImagem = { brilho?: number; matiz?: number; saturacao?: number; desfoque?: number; transparencia?: number };
export type FundoDaPagina = { arquivo: string; proporcao: number; zoom: number; x: number; y: number; ajustes?: AjustesDeImagem };

/**
 * As páginas de uma aba (16/10/2026): cada departamento tem uma ou mais páginas, cada uma com a sua grade de blocos. Ficam
 * na coluna `blocos` da aba; a lista antiga (só os blocos, de antes das páginas) vira uma página.
 */
/** O nome da página (16/10/2026), o do slide na apresentação; sem ele, "Página N". */
export type PaginaDoRelatorio = { id: string; nome?: string; blocos: BlocoDoRelatorio[]; fundo?: FundoDaPagina };
export function paginasDe(json: unknown): PaginaDoRelatorio[] {
  const lista = Array.isArray(json) ? json : [];
  if (!lista.length) return [{ id: "p1", blocos: [] }];
  if (lista.some((x) => x && typeof x === "object" && "tipo" in x)) return [{ id: "p1", blocos: lista as BlocoDoRelatorio[] }];
  return lista as PaginaDoRelatorio[];
}

/** As fotos (16/10/2026): na pasta do relatório, dentro dos uploads, com um nome sorteado. */
export const NOME_DA_FOTO = /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/;
const EXTENSOES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
const TIPOS: Record<string, string> = Object.fromEntries(Object.entries(EXTENSOES).map(([t, e]) => [e, t]));
const pastaDasFotos = (relatorioId: string) => join(diretorioUploads(), "relatorios-executivos", relatorioId);
const MAXIMO_DA_FOTO = 10 * 1024 * 1024;

/** Os vídeos (20/10/2026): na mesma pasta das fotos, com um nome sorteado; até 200 MB. */
export const NOME_DO_VIDEO = /^[0-9a-f-]{36}\.(mp4|webm|mov|m4v|ogv)$/;
const EXTENSOES_DE_VIDEO: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "video/x-m4v": "m4v", "video/ogg": "ogv" };
const TIPOS_DE_VIDEO: Record<string, string> = Object.fromEntries(Object.entries(EXTENSOES_DE_VIDEO).map(([t, e]) => [e, t]));
export const MAXIMO_DO_VIDEO = 200 * 1024 * 1024;
/** Os sites dos links de vídeo (20/10/2026). */
export const SITES_DE_VIDEO = /^https:\/\/([a-z0-9-]+\.)*(youtube\.com|youtu\.be|youtube-nocookie\.com|instagram\.com|facebook\.com|fb\.watch|linkedin\.com)(\/|$)/i;

/** Os arquivos de uma página: as fotos, os vídeos e a Imagem de Fundo (20/10/2026). */
const arquivosDaPagina = (p: PaginaDoRelatorio) => [
  ...p.blocos.flatMap((b) => ((b.tipo === "FOTO" || b.tipo === "VIDEO") && b.arquivo ? [b.arquivo] : [])),
  ...(p.fundo?.arquivo ? [p.fundo.arquivo] : []),
];

/** Desde quando cada arquivo da pasta do relatório está sem uso (24/10/2026), em ms. */
const SEM_USO = ".sem-uso.json";

/**
 * Apaga as fotos que nenhuma aba usa (enviadas e não gravadas, ou tiradas da aba) com mais de um dia: as mais novas
 * podem estar numa aba ainda não gravada. O dia conta do envio e (24/10/2026, o Desfazer do salvamento automático) de
 * quando a foto saiu da aba: a excluída e logo gravada volta inteira com o Desfazer.
 */
async function limparFotos(relatorioId: string) {
  const abas = await getPrismaClient().relatorioExecutivoAba.findMany({ where: { relatorioId }, select: { blocos: true } });
  const usadas = new Set(abas.flatMap((a) => paginasDe(a.blocos).flatMap(arquivosDaPagina)));
  const pasta = pastaDasFotos(relatorioId);
  const arquivos = await readdir(pasta).catch(() => [] as string[]);
  const agora = Date.now();
  const umDia = agora - 24 * 60 * 60 * 1000;
  const antes = await readFile(join(pasta, SEM_USO), "utf8")
    .then((t) => JSON.parse(t) as Record<string, number>)
    .catch(() => ({}) as Record<string, number>);
  const semUso: Record<string, number> = {};
  for (const arquivo of arquivos) {
    if (usadas.has(arquivo) || !(NOME_DA_FOTO.test(arquivo) || NOME_DO_VIDEO.test(arquivo))) continue;
    const desde = antes[arquivo] ?? agora;
    const info = await stat(join(pasta, arquivo)).catch(() => null);
    if (info && info.mtimeMs < umDia && desde < umDia) await rm(join(pasta, arquivo), { force: true });
    else semUso[arquivo] = desde;
  }
  if (Object.keys(semUso).length || Object.keys(antes).length) await writeFile(join(pasta, SEM_USO), JSON.stringify(semUso)).catch(() => undefined);
}

type Aba = { departamento: AbaRelatorioExecutivo; blocos: unknown; situacao: "EM_ELABORACAO" | "FINALIZADO"; atualizadoPor: string | null; atualizadoEm: Date; finalizadoPor: string | null; finalizadoEm: Date | null };

/**
 * Quem edita a aba: quem edita a tela, em todas as abas (23/10/2026; antes, nas abas de um departamento, só no recorte de
 * departamentos do usuário).
 */
const editaAba = (u: UsuarioDoRelatorio, _d: AbaRelatorioExecutivo) => u.edita;
/** Quem vê a aba: todos os que leem a tela, em elaboração ou finalizada (23/10/2026; antes, em elaboração, só quem a editava). */
const veAba = (_u: UsuarioDoRelatorio, _a: Aba) => true;

/** A situação do relatório: finalizado quando todas as abas estão. */
const situacaoGeral = (abas: Aba[]) => (abas.length && abas.every((a) => a.situacao === "FINALIZADO") ? "FINALIZADO" : "EM_ELABORACAO");

/**
 * Cria as abas que faltam num relatório (20/10/2026: a Capa, nos de antes dela), vazias. Num relatório com todas as abas
 * finalizadas, a nova já vem finalizada, para ele não voltar a Em Elaboração; quem a edita a reabre para montar. Devolve
 * se criou alguma.
 */
async function completarAbas(r: { id: string; abas: Aba[] }) {
  const faltam = CHAVES_DAS_ABAS.filter((d) => !r.abas.some((a) => a.departamento === d));
  if (!faltam.length) return false;
  const finalizado = situacaoGeral(r.abas) === "FINALIZADO";
  await getPrismaClient().relatorioExecutivoAba.createMany({
    data: faltam.map((departamento) => ({ relatorioId: r.id, departamento, blocos: paginasDe([]) as Prisma.InputJsonValue, ...(finalizado ? { situacao: "FINALIZADO" as const, finalizadoEm: new Date() } : {}) })),
  });
  return true;
}

/**
 * O cenário de comparação do relatório (22/10/2026): o escolhido nas Configurações; sem ele (ou com ele excluído ou
 * particular), o Orçamento Empresarial, como a tela das Configurações mostra.
 */
async function comparacaoDo(r: { cenarioComparadoId: string | null }): Promise<Comparacao> {
  if (!r.cenarioComparadoId) return "ORCAMENTO_EMPRESARIAL";
  const c = await getPrismaClient().cenario.findFirst({ where: { id: r.cenarioComparadoId, visualizacao: "PUBLICA" }, select: { id: true } });
  return c ? { cenarioId: c.id } : "ORCAMENTO_EMPRESARIAL";
}

async function doRelatorio(id: string) {
  const buscar = () => getPrismaClient().relatorioExecutivo.findUnique({ where: { id }, include: { abas: true } });
  const r = await buscar();
  if (!r) throw new RelatorioExecutivoError(404, "Relatório não encontrado.");
  return (await completarAbas(r)) ? (await buscar())! : r;
}

/** A aba que o usuário pode alterar: em elaboração (todas, para quem edita a tela; 23/10/2026). */
async function abaEditavel(id: string, d: AbaRelatorioExecutivo, u: UsuarioDoRelatorio) {
  const r = await doRelatorio(id);
  const aba = r.abas.find((a) => a.departamento === d);
  if (!aba) throw new RelatorioExecutivoError(404, "Aba não encontrada.");
  if (!editaAba(u, d)) throw new RelatorioExecutivoError(403, "Só quem edita os Relatórios Executivos altera as abas.");
  if (aba.situacao === "FINALIZADO") throw new RelatorioExecutivoError(409, `A aba ${nomeDaAba(d)} está finalizada: reabra-a para alterar.`);
  return { r, aba };
}

export const relatoriosExecutivosService = {
  /**
   * Os relatórios (a competência mais recente primeiro), com a situação, o andamento (as abas finalizadas) e as abas do
   * usuário; e as competências fechadas ainda sem relatório (o Novo Relatório).
   */
  async listar(usuario: UsuarioDoRelatorio) {
    const prisma = getPrismaClient();
    const buscar = () => prisma.relatorioExecutivo.findMany({ include: { abas: true }, orderBy: [{ ano: "desc" }, { mes: "desc" }] });
    let [relatorios, fechadas] = await Promise.all([
      buscar(),
      prisma.competencia.findMany({ where: { status: "FECHADA" }, select: { ano: true, mes: true }, orderBy: [{ ano: "desc" }, { mes: "desc" }] }),
    ]);
    // Os relatórios de antes da Capa e do Encerramento (20/10/2026) os ganham aqui, para o andamento contar as oito abas.
    let completou = false;
    for (const r of relatorios) completou = (await completarAbas(r)) || completou;
    if (completou) relatorios = await buscar();
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
        minhas: CHAVES_DAS_ABAS.filter((d) => editaAba(usuario, d)).flatMap((d) => {
          const a = r.abas.find((x) => x.departamento === d);
          return a ? [{ chave: d, nome: nomeDaAba(d), situacao: a.situacao }] : [];
        }),
        criadoPor: r.criadoPorNome,
        criadoEm: r.criadoEm,
        atualizadoEm: r.abas.reduce((m, a) => (a.atualizadoEm > m ? a.atualizadoEm : m), r.atualizadoEm),
      })),
      livres: fechadas.filter((c) => !comRelatorio.has(`${c.ano}|${c.mes}`)).map((c) => ({ ano: c.ano, mes: c.mes, rotulo: rotuloMes(c.ano, c.mes) })),
      meusDepartamentos: CHAVES_DAS_ABAS.filter((d) => editaAba(usuario, d)).map((d) => ({ chave: d, nome: nomeDaAba(d) })),
    };
  },

  /**
   * Cria o relatório de uma competência fechada (um por competência), com as oito abas: vazias ou, com `importarDe`
   * (16/10/2026), com os blocos das abas de outro relatório — os cards (que trazem os dados do mês novo), as fotos
   * (copiadas para a pasta do relatório novo) e as anotações —, todas em elaboração.
   */
  async criar(dados: { ano: number; mes: number; importarDe?: string | null; manterImagensEAnotacoes?: boolean }, usuario: UsuarioDoRelatorio) {
    const prisma = getPrismaClient();
    const competencia = await prisma.competencia.findFirst({ where: { ano: dados.ano, mes: dados.mes } });
    if (!competencia || competencia.status !== "FECHADA") throw new RelatorioExecutivoError(400, `A competência ${rotuloMes(dados.ano, dados.mes)} não está fechada: os relatórios são das competências fechadas.`);
    if (await prisma.relatorioExecutivo.findUnique({ where: { ano_mes: { ano: dados.ano, mes: dados.mes } } })) {
      throw new RelatorioExecutivoError(409, `${rotuloMes(dados.ano, dados.mes)} já tem relatório: abra-o na lista.`);
    }
    const origem = dados.importarDe ? await doRelatorio(dados.importarDe) : null;
    // Sem "Manter Imagens e Anotações" (17/10/2026), as anotações vêm em branco (o tipo da nota e o título ficam) e as
    // fotos, sem a imagem e sem a legenda (o quadro cinza, esperando a imagem); os cards vêm iguais.
    const manter = dados.manterImagensEAnotacoes !== false;
    const esvaziar = (b: BlocoDoRelatorio): BlocoDoRelatorio =>
      b.tipo === "ANOTACAO"
        ? { ...b, texto: "", html: undefined }
        : b.tipo === "FOTO"
          ? { ...b, arquivo: "", legenda: "", legendaHtml: undefined }
          : // O vídeo (20/10/2026), como a foto: o quadro vazio, esperando o vídeo.
            b.tipo === "VIDEO"
            ? { ...b, arquivo: "", url: "", legenda: "", legendaHtml: undefined }
            : b;
    const daOrigem = new Map(
      // Sem as imagens, a página sai também sem a Imagem de Fundo (20/10/2026).
      (origem?.abas ?? []).map((a) => [a.departamento, paginasDe(a.blocos).map((p) => (manter ? p : { ...p, fundo: undefined, blocos: p.blocos.map(esvaziar) }))]),
    );
    const r = await prisma.relatorioExecutivo.create({
      data: {
        ano: dados.ano,
        mes: dados.mes,
        criadoPorId: usuario.id,
        criadoPorNome: usuario.nome,
        // O cenário de comparação da origem (22/10/2026), no mesmo exercício.
        cenarioComparadoId: origem && origem.ano === dados.ano ? origem.cenarioComparadoId : null,
        abas: { create: CHAVES_DAS_ABAS.map((departamento) => ({ departamento, blocos: (daOrigem.get(departamento) ?? paginasDe([])) as Prisma.InputJsonValue, atualizadoPor: origem ? usuario.nome : null })) },
      },
    });
    // As fotos da origem vão para a pasta do relatório novo (a origem pode ser excluída depois).
    if (origem && [...daOrigem.values()].some((ps) => ps.some((p) => arquivosDaPagina(p).length))) {
      await cp(pastaDasFotos(origem.id), pastaDasFotos(r.id), { recursive: true }).catch(() => undefined);
    }
    await auditar({
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      acao: "CRIACAO",
      entidade: "relatorio_executivo",
      entidadeId: r.id,
      metadados: { mes: rotuloMes(r.ano, r.mes), importadoDe: origem ? rotuloMes(origem.ano, origem.mes) : null, imagensEAnotacoes: origem ? manter : null },
    });
    return { id: r.id, rotuloMes: rotuloMes(r.ano, r.mes) };
  },

  /** O relatório, com as abas: a situação de cada uma, as páginas (com os blocos) das que o usuário vê e o que ele pode fazer em cada. */
  async obter(id: string, usuario: UsuarioDoRelatorio) {
    const r = await doRelatorio(id);
    const abas = CHAVES_DAS_ABAS.flatMap((d) => {
      const a = r.abas.find((x) => x.departamento === d);
      if (!a) return [];
      const ve = veAba(usuario, a);
      return [
        {
          chave: d,
          nome: nomeDaAba(d),
          titulo: DA_ABA.get(d)?.titulo ?? d,
          situacao: a.situacao,
          visivel: ve,
          paginas: ve ? paginasDe(a.blocos) : [],
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
    // Comparados com o cenário das Configurações (22/10/2026).
    const c = await comparacaoDo(r);
    const [painel, indicadores] = await Promise.all([painelService.painel(r.ano, r.mes, true, c), indicadoresService.listar(r.ano, r.mes, true, c)]);
    return { painel, indicadores };
  },

  /**
   * A tabela de Resultados de uma visão (22/10/2026), para os blocos de tabela: até o mês do relatório, só das competências
   * fechadas, com o orçado (o Orçamento Empresarial), como a tela Resultados; sem o recorte do usuário, como os cards.
   */
  async resultados(id: string, visao: 0 | 1 | 2 | 3 | 4 | 5) {
    const r = await doRelatorio(id);
    return resultadosService.unidade(r.ano, visao, r.mes, ACESSO_TOTAL, true, await comparacaoDo(r));
  },

  /**
   * As Configurações do relatório (22/10/2026): o cenário de comparação (nulo: o marcado como Orçamento Empresarial no
   * exercício, que vem em `marcado`) e as opções — todos os cenários públicos (de todos os exercícios), com o ano, o tipo
   * (sintético ou analítico) e a marcação; os particulares ficam de fora (os dados do comparado aparecem a todos os que
   * leem o relatório).
   */
  async configuracoes(id: string, usuario: UsuarioDoRelatorio) {
    const r = await doRelatorio(id);
    const [cenarios, marcado] = await Promise.all([
      getPrismaClient().cenario.findMany({
        where: { visualizacao: "PUBLICA" },
        orderBy: [{ ano: "desc" }, { nome: "asc" }],
        select: { id: true, nome: true, ano: true, tipo: true, marcacao: true },
      }),
      cenarioMarcado("ORCAMENTO_EMPRESARIAL"),
    ]);
    // O escolhido que deixou de existir (ou ficou particular) volta à marcação.
    const escolhido = r.cenarioComparadoId && cenarios.some((c) => c.id === r.cenarioComparadoId) ? r.cenarioComparadoId : null;
    return { ano: r.ano, cenarioComparadoId: escolhido, marcado, cenarios, podeEditar: usuario.edita };
  },

  /** Grava o cenário de comparação (de quem edita a tela; nulo: volta ao Orçamento Empresarial). */
  async gravarConfiguracoes(id: string, dados: { cenarioComparadoId: string | null }, usuario: UsuarioDoRelatorio) {
    if (!usuario.edita) throw new RelatorioExecutivoError(403, "Só quem edita os Relatórios Executivos muda as configurações.");
    const r = await doRelatorio(id);
    if (dados.cenarioComparadoId) {
      const c = await getPrismaClient().cenario.findUnique({ where: { id: dados.cenarioComparadoId }, select: { visualizacao: true } });
      // Qualquer cenário público (22/10/2026), de qualquer exercício.
      if (c?.visualizacao !== "PUBLICA") throw new RelatorioExecutivoError(400, "Escolha um dos cenários públicos da lista.");
    }
    await getPrismaClient().relatorioExecutivo.update({ where: { id }, data: { cenarioComparadoId: dados.cenarioComparadoId } });
    await auditar({
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      acao: "ALTERACAO",
      entidade: "relatorio_executivo",
      entidadeId: id,
      antes: { cenarioComparadoId: r.cenarioComparadoId },
      depois: { cenarioComparadoId: dados.cenarioComparadoId },
      metadados: { mes: rotuloMes(r.ano, r.mes), configuracoes: true },
    });
    return this.configuracoes(id, usuario);
  },

  /** Grava as páginas de uma aba, com os blocos de cada uma (de quem a edita, em elaboração). */
  /**
   * Grava as páginas de uma aba (o grupo). `versao` (23/10/2026): quando ela foi gravada da última vez, no momento em que o
   * usuário a abriu; se outro gravou depois, recusa (409 CONFLITO, com quem e quando) em vez de sobrepor — a não ser com
   * `forcar` (o usuário escolheu gravar por cima).
   */
  async gravarAba(id: string, departamento: AbaRelatorioExecutivo, paginas: PaginaDoRelatorio[], usuario: UsuarioDoRelatorio, opcoes: { versao?: string; forcar?: boolean } = {}) {
    const { r, aba } = await abaEditavel(id, departamento, usuario);
    if (opcoes.versao && !opcoes.forcar && aba.atualizadoEm.toISOString() !== opcoes.versao) {
      const quem = aba.atualizadoPor ?? "Outro usuário";
      const quando = aba.atualizadoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
      throw new RelatorioExecutivoError(409, `${quem} gravou ${nomeDaAba(departamento)} em ${quando}, depois que você abriu o relatório.`, "CONFLITO", {
        aba: departamento,
        nome: nomeDaAba(departamento),
        atualizadoPor: aba.atualizadoPor,
        atualizadoEm: aba.atualizadoEm,
      });
    }
    await getPrismaClient().relatorioExecutivoAba.update({
      where: { relatorioId_departamento: { relatorioId: id, departamento } },
      data: { blocos: (paginas.length ? paginas : paginasDe([])) as Prisma.InputJsonValue, atualizadoPor: usuario.nome },
    });
    // A gravação na Auditoria (23/10/2026), com a gravação por cima de outro usuário, quando foi o caso. Em sequência
    // (24/10/2026, o salvamento automático), só a mais recente do mesmo usuário no grupo.
    auditoriaEmSequencia.registrar(`${id}|${departamento}`, {
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      acao: "GRAVACAO_RE",
      entidade: "relatorio_executivo",
      entidadeId: id,
      metadados: { mes: rotuloMes(r.ano, r.mes), aba: nomeDaAba(departamento), paginas: paginas.length, ...(opcoes.forcar ? { porCima: true } : {}) },
    });
    await limparFotos(id);
    return this.obter(id, usuario);
  },

  /** Finaliza a aba (fica visível para todos, só leitura) ou a reabre (volta a ser só de quem a edita). */
  async mudarAba(id: string, departamento: AbaRelatorioExecutivo, acao: "finalizar" | "reabrir", usuario: UsuarioDoRelatorio) {
    const prisma = getPrismaClient();
    const r = await doRelatorio(id);
    if (acao === "finalizar") await abaEditavel(id, departamento, usuario);
    else {
      const aba = r.abas.find((a) => a.departamento === departamento);
      if (!aba) throw new RelatorioExecutivoError(404, "Aba não encontrada.");
      if (!editaAba(usuario, departamento) && !usuario.admin) throw new RelatorioExecutivoError(403, "Só quem edita os Relatórios Executivos reabre as abas.");
      if (aba.situacao !== "FINALIZADO") throw new RelatorioExecutivoError(409, "A aba não está finalizada.");
    }
    // As gravações em sequência do relatório entram na Auditoria antes.
    await auditoriaEmSequencia.encerrar(`${id}|`);
    await prisma.relatorioExecutivoAba.update({
      where: { relatorioId_departamento: { relatorioId: id, departamento } },
      data: acao === "finalizar" ? { situacao: "FINALIZADO", finalizadoPor: usuario.nome, finalizadoEm: new Date() } : { situacao: "EM_ELABORACAO", finalizadoPor: null, finalizadoEm: null, atualizadoPor: usuario.nome },
    });
    await auditar({
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      // A ação própria (23/10/2026; antes, ALTERACAO, com a ação nos metadados).
      acao: acao === "finalizar" ? "FINALIZACAO_RE" : "REABERTURA_RE",
      entidade: "relatorio_executivo",
      entidadeId: id,
      metadados: { mes: rotuloMes(r.ano, r.mes), aba: nomeDaAba(departamento) },
    });
    return this.obter(id, usuario);
  },

  /** Guarda uma foto do relatório (quem edita a tela; até 10 MB, JPEG, PNG, WebP ou GIF) e devolve o nome do arquivo. */
  async salvarFoto(id: string, conteudo: Buffer, tipo: string, usuario: UsuarioDoRelatorio) {
    await doRelatorio(id);
    if (!usuario.edita) throw new RelatorioExecutivoError(403, "Seu perfil não edita os relatórios.");
    const extensao = EXTENSOES[tipo.split(";")[0].trim().toLowerCase()];
    if (!extensao) throw new RelatorioExecutivoError(400, "A foto precisa ser JPEG, PNG, WebP ou GIF.");
    if (!conteudo.length) throw new RelatorioExecutivoError(400, "O arquivo da foto está vazio.");
    if (conteudo.length > MAXIMO_DA_FOTO) throw new RelatorioExecutivoError(400, "A foto passa de 10 MB.");
    const arquivo = `${randomUUID()}.${extensao}`;
    await mkdir(pastaDasFotos(id), { recursive: true });
    await writeFile(join(pastaDasFotos(id), arquivo), conteudo);
    return { arquivo };
  },

  /**
   * Copia fotos e vídeos de outro relatório para a pasta deste (24/10/2026: colar blocos copiados de outro relatório), com
   * os mesmos nomes; os que já estão aqui ficam. Devolve os que não se acharam na origem.
   */
  async copiarArquivos(id: string, origemId: string, arquivos: string[], usuario: UsuarioDoRelatorio) {
    if (!usuario.edita) throw new RelatorioExecutivoError(403, "Seu perfil não edita os relatórios.");
    await doRelatorio(id);
    await doRelatorio(origemId);
    const validos = [...new Set(arquivos)].filter((a) => NOME_DA_FOTO.test(a) || NOME_DO_VIDEO.test(a));
    await mkdir(pastaDasFotos(id), { recursive: true });
    const faltando: string[] = [];
    for (const a of validos) {
      const destino = join(pastaDasFotos(id), a);
      if (await stat(destino).catch(() => null)) continue;
      const copiou = await copyFile(join(pastaDasFotos(origemId), a), destino).then(
        () => true,
        () => false,
      );
      if (!copiou) faltando.push(a);
    }
    return { copiados: validos.length - faltando.length, faltando };
  },

  /** Uma foto do relatório: o conteúdo e o tipo. */
  async lerFoto(id: string, arquivo: string) {
    if (!NOME_DA_FOTO.test(arquivo)) throw new RelatorioExecutivoError(400, "Foto inválida.");
    await doRelatorio(id);
    const conteudo = await readFile(join(pastaDasFotos(id), arquivo)).catch(() => null);
    if (!conteudo) throw new RelatorioExecutivoError(404, "Foto não encontrada.");
    return { conteudo, tipo: TIPOS[arquivo.split(".").pop()!] };
  },

  /**
   * Guarda um vídeo do relatório (20/10/2026; quem edita a tela; até 200 MB, MP4, WebM, MOV, M4V ou OGG), gravado no disco
   * enquanto chega (sem guardar o arquivo inteiro na memória), e devolve o nome do arquivo.
   */
  async salvarVideo(id: string, corpo: Readable, tipo: string, tamanho: number | null, usuario: UsuarioDoRelatorio) {
    await doRelatorio(id);
    if (!usuario.edita) throw new RelatorioExecutivoError(403, "Seu perfil não edita os relatórios.");
    const extensao = EXTENSOES_DE_VIDEO[tipo.split(";")[0].trim().toLowerCase()];
    if (!extensao) throw new RelatorioExecutivoError(400, "O vídeo precisa ser MP4, WebM, MOV, M4V ou OGG.");
    if (tamanho !== null && tamanho > MAXIMO_DO_VIDEO) throw new RelatorioExecutivoError(413, "O vídeo passa de 200 MB.");
    const arquivo = `${randomUUID()}.${extensao}`;
    await mkdir(pastaDasFotos(id), { recursive: true });
    const caminho = join(pastaDasFotos(id), arquivo);
    let recebido = 0;
    const contador = new Transform({
      transform(parte: Buffer, _codificacao, pronto) {
        recebido += parte.length;
        if (recebido > MAXIMO_DO_VIDEO) pronto(new RelatorioExecutivoError(413, "O vídeo passa de 200 MB."));
        else pronto(null, parte);
      },
    });
    try {
      await pipeline(corpo, contador, createWriteStream(caminho));
    } catch (error) {
      await rm(caminho, { force: true });
      if (error instanceof RelatorioExecutivoError) throw error;
      throw new RelatorioExecutivoError(400, "O envio do vídeo foi interrompido. Tente de novo.");
    }
    if (!recebido) {
      await rm(caminho, { force: true });
      throw new RelatorioExecutivoError(400, "O arquivo do vídeo está vazio.");
    }
    return { arquivo };
  },

  /** Um vídeo do relatório (20/10/2026): o caminho no disco, o tamanho e o tipo (o controller o envia em partes, pelo Range). */
  async lerVideo(id: string, arquivo: string) {
    if (!NOME_DO_VIDEO.test(arquivo)) throw new RelatorioExecutivoError(400, "Vídeo inválido.");
    await doRelatorio(id);
    const caminho = join(pastaDasFotos(id), arquivo);
    const info = await stat(caminho).catch(() => null);
    if (!info) throw new RelatorioExecutivoError(404, "Vídeo não encontrado.");
    return { caminho, tamanho: info.size, tipo: TIPOS_DE_VIDEO[arquivo.split(".").pop()!] };
  },

  /** Exclui o relatório (quem o criou ou o Administrador), enquanto nenhuma aba estiver finalizada. */
  async excluir(id: string, usuario: UsuarioDoRelatorio) {
    const r = await doRelatorio(id);
    if ((r.criadoPorId !== usuario.id && !usuario.admin) || !usuario.edita) throw new RelatorioExecutivoError(403, `Só quem criou o relatório (${r.criadoPorNome}) ou o Administrador o exclui.`);
    if (r.abas.some((a) => a.situacao === "FINALIZADO")) throw new RelatorioExecutivoError(409, "O relatório tem abas finalizadas: reabra-as antes de excluir.");
    await getPrismaClient().relatorioExecutivo.delete({ where: { id } });
    await rm(pastaDasFotos(id), { recursive: true, force: true });
    await auditoriaEmSequencia.encerrar(`${id}|`);
    await auditar({ usuarioId: usuario.id, usuarioNome: usuario.nome, acao: "EXCLUSAO", entidade: "relatorio_executivo", entidadeId: id, metadados: { mes: rotuloMes(r.ano, r.mes) } });
    return { excluido: true };
  },
};
