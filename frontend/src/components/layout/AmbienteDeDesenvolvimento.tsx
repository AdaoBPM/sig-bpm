"use client";

import { useEffect } from "react";

/**
 * A marca do ambiente de desenvolvimento (15/10/2026): a porta 3100 (`next dev`) tem a borda vermelha em volta da tela,
 * a etiqueta "Desenvolvimento" antes do caminho e, desde 17/10/2026, o ícone da aba do navegador em vermelho, para não
 * se confundir com a produção (porta 3000, `next start`, sem a marca). O NODE_ENV entra no código na compilação:
 * "development" no next dev, "production" no build.
 */
export const EH_DESENVOLVIMENTO = process.env.NODE_ENV === "development";

/** A borda vermelha em volta da tela, por cima de tudo e sem pegar os cliques, e o ícone vermelho da aba. */
export function BordaDoDesenvolvimento() {
  if (!EH_DESENVOLVIMENTO) return null;
  return (
    <>
      <IconeDoDesenvolvimento />
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[200] border-4 border-red-600" />
    </>
  );
}

/**
 * O ícone da aba em vermelho (17/10/2026): o favicon de sempre, redesenhado com as partes escuras em vermelho, num
 * `<link rel="icon">` no fim do head (o navegador usa o último).
 */
function IconeDoDesenvolvimento() {
  useEffect(() => {
    let cancelado = false;
    const imagem = new Image();
    imagem.onload = () => {
      if (cancelado) return;
      const tamanho = 64;
      const tela = document.createElement("canvas");
      tela.width = tela.height = tamanho;
      const ctx = tela.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(imagem, 0, 0, tamanho, tamanho);
      const px = ctx.getImageData(0, 0, tamanho, tamanho);
      for (let k = 0; k < px.data.length; k += 4) {
        // As partes escuras (o círculo preto) viram o vermelho da borda (red-600); as claras ficam.
        if (px.data[k + 3] > 0 && px.data[k] + px.data[k + 1] + px.data[k + 2] < 384) {
          px.data[k] = 220;
          px.data[k + 1] = 38;
          px.data[k + 2] = 38;
        }
      }
      ctx.putImageData(px, 0, 0);
      const link = document.createElement("link");
      link.rel = "icon";
      link.type = "image/png";
      link.dataset.desenvolvimento = "";
      link.href = tela.toDataURL("image/png");
      document.head.appendChild(link);
    };
    imagem.src = "/favicon.ico";
    return () => {
      cancelado = true;
      document.head.querySelectorAll("link[data-desenvolvimento]").forEach((l) => l.remove());
    };
  }, []);
  return null;
}

/** A etiqueta antes do caminho das telas. */
export function EtiquetaDoDesenvolvimento() {
  if (!EH_DESENVOLVIMENTO) return null;
  return (
    <span title="Ambiente de desenvolvimento (porta 3100), com a cópia do banco" className="shrink-0 rounded-sm bg-red-800 px-2 py-0.5 text-xs font-bold text-white">
      Desenvolvimento
    </span>
  );
}
