"use client";

import { useRef } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { CopiarComoImagem } from "../components/CopiarComoImagem";
import { LegendaRealizadoOrcado, type TipoGrafico } from "../components/GraficoRealizadoOrcado";
import { MiniGrafico } from "../components/MiniGrafico";
import type { Indicador, MesRelatorio } from "../services/relatoriosService";

// O comportamento com iniciais maiúsculas (13/10/2026), como os nomes.
const SENTIDO: Record<string, string> = { "↑": "Quanto Maior, Melhor", "↓": "Quanto Menor, Melhor", "=": "Acompanhamento", "-": "Sem Sentido Definido" };

/**
 * O gráfico de um indicador (Indicadores, 09/10/2026): os meses do exercício até o escolhido, realizado × orçado, no
 * padrão dos gráficos do Painel de Bordo (realizado em amarelo-ouro, orçado em preto), e, depois do último mês, o
 * gráfico do acumulado (ACUM.), como nos cards do painel (13/10/2026; saíram os quadros do último mês e do acumulado, e
 * a descrição foi para a linha da legenda). Desde 13/10/2026, o mesmo gráfico dos cards do painel (MiniGrafico): com os Rótulos, os valores na
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
      {/* O foco inicial no próprio modal, não no botão de copiar (o único botão dele). */}
      <DialogContent
        className="w-[min(64rem,calc(100%_-_2rem))] max-w-none gap-4 rounded-sm sm:max-w-none"
        initialFocus={() => conteudo.current?.closest<HTMLElement>("[data-slot=\"dialog-content\"]") ?? true}
      >
        <div ref={conteudo} className="grid gap-4">
          {/* O título mais perto do card da descrição (13/10/2026): 16 px entre os dois, em vez de 28. */}
          <DialogHeader className="-mb-2 pb-2">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-lg font-extrabold text-gray-900">
                {/* Sem a numeração do indicador (13/10/2026): só o nome. */}
                {i.nome}
              </DialogTitle>
              <CopiarComoImagem alvo={conteudo} nome={i.nome} dica="Copiar o gráfico como imagem" />
            </div>
          </DialogHeader>

          {/* A descrição à esquerda e a legenda à direita, na mesma linha, num card com o destaque amarelo-ouro à esquerda (13/10/2026). */}
          <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-1 rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white px-4 py-2.5">
            <DialogDescription>
              {i.metodologia}
              {i.unidade ? ` · Und.: ${i.unidade}` : ""}
              {SENTIDO[i.sentido] ? ` · ${i.sentido} ${SENTIDO[i.sentido]}` : ""}
            </DialogDescription>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-600">
              <LegendaRealizadoOrcado tipo={tipo} />
            </div>
          </div>
          {/* Os meses e, depois do último, o acumulado (realizado × orçado), como nos cards do Painel de Bordo. */}
          <div className="flex h-80 gap-3">
            <div className="min-w-0 flex-1">
              <MiniGrafico
                dados={dados}
                formatar={formatar}
                formatarCurto={formatarCurto}
                tipo={tipo}
                comRotulos={comRotulos}
                comEscala={!comRotulos}
                topoComRotulos={20}
                fatorDaEscala={i.unidade === "%" ? 100 : 1}
              />
            </div>
            <div
              className={`${comRotulos ? "w-28" : "w-40"} shrink-0 border-l border-gray-100 pl-3`}
              title={i.acumulado === "ATUAL" ? "Indicador de posição: o acumulado é o último mês." : `Acumulado do exercício (até ${meses[ultimo]?.rotulo ?? ""}): realizado × orçado`}
            >
              <MiniGrafico
                dados={[{ mes: "ACUM.", realizado: i.total, orcado: i.totalOrcado }]}
                formatar={formatar}
                formatarCurto={formatarCurto}
                tipo={tipo}
                comRotulos={comRotulos}
                comEscala={!comRotulos}
                topoComRotulos={20}
                fatorDaEscala={i.unidade === "%" ? 100 : 1}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
