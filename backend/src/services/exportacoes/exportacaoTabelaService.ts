import { limparNome } from "../../lib/arquivosExportados.js";
import { A4_PAISAGEM, caber, type Cor, DocumentoPDF, largura } from "../../lib/pdfEscrita.js";
import { type Celula, ESTILO, gerarXlsx, nomesDasAbas } from "../../lib/xlsxEscrita.js";

/**
 * O Exportar das tabelas das telas (30/10/2026, pedido do Adão): a tabela como está na tela — as colunas e as linhas que
 * os filtros dos rótulos deixam, na ordem escolhida — em Excel (uma aba, com o cabeçalho preso e os números como números)
 * ou em PDF (A4 deitada, com o cabeçalho repetido em cada página), no padrão das demais exportações do SIG. A tela manda o
 * que mostra; o servidor só monta o arquivo (nenhum dado sai do banco aqui).
 */

export type TipoDaColuna = "texto" | "numero" | "moeda";
export type TabelaExportada = {
  titulo: string;
  subtitulo: string | null;
  colunas: Array<{ rotulo: string; tipo: TipoDaColuna }>;
  /** Cada célula: o texto da tela e, nas colunas de número e de moeda, o número. */
  linhas: Array<Array<{ texto: string; numero: number | null }>>;
};

const dataHora = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d).replace(",", "");

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** A planilha: o título, o subtítulo e quem gerou, uma linha em branco, o cabeçalho e as linhas. */
function planilha(t: TabelaExportada, geracao: string) {
  // As colunas de número só com inteiros (o Nº, a filial) ficam sem casas; as demais, com duas.
  const inteiras = t.colunas.map((c, i) => c.tipo === "numero" && t.linhas.every((l) => l[i]?.numero === null || l[i]?.numero === undefined || Number.isInteger(l[i].numero)));
  const celula = (i: number, x: { texto: string; numero: number | null } | undefined): Celula => {
    const c = t.colunas[i];
    if (!x) return { valor: null };
    if (c.tipo === "texto" || x.numero === null) return { valor: x.texto || null, estilo: c.tipo === "texto" ? ESTILO.padrao : ESTILO.itemDireita };
    return { valor: x.numero, estilo: c.tipo === "moeda" ? ESTILO.itemMoeda : inteiras[i] ? ESTILO.itemDireita : ESTILO.itemNumero };
  };
  const linhas: Celula[][] = [
    [{ valor: t.titulo, estilo: ESTILO.titulo }],
    ...(t.subtitulo ? [[{ valor: t.subtitulo, estilo: ESTILO.informacao }]] : []),
    [{ valor: geracao, estilo: ESTILO.informacao }],
    [],
  ];
  const linhaCabecalho = linhas.length + 1;
  linhas.push(t.colunas.map((c) => ({ valor: c.rotulo, estilo: c.tipo === "texto" ? ESTILO.cabecalho : ESTILO.cabecalhoDireita })));
  for (const l of t.linhas) linhas.push(t.colunas.map((_, i) => celula(i, l[i])));
  // A largura de cada coluna: o maior texto (o rótulo e as células), entre 8 e 60 caracteres.
  const larguras = t.colunas.map((c, i) => Math.min(60, Math.max(8, c.rotulo.length + 2, ...t.linhas.map((l) => (l[i]?.texto.length ?? 0) + 2))));
  return { nome: nomesDasAbas([t.titulo])[0], larguras, linhas, linhaCabecalho, rodape: t.titulo, paisagem: t.colunas.length > 6 };
}

// ---- PDF (o padrão dos Resultados e dos Indicadores) ----------------------------------------------------------------

const CINZA: Cor = [75, 85, 99];
const FUNDO: Cor = [243, 244, 246];
const TRACO: Cor = [156, 163, 175];
const LINHA: Cor = [229, 231, 235];
const M = 30;
const DIREITA = A4_PAISAGEM.largura - M;
const CORPO = 6.8;
const ALTURA = 12;

