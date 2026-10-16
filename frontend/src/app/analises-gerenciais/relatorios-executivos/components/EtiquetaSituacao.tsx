import type { Situacao } from "../services/relatoriosExecutivosService";

/** A situação do relatório numa etiqueta: Em Elaboração (cinza) ou Finalizado (verde). */
export function EtiquetaSituacao({ situacao }: { situacao: Situacao }) {
  return situacao === "FINALIZADO" ? (
    <span className="inline-flex rounded-sm border border-green-300 bg-green-50 px-1.5 py-px text-xs font-medium text-green-800">Finalizado</span>
  ) : (
    <span className="inline-flex rounded-sm border border-gray-300 bg-white px-1.5 py-px text-xs font-medium text-gray-700">Em Elaboração</span>
  );
}
