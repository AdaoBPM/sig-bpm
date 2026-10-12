import type { ReactNode } from "react";

import { RolagemLateral } from "./RolagemLateral";

/**
 * A moldura de todas as tabelas (G6 do levantamento de layout): o quadro
 * branco, a barra de cima (busca, filtros, contagem) e o rodapé (paginação).
 */
export function QuadroTabela({ barra, rodape, children }: { barra?: ReactNode; rodape?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-sm border border-gray-200 bg-white">
      {barra ? <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-2.5">{barra}</div> : null}
      {/* Rola na horizontal só em tela estreita (com a barra presa no pé da janela); na larga, o cabeçalho da tabela fica fixo ao rolar a página. */}
      <RolagemLateral className="lg:overflow-x-visible">{children}</RolagemLateral>
      {rodape}
    </div>
  );
}