/** As larguras das colunas no PDF: a natural (o maior texto, até 220 pt), encolhida quando não cabe na página. */
function largurasNoPdf(t: TabelaExportada) {
  const naturais = t.colunas.map((c, i) => {
    const maior = Math.max(largura(c.rotulo, "negrito", CORPO), ...t.linhas.map((l) => largura(l[i]?.texto ?? "", "normal", CORPO)));
    return Math.min(220, Math.max(24, maior + 8));
  });
  const soma = naturais.reduce((s, x) => s + x, 0);
  const fator = Math.min(1, (DIREITA - M) / soma);
  return naturais.map((x) => x * fator);
}

function pdf(t: TabelaExportada, geracao: string) {
  const doc = new DocumentoPDF(A4_PAISAGEM);
  const ws = largurasNoPdf(t);
  const xs = ws.map((_, i) => M + ws.slice(0, i).reduce((s, x) => s + x, 0));
  // O fim da tabela (o fundo do cabeçalho e os traços vão até ele, não até a margem).
  const fim = M + ws.reduce((s, x) => s + x, 0);
  const direita = (i: number) => t.colunas[i].tipo !== "texto";
  let y = 0;
  const cabecalho = () => {
    doc.retangulo(M, y - 4, fim - M, 13, FUNDO);
    t.colunas.forEach((c, i) => {
      const r = caber(c.rotulo, "negrito", CORPO, ws[i] - 6);
      doc.texto(direita(i) ? xs[i] + ws[i] - 3 : xs[i] + 3, y, r, { fonte: "negrito", tamanho: CORPO, alinhar: direita(i) ? "direita" : "esquerda" });
    });
    doc.linha(M, y - 4, fim, y - 4, TRACO);
    y -= 14;
  };
  const topo = (primeira: boolean) => {
    doc.novaPagina();
    y = A4_PAISAGEM.altura - 36;
    if (primeira) {
      doc.texto(M, y, t.titulo, { fonte: "negrito", tamanho: 13 });
      y -= 14;
      if (t.subtitulo) {
        doc.texto(M, y, caber(t.subtitulo, "normal", 8, DIREITA - M), { tamanho: 8, cor: CINZA });
        y -= 10;
      }
      doc.texto(M, y, `${t.linhas.length.toLocaleString("pt-BR")} ${t.linhas.length === 1 ? "linha" : "linhas"}`, { tamanho: 8, cor: CINZA });
      y -= 16;
    } else {
      doc.texto(M, y, `${t.titulo} (continuação)`, { fonte: "negrito", tamanho: 9 });
      y -= 14;
    }
    cabecalho();
  };
  topo(true);
  for (const l of t.linhas) {
    if (y < 40) topo(false);
    t.colunas.forEach((_, i) => {
      const texto = caber(l[i]?.texto ?? "", "normal", CORPO, ws[i] - 6);
      if (texto) doc.texto(direita(i) ? xs[i] + ws[i] - 3 : xs[i] + 3, y, texto, { tamanho: CORPO, alinhar: direita(i) ? "direita" : "esquerda" });
    });
    doc.linha(M, y - 4, fim, y - 4, LINHA, 0.3);
    y -= ALTURA;
  }
  for (let p = 1; p <= doc.total; p++) {
    doc.texto(M, 18, geracao, { tamanho: 6.5, cor: CINZA, pagina: p });
    doc.texto(DIREITA, 18, `Página ${p} de ${doc.total}`, { tamanho: 6.5, cor: CINZA, alinhar: "direita", pagina: p });
  }
  return doc.gerar(t.titulo);
}

export function exportarTabela(t: TabelaExportada, formato: "xlsx" | "pdf", usuarioNome: string) {
  const geracao = `Gerado em ${dataHora(new Date())} por ${usuarioNome} · SIG BPM`;
  // A barra do mês vira hífen no nome do arquivo ("09/2026" → "09-2026"); o resto, como o título.
  const nomeArquivo = `${limparNome(t.titulo.replaceAll("/", "-"))}.${formato}`;
  if (formato === "xlsx") return { nomeArquivo, tipo: XLSX, conteudo: gerarXlsx([planilha(t, geracao)], t.titulo) };
  return { nomeArquivo, tipo: "application/pdf", conteudo: pdf(t, geracao) };
}
