"use client";

import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { Check, ChevronDown, Clapperboard } from "lucide-react";

import { Button } from "@/components/ui/button";

import { botaoPrimario } from "@/app/cenarios/components/CenarioDialog";

import type { Transicao } from "../services/relatoriosExecutivosService";

/** As transições do botão Transições (27/10/2026): Nenhuma tira a do slide. */
export const TRANSICOES: Array<{ valor: Transicao | undefined; rotulo: string }> = [
  { valor: undefined, rotulo: "Nenhuma" },
  { valor: "ESMAECER", rotulo: "Esmaecer" },
  { valor: "ROLAR_VERTICAL", rotulo: "Rolar Vertical" },
  { valor: "ROLAR_HORIZONTAL", rotulo: "Rolar Horizontal" },
];

/** O que o botão Transições muda num slide: a transição e o avanço automático, em segundos. */
export type AjusteDoSlide = { transicao?: Transicao; avancarApos?: number };

/** O maior Avançar Após, em segundos (uma hora). */
const MAXIMO_DO_AVANCO = 3600;

/**
 * O botão Transições do Relatório Executivo (27/10/2026; 30/10/2026, pedido do Adão: o slide aberto, "Aplicar ao Grupo" e
 * "Avançar Após"). A lista escolhe a transição do slide aberto; com "Aplicar ao Grupo" marcado, a escolha vale para todos os
 * slides do grupo (marcar a caixa já leva a transição e o avanço do slide aberto a todos). "Avançar Após" (em segundos; em
 * branco ou zero, sem avanço) faz a apresentação passar sozinha ao próximo slide. A caixa abre marcada quando todos os
 * slides do grupo já têm o mesmo ajuste.
 */
export function TransicoesDoSlide({
  ajuste,
  nomeDoSlide,
  nomeDoGrupo,
  uniforme,
  onMudar,
}: {
  ajuste: AjusteDoSlide;
  nomeDoSlide: string;
  nomeDoGrupo: string;
  /** Todos os slides do grupo têm o ajuste do aberto. */
  uniforme: boolean;
  onMudar: (ajuste: AjusteDoSlide, aoGrupo: boolean) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [aoGrupo, setAoGrupo] = useState(uniforme);
  const [segundos, setSegundos] = useState(ajuste.avancarApos ? String(ajuste.avancarApos) : "");
  const abrir = (a: boolean) => {
    if (a) {
      setAoGrupo(uniforme);
      setSegundos(ajuste.avancarApos ? String(ajuste.avancarApos) : "");
    } else gravarSegundos();
    setAberto(a);
  };
  const mudar = (novo: AjusteDoSlide, grupo = aoGrupo) => onMudar({ ...(novo.transicao ? { transicao: novo.transicao } : {}), ...(novo.avancarApos ? { avancarApos: novo.avancarApos } : {}) }, grupo);
  // Os segundos valem ao sair do campo, com Enter e ao fechar (não a cada tecla: cada mudança grava o grupo).
  const gravarSegundos = () => {
    const n = Math.min(MAXIMO_DO_AVANCO, Math.max(0, Math.round(Number(segundos.replace(",", ".")) || 0)));
    setSegundos(n ? String(n) : "");
    if (n !== (ajuste.avancarApos ?? 0)) mudar({ ...ajuste, avancarApos: n || undefined });
  };
  const rotulo = TRANSICOES.find((t) => t.valor === ajuste.transicao)?.rotulo ?? "Nenhuma";
  const item = "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm whitespace-nowrap text-gray-800 hover:bg-gray-100";
  return (
    <Popover.Root open={aberto} onOpenChange={abrir}>
      <Popover.Trigger
        render={
          <Button type="button" className={botaoPrimario} title={`A transição de ${nomeDoSlide}: ${rotulo}${ajuste.avancarApos ? `; avança após ${ajuste.avancarApos} s` : ""}`}>
            <Clapperboard className="size-4" />
            Transições
            <ChevronDown className="size-4" />
          </Button>
        }
      />
      <Popover.Portal>
        <Popover.Positioner sideOffset={4} align="end" className="z-50">
          <Popover.Popup className="w-max min-w-56 rounded-sm border border-gray-200 bg-white p-1 text-gray-900 shadow-lg outline-none">
            <p className="max-w-64 truncate px-2 py-1.5 text-xs text-gray-500">{aoGrupo ? `Slides de ${nomeDoGrupo}` : nomeDoSlide}</p>
            {TRANSICOES.map((t) => (
              <button key={t.rotulo} type="button" className={item} onClick={() => mudar({ ...ajuste, transicao: t.valor })}>
                <Check className={`size-4 ${t.valor === ajuste.transicao ? "" : "invisible"}`} />
                {t.rotulo}
              </button>
            ))}
            <div className="my-1 border-t border-gray-200" />
            <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-gray-800 hover:bg-gray-100">
              <input
                type="checkbox"
                checked={aoGrupo}
                onChange={(e) => {
                  setAoGrupo(e.target.checked);
                  if (e.target.checked) mudar(ajuste, true);
                }}
                className="size-4 accent-black"
              />
              Aplicar ao Grupo
            </label>
            <label className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-800">
              Avançar Após
              <input
                type="number"
                min={0}
                max={MAXIMO_DO_AVANCO}
                step={1}
                inputMode="numeric"
                value={segundos}
                onChange={(e) => setSegundos(e.target.value)}
                onBlur={gravarSegundos}
                onKeyDown={(e) => {
                  if (e.key === "Enter") gravarSegundos();
                }}
                aria-label="Avançar após (segundos)"
                className="h-8 w-16 rounded-sm border border-gray-300 px-2 text-right text-sm outline-none focus:border-gray-500"
              />
              <span className="text-gray-500">segundos</span>
            </label>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
