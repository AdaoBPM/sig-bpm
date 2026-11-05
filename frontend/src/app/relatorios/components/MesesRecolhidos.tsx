"use client";

import { useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Os meses anteriores ao de referência recolhidos ou não (12/10/2026): a escolha fica guardada neste navegador e vale
 * em todas as tabelas de Resultados. Começa expandido; sem armazenamento (janela privada), só não é lembrada. Lida por
 * useSyncExternalStore (13/10/2026; antes, um efeito): no servidor, expandido; as tabelas abertas mudam juntas.
 */
const CHAVE_MESES = "sig.resultados.mesesRecolhidos";
const ouvintesDosMeses = new Set<() => void>();
/** A escolha desta visita (vale também sem armazenamento); null: a guardada no navegador. */
let mesesRecolhidosNaMemoria: boolean | null = null;
function lerMesesRecolhidos() {
  if (mesesRecolhidosNaMemoria !== null) return mesesRecolhidosNaMemoria;
  try {
    return window.localStorage.getItem(CHAVE_MESES) === "1";
  } catch {
    return false; // sem armazenamento
  }
}
export function useMesesRecolhidos(): [boolean, () => void] {
  const recolhido = useSyncExternalStore(
    (avisar) => {
      ouvintesDosMeses.add(avisar);
      return () => ouvintesDosMeses.delete(avisar);
    },
    lerMesesRecolhidos,
    () => false,
  );
  const alternar = () => {
    mesesRecolhidosNaMemoria = !recolhido;
    try {
      window.localStorage.setItem(CHAVE_MESES, recolhido ? "0" : "1");
    } catch {
      // sem armazenamento
    }
    ouvintesDosMeses.forEach((avisar) => avisar());
  };
  return [recolhido, alternar];
}

/** O botão ao lado dos níveis: a seta para a direita expande os meses anteriores; para a esquerda, recolhe. */
export function BotaoMeses({ recolhido, onAlternar }: { recolhido: boolean; onAlternar: () => void }) {
  const rotulo = recolhido ? "Expandir os meses anteriores" : "Recolher os meses anteriores";
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onAlternar}
      aria-label={rotulo}
      aria-pressed={recolhido}
      title={rotulo}
      className="size-8 shrink-0 rounded-sm border-black/30 bg-white p-0"
    >
      {recolhido ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
    </Button>
  );
}
