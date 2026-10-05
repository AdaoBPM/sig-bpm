import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Os três estados de uma consulta, iguais em todas as telas (G12 do
 * levantamento de layout): carregando (esqueleto cinza), vazio e erro.
 */

export function Carregando({ linhas = 4, altura = "h-9" }: { linhas?: number; altura?: string }) {
  return (
    <div className="space-y-2 p-4" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className={`${altura} animate-pulse rounded-sm bg-gray-100`} />
      ))}
    </div>
  );
}

export function Vazio({ titulo, dica }: { titulo: string; dica?: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm font-medium text-gray-900">{titulo}</p>
      {dica ? <p className="mt-1 text-sm text-gray-600">{dica}</p> : null}
    </div>
  );
}

export function ErroCarga({ mensagem }: { mensagem: string }) {
  return (
    <div className="m-4 flex items-start gap-2 rounded-sm border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <p>{mensagem}</p>
    </div>
  );
}
