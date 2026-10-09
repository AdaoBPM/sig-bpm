"use client";

import { useParams } from "next/navigation";

import { IndicadoresContent } from "@/app/relatorios/indicadores/IndicadoresContent";

import { lerAnoMes } from "../utils/formatacao";

/** A etapa Indicadores do mês: a tela Indicadores de Resultados e Indicadores, com o exercício até a competência. */
export function IndicadoresDoMes() {
  const { anoMes } = useParams<{ anoMes: string }>();
  const periodo = lerAnoMes(anoMes);
  if (!periodo) {
    return (
      <div className="rounded-sm border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">Competência inválida na URL.</p>
      </div>
    );
  }
  // Uma tela por mês: trocar de mês recomeça a consulta.
  return <IndicadoresContent key={anoMes} periodoFixo={periodo} />;
}
