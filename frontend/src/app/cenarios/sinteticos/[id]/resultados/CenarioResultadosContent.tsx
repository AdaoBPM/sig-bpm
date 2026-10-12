"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Abas } from "@/components/shared/Abas";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { TabelaResultados } from "@/app/relatorios/resultados/ResultadosContent";
import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

import { cenariosService } from "../../../services/cenariosService";

/** As visões da DRE do cenário: as de Resultados Realizados, sem os centros de custo. */
const VISOES = [
  { chave: "0", nome: "Consolidado" },
  { chave: "1", nome: "Matriz" },
  { chave: "2", nome: "Filial" },
  { chave: "3", nome: "Serviços" },
  { chave: "4", nome: "Despesas e Extra" },
  { chave: "5", nome: "RN" },
];

const Carregando = () => <div className="h-64 animate-pulse rounded-sm bg-gray-100" />;

function Visao({ id, visao, nome }: { id: string; visao: number; nome: string }) {
  const consulta = useQuery({ queryKey: ["cenarios", id, "resultados", visao], queryFn: () => cenariosService.resultados(id, visao) });
  if (consulta.isError) {
    return (
      <div className="rounded-sm border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">{mensagemDeErro(consulta.error, "Erro ao carregar os resultados do cenário.")}</p>
      </div>
    );
  }
  if (consulta.isPending) return <Carregando />;
  if (consulta.data.linhas.every((l) => l.tipo === "SECAO")) {
    return <p className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">O cenário não tem a DRE de {nome}. Importe um arquivo com a aba dela na lista dos cenários.</p>;
  }
  return (
    <TabelaResultados
      key={visao}
      dados={consulta.data}
      titulo={`Resultados · ${nome}`}
      visao={visao === 0 ? { consolidado: true } : { unidade: visao }}
      nomeVisao={nome}
      consultas={false}
    />
  );
}

/** A tela Resultados de um cenário sintético: as visões da DRE mês a mês no exercício, como em Resultados Realizados. */
export function CenarioResultadosContent() {
  const { id } = useParams<{ id: string }>();
  useRegistrarAcessoTela(`/cenarios/sinteticos/${id}/resultados`);
  const [visao, setVisao] = useState("0");
  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Resultados"
        comoUsar={
          <ul>
            <li>Troque de cenário no nome dele, na barra do topo; ao lado, a tela Indicadores.</li>
            <li>Escolha a visão nas abas: Consolidado ou cada unidade.</li>
            <li>No menu de níveis (a seta antes do título da tabela), escolha Totais, Atribuições ou Contas; a seta de cada total ou atribuição abre e fecha só aquele grupo.</li>
            <li>O botão de seta ao lado do menu de níveis recolhe (seta para a esquerda) ou expande (seta para a direita) os meses antes de dezembro; a escolha fica guardada neste navegador.</li>
            <li>A tabela rola para os lados: a descrição e os rótulos ficam presos. Dezembro e o total do exercício trazem também o valor por m³.</li>
          </ul>
        }
        sobre={
          <>
            <p>
              A DRE do cenário mês a mês no exercício, como as abas de Resultados Realizados (sem os centros de custo): o valor e a participação (%)
              de cada mês e o total do exercício, com o valor unitário (R$/m³) em dezembro e no total. Os valores são os do arquivo importado no
              cenário (as abas Consolidado, Matriz, Filial, Serviços, Desp.+Extra e RN), ligados às linhas da Estrutura da DRE pela descrição.
            </p>
            <p>
              A participação e o valor unitário seguem as bases de Resultados Realizados: a ROB nas receitas e nos impostos; a Receita Líquida do
              Pré-Fabricado nos custos de produção; a de Montagem e a Complementar nos custos de serviços; a de Frete no Frete e Descarga; a ROL no
              resto. Em Despesas e Extra e no RN, as bases são as do Consolidado.
            </p>
          </>
        }
      />
      <Abas rotulo="Visão dos resultados do cenário" ativa={visao} onMudar={setVisao} abas={VISOES.map((v) => ({ chave: v.chave, rotulo: v.nome }))} />
      <Visao id={id} visao={Number(visao)} nome={VISOES.find((v) => v.chave === visao)!.nome} />
    </div>
  );
}
