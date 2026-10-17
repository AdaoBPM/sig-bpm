"use client";

import { useSyncExternalStore } from "react";

/**
 * A acessibilidade (16/10/2026; antes, a lista Cores do Configurar Gráficos dos painéis), escolhida no menu do usuário e
 * guardada neste navegador:
 * - Padrão: os destaques bons em verde;
 * - Daltonismo: em azul, no lugar do verde (os sinais e a legenda dos Painéis de Bordo, as anotações positivas e os
 *   cards dos Relatórios Executivos).
 * A chave e os valores guardados são os da antiga lista Cores, para manter a escolha já feita nos navegadores.
 */
export type Acessibilidade = "padrao" | "daltonismo";

const CHAVE = "sig.painel.cores";
const ouvintes = new Set<() => void>();

const ler = (): Acessibilidade => {
  try {
    return window.localStorage.getItem(CHAVE) === "daltonismo" ? "daltonismo" : "padrao";
  } catch {
    // Sem armazenamento (janela privada): o padrão.
    return "padrao";
  }
};

function escolher(a: Acessibilidade) {
  try {
    window.localStorage.setItem(CHAVE, a);
  } catch {
    // Sem armazenamento: a escolha vale só nesta visita (e não é lembrada).
  }
  ouvintes.forEach((avisar) => avisar());
}

export function useAcessibilidade(): [Acessibilidade, (a: Acessibilidade) => void] {
  const a = useSyncExternalStore(
    (avisar) => {
      ouvintes.add(avisar);
      // Outra aba do navegador mudou a escolha.
      const aoGuardar = (e: StorageEvent) => (e.key === CHAVE ? avisar() : undefined);
      window.addEventListener("storage", aoGuardar);
      return () => {
        ouvintes.delete(avisar);
        window.removeEventListener("storage", aoGuardar);
      };
    },
    ler,
    () => "padrao" as Acessibilidade,
  );
  return [a, escolher];
}
