"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChartColumn } from "lucide-react";

import type { TipoGrafico } from "../components/GraficoRealizadoOrcado";
import { mensagemDeErro, relatoriosService, type Indicador, type MarcacaoComparavel } from "../services/relatoriosService";
import { GraficoIndicadorDialog } from "../indicadores/GraficoIndicadorDialog";
import { TabelaIndicadores, valor, valorCurto } from "../indicadores/TabelaIndicadores";

/**
 * A aba Indicadores do Painel de Bordo de Resultados Empresariais (19/10/2026; antes, a tela Indicadores): os
 * indicadores do exercício até o Período do Configurar Gráficos do painel, com o orçado, e o gráfico de cada um no Tipo
 * e com os Rótulos escolhidos lá.
 */
export function IndicadoresDoPainel({ ano, ate, tipo, comRotulos, comparaCom }: { ano: number; ate: number; tipo: TipoGrafico; comRotulos: boolean; /** O Compara Com (21/10/2026). */ comparaCom?: MarcacaoComparavel }) {
  const consulta = useQuery({ queryKey: ["relatorios", "indicadores", ano, ate, comparaCom], queryFn: () => relatoriosService.indicadores(ano, ate, false, comparaCom) });
  const dados = consulta.data;
  const [comGrafico, setComGrafico] = useState<Indicador | null>(null);
  if (consulta.isError) {
    return (
      <div className="rounded-sm border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">{mensagemDeErro(consulta.error, "Erro ao carregar os indicadores.")}</p>
      </div>
    );
  }
  if (!dados) return <div className="h-64 animate-pulse rounded-sm bg-gray-100" />;
  return (
    <>
      <TabelaIndicadores
        meses={dados.meses}
        indicadores={dados.indicadores}
        onClicar={setComGrafico}
        dicaDoClique="Ver o gráfico do indicador"
        iconeDoClique={ChartColumn}
        comOrcado
      />
      {comGrafico ? (
        <GraficoIndicadorDialog
          indicador={comGrafico}
          meses={dados.meses}
          formatar={(v) => valor(comGrafico, v)}
          formatarCurto={(v) => valorCurto(comGrafico, v)}
          tipo={tipo}
          comRotulos={comRotulos}
          onFechar={() => setComGrafico(null)}
        />
      ) : null}
    </>
  );
}
