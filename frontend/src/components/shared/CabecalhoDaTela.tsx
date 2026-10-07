"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

type Props = {
  titulo: ReactNode;
  /** O que a tela faz, de onde vêm os dados: abre no painel "Sobre Esta Tela", pelo ícone ao lado do título. */
  sobre?: ReactNode;
  /** Orientações breves de uso, no mesmo painel, abaixo do "sobre". */
  comoUsar?: ReactNode;
  /** Selos ao lado do título, como o de valores congelados. */
  selo?: ReactNode;
  /** Botões à direita do título. */
  acoes?: ReactNode;
};

/**
 * O cabeçalho de todas as telas (G3 e G10 do levantamento de layout): título,
 * selo e ações numa linha só, e a explicação num painel lateral, aberto pelo
 * ícone de informação logo depois do título. Nas telas do mês, o
 * mês e o estado ficam na barra de etapas, e não se repetem aqui.
 *
 * A linha do título fica fixa no topo ao rolar a página, e a altura dela vai
 * para --topo-tabela, para o cabeçalho das tabelas parar logo abaixo. Por isso
 * o componente devolve dois irmãos, sem envoltório: o fixo precisa ser filho
 * direto do contêiner da página, que é o que tem a altura toda.
 */
export function CabecalhoDaTela({ titulo, sobre, comoUsar, selo, acoes }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [preso, setPreso] = useState(false);
  const [sobreAberto, setSobreAberto] = useState(false);

  useEffect(() => {
    const el = ref.current;
    const area = el?.closest<HTMLElement>('[data-slot="sidebar-inset"]');
    if (!el || !area) return;
    const mede = () => area.style.setProperty("--topo-tabela", `${el.offsetHeight}px`);
    const observador = new ResizeObserver(mede);
    observador.observe(el);
    mede();
    // A borda de baixo só aparece quando o título está preso e há conteúdo passando por baixo.
    const rolou = () => setPreso(window.scrollY > 0 && el.getBoundingClientRect().top <= 0);
    window.addEventListener("scroll", rolou, { passive: true });
    rolou();
    return () => {
      observador.disconnect();
      window.removeEventListener("scroll", rolou);
      area.style.removeProperty("--topo-tabela");
    };
  }, []);

  return (
    <>
      <div
        ref={ref}
        className={`sticky top-0 z-20 -mx-4 flex flex-col gap-3 border-b bg-[color-mix(in_srgb,var(--muted)_30%,var(--background))] px-4 py-2 sm:flex-row sm:items-center sm:justify-between md:-mx-6 md:px-6 ${
          preso ? "border-gray-200 shadow-sm" : "border-transparent"
        }`}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <div className="flex items-center gap-1.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">{titulo}</h1>
            {sobre || comoUsar ? (
              <button
                type="button"
                onClick={() => setSobreAberto(true)}
                title="Sobre esta tela"
                aria-label="Sobre esta tela"
                className="rounded-sm p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-900"
              >
                <Info className="size-4" />
              </button>
            ) : null}
          </div>
          {selo}
        </div>
        {acoes ? <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div> : null}
      </div>
      {/* Painel lateral, da direita para a esquerda, como o relatório das importações em vigor. */}
      <Sheet open={sobreAberto} onOpenChange={setSobreAberto}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-6 data-[side=right]:sm:max-w-2xl">
          <SheetTitle className="pr-8 text-lg font-extrabold text-gray-900">Sobre Esta Tela</SheetTitle>
          {sobre ? <div className="mt-3 space-y-2 text-sm leading-relaxed text-gray-700">{sobre}</div> : null}
          {comoUsar ? (
            <>
              <h2 className="mt-6 text-base font-bold text-gray-900">Como Usar Esta Tela</h2>
              <div className="mt-2 text-sm leading-relaxed text-gray-700 [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:space-y-0 [&_ul]:pl-5">{comoUsar}</div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
