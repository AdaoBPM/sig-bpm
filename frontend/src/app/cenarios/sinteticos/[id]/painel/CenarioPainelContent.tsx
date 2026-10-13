"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { usePermissions } from "@/context/PermissionContext";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { MESES } from "@/app/competencias/[anoMes]/utils/formatacao";
import { RotulosDoGrafico, SeletorTipoGrafico, useTipoGrafico } from "@/app/relatorios/components/GraficoRealizadoOrcado";
import { Seletor } from "@/app/relatorios/components/SeletorPeriodo";
import { CorpoDoPainel, SeletorCores, useCoresDoPainel } from "@/app/relatorios/painel/PainelContent";
import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

import { cenariosService } from "../../../services/cenariosService";

const ROTULOS = { realizado: "Cenário", orcado: "Comparado" };

/**
 * O Painel de Bordo de um cenário sintético (13/10/2026), como o de Resultados Realizados: as abas Resultados e
 * Performance, com o cenário no lugar do realizado e o cenário comparado (Configurações / Comparativo) no lugar do
 * orçado. O mês de referência começa em dezembro (o cenário se olha nos 12 meses).
 */
export function CenarioPainelContent() {
  const { id } = useParams<{ id: string }>();
  useRegistrarAcessoTela(`/cenarios/sinteticos/${id}/painel`);
  const { hasPermission } = usePermissions();
  const [ate, setAte] = useState(12);
  const [aba, setAba] = useState("resultados");
  const [tipoGrafico, setTipoGrafico] = useTipoGrafico();
  const [cores, setCores] = useCoresDoPainel();
  const consulta = useQuery({ queryKey: ["cenarios", id, "painel", ate], queryFn: () => cenariosService.painel(id, ate) });
  const dados = consulta.data;
  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Painel de Bordo"
        comoUsar={
          <ul>
            <li>
              Nas listas à direita do título, escolha o Período (o mês de referência; o acumulado vai de janeiro até ele), o Tipo dos gráficos e as
              Cores dos sinais (os dois guardados neste navegador, os mesmos do Painel de Bordo de Resultados Realizados).
            </li>
            <li>Troque entre as abas Resultados e Performance (os unitários).</li>
            <li>
              Cada card traz o Atual (o mês de referência) e o Acumulado, com o valor do cenário em destaque, o do cenário comparado e o desvio (vs.
              Comparado) no selo colorido, e os gráficos dos meses e do acumulado (o cenário em amarelo-ouro, o comparado em preto).
            </li>
            <li>O comparado é o cenário escolhido em Configurações / Comparativo; sem ele, essa parte fica vazia (—).</li>
          </ul>
        }
        sobre={
          <>
            <p>
              O Painel de Bordo do cenário: os mesmos quadros do Painel de Bordo de Resultados Realizados, com os indicadores do cenário (os da tela
              Indicadores dele: os que saem da DRE do cenário, os lançamentos manuais e os importados) no lugar do realizado, e os do cenário comparado
              no lugar do orçado.
            </p>
            <p>
              O desvio (vs. Comparado) é o valor do cenário sobre o do comparado, menos 1. O sinal fica verde (azul, nas cores para daltonismo) quando
              o cenário está do lado bom do comparado, vermelho do lado ruim, e amarelo quando o desvio é de até 5%; o lado bom depende do sentido do
              indicador (↑ ou ↓).
            </p>
          </>
        }
        acoes={
          <div className="flex flex-wrap items-center gap-4">
            <Seletor rotulo="Período" valor={String(ate)} onMudar={(v) => setAte(Number(v))} largura="w-36" opcoes={MESES.map((m, k) => ({ valor: String(k + 1), rotulo: m }))} />
            <SeletorTipoGrafico tipo={tipoGrafico} onMudar={setTipoGrafico} />
            <SeletorCores cores={cores} onMudar={setCores} />
          </div>
        }
      />
      {consulta.isError ? (
        <div className="rounded-sm border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{mensagemDeErro(consulta.error, "Erro ao carregar o painel do cenário.")}</p>
        </div>
      ) : !dados ? (
        <div className="h-64 animate-pulse rounded-sm bg-gray-100" />
      ) : (
        <RotulosDoGrafico.Provider value={ROTULOS}>
          <CorpoDoPainel
            dados={dados}
            aba={aba}
            onAba={setAba}
            tipo={tipoGrafico}
            cores={cores}
            aviso={
              dados.comparado ? null : (
                <div className="rounded-sm border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
                  O cenário não tem comparativo: o comparado e o desvio ficam vazios. Escolha um cenário em{" "}
                  {hasPermission("cenarios:editar") ? (
                    <Link href={`/cenarios/sinteticos/${id}/configuracoes?aba=comparativo`} className="font-medium underline underline-offset-2">
                      Configurações / Comparativo
                    </Link>
                  ) : (
                    "Configurações / Comparativo"
                  )}
                  .
                </div>
              )
            }
          />
        </RotulosDoGrafico.Provider>
      )}
    </div>
  );
}
