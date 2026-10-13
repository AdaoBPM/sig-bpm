"use client";

import { useRef } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FaixaIndicadores } from "@/components/shared/FaixaIndicadores";

import { CopiarComoImagem } from "../components/CopiarComoImagem";
import { LegendaRealizadoOrcado, type TipoGrafico } from "../components/GraficoRealizadoOrcado";
import { MiniGrafico } from "../components/MiniGrafico";
import type { Indicador, MesRelatorio } from "../services/relatoriosService";

// O comportamento com iniciais maiúsculas (13/10/2026), como os nomes.
const SENTIDO: Record<string, string> = { "↑": "Quanto Maior, Melhor", "↓": "Quanto Menor, Melhor", "=": "Acompanhamento", "-": "Sem Sentido Definido" };

/**
 * O gráfico de um indicador (Indicadores, 09/10/2026): os meses do exercício até o escolhido, realizado × orçado, no
 * padrão dos gráficos do Painel de Bordo (realizado em amarelo-ouro, orçado em preto); acima, o último mês e o
 * acumulado. Desde 13/10/2026, o mesmo gráfico dos cards do painel (MiniGrafico): com os Rótulos, os valores na
 * vertical (o realizado à esquerda do centro do mês, o orçado à direita); sem eles, a escala à esquerda. Ao lado do
 * nome, o botão de copiar o modal como imagem, como o dos grupos do Painel de Bordo.
 */
export function GraficoIndicadorDialog({
  indicador: i,
  meses,
  formatar,
  formatarCurto = formatar,
  tipo = "barras",
  comRotulos = false,
  onFechar,
}: {
  indicador: Indicador;
  meses: MesRelatorio[];
  /** O valor na unidade do indicador, como na tabela. */
  formatar: (v: number | null) => string;
  /** O valor sem a unidade, com as mesmas casas (os rótulos e a escala). */
  formatarCurto?: (v: number | null) => string;
  /** Barras ou Área (a lista Tipo da tela). */
  tipo?: TipoGrafico;
  /** Os valores escritos no gráfico (a lista Rótulos da tela); sem eles, a escala. */
  comRotulos?: boolean;
  onFechar: () => void;
}) {
  const dados = meses.map((m, k) => ({ mes: m.rotulo.split("/")[0], realizado: i.meses[k], orcado: i.orcado[k] }));
  const ultimo = meses.length - 1;
  // O que vai para a imagem: todo o conteúdo do modal (o X e o botão de copiar ficam de fora).
  const conteudo = useRef<HTMLDivElement>(null);
  return (
    <Dialog open onOpenChange={(aberto) => (aberto ? undefined : onFechar())}>
      <DialogContent className="w-[min(64rem,calc(100%_-_2rem))] max-w-none gap-4 rounded-sm sm:max-w-none">
        <div ref={conteudo} className="grid gap-4">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-lg font-extrabold text-gray-900">
                {i.numero ? <span className="mr-2 font-normal text-gray-400">{i.numero}</span> : null}
                {i.nome}
              </DialogTitle>
              <CopiarComoImagem alvo={conteudo} nome={i.nome} dica="Copiar o gráfico como imagem" />
            </div>
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

          {/* A legenda à direita, como no Painel de Bordo. */}
          <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1 text-xs text-gray-600">
            <LegendaRealizadoOrcado tipo={tipo} />
          </div>
          <div className="h-80">
            <MiniGrafico dados={dados} formatar={formatar} formatarCurto={formatarCurto} tipo={tipo} comRotulos={comRotulos} comEscala={!comRotulos} topoComRotulos={20} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
