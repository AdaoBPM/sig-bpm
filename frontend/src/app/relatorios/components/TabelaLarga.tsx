"use client";

import { useRef, type ReactNode } from "react";

import { BarraDeRolagem } from "@/components/shared/BarraDeRolagem";

/**
 * Uma tabela mais larga que a tela (Resultados, Indicadores) que se comporta
 * como as demais: a página rola, o título da tela fica preso no topo e os
 * rótulos da tabela logo abaixo dele. Para isso, os rótulos vão numa tabela à
 * parte, presa no topo da página, e o corpo numa área que rola para os lados;
 * as duas têm as mesmas larguras de coluna, e os rótulos acompanham a rolagem
 * lateral do corpo. (Uma área com rolagem própria prenderia os rótulos a ela,
 * e não à página.) A primeira coluna fica presa à esquerda nas duas.
 *
 * A barra de rolagem lateral fica presa no pé da janela e sempre visível (12/10/2026; a BarraDeRolagem, desenhada
 * pela ferramenta): à vista enquanto a tabela está na tela, e não só no fim dela. A do corpo fica escondida (a
 * rolagem pelo touchpad e por Shift + roda continua).
 */
export function TabelaLarga({ larguras, cabecalho, corpo }: { larguras: number[]; cabecalho: ReactNode; corpo: ReactNode }) {
  const topo = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  // Os rótulos acompanham a posição lateral do corpo.
  const acompanhar = (x: number) => {
    if (topo.current && topo.current.scrollLeft !== x) topo.current.scrollLeft = x;
  };
  const total = larguras.reduce((s, w) => s + w, 0);
  const colunas = (
    <colgroup>
      {larguras.map((w, i) => (
        <col key={i} style={{ width: w }} />
      ))}
    </colgroup>
  );
  const tabela = "tabela-sig table-fixed border-collapse text-sm";
  return (
    <div className="rounded-sm border border-gray-200 bg-white">
      {/* Acima da coluna presa do corpo (z-10), que passa por baixo dos rótulos ao rolar. */}
      <div ref={topo} className="sticky top-[var(--topo-tabela,0px)] z-30 overflow-hidden">
        {/* Dentro da faixa presa, os rótulos ficam no alto dela (--topo-tabela zerado). */}
        <table className={`${tabela} [--topo-tabela:0px]`} style={{ width: total, minWidth: "100%" }}>
          {colunas}
          <thead>{cabecalho}</thead>
        </table>
      </div>
      <div ref={area} className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" onScroll={(e) => acompanhar(e.currentTarget.scrollLeft)}>
        <table className={tabela} style={{ width: total, minWidth: "100%" }}>
          {colunas}
          <tbody>{corpo}</tbody>
        </table>
      </div>
      <BarraDeRolagem area={area} />
    </div>
  );
}
