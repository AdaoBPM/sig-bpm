"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

import { Erro } from "../../../components/CenarioDialog";
import { ConfiguracoesCenario } from "../../../components/ConfiguracoesCenario";
import { cenariosService } from "../../../services/cenariosService";

/** A tela Configurações de um cenário (12/10/2026; antes, a primeira aba da tela Editar, que deixou de existir). */
export function ConfiguracoesContent() {
  const { id } = useParams<{ id: string }>();
  useRegistrarAcessoTela(`/cenarios/sinteticos/${id}/configuracoes`);
  const cenario = useQuery({ queryKey: ["cenarios", id], queryFn: () => cenariosService.obter(id) });
  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Configurações"
        comoUsar={
          <ul>
            <li>Na aba Cenário, mude o nome, a descrição e a visualização (Particular ou Pública) e clique em “Gravar Configurações”.</li>
            <li>Na aba Referência (opcional): importe um arquivo (como o ORÇAMENTO BPM) ou carregue o resultado realizado das competências fechadas de um exercício. Ela substitui a DRE do cenário, que depois se edita na tela Resultados.</li>
            <li>Troque de cenário no nome dele, na barra do topo; ao lado, as telas Resultados e Indicadores.</li>
            <li>O comparativo com outro cenário (e a variação máxima de cada total) fica na aba Comparar da tela Resultados.</li>
          </ul>
        }
        sobre={
          <p>
            Os dados do cenário e a base opcional da DRE dele: um arquivo importado ou o resultado realizado. Sem referência, a DRE se digita inteira na
            tela Resultados, com os totais calculados pela Estrutura da DRE.
          </p>
        }
      />
      {cenario.isError ? (
        <Erro erro={mensagemDeErro(cenario.error, "Erro ao carregar o cenário.")} />
      ) : cenario.isPending ? (
        <div className="h-64 animate-pulse rounded-sm bg-gray-100" />
      ) : (
        <ConfiguracoesCenario key={`${cenario.data.nome}|${cenario.data.descricao}|${cenario.data.visualizacao}`} cenario={cenario.data} />
      )}
    </div>
  );
}
