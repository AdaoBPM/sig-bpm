"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";

import { Abas } from "@/components/shared/Abas";
import { useAbasDaTela } from "@/components/shared/AbasDaTela";
import { PainelInformacao, SecaoPainel, TextoPainel } from "@/components/shared/PainelInformacao";

type Props = {
  titulo: ReactNode;
  /** O que a tela faz, de onde vêm os dados: abre no painel "Sobre Esta Tela", pelo ícone ao lado do título. */
  sobre?: ReactNode;
  /** Orientações breves de uso, no mesmo painel, abaixo do "sobre". */
  comoUsar?: ReactNode;
  /** Selos à direita, antes das ações, como o de valores congelados. */
  selo?: ReactNode;
  /** Botões à direita do título. */
  acoes?: ReactNode;
  /** O Exportar da tabela da tela (30/10/2026, `ExportarTabela`): antes das ações. */
  exportar?: ReactNode;
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
export function CabecalhoDaTela({ titulo, sobre, comoUsar, selo, acoes, exportar }: Props) {
  // Numa tela com abas (17/10/2026), o título é o nome da tela, e as abas vêm logo abaixo; o painel Sobre segue o da aba.
  const daTela = useAbasDaTela();
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
      {/* Na camada 40 (21/10/2026; antes, 20): a sombra fica por cima dos rótulos fixos das tabelas (camada 30); os menus e os modais, na 50, continuam por cima dele. */}
      <div
        ref={ref}
        className={`sticky top-0 z-40 -mx-4 flex flex-col gap-3 border-b bg-[color-mix(in_srgb,var(--muted)_30%,var(--background))] px-4 py-2 sm:flex-row sm:items-center sm:justify-between md:-mx-6 md:px-6 ${
          preso ? "border-gray-200 shadow-md" : "border-transparent"
        }`}
      >
        {/* O título não quebra (21/10/2026): sem espaço, quem quebra são as ações (a legenda do Painel de Bordo…). */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1">
          <div data-tour="titulo-da-tela" className="flex items-center gap-1.5">
            <h1 className="text-2xl font-extrabold tracking-tight whitespace-nowrap text-gray-900">{daTela?.titulo ?? titulo}</h1>
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
        </div>
        {selo || acoes || exportar ? (
          <div data-tour="acoes-da-tela" className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            {selo}
            {exportar}
            {acoes}
          </div>
        ) : null}
      </div>
      {daTela ? <Abas rotulo={`Abas de ${daTela.titulo}`} ativa={daTela.ativa} abas={daTela.abas.map((a) => ({ chave: a.href, rotulo: a.title, href: a.href }))} /> : null}
      {/* Painel lateral, da direita para a esquerda, como o relatório das importações em vigor. */}
      <PainelInformacao aberto={sobreAberto} onMudar={setSobreAberto} titulo="Sobre Esta Tela">
        {sobre ? <TextoPainel>{sobre}</TextoPainel> : null}
        {comoUsar ? <SecaoPainel titulo="Como Usar Esta Tela">{comoUsar}</SecaoPainel> : null}
        {/* O Exportar da tabela (30/10/2026): a explicação vem com ele, em todas as telas que o têm. */}
        {exportar ? (
          <SecaoPainel titulo="Exportar">
            <p>
              “Exportar”, à direita do título, leva a tabela da tela a um arquivo Excel ou PDF: as linhas que os filtros dos rótulos deixam, na ordem
              escolhida, e as colunas com rótulo (sem as de ações). O arquivo traz o título da tela, quem o gerou e quando.
            </p>
          </SecaoPainel>
        ) : null}
      </PainelInformacao>
    </>
  );
}
