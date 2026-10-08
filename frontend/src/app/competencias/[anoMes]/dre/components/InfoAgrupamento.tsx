"use client";

import { useState } from "react";
import { Info } from "lucide-react";

import { PainelInformacao, SecaoPainel, TextoPainel } from "@/components/shared/PainelInformacao";

/** O agrupamento do centro de custo, num painel à direita, como o "Sobre Esta Tela". */
export function InfoAgrupamento({
  grupo,
  centros,
  periodo = "neste mês",
}: {
  grupo: string;
  centros: Array<{ codigoRM: string | null; nome: string }>;
  /** "neste mês" na DRE; "no período" em Resultados. */
  periodo?: string;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        title="Agrupamento do centro de custo"
        aria-label="Agrupamento do centro de custo"
        className="shrink-0 rounded-sm p-1 text-gray-800 hover:bg-black/10 hover:text-black"
      >
        <Info className="size-4" />
      </button>
      <PainelInformacao aberto={aberto} onMudar={setAberto} titulo="Agrupamento Contábil">
        <TextoPainel>
          <p>
            {grupo} reúne os centros de custo que têm este nome na coluna CENTRO DE CUSTO (CONTROLADORIA) do cadastro. A tabela mostra os
            lançamentos contábeis desses centros, diretos e de rateio, em todas as filiais, pela linha da DRE em que foram classificados — antes do
            rateio.
          </p>
          <p>
            Ficam na tabela os custos de produção e de serviços e as despesas de logística, técnicas, comerciais e administrativas, nas
            atribuições de mão de obra (direta e indireta), de gastos gerais (variáveis, diretos, indiretos e comerciais) e de depreciação que
            têm valor. Cada total soma só as atribuições que aparecem.
          </p>
        </TextoPainel>
        <SecaoPainel titulo="Centros de Custo Agrupados">
          {centros.length > 0 ? (
            <ul className="!list-none !pl-0">
              {centros.map((c) => (
                <li key={`${c.codigoRM}|${c.nome}`} className="flex gap-4 border-b border-gray-100 pb-1.5">
                  <span className="w-32 shrink-0 font-medium text-gray-900">{c.codigoRM ?? "sem código"}</span>
                  <span>{c.nome}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">Nenhum centro com lançamento {periodo}.</p>
          )}
        </SecaoPainel>
      </PainelInformacao>
    </>
  );
}
