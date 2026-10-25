"use client";

import { useAcessibilidade } from "@/lib/acessibilidade";

/**
 * O controle deslizante da Biblioteca de APIs (24/10/2026): liberado (à direita, verde; azul com a Acessibilidade
 * Daltonismo) ou bloqueado (à esquerda, vermelho), com o nome do estado ao lado — a cor nunca diz sozinha.
 */
export function Deslizante({ liberado, rotulo, desabilitado, onMudar }: { liberado: boolean; rotulo: string; desabilitado?: boolean; onMudar: (liberado: boolean) => void }) {
  const [acessibilidade] = useAcessibilidade();
  const ligado = acessibilidade === "daltonismo" ? "bg-blue-600" : "bg-green-600";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={liberado}
      aria-label={`${rotulo}: ${liberado ? "liberado" : "bloqueado"}`}
      title={liberado ? `Liberado: clique para bloquear ${rotulo}` : `Bloqueado: clique para liberar ${rotulo}`}
      disabled={desabilitado}
      onClick={() => onMudar(!liberado)}
      className="inline-flex shrink-0 items-center gap-2 rounded-sm text-xs font-semibold disabled:cursor-wait disabled:opacity-60"
    >
      <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${liberado ? ligado : "bg-red-600"}`}>
        <span className={`absolute size-4 rounded-full bg-white shadow transition-transform ${liberado ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </span>
      <span className={liberado ? "text-gray-700" : "text-red-700"}>{liberado ? "Liberado" : "Bloqueado"}</span>
    </button>
  );
}
