"use client";

import { useState, type RefObject } from "react";
import { getFontEmbedCSS, toBlob } from "html-to-image";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

/** O fundo de verdade atrás do elemento (o do primeiro ancestral com cor), para a imagem ter o fundo da tela no tema escolhido. */
export function fundoAtras(no: HTMLElement) {
  for (let e: HTMLElement | null = no; e; e = e.parentElement) {
    const cor = getComputedStyle(e).backgroundColor;
    if (cor && cor !== "transparent" && !/^rgba\(.*,\s*0\)$/.test(cor)) return cor;
  }
  return "#ffffff";
}

/** As fontes da página para a imagem, lidas uma vez (as próximas cópias saem mais rápido); com erro, lê de novo na próxima. */
let fontes: Promise<string> | null = null;
export function fontesDaPagina(no: HTMLElement) {
  fontes ??= getFontEmbedCSS(no).catch(() => {
    fontes = null;
    return "";
  });
  return fontes;
}

/** Baixa o arquivo com o nome (sem os caracteres que o Windows não aceita). */
export function baixarArquivo(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome.replace(/[\\/:*?"<>|]/g, "-");
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * A imagem de uma tabela larga (22/10/2026: o Exportar de Resultados e dos cenários), do jeito que está na tela — os níveis e
 * os grupos abertos ou fechados, os meses recolhidos ou não —, mas inteira: todas as linhas e colunas, sem a rolagem, sem
 * os rótulos presos e sem os botões. Sai de uma cópia da tabela fora da tela (como o Copiar sem os Gráficos), em PNG,
 * com o fundo da tela e uma margem.
 */
export async function imagemDaTabela(raiz: HTMLElement): Promise<Blob> {
  const largura = Math.max(...[...raiz.querySelectorAll("table")].map((t) => t.scrollWidth), raiz.offsetWidth - 2) + 2;
  const caixa = document.createElement("div");
  caixa.setAttribute("aria-hidden", "true");
  caixa.style.cssText = "position: fixed; left: -100000px; top: 0; pointer-events: none;";
  const no = raiz.cloneNode(true) as HTMLElement;
  no.style.width = `${largura}px`;
  no.querySelectorAll<HTMLElement>("[data-topo-da-tabela], [data-corpo-da-tabela]").forEach((e) => {
    e.style.position = "static";
    e.style.overflow = "visible";
  });
  caixa.appendChild(no);
  (raiz.parentElement ?? document.body).appendChild(caixa);
  try {
    const margem = 16;
    const opcoes: Parameters<typeof toBlob>[1] = {
      width: no.offsetWidth + 2 * margem,
      height: no.offsetHeight + 2 * margem,
      backgroundColor: fundoAtras(raiz),
      style: { margin: "0", padding: `${margem}px`, width: `${no.offsetWidth + 2 * margem}px`, height: `${no.offsetHeight + 2 * margem}px` },
      // Os ícones (SVG) também: as lupas das consultas.
      filter: (n) => (n as Partial<HTMLOrSVGElement>).dataset?.foraDaImagem === undefined,
      fontEmbedCSS: await fontesDaPagina(no),
    };
    // Duas vezes, como no Copiar como Imagem: vale a segunda.
    await toBlob(no, opcoes);
    const b = await toBlob(no, opcoes);
    if (!b) throw new Error("Imagem vazia.");
    return b;
  } finally {
    caixa.remove();
  }
}

/**
 * O botão Copiar como Imagem (13/10/2026): o `alvo` inteiro (no Painel de Bordo, o grupo, com o nome e os cards; no
 * gráfico do indicador, o modal), sem os botões, numa imagem PNG, com o fundo de trás e uma margem, na área de
 * transferência, para colar num e-mail ou numa apresentação. Sem acesso à área de transferência (o endereço sem https,
 * ou o navegador sem suporte), baixa o arquivo. Fica de fora da imagem o que tem `data-fora-da-imagem` e o X do modal.
 *
 * `semGraficos` (14/10/2026; o ícone com um asterisco): os cards do grupo sem os gráficos, só com os valores, na largura
 * deles e com a borda de cada card. A imagem sai de uma cópia do grupo fora da tela, marcada com `data-sem-graficos`
 * (o globals.css tira o que tem `data-grafico-do-card` e estreita os cards), para a tela não piscar.
 */
export function CopiarComoImagem({
  alvo,
  nome,
  dica = "Copiar como imagem",
  semGraficos = false,
}: {
  alvo: RefObject<HTMLElement | null>;
  nome: string;
  dica?: string;
  semGraficos?: boolean;
}) {
  const [estado, setEstado] = useState<"livre" | "gerando" | "copiado">("livre");
  const copiar = async () => {
    const original = alvo.current;
    if (!original || estado === "gerando") return;
    setEstado("gerando");
    // Sem os gráficos: a cópia do grupo ao lado do original (com os mesmos estilos herdados), fora da tela.
    let no = original;
    let caixa: HTMLElement | null = null;
    if (semGraficos && original.parentElement) {
      caixa = document.createElement("div");
      caixa.setAttribute("aria-hidden", "true");
      caixa.style.cssText = "position: fixed; left: -100000px; top: 0; pointer-events: none;";
      no = original.cloneNode(true) as HTMLElement;
      no.dataset.semGraficos = "";
      caixa.appendChild(no);
      original.parentElement.appendChild(caixa);
    }
    const margem = 16;
    const largura = no.offsetWidth + 2 * margem;
    const altura = no.offsetHeight + 2 * margem;
    const gerar = async () => {
      const opcoes: Parameters<typeof toBlob>[1] = {
        width: largura,
        height: altura,
        backgroundColor: fundoAtras(original),
        style: { margin: "0", padding: `${margem}px`, width: `${largura}px`, height: `${altura}px` },
        filter: (n) => !(n instanceof HTMLElement && (n.dataset.foraDaImagem !== undefined || n.dataset.slot === "dialog-close")),
        fontEmbedCSS: await fontesDaPagina(no),
      };
      // Duas vezes (13/10/2026): a primeira só aquece o navegador, que às vezes desenha a primeira imagem sem uma parte
      // do conteúdo (a legenda saiu em branco no gráfico do indicador); vale a segunda.
      try {
        await toBlob(no, opcoes);
        const b = await toBlob(no, opcoes);
        if (!b) throw new Error("Imagem vazia.");
        return b;
      } finally {
        caixa?.remove();
      }
    };
    const imagem = gerar();
    try {
      // A promessa vai direto para a área de transferência, para a cópia valer como feita no clique.
      await navigator.clipboard.write([new ClipboardItem({ "image/png": imagem })]);
      toast.success(`${nome}: copiado como imagem.`);
      setEstado("copiado");
      setTimeout(() => setEstado("livre"), 2000);
      return;
    } catch {
      // Sem a área de transferência: baixa a imagem (abaixo).
    }
    try {
      const url = URL.createObjectURL(await imagem);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${nome.replace(/[\\/:*?"<>|]/g, "-")}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${nome}: o navegador não deixou copiar, a imagem foi baixada.`);
    } catch {
      toast.error("Não foi possível gerar a imagem.");
    }
    setEstado("livre");
  };
  const Icone = estado === "copiado" ? Check : Copy;
  return (
    <button
      type="button"
      data-fora-da-imagem
      onClick={copiar}
      disabled={estado === "gerando"}
      title={dica}
      aria-label={semGraficos ? `Copiar ${nome} como imagem (sem gráficos)` : `Copiar ${nome} como imagem`}
      className="relative inline-flex size-7 items-center justify-center rounded-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-wait disabled:opacity-60"
    >
      <Icone className="size-4" />
      {/* O asterisco do Sem os Gráficos (14/10/2026). */}
      {semGraficos && estado !== "copiado" ? <span className="absolute top-0 right-0 text-[11px] leading-none font-bold">*</span> : null}
    </button>
  );
}
