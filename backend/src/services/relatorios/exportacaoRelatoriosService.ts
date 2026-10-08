import { getPrismaClient } from "../../config/prisma.js";
import { A4_PAISAGEM, caber, DocumentoPDF, type Cor, type Fonte } from "../../lib/pdfEscrita.js";
import { ESTILO, gerarXlsx, type AbaEscrita, type Celula } from "../../lib/xlsxEscrita.js";
import { ACESSO_TOTAL, type Acesso } from "../acesso/acesso.js";
import { indicadoresService } from "./indicadoresService.js";
import { RelatorioError, resultadosService } from "./resultadosService.js";

/**
 * Exportação dos relatórios em Excel e PDF, como a tela: os Resultados (uma
 * visão, todas as unidades ou todos os centros de custo, uma por aba ou por
 * página) e os Indicadores. No Excel vão todas as colunas da tela; no PDF
 * (A4 deitada), cada mês traz o valor e, embaixo, a participação, e o fim da
 * linha o total do exercício com o % e o R$/m³ (o mês escolhido já é a última
 * coluna dos meses).
 */

export type EscopoResultados = { tipo: "visao"; visao: 0 | 1 | 2 | 3 | 4 | 5 } | { tipo: "centro"; grupo: string } | { tipo: "unidades" } | { tipo: "centros" };
export type Formato = "xlsx" | "pdf";

type Resultados = Awaited<ReturnType<typeof resultadosService.unidade>>;
type Bloco = { nome: string; titulo: string; dados: Resultados };

const VISOES: Array<{ visao: 0 | 1 | 2 | 3 | 4 | 5; nome: string }> = [
  { visao: 0, nome: "Consolidado" },
  { visao: 1, nome: "Matriz" },
  { visao: 2, nome: "Filial" },
  { visao: 3, nome: "Serviços" },
  { visao: 4, nome: "Despesas e Extra" },
  { visao: 5, nome: "RN" },
];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const dataHora = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d).replace(",", "");
const n0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const n1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const n2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v: number) => `${n1.format(v * 100)}%`;

/** A identificação do arquivo: o período, o estado das competências e quem gerou. */
async function identificar(ano: number, ate: number, usuarioNome: string) {
  const competencias = await getPrismaClient().competencia.findMany({ where: { ano, mes: { lte: ate } }, select: { status: true, apuradaEm: true } });
  const apuradas = competencias.filter((c) => c.apuradaEm !== null);
  const abertas = apuradas.filter((c) => c.status !== "FECHADA").length;
  return {
    periodo: `Exercício ${ano} · de janeiro a ${MESES[ate - 1]} · ${apuradas.length} competência(s) apurada(s)`,
    avisos: abertas ? [`Valores provisórios: ${abertas} competência(s) do período ainda não está(ão) fechada(s).`] : [],
    geracao: `Gerado em ${dataHora(new Date())} por ${usuarioNome} · SIG BPM`,
  };
}
type Identificacao = Awaited<ReturnType<typeof identificar>>;

async function blocos(ano: number, ate: number | undefined, escopo: EscopoResultados, acesso: Acesso): Promise<Bloco[]> {
  if (escopo.tipo === "visao") {
    const v = VISOES.find((x) => x.visao === escopo.visao)!;
    return [{ nome: v.nome, titulo: v.nome, dados: await resultadosService.unidade(ano, v.visao, ate) }];
  }
  if (escopo.tipo === "unidades") return Promise.all(VISOES.map(async (v) => ({ nome: v.nome, titulo: v.nome, dados: await resultadosService.unidade(ano, v.visao, ate) })));
  const grupos = escopo.tipo === "centro" ? [escopo.grupo] : (await resultadosService.listarCentros(ano, ate, acesso)).grupos.map((g) => g.grupo);
  const r: Bloco[] = [];
  for (const g of grupos) r.push({ nome: g, titulo: `Centro de Custo ${g}`, dados: await resultadosService.centros(ano, g, ate, acesso) });
  return r;
}

