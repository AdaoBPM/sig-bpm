"use client";

import { createContext, useSyncExternalStore, type ReactNode } from "react";

/**
 * A tela padrão dos relatórios (27/10/2026, pedido do Adão): o slide se monta sempre em 1920 × 1080 — a tela em que os
 * relatórios vinham sendo montados — e, na apresentação, se reduz ou se amplia por inteiro para caber na tela de quem abre,
 * com a mesma aparência e os blocos nos mesmos lugares. Antes, a grade tinha a largura e as linhas da tela de quem abria:
 * num monitor menor, cabiam menos linhas, e os blocos de baixo ficavam fora da tela.
 */
export const TELA_PADRAO = { largura: 1920, altura: 1080 } as const;

/** Dentro do slide em escala: a ampliação de um bloco se mede pela tela padrão (a caixa do slide), e não pela janela. */
export const NaTelaPadrao = createContext(false);

const assinarJanela = (aviso: () => void) => {
  window.addEventListener("resize", aviso);
  return () => window.removeEventListener("resize", aviso);
};
const daJanela = () => `${window.innerWidth}x${window.innerHeight}`;

/**
 * O slide na tela de quem abre: a caixa de 1920 × 1080, reduzida ou ampliada (transform) até o maior tamanho que cabe
 * na janela, centralizada; o que sobra, na proporção diferente da tela, fica no fundo da página.
 */
export function TelaNaEscala({ children }: { children: ReactNode }) {
  const janela = useSyncExternalStore(assinarJanela, daJanela, () => `${TELA_PADRAO.largura}x${TELA_PADRAO.altura}`);
  const [w, h] = janela.split("x").map(Number);
  const escala = Math.min(w / TELA_PADRAO.largura, h / TELA_PADRAO.altura) || 1;
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
      <div
        data-tela-padrao
        className="relative shrink-0 overflow-hidden"
        style={{ width: TELA_PADRAO.largura, height: TELA_PADRAO.altura, transform: escala === 1 ? undefined : `scale(${escala})` }}
      >
        <NaTelaPadrao.Provider value>{children}</NaTelaPadrao.Provider>
      </div>
    </div>
  );
}
