"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FaixaIndicadores } from "@/components/shared/FaixaIndicadores";

import { GraficoRealizadoOrcado, LegendaRealizadoOrcado, type TipoGrafico } from "../components/GraficoRealizadoOrcado";
import type { Indicador, MesRelatorio } from "../services/relatoriosService";

const SENTIDO: Record<string, string> = { "↑": "quanto maior, melhor", "↓": "quanto menor, melhor", "=": "acompanhamento", "-": "sem sentido definido" };

/**
 * O gráfico de um indicador (Indicadores, 09/10/2026): os meses do exercício até o escolhido, realizado × orçado, no
 * padrão dos gráficos do Painel de Bordo (realizado em amarelo-ouro, orçado em preto), com os valores no alto das
 * colunas; acima, o último mês e o acumulado.
 */
export function GraficoIndicadorDialog({
  indicador: i,
  meses,
  formatar,
  tipo = "barras",
  onFechar,
}: {
  indicador: Indicador;
  meses: MesRelatorio[];
  /** O valor na unidade do indicador, como na tabela. */
  formatar: (v: number | null) => string;
  /** Barras ou Área (a lista Tipo da tela). */
  tipo?: TipoGrafico;
  onFechar: () => void;
}) {
  const dados = meses.map((m, k) => ({ mes: m.rotulo.split("/")[0], realizado: i.meses[k], orcado: i.orcado[k] }));
  const ultimo = meses.length - 1;
  return (
    <Dialog open onOpenChange={(aberto) => (aberto ? undefined : onFechar())}>
      <DialogContent className="w-[min(64rem,calc(100%_-_2rem))] max-w-none gap-4 rounded-sm sm:max-w-none">
        <DialogHeader>
          <DialogTitle className="text-lg font-extrabold text-gray-900">
            {i.numero ? <span className="mr-2 font-normal text-gray-400">{i.numero}</span> : null}
            {i.nome}
          </DialogTitle>
          <DialogDescription>
            {i.metodologia}
            {i.unidade ? ` · Und.: ${i.unidade}` : ""}
            {SENTIDO[i.sentido] ? ` · ${i.sentido} ${SENTIDO[i.sentido]}` : ""}
          </DialogDescription>
        </DialogHeader>

        <FaixaIndicadores
          itens={[
            { rotulo: `Realizado ${meses[ultimo]?.rotulo ?? ""}`, valor: formatar(i.meses[ultimo] ?? null), rotuloAntes: true },
            { rotulo: `Orçado ${meses[ultimo]?.rotulo ?? ""}`, valor: formatar(i.orcado[ultimo] ?? null), rotuloAntes: true },
            { rotulo: "Realizado Acumulado", valor: formatar(i.total), dica: i.acumulado === "ATUAL" ? "Indicador de posição: o acumulado é o último mês." : undefined, rotuloAntes: true },
            { rotulo: "Orçado Acumulado", valor: formatar(i.totalOrcado), rotuloAntes: true },
          ]}
        />

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-600">
          <LegendaRealizadoOrcado tipo={tipo} />
        </div>
        <GraficoRealizadoOrcado dados={dados} formatar={formatar} className="h-80" rotulosDosValores tipo={tipo} />
      </DialogContent>
    </Dialog>
  );
}
