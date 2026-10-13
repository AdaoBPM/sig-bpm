"use client";

import { useState, type RefObject } from "react";
import { getFontEmbedCSS, toBlob } from "html-to-image";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

/** O fundo de verdade atrás do elemento (o do primeiro ancestral com cor), para a imagem ter o fundo da tela no tema escolhido. */
function fundoAtras(no: HTMLElement) {
  for (let e: HTMLElement | null = no; e; e = e.parentElement) {
    const cor = getComputedStyle(e).backgroundColor;
    if (cor && cor !== "transparent" && !/^rgba\(.*,\s*0\)$/.test(cor)) return cor;
  }
  return "#ffffff";
}

/** As fontes da página para a imagem, lidas uma vez (as próximas cópias saem mais rápido); com erro, lê de novo na próxima. */
let fontes: Promise<string> | null = null;
function fontesDaPagina(no: HTMLElement) {
  fontes ??= getFontEmbedCSS(no).catch(() => {
    fontes = null;
    return "";
  });
  return fontes;
}

/**
 * O botão Copiar como Imagem (13/10/2026): o `alvo` inteiro (no Painel de Bordo, o grupo, com o nome e os cards; no
 * gráfico do indicador, o modal), sem os botões, numa imagem PNG, com o fundo de trás e uma margem, na área de
 * transferência, para colar num e-mail ou numa apresentação. Sem acesso à área de transferência (o endereço sem https,
 * ou o navegador sem suporte), baixa o arquivo. Fica de fora da imagem o que tem `data-fora-da-imagem` e o X do modal.
 */
export function CopiarComoImagem({ alvo, nome, dica = "Copiar como imagem" }: { alvo: RefObject<HTMLElement | null>; nome: string; dica?: string }) {
  const [estado, setEstado] = useState<"livre" | "gerando" | "copiado">("livre");
  const copiar = async () => {
    const no = alvo.current;
    if (!no || estado === "gerando") return;
    setEstado("gerando");
    const margem = 16;
    const largura = no.offsetWidth + 2 * margem;
    const altura = no.offsetHeight + 2 * margem;
    const gerar = async () => {
      const opcoes: Parameters<typeof toBlob>[1] = {
        width: largura,
        height: altura,
        backgroundColor: fundoAtras(no),
        style: { margin: "0", padding: `${margem}px`, width: `${largura}px`, height: `${altura}px` },
        filter: (n) => !(n instanceof HTMLElement && (n.dataset.foraDaImagem !== undefined || n.dataset.slot === "dialog-close")),
        fontEmbedCSS: await fontesDaPagina(no),
      };
      // Duas vezes (13/10/2026): a primeira só aquece o navegador, que às vezes desenha a primeira imagem sem uma parte
      // do conteúdo (a legenda saiu em branco no gráfico do indicador); vale a segunda.
      await toBlob(no, opcoes);
      const b = await toBlob(no, opcoes);
      if (!b) throw new Error("Imagem vazia.");
      return b;
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
      aria-label={`Copiar ${nome} como imagem`}
      className="inline-flex size-7 items-center justify-center rounded-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-wait disabled:opacity-60"
    >
      <Icone className="size-4" />
    </button>
  );
}
