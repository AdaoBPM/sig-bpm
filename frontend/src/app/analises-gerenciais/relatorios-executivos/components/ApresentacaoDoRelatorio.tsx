"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Minimize2 } from "lucide-react";

import { BpmLogo } from "@/components/layout/BpmLogo";

import type { Cores } from "@/app/relatorios/painel/PainelContent";
import type { TipoGrafico } from "@/app/relatorios/components/GraficoRealizadoOrcado";

import { GradeDoRelatorio } from "./GradeDoRelatorio";
import type { Bloco, DadosDoRelatorio } from "../services/relatoriosExecutivosService";

export type Slide = { chave: string; nome: string; blocos: Bloco[] };

/** Entra na tela inteira do navegador (a página toda; a apresentação a cobre, sem o menu lateral). */
export function entrarEmTelaInteira() {
  document.documentElement.requestFullscreen?.().catch(() => undefined);
}

/**
 * A apresentação do relatório (16/10/2026): em tela inteira (a função do navegador), sem o menu lateral, uma página
 * por slide, só para leitura. Os botões de recuar e avançar ficam na base esquerda; as setas do teclado também mudam o slide,
 * e Esc (ou o botão Sair) encerra.
 */
export function ApresentacaoDoRelatorio({
  relatorioId,
  titulo,
  slides,
  inicial,
  dados,
  cores,
  tipo,
  onSair,
}: {
  relatorioId: string;
  titulo: string;
  slides: Slide[];
  inicial: number;
  dados: DadosDoRelatorio | undefined;
  cores: Cores;
  tipo: TipoGrafico;
  onSair: () => void;
}) {
  const [k, setK] = useState(inicial);
  const ir = (d: number) => setK((x) => Math.min(slides.length - 1, Math.max(0, x + d)));
  const sair = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    onSair();
  };
  useEffect(() => {
    // Sair da tela inteira pelo navegador (Esc) encerra a apresentação.
    const aoMudar = () => {
      if (!document.fullscreenElement) onSair();
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) ir(1);
      else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) ir(-1);
      else if (e.key === "Escape") sair();
      else return;
      e.preventDefault();
    };
    document.addEventListener("fullscreenchange", aoMudar);
    window.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("fullscreenchange", aoMudar);
      window.removeEventListener("keydown", aoTeclar);
    };
  });
  const slide = slides[k];
  const botao = "inline-flex size-9 items-center justify-center rounded-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 disabled:pointer-events-none disabled:opacity-40";
  return (
    <div role="dialog" aria-modal aria-label={`Apresentação: ${titulo}`} className="fixed inset-0 z-[60] overflow-auto bg-background">
      <div className="px-8 pt-6 pb-20">
        {/* A logo da BPM no canto de cima, à direita (16/10/2026), na altura do título. */}
        <header className="mb-4 flex items-center gap-3 border-b border-gray-200 pb-3">
          <h1 className="text-2xl font-bold tracking-wide text-gray-900 uppercase">{slide?.nome}</h1>
          <span className="text-lg font-semibold text-gray-500">{titulo}</span>
          <BpmLogo className="ml-auto h-8 w-auto" />
        </header>
        {slide ? <GradeDoRelatorio key={slide.chave} relatorioId={relatorioId} blocos={slide.blocos} dados={dados} editavel={false} cores={cores} tipo={tipo} onMudar={() => undefined} /> : null}
      </div>
      <nav aria-label="Slides" className="fixed bottom-4 left-4 flex items-center gap-1 rounded-sm border border-gray-200 bg-white p-1 shadow-md">
        <button type="button" className={botao} disabled={k === 0} onClick={() => ir(-1)} title="Slide anterior (←)" aria-label="Slide anterior">
          <ChevronLeft className="size-5" />
        </button>
        <span className="min-w-12 text-center text-sm text-gray-700">
          {k + 1} / {slides.length}
        </span>
        <button type="button" className={botao} disabled={k >= slides.length - 1} onClick={() => ir(1)} title="Próximo slide (→)" aria-label="Próximo slide">
          <ChevronRight className="size-5" />
        </button>
        <span className="mx-1 h-6 w-px bg-gray-200" />
        <button type="button" className={botao} onClick={sair} title="Sair da apresentação (Esc)" aria-label="Sair da apresentação">
          <Minimize2 className="size-4" />
        </button>
      </nav>
    </div>
  );
}
