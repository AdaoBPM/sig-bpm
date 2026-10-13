"use client";

import { useEffect } from "react";

/**
 * As alterações não gravadas (13/10/2026): os formulários com algo digitado e ainda não gravado se registram aqui; ao
 * sair da tela (um link, a troca de cenário ou de mês, o Sair, recarregar ou fechar a aba), a ferramenta pergunta antes
 * (AvisoDeSaida, no layout). Nos modais com `avisoAoSair`, também ao fechá-los pelo X, pelo Esc ou clicando fora.
 */
const pendentes = new Set<symbol>();

export const MENSAGEM_SAIDA = "Há alterações não gravadas nesta tela. Sair e perder essas alterações?";
export const MENSAGEM_MODAL = "Há alterações não gravadas neste modal. Fechar e perder essas alterações?";

export const haAlteracoesPendentes = () => pendentes.size > 0;

/** Pergunta antes de sair quando há alterações não gravadas; true: pode sair. */
export function podeSair(mensagem = MENSAGEM_SAIDA): boolean {
  return !haAlteracoesPendentes() || window.confirm(mensagem);
}

/** Registra o formulário enquanto `sujo` (algo digitado e não gravado). */
export function useAlteracoesPendentes(sujo: boolean) {
  useEffect(() => {
    if (!sujo) return;
    const id = Symbol("alteracao");
    pendentes.add(id);
    return () => {
      pendentes.delete(id);
    };
  }, [sujo]);
}
