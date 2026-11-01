"use client";

import { Globe, Lock } from "lucide-react";

import { OpcaoEmLinha } from "@/app/cenarios/components/CenarioDialog";
import type { VisualizacaoDoPainel } from "@/app/analises-gerenciais/relatorios-executivos/services/relatoriosExecutivosService";

import { ROTULO_DA_VISUALIZACAO } from "../services/paineisDeBordoService";

/** As opções da visualização (31/10/2026), como as dos cenários: o ícone e o que cada uma faz. */
const OPCOES: Array<{ v: VisualizacaoDoPainel; detalhe: string; Icone: typeof Lock }> = [
  { v: "PRIVADO", detalhe: "Apenas você (quem criou), os editores que você convidar e os Administradores têm acesso.", Icone: Lock },
  // Desde 01/11/2026, só depois de finalizado.
  { v: "PUBLICO", detalhe: "Depois de finalizado, todos os usuários com permissão nos Painéis de Bordo o veem; só você, os editores convidados e os Administradores o alteram.", Icone: Globe },
];

/** A visualização do painel na lista: o cadeado no Privado e o globo no Público, como na lista dos cenários. */
export function RotuloDaVisualizacao({ visualizacao }: { visualizacao: VisualizacaoDoPainel }) {
  const Icone = visualizacao === "PRIVADO" ? Lock : Globe;
  return (
    <span className={`inline-flex items-center gap-1 ${visualizacao === "PRIVADO" ? "font-medium text-gray-900" : "text-gray-700"}`}>
      <Icone className="size-3.5" />
      {ROTULO_DA_VISUALIZACAO[visualizacao]}
    </span>
  );
}

/**
 * A Visualização do painel (31/10/2026), como a dos cenários: Privado ou Público. `emLinhas`: as opções uma embaixo da outra,
 * com o texto ao lado (as Configurações); sem ele, lado a lado (o Novo Painel).
 */
export function CampoVisualizacaoDoPainel({ valor, onMudar, emLinhas, desabilitado }: { valor: VisualizacaoDoPainel; onMudar: (v: VisualizacaoDoPainel) => void; emLinhas?: boolean; desabilitado?: boolean }) {
  return (
    <fieldset className="space-y-1.5" disabled={desabilitado}>
      <legend className="text-sm leading-none font-medium">Visualização</legend>
      <div className={emLinhas ? "space-y-2 pt-1.5" : "grid gap-2 pt-1.5 sm:grid-cols-2"}>
        {OPCOES.map(({ v, detalhe, Icone }) =>
          emLinhas ? (
            <OpcaoEmLinha key={v} nome="visualizacao-do-painel" marcada={valor === v} onMarcar={() => onMudar(v)} rotulo={ROTULO_DA_VISUALIZACAO[v]} detalhe={detalhe} Icone={Icone} desabilitada={desabilitado} />
          ) : (
            <label key={v} className={`flex cursor-pointer items-start gap-2 rounded-sm border px-3 py-2 text-sm hover:bg-gray-50 ${valor === v ? "border-gray-900 bg-gray-50" : "border-gray-200"}`}>
              <input type="radio" name="visualizacao-do-painel" className="mt-1 accent-black" checked={valor === v} onChange={() => onMudar(v)} />
              <span className="min-w-0">
                <span className="inline-flex items-center gap-1.5 font-medium text-gray-900">
                  <Icone className="size-3.5" />
                  {ROTULO_DA_VISUALIZACAO[v]}
                </span>
                <span className="block text-xs text-gray-600">{detalhe}</span>
              </span>
            </label>
          ),
        )}
      </div>
    </fieldset>
  );
}
