import type { QueryClient } from "@tanstack/react-query";

/** O mês seguinte, "2026-09" para "2026-08": ele herda o saldo do estoque e o aviso de mês anterior reapurado. */
function mesSeguinte(anoMes: string) {
  const [ano, mes] = anoMes.split("-").map(Number);
  return mes === 12 ? `${ano + 1}-01` : `${ano}-${String(mes + 1).padStart(2, "0")}`;
}

/**
 * Depois de mudar algo de um mês (importar, lançar, editar uma lista, apurar,
 * reabrir), as telas que mostram esse mês se atualizam: a classificação, a
 * situação da apuração (o aviso de "entradas alteradas" e o fechar), a DRE, as
 * listas — e a lista de competências e as divergências. Sem o mês, tudo
 * (uma correção de cadastro reclassifica várias competências).
 */
export function atualizarCompetencia(queryClient: QueryClient, anoMes?: string) {
  if (anoMes) {
    const seguinte = mesSeguinte(anoMes);
    queryClient.invalidateQueries({ predicate: (q) => q.queryKey.includes(anoMes) || q.queryKey.includes(seguinte) });
  } else {
    queryClient.invalidateQueries();
  }
  queryClient.invalidateQueries({ queryKey: ["competencias"] });
  queryClient.invalidateQueries({ queryKey: ["divergencias"] });
}
