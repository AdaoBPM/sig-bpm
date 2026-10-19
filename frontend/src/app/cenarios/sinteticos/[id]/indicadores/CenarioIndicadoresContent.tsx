"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChartColumn, Pencil } from "lucide-react";

import { usePermissions } from "@/context/PermissionContext";

import { TabelaIndicadores, valor, valorCurto } from "@/app/relatorios/indicadores/TabelaIndicadores";
import { GraficoIndicadorDialog } from "@/app/relatorios/indicadores/GraficoIndicadorDialog";
import { RotulosDoGrafico, type TipoGrafico } from "@/app/relatorios/components/GraficoRealizadoOrcado";
import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

import { LancamentoDialog } from "../../../components/IndicadoresManuais";
import { AvisoMarcado, estaTravado } from "../../../components/AvisoMarcado";
import { cenariosService, type IndicadorDoCenario } from "../../../services/cenariosService";
import { useTipoDoCenario } from "../../../components/tipoDoCenario";

/**
 * As abas dos indicadores no Painel de Bordo do cenário, depois de Performance (19/10/2026): as metas orçadas (todos),
 * os indicadores da DRE de Produção e Serviços e os lançamentos manuais. A chave é a da aba no perfil.
 */
// As Metas primeiro (12/10/2026): o compilado dos indicadores, como o Consolidado nos Resultados.
const ABAS = [
  { chave: "metas", rotulo: "Metas" },
  { chave: "indicadores_resultados", rotulo: "Indicadores de Resultados" },
  { chave: "manuais", rotulo: "Indicadores Manuais" },
];
const DA_ABA: Record<string, (i: IndicadorDoCenario) => boolean> = {
  indicadores_resultados: (i) => i.classe === "RESULTADO" && (i.grupo === "Produção" || i.grupo === "Serviços"),
  manuais: (i) => i.classe === "MANUAL",
  metas: () => true,
};

/** As abas dos indicadores que o perfil lê (no Painel de Bordo do cenário). */
export function useAbasDosIndicadoresDoCenario() {
  const t = useTipoDoCenario();
  const { hasPermission } = usePermissions();
  return ABAS.filter((a) => hasPermission(t.perm("painel", "ler", a.chave)));
}

/**
 * Uma aba de indicadores do Painel de Bordo de um cenário (sintético ou analítico; 19/10/2026, antes a tela Indicadores):
 * Metas, Indicadores de Resultados ou Indicadores Manuais — a tabela e o gráfico de cada indicador, com o Tipo e os
 * Rótulos do Configurar Gráficos do Painel de Bordo.
 */
export function IndicadoresDoCenario({ id, aba, tipo, comRotulos }: { id: string; aba: string; tipo: TipoGrafico; comRotulos: boolean }) {
  const t = useTipoDoCenario();
  const { hasPermission } = usePermissions();
  // O cenário marcado não se edita (12/10/2026): os Indicadores Manuais ficam só para leitura, com o aviso.
  const cenario = useQuery({ queryKey: ["cenarios", id], queryFn: () => cenariosService.obter(id) });
  // Também a versão congelada (13/10/2026) trava os Indicadores Manuais.
  const travado = !!cenario.data && estaTravado(cenario.data);
  // No analítico (14/10/2026), os Indicadores Manuais se editam na tela Premissas; aqui ficam só para leitura.
  const analitico = t.tipo === "ANALITICO";
  const podeEditar = hasPermission(t.perm("painel", "editar", "manuais")) && !!cenario.data && !travado && !analitico;
  const [editando, setEditando] = useState<IndicadorDoCenario | null>(null);
  // O gráfico do indicador (16/10/2026), como em Resultados Empresariais: o cenário × o comparado.
  const [comGrafico, setComGrafico] = useState<IndicadorDoCenario | null>(null);
  const consulta = useQuery({ queryKey: ["cenarios", id, "indicadores"], queryFn: () => cenariosService.indicadores(id) });
  const dados = consulta.data;
  const daAba = DA_ABA[aba] ? (dados?.indicadores.filter(DA_ABA[aba]) ?? []) : [];
  const manuais = aba === "manuais";
  // Nos Indicadores Manuais que se editam, o clique digita os lançamentos; nos demais, abre o gráfico.
  const digita = manuais && podeEditar;

  return (
    <div className="space-y-6">
      {aba === "metas" ? (
        <p className="rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white px-4 py-2 text-sm text-gray-600">
          As Metas são o compilado dos indicadores: os Indicadores de Resultados (que saem da DRE do cenário) e os Indicadores Manuais, com as
          eficiências calculadas e os importados (liberação de projetos, GME). Não se editam aqui: mudam com a DRE, na tela Resultados, e com os
          Indicadores Manuais.
        </p>
      ) : null}
      {manuais && cenario.data && travado && hasPermission(t.perm("painel", "editar", "manuais")) ? <AvisoMarcado cenario={cenario.data} oQue="os Indicadores Manuais" /> : null}
      {manuais && analitico ? (
        <p className="rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white px-4 py-2 text-sm text-gray-600">
          No cenário analítico, os Indicadores Manuais se digitam na tela Premissas, aba Indicadores Manuais.
        </p>
      ) : null}
      {consulta.isError ? (
        <div className="rounded-sm border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{mensagemDeErro(consulta.error, "Erro ao carregar os indicadores do cenário.")}</p>
        </div>
      ) : !dados ? (
        <div className="h-64 animate-pulse rounded-sm bg-gray-100" />
      ) : (
        <TabelaIndicadores
          key={aba}
          meses={dados.meses}
          indicadores={daAba}
          comparado={dados.comparado}
          onClicar={digita ? setEditando : setComGrafico}
          dicaDoClique={digita ? "Digitar os lançamentos do indicador" : "Ver o gráfico do indicador"}
          iconeDoClique={digita ? Pencil : ChartColumn}
          destacar={manuais ? (i, k) => i.digitados[k] : undefined}
          dicaDoDestaque="Valor digitado"
        />
      )}
      {editando && dados ? <LancamentoDialog id={id} indicador={editando} meses={dados.meses} onFechar={() => setEditando(null)} /> : null}
      {comGrafico && dados ? (
        <RotulosDoGrafico.Provider value={{ realizado: "Cenário", orcado: dados.comparado ? `Comparado (${dados.comparado.nome})` : "Comparado" }}>
          <GraficoIndicadorDialog
            indicador={comGrafico}
            meses={dados.meses}
            formatar={(v) => valor(comGrafico, v)}
            formatarCurto={(v) => valorCurto(comGrafico, v)}
            tipo={tipo}
            comRotulos={comRotulos}
            onFechar={() => setComGrafico(null)}
          />
        </RotulosDoGrafico.Provider>
      ) : null}
    </div>
  );
}