// ---- Excel ------------------------------------------------------------------------------------

function abaResultados(b: Bloco, id: Identificacao): AbaEscrita {
  const { dados } = b;
  const ultimo = dados.meses[dados.meses.length - 1];
  const linhas: Celula[][] = [
    [{ valor: `Resultados · ${b.titulo}`, estilo: ESTILO.titulo }],
    [{ valor: id.periodo, estilo: ESTILO.informacao }],
    [{ valor: id.geracao, estilo: ESTILO.informacao }],
    ...id.avisos.map((a) => [{ valor: a, estilo: ESTILO.aviso }]),
    [],
  ];
  const cab = (t: string) => ({ valor: t, estilo: ESTILO.cabecalhoDireita });
  linhas.push([
    { valor: "Linha", estilo: ESTILO.cabecalho },
    ...dados.meses.flatMap((m) => [cab(m.rotulo), cab("%")]),
    cab(ultimo.rotulo),
    cab("%"),
    cab("R$/m³"),
    cab(`TOTAL/${String(dados.ano).slice(2)}`),
    cab("%"),
    cab("R$/m³"),
  ]);
  const cabecalho = linhas.length;
  for (const l of dados.linhas.filter((x) => x.tipo !== "SECAO")) {
    const d = l.tipo !== "ITEM";
    const num = (v: number | null): Celula => (v === null ? { valor: null, estilo: d ? ESTILO.destaqueDireita : ESTILO.itemDireita } : { valor: v, estilo: d ? ESTILO.destaqueNumero : ESTILO.itemNumero });
    const per = (v: number | null): Celula => (v === null || l.volume ? { valor: null, estilo: d ? ESTILO.destaqueDireita : ESTILO.itemDireita } : { valor: v, estilo: d ? ESTILO.destaquePercentual : ESTILO.itemPercentual });
    const u = l.meses[l.meses.length - 1];
    linhas.push([
      { valor: l.descricao, estilo: d ? ESTILO.destaque : ESTILO.item },
      ...l.meses.flatMap((c) => [num(c.valor), per(c.pct)]),
      num(u.valor),
      per(u.pct),
      num(l.volume ? null : u.unitario),
      num(l.total.valor),
      per(l.total.pct),
      num(l.volume ? null : l.total.unitario),
    ]);
  }
  return {
    nome: b.nome,
    larguras: [48, ...dados.meses.flatMap(() => [15, 8]), 15, 8, 10, 16, 8, 10],
    linhas,
    linhaCabecalho: cabecalho,
    rodape: `Resultados ${dados.ano} · ${b.titulo}`,
    paisagem: true,
    congelarPrimeiraColuna: true,
  };
}

type Indicadores = Awaited<ReturnType<typeof indicadoresService.listar>>;
const NOME_DO_GRUPO: Record<string, string> = { GME: "Metas Estratégicas (GME)" };

function abaIndicadores(dados: Indicadores, id: Identificacao): AbaEscrita {
  const linhas: Celula[][] = [
    [{ valor: "Indicadores", estilo: ESTILO.titulo }],
    [{ valor: id.periodo, estilo: ESTILO.informacao }],
    [{ valor: id.geracao, estilo: ESTILO.informacao }],
    ...id.avisos.map((a) => [{ valor: a, estilo: ESTILO.aviso }]),
    [],
  ];
  const cab = (t: string, direita = false) => ({ valor: t, estilo: direita ? ESTILO.cabecalhoDireita : ESTILO.cabecalho });
  linhas.push([cab("Indicador"), cab("Nº"), cab("Sentido"), cab("Und."), cab("Metodologia"), ...dados.meses.map((m) => cab(m.rotulo, true)), cab("Acumulado", true)]);
  const cabecalho = linhas.length;
  let grupo = "";
  for (const i of dados.indicadores) {
    if (i.grupo !== grupo) {
      grupo = i.grupo;
      linhas.push([{ valor: (NOME_DO_GRUPO[grupo] ?? grupo).toUpperCase(), estilo: ESTILO.destaque }]);
    }
    const valor = (v: number | null): Celula =>
      !i.comFonte || v === null ? { valor: null, estilo: ESTILO.itemDireita } : { valor: v, estilo: i.unidade === "%" ? ESTILO.itemPercentual : ESTILO.itemNumero };
    linhas.push([
      { valor: i.nome, estilo: ESTILO.item },
      { valor: i.numero || null },
      { valor: i.sentido },
      { valor: i.unidade },
      { valor: i.comFonte ? i.metodologia : `${i.metodologia} (sem fonte na ferramenta)`, estilo: ESTILO.informacao },
      ...i.meses.map(valor),
      valor(i.total),
    ]);
  }
  return {
    nome: "Indicadores",
    larguras: [46, 7, 8, 12, 40, ...dados.meses.map(() => 14), 16],
    linhas,
    linhaCabecalho: cabecalho,
    rodape: `Indicadores ${dados.ano}`,
    paisagem: true,
    congelarPrimeiraColuna: true,
  };
}

