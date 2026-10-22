/**
 * Um PDF com uma imagem JPEG por página (22/10/2026: a exportação dos Relatórios Executivos em PDF), sem biblioteca: cada
 * página tem o tamanho da imagem (na largura `largura`, em pontos, e a altura na proporção dela) e a imagem a cobre
 * inteira. O JPEG entra como está (DCTDecode), sem recompressão.
 */
export type PaginaDeImagem = { jpeg: Uint8Array; largura: number; altura: number };

export function pdfDeImagens(paginas: PaginaDeImagem[], larguraEmPontos = 960): Blob {
  const texto = new TextEncoder();
  const partes: Uint8Array[] = [];
  const posicoes: number[] = [];
  let tamanho = 0;
  const escrever = (p: string | Uint8Array) => {
    const b = typeof p === "string" ? texto.encode(p) : p;
    partes.push(b);
    tamanho += b.length;
  };
  // Os objetos: 1 o catálogo, 2 as páginas; cada página usa três (a página, o conteúdo e a imagem).
  const objeto = (n: number, corpo: () => void) => {
    posicoes[n] = tamanho;
    escrever(`${n} 0 obj\n`);
    corpo();
    escrever("\nendobj\n");
  };
  escrever("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const kids = paginas.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  objeto(1, () => escrever("<< /Type /Catalog /Pages 2 0 R >>"));
  objeto(2, () => escrever(`<< /Type /Pages /Kids [${kids}] /Count ${paginas.length} >>`));
  paginas.forEach((p, i) => {
    const n = 3 + i * 3;
    const w = larguraEmPontos;
    const h = Math.round((larguraEmPontos * p.altura) / p.largura * 100) / 100;
    const conteudo = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    objeto(n, () => escrever(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${n + 2} 0 R >> >> /Contents ${n + 1} 0 R >>`));
    objeto(n + 1, () => escrever(`<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`));
    objeto(n + 2, () => {
      escrever(`<< /Type /XObject /Subtype /Image /Width ${p.largura} /Height ${p.altura} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
      escrever(p.jpeg);
      escrever("\nendstream");
    });
  });
  const total = posicoes.length;
  const xref = tamanho;
  escrever(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let n = 1; n < total; n++) escrever(`${String(posicoes[n]).padStart(10, "0")} 00000 n \n`);
  escrever(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(partes as BlobPart[], { type: "application/pdf" });
}
