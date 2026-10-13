"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/context/PermissionContext";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { MESES } from "@/app/competencias/[anoMes]/utils/formatacao";
import { RotulosDoGrafico, SeletorRotulos, SeletorTipoGrafico, useRotulosDosValores, useTipoGrafico } from "@/app/relatorios/components/GraficoRealizadoOrcado";
import { Seletor } from "@/app/relatorios/components/SeletorPeriodo";
import { AVISO_DO_PAINEL, CorpoDoPainel, SeletorCores, useCoresDoPainel } from "@/app/relatorios/painel/PainelContent";
import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

import { cenariosService } from "../../../services/cenariosService";
import { useTipoDoCenario } from "../../../components/tipoDoCenario";

const ROTULOS = { realizado: "Cenário", orcado: "Comparado" };

/**
 * O Painel de Bordo de um cenário sintético (13/10/2026), como o de Resultados Realizados: as abas Resultados e
 * Performance, com o cenário no lugar do realizado e o cenário comparado (Configurações / Comparativo) no lugar do
 * orçado. O mês de referência começa em dezembro (o cenário se olha nos 12 meses).
 */
export function CenarioPainelContent() {
  const { id } = useParams<{ id: string }>();
  const t = useTipoDoCenario();
  useRegistrarAcessoTela(`${t.base}/${id}/painel`);
  const { hasPermission } = usePermissions();
  const [ate, setAte] = useState(12);
  const [aba, setAba] = useState("resultados");
  const router = useRouter();
  const [tipoGrafico, setTipoGrafico] = useTipoGrafico();
  const [comRotulos, setComRotulos] = useRotulosDosValores();
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
              Nas listas à direita do título, escolha o Período (o mês de referência; o acumulado vai de janeiro até ele), os Rótulos (Com: os
              valores de cada mês escritos nos gráficos, o cenário por cima do comparado), o Tipo dos gráficos e as Cores dos sinais (guardados neste
              navegador, os mesmos do Painel de Bordo de Resultados Realizados).
            </li>
            <li>Troque entre as abas Resultados e Performance (os unitários).</li>
            <li>
              Cada card traz o nome e, à direita dele, a sigla e o sentido (o mês de referência fica ao lado do nome do grupo); embaixo, o Cenário
              (Atual), do mês de referência, e o Cenário (Acumulado), cada um com o valor em destaque e, à direita, o selo do desvio e o valor do
              cenário comparado (vs. Comparado); e os gráficos dos meses e do acumulado (o cenário em amarelo-ouro, o comparado em preto).
            </li>
            <li>
              Com os Rótulos, o valor do cenário fica à esquerda do centro de cada mês (e do acumulado) e o do comparado à direita. Cores: Padrão
              (verde, amarelo e vermelho) ou Acessíveis (azul no lugar do verde, para quem não distingue o verde do vermelho).
            </li>
            <li>
              O botão ao lado do nome de cada grupo copia o grupo inteiro (o nome e os cards) como imagem, para colar num e-mail ou numa
              apresentação; se o navegador não deixar copiar, a imagem é baixada.
            </li>
            <li>
              O comparado é o cenário escolhido em Configurações / Comparativo; sem ele, essa parte fica vazia (—), e o aviso traz o botão
              “Adicionar Comparativo” (para quem edita os cenários).
            </li>
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
              O desvio (vs. Comparado) é o valor do cenário sobre o do comparado, menos 1. O sinal fica verde (azul, nas cores Acessíveis) quando
              o cenário está do lado bom do comparado, vermelho do lado ruim, e amarelo quando o desvio é de até 5%; o lado bom depende do sentido do
              indicador (↑ ou ↓).
            </p>
          </>
        }
        acoes={
          <div className="flex flex-wrap items-center gap-4">
            <Seletor rotulo="Período" valor={String(ate)} onMudar={(v) => setAte(Number(v))} largura="w-36" opcoes={MESES.map((m, k) => ({ valor: String(k + 1), rotulo: m }))} />
            <SeletorRotulos com={comRotulos} onMudar={setComRotulos} />
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
            comRotulos={comRotulos}
            aviso={
              // Sem comparativo (13/10/2026): o quadro comum, com o destaque vermelho à esquerda e o botão Adicionar Comparativo.
              dados.comparado ? null : (
                <div className={`${AVISO_DO_PAINEL} flex flex-wrap items-center justify-between gap-3`}>
                  <span>O cenário não tem comparativo: o comparado e o desvio ficam vazios.</span>
                  {hasPermission(t.editar) ? (
                    <Button type="button" variant="outline" className="rounded-sm" onClick={() => router.push(`${t.base}/${id}/configuracoes?aba=comparativo`)}>
                      Adicionar Comparativo
                    </Button>
                  ) : (
                    <span className="text-gray-500">Peça a quem edita os cenários para escolher um em Configurações / Comparativo.</span>
                  )}
                </div>
              )
            }
          />
        </RotulosDoGrafico.Provider>
      )}
    </div>
  );
}