// ---- PDF --------------------------------------------------------------------------------------

const CINZA: Cor = [75, 85, 99];
const CLARO: Cor = [107, 114, 128];
const AMBAR: Cor = [146, 64, 14];
const FUNDO: Cor = [243, 244, 246];
const TRACO: Cor = [156, 163, 175];
const M = 30;
const DIREITA = A4_PAISAGEM.largura - M;
const CORPO = 6.8;

/** Cabeçalho da página (título, período e avisos na primeira; "continuação" nas demais). */
function topo(doc: DocumentoPDF, titulo: string, id: Identificacao, primeira: boolean) {
  doc.novaPagina();
  let y = A4_PAISAGEM.altura - 36;
  if (primeira) {
    doc.texto(M, y, titulo, { fonte: "negrito", tamanho: 13 });
    y -= 14;
    doc.texto(M, y, id.periodo, { tamanho: 8, cor: CINZA });
    y -= 10;
    for (const a of id.avisos) {
      doc.texto(M, y, a, { tamanho: 8, cor: AMBAR });
      y -= 10;
    }
    return y - 6;
  }
  doc.texto(M, y, `${titulo} (continuação)`, { fonte: "negrito", tamanho: 9 });
  return y - 14;
}

function paginasResultados(doc: DocumentoPDF, b: Bloco, id: Identificacao) {
  const { dados } = b;
  const larguraDescricao = 190;
  const colunas = [...dados.meses.map((m) => m.rotulo), `TOTAL/${String(dados.ano).slice(2)}`, "%", "R$/m³"];
  const w = (DIREITA - M - larguraDescricao) / colunas.length;
  const x = (i: number) => M + larguraDescricao + w * (i + 1) - 3; // borda direita da coluna
  const ALTURA = 15;
  let y = 0;
  const cabecalho = () => {
    doc.retangulo(M, y - 4, DIREITA - M, 13, FUNDO);
    doc.texto(M + 3, y, "Linha", { fonte: "negrito", tamanho: CORPO });
    colunas.forEach((c, i) => doc.texto(x(i), y, c, { fonte: "negrito", tamanho: CORPO, alinhar: "direita" }));
    doc.linha(M, y - 4, DIREITA, y - 4, TRACO);
    y -= 15;
  };
  const titulo = `Resultados · ${b.titulo}`;
  y = topo(doc, titulo, id, true);
  cabecalho();
  for (const l of dados.linhas.filter((z) => z.tipo !== "SECAO")) {
    if (y < 40) {
      y = topo(doc, titulo, id, false);
      cabecalho();
    }
    const d = l.tipo !== "ITEM";
    const fonte: Fonte = d ? "negrito" : "normal";
    if (d) doc.retangulo(M, y - 9.5, DIREITA - M, ALTURA - 1, FUNDO);
    const xt = d ? M + 3 : M + 11;
    doc.texto(xt, y - 2, caber(l.descricao, fonte, CORPO, larguraDescricao - (xt - M) - 4), { fonte, tamanho: CORPO });
    const valor = (v: number | null) => (v === null ? "—" : l.volume ? n2.format(v) : n0.format(v));
    l.meses.forEach((c, i) => {
      // Sem a participação embaixo (linhas de volume), o valor fica na altura da descrição.
      doc.texto(x(i), l.volume ? y - 2 : y, valor(c.valor), { fonte, tamanho: CORPO, alinhar: "direita" });
      if (!l.volume && c.pct !== null) doc.texto(x(i), y - 7, pct(c.pct), { tamanho: 5.5, cor: CLARO, alinhar: "direita" });
    });
    const k = dados.meses.length;
    doc.texto(x(k), y - 2, valor(l.total.valor), { fonte, tamanho: CORPO, alinhar: "direita" });
    if (!l.volume && l.total.pct !== null) doc.texto(x(k + 1), y - 2, pct(l.total.pct), { tamanho: CORPO, alinhar: "direita" });
    if (!l.volume && l.total.unitario !== null) doc.texto(x(k + 2), y - 2, n2.format(l.total.unitario), { tamanho: CORPO, alinhar: "direita" });
    y -= ALTURA;
  }
}

