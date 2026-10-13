"use client";

import { usePathname } from "next/navigation";

import { DO_TIPO, tipoDaRota } from "../services/cenariosService";

/**
 * O tipo do cenário da tela aberta (13/10/2026), pela rota: /cenarios/sinteticos ou /cenarios/analiticos. Dá o caminho
 * das telas, o nome da lista e as permissões do tipo (as telas dos dois tipos são as mesmas).
 */
export function useTipoDoCenario() {
  const tipo = tipoDaRota(usePathname() ?? "");
  return { tipo, ...DO_TIPO[tipo] };
}
