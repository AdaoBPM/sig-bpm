"use client";

import { usePathname } from "next/navigation";

import { DO_TIPO, tipoDaRota } from "../services/cenariosService";

/**
 * O tipo do cenário da tela aberta (13/10/2026), pela rota: /cenarios/sinteticos ou /cenarios/analiticos. Dá o caminho
 * das telas, o nome da lista e as permissões do tipo (as telas dos dois tipos são as mesmas; por tela e aba, perm).
 */
export function useTipoDoCenario() {
  const tipo = tipoDaRota(usePathname() ?? "");
  const d = DO_TIPO[tipo];
  /** A permissão de uma tela do cenário (14/10/2026), ou de uma aba dela: perm("resultados", "editar", "matriz"). */
  const perm = (tela: string, acao: "ler" | "editar" = "ler", aba?: string) => `${d.area}_${tela}${aba ? `.${aba}` : ""}:${acao}`;
  return { tipo, ...d, perm };
}