function valorIndicador(unidade: string, v: number | null) {
  if (v === null) return "—";
  if (unidade === "%") return pct(v);
  if (unidade === "R$" || unidade === "colab." || unidade === "ocorr.") return n0.format(v);
  if (unidade === "pistas") return n1.format(v);
  return n2.format(v);
}

/** As setas não existem na fonte padrão do PDF (WinAnsi): o sentido vai por extenso. */
const SENTIDO_PDF: Record<string, string> = { "↑": "maior", "↓": "menor", "=": "=", "-": "-" };

function paginasIndicadores(doc: DocumentoPDF, dados: Indicadores, id: Identificacao) {
  const larguraNome = 230;
  const fixas = [
    { rotulo: "Sent.", w: 26 },
    { rotulo: "Und.", w: 52 },
  ];
  const colunas = [...dados.meses.map((m) => m.rotulo), "Acumulado"];
  const inicio = M + larguraNome + fixas.reduce((s, f) => s + f.w, 0);
  const w = (DIREITA - inicio) / colunas.length;
  const x = (i: number) => inicio + w * (i + 1) - 3;
  let y = 0;
  const cabecalho = () => {
    doc.retangulo(M, y - 4, DIREITA - M, 13, FUNDO);
    doc.texto(M + 3, y, "Indicador", { fonte: "negrito", tamanho: CORPO });
    doc.texto(M + larguraNome, y, "Sent.", { fonte: "negrito", tamanho: CORPO });
    doc.texto(M + larguraNome + fixas[0].w, y, "Und.", { fonte: "negrito", tamanho: CORPO });
    colunas.forEach((c, i) => doc.texto(x(i), y, c, { fonte: "negrito", tamanho: CORPO, alinhar: "direita" }));
    doc.linha(M, y - 4, DIREITA, y - 4, TRACO);
    y -= 15;
  };
  y = topo(doc, "Indicadores", id, true);
  cabecalho();
  let grupo = "";
  for (const i of dados.indicadores) {
    if (y < 48) {
      y = topo(doc, "Indicadores", id, false);
      cabecalho();
    }
    if (i.grupo !== grupo) {
      grupo = i.grupo;
      doc.retangulo(M, y - 4, DIREITA - M, 12, FUNDO);
      doc.texto(M + 3, y, (NOME_DO_GRUPO[grupo] ?? grupo).toUpperCase(), { fonte: "negrito", tamanho: CORPO });
      y -= 14;
    }
    const principal = i.numero === "";
    const fonte: Fonte = principal ? "negrito" : "normal";
    const cor: Cor = i.comFonte ? [17, 24, 39] : TRACO;
    const xt = principal ? M + 3 : M + 11;
    doc.texto(xt, y, caber(`${i.numero ? `${i.numero}  ` : ""}${i.nome}`, fonte, CORPO, larguraNome - (xt - M) - 4), { fonte, tamanho: CORPO, cor });
    doc.texto(xt, y - 7, caber(i.comFonte ? i.metodologia : `${i.metodologia} · sem fonte na ferramenta`, "normal", 5.5, larguraNome - (xt - M) - 4), { tamanho: 5.5, cor: CLARO });
    doc.texto(M + larguraNome, y, SENTIDO_PDF[i.sentido] ?? i.sentido, { tamanho: CORPO, cor: CINZA });
    doc.texto(M + larguraNome + fixas[0].w, y, i.unidade, { tamanho: CORPO, cor: CINZA });
    if (i.comFonte) {
      i.meses.forEach((v, k) => doc.texto(x(k), y, valorIndicador(i.unidade, v), { fonte, tamanho: CORPO, alinhar: "direita" }));
      doc.texto(x(i.meses.length), y, valorIndicador(i.unidade, i.total), { fonte: "negrito", tamanho: CORPO, alinhar: "direita" });
    }
    y -= 16;
  }
}

