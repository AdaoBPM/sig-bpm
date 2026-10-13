"use client";

import { useEffect } from "react";

import { haAlteracoesPendentes, MENSAGEM_SAIDA } from "@/lib/alteracoesPendentes";

/**
 * O aviso ao sair com alterações não gravadas (13/10/2026), em todas as telas: ao recarregar ou fechar a aba, o aviso
 * do navegador; ao clicar num link interno (o menu lateral, a barra do cenário ou das etapas, as migalhas, as abas com
 * link), a pergunta antes de sair. As navegações por código (a troca de cenário ou de mês, o Sair) perguntam com
 * `podeSair`. O voltar do navegador não pergunta (o Next não permite interromper essa navegação).
 */
export function AvisoDeSaida() {
  useEffect(() => {
    const aoDescarregar = (e: BeforeUnloadEvent) => {
      if (!haAlteracoesPendentes()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    // Na captura, antes do Link do Next: sem a confirmação, o clique não chega a ele.
    const aoClicar = (e: MouseEvent) => {
      if (!haAlteracoesPendentes() || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const destino = new URL(link.href, window.location.href);
      if (destino.origin !== window.location.origin) return; // fora da ferramenta: o aviso do navegador
      if (destino.pathname === window.location.pathname && destino.search === window.location.search) return;
      if (!window.confirm(MENSAGEM_SAIDA)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", aoDescarregar);
    document.addEventListener("click", aoClicar, true);
    return () => {
      window.removeEventListener("beforeunload", aoDescarregar);
      document.removeEventListener("click", aoClicar, true);
    };
  }, []);
  return null;
}
