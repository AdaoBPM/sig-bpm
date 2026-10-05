"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";

type Props = {
  titulo: ReactNode;
  /** O que a tela faz, de onde vêm os dados: fica recolhido em "Sobre esta tela". */
  sobre?: ReactNode;
  /** Selos ao lado do título, como o de valores congelados. */
  selo?: ReactNode;
  /** Botões à direita do título. */
  acoes?: ReactNode;
};

/**
 * O cabeçalho de todas as telas (G3 e G10 do levantamento de layout): título,
 * selo e ações numa linha só, e a explicação recolhida. Nas telas do mês, o
 * mês e o estado ficam na barra de etapas, e não se repetem aqui.
 *
 * A linha do título fica fixa no topo ao rolar a página, e a altura dela vai
 * para --topo-tabela, para o cabeçalho das tabelas parar logo abaixo. Por isso
 * o componente devolve dois irmãos, sem envoltório: o fixo precisa ser filho
 * direto do contêiner da página, que é o que tem a altura toda.
 */
export function CabecalhoDaTela({ titulo, sobre, selo, acoes }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [preso, setPreso] = useState(false);

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
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">{titulo}</h1>
          {selo}
        </div>
        {acoes ? <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div> : null}
      </div>
      {sobre ? (
        <details className="group -mt-4 max-w-3xl text-sm text-gray-600">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900">
            <Info className="size-3.5" />
            <span className="group-open:hidden">Sobre esta tela</span>
            <span className="hidden group-open:inline">Fechar</span>
          </summary>
          <div className="mt-1.5 space-y-1">{sobre}</div>
        </details>
      ) : null}
    </>
  );
}
