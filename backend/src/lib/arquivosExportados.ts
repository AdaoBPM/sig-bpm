import { zipSync } from "fflate";

/**
 * Os nomes e os pacotes dos arquivos exportados (14/10/2026): o nome sem os caracteres que o Windows não aceita, o
 * departamento de um centro de custo como nome (para os arquivos de cada centro) e o ZIP com um arquivo por centro.
 */

/** O nome de um arquivo: sem \ / : * ? " < > | e sem espaços repetidos. */
export const limparNome = (nome: string) => nome.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();

const MINUSCULAS = new Set(["a", "o", "as", "os", "e", "de", "da", "do", "das", "dos", "em", "na", "no", "para", "por"]);

/** "CUSTOS DE PRODUÇÃO (CP)" → "Custos de Produção (CP)": o departamento do cadastro, com iniciais maiúsculas. */
export function nomeDoDepartamento(departamento: string | null | undefined) {
  if (!departamento?.trim()) return "Sem Departamento";
  let parenteses = 0;
  return departamento
    .trim()
    .split(/\s+/)
    .map((p, i) => {
      const dentro = parenteses > 0 || p.startsWith("(");
      for (const c of p) parenteses += c === "(" ? 1 : c === ")" ? -1 : 0;
      if (dentro) return p;
      const m = p.toLocaleLowerCase("pt-BR");
      return i > 0 && MINUSCULAS.has(m) ? m : m.charAt(0).toLocaleUpperCase("pt-BR") + m.slice(1);
    })
    .join(" ");
}

/** O ZIP com os arquivos (um por centro de custo); nomes repetidos ganham " (2)", " (3)"… */
export function zipDeArquivos(arquivos: Array<{ nome: string; conteudo: Uint8Array }>) {
  const usados = new Set<string>();
  const entradas: Record<string, Uint8Array> = {};
  for (const a of arquivos) {
    const ponto = a.nome.lastIndexOf(".");
    const base = limparNome(ponto > 0 ? a.nome.slice(0, ponto) : a.nome);
    const ext = ponto > 0 ? a.nome.slice(ponto) : "";
    let nome = `${base}${ext}`;
    for (let i = 2; usados.has(nome.toLowerCase()); i++) nome = `${base} (${i})${ext}`;
    usados.add(nome.toLowerCase());
    entradas[nome] = a.conteudo;
  }
  return zipSync(entradas, { level: 6 });
}

export const TIPO_ZIP = "application/zip";
