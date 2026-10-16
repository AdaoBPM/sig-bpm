"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Minimize2 } from "lucide-react";

import { BpmLogo } from "@/components/layout/BpmLogo";

import type { Cores } from "@/app/relatorios/painel/PainelContent";
import type { TipoGrafico } from "@/app/relatorios/components/GraficoRealizadoOrcado";

import { GradeDoRelatorio, linhasDaPagina } from "./GradeDoRelatorio";
import type { Bloco, DadosDoRelatorio } from "../services/relatoriosExecutivosService";

export type Slide = { chave: string; nome: string; blocos: Bloco[] };

/** Entra na tela inteira do navegador (a página toda; a apresentação a cobre, sem o menu lateral). */
export function entrarEmTelaInteira() {
  document.documentElement.requestFullscreen?.().catch(() => undefined);
}

/**
 * A apresentação do relatório (16/10/2026): em tela inteira (a função do navegador), sem o menu lateral, uma página
 * por slide, só para leitura, na altura da página (o espaço útil da tela inteira). Os botões de recuar, avançar e sair ficam
 * no centro da base, em cinza escuro, e só aparecem quando o mouse se move; as setas do teclado também mudam o slide, e
 * Esc encerra.
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
  // Os botões aparecem quando o mouse se move e somem 2,5 s depois (ficam enquanto o mouse está sobre eles).
  const [comBotoes, setComBotoes] = useState(false);
  const sobreOsBotoes = useRef(false);
  const relogio = useRef<number | undefined>(undefined);
  const mostrarBotoes = () => {
    setComBotoes(true);
    window.clearTimeout(relogio.current);
    relogio.current = window.setTimeout(() => {
      if (!sobreOsBotoes.current) setComBotoes(false);
    }, 2500);
  };
  useEffect(() => () => window.clearTimeout(relogio.current), []);
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
  const botao = "inline-flex size-9 items-center justify-center rounded-sm text-gray-100 hover:bg-gray-700 hover:text-white disabled:pointer-events-none disabled:opacity-40";
  return (
    <div role="dialog" aria-modal aria-label={`Apresentação: ${titulo}`} className="fixed inset-0 z-[60] overflow-hidden bg-background" onMouseMove={mostrarBotoes}>
      {/* O topo e as margens do slide: os de linhasDaPagina, para a página caber inteira na tela. */}
      <div className="px-8 pt-6 pb-6">
        {/* O relatório em preto e o departamento em cinza (16/10/2026), com a logo da BPM à direita, na altura do título. */}
        <header className="mb-4 flex h-10 items-center gap-1.5 border-b border-gray-200 pb-3">
          <h1 className="text-lg font-bold text-gray-900">{titulo}</h1>
          <span className="text-lg font-semibold text-gray-500">- {slide?.nome}</span>
          <BpmLogo className="ml-auto h-6 w-auto" />
        </header>
        {slide ? (
          <GradeDoRelatorio key={slide.chave} relatorioId={relatorioId} blocos={slide.blocos} dados={dados} editavel={false} cores={cores} tipo={tipo} linhas={linhasDaPagina()} onMudar={() => undefined} />
        ) : null}
      </div>
      <nav
        aria-label="Slides"
        onMouseEnter={() => (sobreOsBotoes.current = true)}
        onMouseLeave={() => {
          sobreOsBotoes.current = false;
          mostrarBotoes();
        }}
        className={`fixed bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-sm bg-gray-800 p-1 shadow-lg transition-opacity duration-300 ${comBotoes ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <button type="button" className={botao} disabled={k === 0} onClick={() => ir(-1)} title="Slide anterior (←)" aria-label="Slide anterior">
          <ChevronLeft className="size-5" />
        </button>
        <button type="button" className={botao} disabled={k >= slides.length - 1} onClick={() => ir(1)} title="Próximo slide (→)" aria-label="Próximo slide">
          <ChevronRight className="size-5" />
        </button>
        <span className="mx-1 h-6 w-px bg-gray-600" />
        <button type="button" className={botao} onClick={sair} title="Sair da apresentação (Esc)" aria-label="Sair da apresentação">
          <Minimize2 className="size-4" />
        </button>
      </nav>
    </div>
  );
}
