"use client";

import { useCallback, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

/**
 * A aba que o usuário olhava, lembrada ao recarregar a página (30/10/2026, pedido do Adão): guardada na sessão do
 * navegador (sessionStorage), por tela (o endereço) e por chave, com uma cópia na memória para quando o navegador não
 * deixa guardar. Uma aba guardada que não vale mais (fora de `validas`) volta à padrão. Vale na mesma aba do navegador:
 * uma aba nova do navegador começa na padrão.
 */
const memoria = new Map<string, string>();
const ouvintes = new Set<() => void>();
const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
};
function ler(id: string): string | null {
  const m = memoria.get(id);
  if (m !== undefined) return m;
  try {
    return sessionStorage.getItem(id);
  } catch {
    return null;
  }
}

export function useAbaLembrada<T extends string = string>(chave: string, padrao: NoInfer<T>, validas?: readonly string[] | ((aba: string) => boolean)): [T, (aba: T) => void] {
  const pathname = usePathname();
  const id = `sig:aba:${pathname}:${chave}`;
  // No servidor (e na primeira pintura), a padrão; depois, a guardada.
  const guardada = useSyncExternalStore(assinar, () => ler(id), () => null);
  const vale = guardada !== null && (!validas || (typeof validas === "function" ? validas(guardada) : validas.includes(guardada)));
  const mudar = useCallback(
    (aba: T) => {
      memoria.set(id, aba);
      try {
        sessionStorage.setItem(id, aba);
      } catch {
        // Sem a sessão do navegador (modo privado, bloqueio): fica só na memória, até recarregar.
      }
      for (const f of ouvintes) f();
    },
    [id],
  );
  return [(vale ? guardada : padrao) as T, mudar];
}