function rodapes(doc: DocumentoPDF, id: Identificacao) {
  for (let p = 1; p <= doc.total; p++) {
    doc.texto(M, 18, id.geracao, { tamanho: 6.5, cor: CINZA, pagina: p });
    doc.texto(DIREITA, 18, `Página ${p} de ${doc.total}`, { tamanho: 6.5, cor: CINZA, alinhar: "direita", pagina: p });
  }
}

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const limpar = (nome: string) => nome.replace(/[\\/:*?"<>|]/g, " ");

export const exportacaoRelatoriosService = {
  async resultados(ano: number, ate: number | undefined, escopo: EscopoResultados, formato: Formato, usuarioNome: string, acesso: Acesso = ACESSO_TOTAL) {
    // Sem `ate`, até o último mês apurado (como na tela).
    const bs = await blocos(ano, ate, escopo, acesso);
    if (bs.length === 0) throw new RelatorioError(404, "Nenhum centro de custo com valor para exportar.");
    const ultimo = bs[0].dados.ate;
    const id = await identificar(ano, ultimo, usuarioNome);
    const nomeVisao = escopo.tipo === "unidades" ? "todas as unidades" : escopo.tipo === "centros" ? "todos os centros de custo" : bs[0].nome;
    const titulo = `Resultados ${ano} - ${nomeVisao}`;
    const nomeArquivo = limpar(`Resultados ${ano} até ${String(ultimo).padStart(2, "0")} - ${nomeVisao}.${formato}`);
    if (formato === "xlsx") return { nomeArquivo, tipo: XLSX, conteudo: gerarXlsx(bs.map((b) => abaResultados(b, id)), titulo), visoes: bs.map((b) => b.nome) };
    const doc = new DocumentoPDF(A4_PAISAGEM);
    for (const b of bs) paginasResultados(doc, b, id);
    rodapes(doc, id);
    return { nomeArquivo, tipo: "application/pdf", conteudo: doc.gerar(titulo), visoes: bs.map((b) => b.nome) };
  },

  async indicadores(ano: number, ate: number | undefined, formato: Formato, usuarioNome: string) {
    const dados = await indicadoresService.listar(ano, ate);
    const id = await identificar(ano, dados.ate, usuarioNome);
    const titulo = `Indicadores ${ano}`;
    const nomeArquivo = limpar(`Indicadores ${ano} até ${String(dados.ate).padStart(2, "0")}.${formato}`);
    if (formato === "xlsx") return { nomeArquivo, tipo: XLSX, conteudo: gerarXlsx([abaIndicadores(dados, id)], titulo), visoes: ["Indicadores"] };
    const doc = new DocumentoPDF(A4_PAISAGEM);
    paginasIndicadores(doc, dados, id);
    rodapes(doc, id);
    return { nomeArquivo, tipo: "application/pdf", conteudo: doc.gerar(titulo), visoes: ["Indicadores"] };
  },
};

