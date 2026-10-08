/**
 * Escritor mínimo de PDF para relatório: texto em Helvetica (normal e negrito),
 * retângulos e linhas, em páginas A4. As fontes são as padrão do PDF, que todo
 * leitor tem, então nada é embutido. O texto vai em WinAnsiEncoding, que cobre
 * o português; caractere fora dela vira "?".
 *
 * Sem dependência: a exportação da DRE (Passo 26) é uma tabela de duas colunas,
 * e uma biblioteca de PDF traria fontes, imagens e layout que não usamos.
 */

export type Fonte = "normal" | "negrito";
export type Cor = [number, number, number];

export const A4 = { largura: 595.28, altura: 841.89 };
/** A4 deitada, para as tabelas largas (Resultados, Indicadores). */
export const A4_PAISAGEM = { largura: A4.altura, altura: A4.largura };

// Larguras da Helvetica e da Helvetica-Bold (AFM da Adobe), em milésimos do
// corpo, dos caracteres 32 a 126. Letras acentuadas usam a largura da letra base.
const LARGURAS: Record<Fonte, number[]> = {
  normal: [
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
  ],
  negrito: [
    278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
    975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
    333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
  ],
};
const ESPECIAIS: Record<string, { codigo: number; largura: number }> = {
  "€": { codigo: 0x80, largura: 556 },
  "…": { codigo: 0x85, largura: 1000 },
  "•": { codigo: 0x95, largura: 350 },
  "–": { codigo: 0x96, largura: 556 },
  "—": { codigo: 0x97, largura: 1000 },
  "‘": { codigo: 0x91, largura: 222 },
  "’": { codigo: 0x92, largura: 222 },
  "“": { codigo: 0x93, largura: 333 },
  "”": { codigo: 0x94, largura: 333 },
};

/** O espaço entre "R$" e o número na moeda formatada (Intl, pt-BR). */
const ESPACO_SEM_QUEBRA = String.fromCharCode(0xa0);

function larguraDoCaractere(ch: string, fonte: Fonte) {
  const especial = ESPECIAIS[ch];
  if (especial) return especial.largura;
  const c = ch.charCodeAt(0);
  if (c >= 32 && c <= 126) return LARGURAS[fonte][c - 32];
  const base = ch.normalize("NFD")[0];
  const b = base.charCodeAt(0);
  if (b >= 32 && b <= 126) return LARGURAS[fonte][b - 32];
  if (ch === "·" || ch === ESPACO_SEM_QUEBRA) return 278;
  if (ch === "²" || ch === "³" || ch === "¹") return 333;
  if (ch === "º" || ch === "ª") return 365;
  if (ch === "°") return 400;
  return 556;
}

/** Largura do texto, em pontos. */
export function largura(texto: string, fonte: Fonte, tamanho: number) {
  let soma = 0;
  for (const ch of texto) soma += larguraDoCaractere(ch, fonte);
  return (soma * tamanho) / 1000;
}

/** Corta o texto com reticências para caber na largura. */
export function caber(texto: string, fonte: Fonte, tamanho: number, maximo: number) {
  if (largura(texto, fonte, tamanho) <= maximo) return texto;
  let t = texto;
  while (t.length > 1 && largura(`${t}…`, fonte, tamanho) > maximo) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** O texto como string literal do PDF: WinAnsi, com os bytes altos em octal para o arquivo ficar ASCII. */
function literal(texto: string) {
  let s = "";
  for (const ch of texto) {
    const especial = ESPECIAIS[ch];
    const c = especial ? especial.codigo : ch.charCodeAt(0);
    if (ch === "(" || ch === ")" || ch === "\\") s += `\\${ch}`;
    else if (c >= 32 && c <= 126) s += ch;
    else if ((c >= 0xa0 && c <= 0xff) || especial) s += `\\${c.toString(8).padStart(3, "0")}`;
    else s += "?";
  }
  return `(${s})`;
}

const num = (n: number) => (Math.round(n * 100) / 100).toString();
const cor = ([r, g, b]: Cor) => `${num(r / 255)} ${num(g / 255)} ${num(b / 255)}`;

export class DocumentoPDF {
  private paginas: string[][] = [];

  constructor(readonly pagina: { largura: number; altura: number } = A4) {}

  get total() {
    return this.paginas.length;
  }

  /** Abre uma página nova; os desenhos seguintes vão para ela. */
  novaPagina() {
    this.paginas.push([]);
    return this.paginas.length;
  }

  /** Desenha na página indicada (a partir de 1), ou na última. */
  private em(pagina?: number) {
    return this.paginas[(pagina ?? this.paginas.length) - 1];
  }

  /** Texto com a linha de base em y (y cresce para cima, a partir do pé da página). */
  texto(x: number, y: number, t: string, o: { fonte?: Fonte; tamanho?: number; cor?: Cor; alinhar?: "esquerda" | "direita"; pagina?: number } = {}) {
    const fonte = o.fonte ?? "normal";
    const tamanho = o.tamanho ?? 9;
    const x0 = o.alinhar === "direita" ? x - largura(t, fonte, tamanho) : x;
    this.em(o.pagina).push(`BT ${cor(o.cor ?? [17, 24, 39])} rg /${fonte === "negrito" ? "F2" : "F1"} ${num(tamanho)} Tf ${num(x0)} ${num(y)} Td ${literal(t)} Tj ET`);
  }

  retangulo(x: number, y: number, w: number, h: number, preenchimento: Cor) {
    this.em().push(`${cor(preenchimento)} rg ${num(x)} ${num(y)} ${num(w)} ${num(h)} re f`);
  }

  linha(x1: number, y1: number, x2: number, y2: number, traco: Cor, espessura = 0.5) {
    this.em().push(`${cor(traco)} RG ${num(espessura)} w ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S`);
  }

  /** O arquivo PDF. */
  gerar(titulo: string): Uint8Array {
    const objetos: string[] = [];
    const n = this.paginas.length;
    // 1 catálogo, 2 páginas, 3 e 4 fontes, 5 informações; depois, página e conteúdo de cada uma.
    const idPagina = (i: number) => 6 + i * 2;
    objetos[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objetos[2] = `<< /Type /Pages /Count ${n} /Kids [${this.paginas.map((_, i) => `${idPagina(i)} 0 R`).join(" ")}] >>`;
    objetos[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objetos[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
    const d = new Date();
    const data = `D:${d.getUTCFullYear()}${[d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()].map((x) => String(x).padStart(2, "0")).join("")}Z`;
    objetos[5] = `<< /Title ${literal(titulo)} /Producer (SIG BPM) /CreationDate (${data}) >>`;
    this.paginas.forEach((comandos, i) => {
      const conteudo = comandos.join("\n");
      objetos[idPagina(i)] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.pagina.largura} ${this.pagina.altura}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${idPagina(i) + 1} 0 R >>`;
      objetos[idPagina(i) + 1] = `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`;
    });

    // Tudo é ASCII (o texto vai em octal), então o tamanho em caracteres é o tamanho em bytes.
    let pdf = "%PDF-1.4\n";
    const posicoes: number[] = [];
    for (let id = 1; id < objetos.length; id++) {
      posicoes[id] = pdf.length;
      pdf += `${id} 0 obj\n${objetos[id]}\nendobj\n`;
    }
    const xref = pdf.length;
    pdf += `xref\n0 ${objetos.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < objetos.length; id++) pdf += `${String(posicoes[id]).padStart(10, "0")} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objetos.length} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return new TextEncoder().encode(pdf);
  }
}
