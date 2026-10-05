import type { ReactNode } from "react";

export type Indicador = {
  rotulo: string;
  valor: ReactNode;
  /** "atencao" pinta o valor de vermelho (pendências, diferenças). */
  tom?: "atencao";
  /** Texto do title: o detalhe que não cabe na faixa. */
  dica?: string;
  /** O rótulo antes do valor ("classificado em 01/10/2026"); o padrão é depois ("1.146 lançamentos"). */
  rotuloAntes?: boolean;
};

/**
 * Os números da tela numa faixa só (E4 do levantamento de layout), em vez de
 * um cartão grande para cada número.
 */
export function FaixaIndicadores({ itens }: { itens: Indicador[] }) {
  return (
    <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-sm border border-gray-200 bg-white px-4 py-2.5">
      {itens.map((i) => (
        <div key={i.rotulo} className="flex items-baseline gap-1.5" title={i.dica}>
          <dt className={`text-xs text-gray-600 ${i.rotuloAntes ? "" : "order-2"}`}>{i.rotulo}</dt>
          <dd className={`${i.rotuloAntes ? "" : "order-1"} text-base font-extrabold tabular-nums ${i.tom === "atencao" ? "text-red-700" : "text-gray-900"}`}>{i.valor}</dd>
        </div>
      ))}
    </dl>
  );
}
