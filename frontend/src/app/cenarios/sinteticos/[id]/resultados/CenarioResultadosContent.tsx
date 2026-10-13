"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Abas } from "@/components/shared/Abas";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { usePermissions } from "@/context/PermissionContext";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { TabelaResultados } from "@/app/relatorios/resultados/ResultadosContent";
import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

import { AvisoMarcado, estaTravado } from "../../../components/AvisoMarcado";
import { EdicaoDRE } from "../../../components/EdicaoDRE";
import { BotoesDeVersao } from "../../../components/VersaoCenario";
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
  // Quem edita os cenários edita a DRE aqui mesmo (12/10/2026; antes, na tela Editar, que deixou de existir).
  const { hasPermission } = usePermissions();
  // O cenário marcado (12/10/2026) ou com a versão congelada (13/10/2026) não se edita: a tabela fica só para leitura, com o aviso.
  const cenario = useQuery({ queryKey: ["cenarios", id], queryFn: () => cenariosService.obter(id) });
  const travado = !!cenario.data && estaTravado(cenario.data);
  const podeEditar = hasPermission("cenarios:editar") && !!cenario.data && !travado;
  const nome = VISOES.find((v) => v.chave === visao)!.nome;
  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Resultados"
        acoes={hasPermission("cenarios:editar") && cenario.data ? <BotoesDeVersao cenario={cenario.data} /> : undefined}
        comoUsar={
          <ul>
            <li>Troque de cenário no nome dele, na barra do topo; ao lado, a tela Indicadores.</li>
            <li>Escolha a visão nas abas: Consolidado ou cada unidade.</li>
            <li>
              Versões (para quem edita os cenários): “Congelar Versão” trava o cenário na versão atual (VER00, VER01…), como o fechamento de uma
              competência — a DRE, os Indicadores Manuais e a referência não se editam mais; “Reabrir Versão” a destrava, como a reabertura de uma
              competência. “Criar Revisão” (só numa versão congelada) cria uma cópia na próxima versão, aberta para edição: um cenário novo na lista, com a DRE, os indicadores, o comparativo e as justificativas. A marcação
              fica na versão de origem: remarque a revisão à mão em Configurações / Cenário.
            </li>
            <li>
              Com um cenário comparado (Configurações / Comparativo), depois do total do exercício vêm, em preto e cinza, o total do cenário comparado (valor, % e
              R$/m³) e, no amarelo, a Diferença (o cenário menos o comparado), o Atingimento (o cenário sobre o comparado) e a Eficiência (a diferença
              dos %, em pontos percentuais), como o orçado em Resultados Realizados — sem o mês vigente, porque o cenário se olha nos 12 meses.
            </li>
            <li>No menu de níveis (a seta antes do título da tabela), escolha Totais, Atribuições ou Contas; a seta de cada total ou atribuição abre e fecha só aquele grupo.</li>
            <li>O botão de seta ao lado do menu de níveis recolhe (seta para a esquerda) ou expande (seta para a direita) os meses antes de dezembro; a escolha fica guardada neste navegador.</li>
            <li>A tabela rola para os lados: a descrição e os rótulos ficam presos, e a barra de rolagem fica no pé da janela, sempre à vista. Dezembro e o total do exercício trazem também o valor por m³.</li>
            {podeEditar ? (
              <>
                <li>Edição (para quem edita os cenários): nas abas Matriz, Filial, Serviços, Despesas e Extra e RN, só os valores mensais das contas se editam; os totais, os percentuais e os valores por m³ são calculados. O Consolidado soma as unidades e não se edita.</li>
                <li>Para reajustar vários valores: marque as contas (a caixa de um total ou de uma atribuição marca as contas dele) e os meses (a caixa no rótulo de cada mês, ou “Marcar Todos os Meses”). Os valores marcados ficam contornados. Clique numa linha (ou em “Reajustar Marcados”) e informe o reajuste, percentual ou absoluto: ele vale para todos os marcados.</li>
                <li>Para editar um valor: clique nele. O modal mostra o valor atual, o reajuste (percentual ou absoluto) e o valor recalculado, que também se digita direto. A chave “Replicar aos meses posteriores” copia o valor recalculado aos meses seguintes. Essa edição não olha as caixas marcadas.</li>
                <li>Cada gravação recalcula os totais da unidade e o Consolidado e fica no histórico (tela Reajustes, na barra do topo). “Limpar Seleção” desmarca as contas e os meses. Com os meses anteriores recolhidos, os meses marcados e escondidos continuam marcados (a barra mostra quantos). Nome, descrição, visualização e a referência (arquivo ou resultado realizado) ficam na tela Configurações, na barra do topo.</li>
              </>
            ) : null}
          </ul>
        }
        sobre={
          <>
            <p>
              A DRE do cenário mês a mês no exercício, como as abas de Resultados Realizados (sem os centros de custo): o valor e a participação (%)
              de cada mês e o total do exercício, com o valor unitário (R$/m³) em dezembro e no total. Os valores são os digitados na ferramenta ou os da
              referência do cenário (um arquivo importado, ligado às linhas da Estrutura da DRE pela descrição, ou o resultado realizado); os totais são
              calculados pela Estrutura da DRE, e o Consolidado soma as unidades.
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
      {cenario.data && travado && hasPermission("cenarios:editar") ? <AvisoMarcado cenario={cenario.data} oQue="a DRE" /> : null}
      {podeEditar ? <EdicaoDRE key={visao} id={id} visao={Number(visao)} nome={nome} /> : <Visao id={id} visao={Number(visao)} nome={nome} />}
    </div>
  );
}
