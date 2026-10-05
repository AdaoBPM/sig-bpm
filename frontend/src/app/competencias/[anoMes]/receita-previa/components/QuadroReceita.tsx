"use client";

import { moeda } from "../../utils/formatacao";
import {
  ROTULO_LINHA,
  ROTULO_UNIDADE,
  type Natureza,
  type ReceitaNatureza,
} from "../services/receitaPreviaService";

/** Naturezas de cada unidade, na ordem da aba Receitas (Prévia). */
const NATUREZAS_DA_UNIDADE: Record<number, Natureza[]> = {
  1: ["PRE_FABRICADO", "FRETE", "DEVOLUCOES_INVENTARIOS"],
  2: ["PRE_FABRICADO", "FRETE", "DEVOLUCOES_INVENTARIOS"],
  3: ["MONTAGEM", "COMPLEMENTAR"],
};

const soma = (xs: string[]) => xs.reduce((a, x) => a + Number(x), 0);

type Props = {
  unidade: number;
  receitas: ReceitaNatureza[];
  onAbrir: (unidade: number, natureza: Natureza) => void;
};

function Linha({
  rotulo,
  valor,
  destaque,
  base,
  onClick,
}: {
  rotulo: string;
  valor: number;
  destaque?: boolean;
  base: number;
  onClick?: () => void;
}) {
  const pct = base === 0 ? null : valor / base;
  return (
    <tr className={destaque ? "border-t border-gray-200 bg-gray-50" : "border-t border-gray-100"}>
      <td className={`px-4 py-2 text-sm ${destaque ? "font-bold text-gray-900" : "pl-8 text-gray-700"}`}>
        {onClick ? (
          <button type="button" onClick={onClick} className="text-left underline-offset-2 hover:underline">
            {rotulo}
          </button>
        ) : (
          rotulo
        )}
      </td>
      <td className={`px-4 py-2 text-right text-sm tabular-nums ${destaque ? "font-bold" : ""}`}>{moeda(valor)}</td>
      <td className="px-4 py-2 text-right text-xs tabular-nums text-gray-500">
        {pct === null ? "—" : `${(pct * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
      </td>
    </tr>
  );
}

/**
 * Um bloco da aba Receitas (Prévia): ROB, IRB e ROL da unidade, por natureza.
 * Os três blocos ficam um embaixo do outro, com as mesmas colunas de largura
 * fixa (E7 do levantamento de layout), para os valores se alinharem entre eles.
 */
export function QuadroReceita({ unidade, receitas, onAbrir }: Props) {
  const naturezas = NATUREZAS_DA_UNIDADE[unidade];
  const da = (n: Natureza) => receitas.find((r) => r.unidade === unidade && r.natureza === n);
  const rob = soma(naturezas.map((n) => da(n)?.receitaBruta ?? "0"));
  const rol = soma(naturezas.map((n) => da(n)?.receitaLiquida ?? "0"));
  const variacao = Number(da("PRE_FABRICADO")?.variacaoEstoque ?? 0);

  return (
    <div className="border border-gray-200 bg-white rounded-sm">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-bold tracking-wide text-gray-900 uppercase">{ROTULO_UNIDADE[unidade]}</h2>
      </div>
      <table className="tabela-sig w-full table-fixed border-collapse">
        <colgroup>
          <col />
          <col className="w-48" />
          <col className="w-24" />
        </colgroup>
        <thead className="sr-only">
          <tr>
            <th>Linha</th>
            <th>Valor</th>
            <th>Participação</th>
          </tr>
        </thead>
        <tbody>
          <Linha rotulo="RECEITA OPERACIONAL BRUTA (ROB)" valor={rob} base={rob} destaque />
          {naturezas.map((n) => (
            <Linha key={`b-${n}`} rotulo={ROTULO_LINHA[n].bruta} valor={Number(da(n)?.receitaBruta ?? 0)} base={rob} onClick={() => onAbrir(unidade, n)} />
          ))}
          <Linha rotulo="IMPOSTOS SOBRE A RECEITA BRUTA (IRB)" valor={rob - rol} base={rob} destaque />
          <Linha rotulo="RECEITA OPERACIONAL LÍQUIDA (ROL)" valor={rol} base={rol} destaque />
          {naturezas.map((n) => (
            <Linha key={`l-${n}`} rotulo={ROTULO_LINHA[n].liquida} valor={Number(da(n)?.receitaLiquida ?? 0)} base={rob} onClick={() => onAbrir(unidade, n)} />
          ))}
          {unidade === 2 ? (
            <>
              <Linha rotulo="CUSTOS DE PRODUÇÃO: PRÉ-FABRICADOS (CPP)" valor={variacao} base={variacao} destaque />
              <Linha rotulo="Variação do Estoque" valor={variacao} base={rob - rol} onClick={() => onAbrir(2, "PRE_FABRICADO")} />
            </>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
