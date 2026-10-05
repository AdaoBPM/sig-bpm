import type { StatusCompetencia } from "../services/competenciasService";

/**
 * O estado da competência governa o que se pode fazer com ela, então precisa
 * ser lido de relance. As cores seguem os tokens de status do design system.
 */
const ESTILO: Record<StatusCompetencia, { classe: string; rotulo: string }> = {
  ABERTA: {
    classe: "border-blue-200 bg-blue-50 text-blue-700",
    rotulo: "Aberta",
  },
  EM_CONFERENCIA: {
    classe: "border-yellow-200 bg-yellow-50 text-yellow-800",
    rotulo: "Em conferência",
  },
  FECHADA: {
    classe: "border-green-200 bg-green-50 text-green-700",
    rotulo: "Fechada",
  },
};

/** O nome do estado, como no selo (também no filtro da coluna Estado). */
export const rotuloStatus = (status: StatusCompetencia) => ESTILO[status].rotulo;

export function StatusCompetenciaBadge({
  status,
}: {
  status: StatusCompetencia;
}) {
  const { classe, rotulo } = ESTILO[status];
  return (
    <span
      className={`inline-block rounded-sm border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${classe}`}
    >
      {rotulo}
    </span>
  );
}
