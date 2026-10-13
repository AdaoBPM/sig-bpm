"use client";

import { useSyncExternalStore } from "react";

import { CHAVE_TEMA } from "./temaScript";

/**
 * O tema da ferramenta (13/10/2026), escolhido no menu do usuário e guardado neste navegador:
 * - Padrão: o de sempre (o menu lateral preto, as telas claras);
 * - Claro: o menu lateral branco, separado das telas por uma sombra cinza clara;
 * - Escuro: as telas em cinza escuro, com os textos brancos e cinza-claros; as partes pretas e cinzas do orçado e do
 *   comparado ficam brancas e cinza-claras, com o texto preto.
 * O tema vai no atributo data-tema do <html> (e a classe dark, no Escuro); as cores ficam no globals.css.
 */
export type Tema = "padrao" | "claro" | "escuro";

const ouvintes = new Set<() => void>();

const lerTema = (): Tema => {
  const t = typeof document === "undefined" ? null : document.documentElement.dataset.tema;
  return t === "claro" || t === "escuro" ? t : "padrao";
};

export function aplicarTema(tema: Tema) {
  const html = document.documentElement;
  if (tema === "padrao") delete html.dataset.tema;
  else html.dataset.tema = tema;
  html.classList.toggle("dark", tema === "escuro");
  try {
    window.localStorage.setItem(CHAVE_TEMA, tema);
  } catch {
    // sem armazenamento: o tema vale só nesta visita
  }
  ouvintes.forEach((avisar) => avisar());
}

export function useTema(): [Tema, (t: Tema) => void] {
  const tema = useSyncExternalStore(
    (avisar) => {
      ouvintes.add(avisar);
      return () => ouvintes.delete(avisar);
    },
    lerTema,
    () => "padrao" as Tema,
  );
  return [tema, aplicarTema];
}

