import type { Situacao } from "../services/relatoriosExecutivosService";

export const ROTULO_SITUACAO: Record<Situacao, string> = { EM_ELABORACAO: "Em Elaboração", FINALIZADO: "Finalizado" };

/** A situação (do relatório ou de uma aba) numa etiqueta: Em Elaboração (cinza) ou Finalizado (verde). */
export function EtiquetaSituacao({ situacao }: { situacao: Situacao }) {
  return situacao === "FINALIZADO" ? (
    <span className="inline-flex rounded-sm border border-green-300 bg-green-50 px-1.5 py-px text-xs font-medium whitespace-nowrap text-green-800">{ROTULO_SITUACAO.FINALIZADO}</span>
  ) : (
    <span className="inline-flex rounded-sm border border-gray-300 bg-white px-1.5 py-px text-xs font-medium whitespace-nowrap text-gray-700">{ROTULO_SITUACAO.EM_ELABORACAO}</span>
  );
}
