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
import { AvisoRateiosSemBase } from "../../../components/CentrosDoCenario";
import { BotoesDeVersao } from "../../../components/VersaoCenario";
import { cenariosService } from "../../../services/cenariosService";
import { useTipoDoCenario } from "../../../components/tipoDoCenario";

/** As visões da DRE do cenário: as de Resultados Realizados, sem os centros de custo. */
const VISOES = [
  { chave: "0", aba: "consolidado", nome: "Consolidado" },
  { chave: "1", aba: "matriz", nome: "Matriz" },
  { chave: "2", aba: "filial", nome: "Filial" },
  { chave: "3", aba: "servicos", nome: "Serviços" },
  { chave: "4", aba: "despesas", nome: "Despesas e Extra" },
  { chave: "5", aba: "rn", nome: "RN" },
];

const Carregando = () => <div className="h-64 animate-pulse rounded-sm bg-gray-100" />;

function Visao({ id, visao, nome, analitico }: { id: string; visao: number; nome: string; analitico: boolean }) {
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
    return (
      <p className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">
        {analitico
          ? `O cenário ainda não tem a DRE de ${nome}: ela é calculada a partir das premissas do cenário.`
          : `O cenário não tem a DRE de ${nome}. Importe um arquivo com a aba dela em Configurações / Referência.`}
      </p>
    );
  }
  return (
    <TabelaResultados
      key={visao}
      dados={consulta.data}
      titulo={`Resultados · ${nome}`}
      visao={visao === 0 ? { consolidado: true } : { unidade: visao }}
      nomeVisao={nome}
      consultas={false}
      doCenario
    />
  );
}

/**
 * A tela Resultados de um cenário: as visões da DRE mês a mês no exercício, como em Resultados Realizados. No sintético,
 * quem edita os cenários edita a DRE aqui; no analítico (13/10/2026), a DRE é calculada a partir das premissas e fica
 * só para leitura.
 */
export function CenarioResultadosContent() {
  const { id } = useParams<{ id: string }>();
  const t = useTipoDoCenario();
  useRegistrarAcessoTela(`${t.base}/${id}/resultados`);
  const [escolhida, setVisao] = useState("0");
  // Quem edita os cenários edita a DRE aqui mesmo (12/10/2026; antes, na tela Editar, que deixou de existir).
  const { hasPermission } = usePermissions();
  // O cenário marcado (12/10/2026) ou com a versão congelada (13/10/2026) não se edita: a tabela fica só para leitura, com o aviso.
  const cenario = useQuery({ queryKey: ["cenarios", id], queryFn: () => cenariosService.obter(id) });
  const travado = !!cenario.data && estaTravado(cenario.data);
  const analitico = t.tipo === "ANALITICO";
  // As visões (abas) que o perfil lê, e a edição de cada uma (14/10/2026).
  const visoes = VISOES.filter((v) => hasPermission(t.perm("resultados", "ler", v.aba)));
  const visao = visoes.some((v) => v.chave === escolhida) ? escolhida : (visoes[0]?.chave ?? "");
  const daVisao = VISOES.find((v) => v.chave === visao);
  const podeEditar = !analitico && !!daVisao && hasPermission(t.perm("resultados", "editar", daVisao.aba)) && !!cenario.data && !travado;
  const nome = daVisao?.nome ?? "";
  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Resultados"
        acoes={hasPermission(t.perm("resultados", "editar")) && cenario.data ? <BotoesDeVersao cenario={cenario.data} /> : undefined}
        comoUsar={
          <ul>
            <li>Troque de cenário no nome dele, na barra do topo; ao lado, a tela Indicadores.</li>
            {analitico ? <li>No cenário analítico, a DRE é calculada a partir das premissas e não se edita aqui: os valores mudam com as premissas.</li> : null}
            <li>Escolha a visão nas abas: Consolidado ou cada unidade (as que o seu perfil lê).</li>
            <li>
              Versões (para quem edita a tela Resultados): “Congelar Versão” trava o cenário na versão atual (VER00, VER01…), como o fechamento de uma
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
            <li>O botão de seta ao lado do menu de níveis recolhe (seta para a esquerda) ou expande (seta para a direita) os meses — todos, dezembro também, deixando a descrição e os totais, que se esticam e enchem a tela; a escolha fica guardada neste navegador.</li>
            <li>A tabela rola para os lados: a descrição e os rótulos ficam presos, e a barra de rolagem fica no pé da janela, sempre à vista. O total do exercício traz também o valor por m³ (os meses, não).</li>
            {podeEditar ? (
              <>
                <li>Edição (para quem edita a aba): nas abas Matriz, Filial, Serviços, Despesas e Extra e RN, só os valores mensais das contas se editam; os totais, os percentuais e os valores por m³ são calculados. O Consolidado soma as unidades e não se edita.</li>
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
      <Abas rotulo="Visão dos resultados do cenário" ativa={visao} onMudar={setVisao} abas={visoes.map((v) => ({ chave: v.chave, rotulo: v.nome }))} />
      {cenario.data && travado && hasPermission(t.perm("resultados", "editar")) && !analitico ? <AvisoMarcado cenario={cenario.data} oQue="a DRE" /> : null}
      {/* No analítico, o aviso dos rateios sem base nas premissas (13/10/2026): esse valor não entra na DRE. */}
      {analitico ? <AvisoRateiosSemBase id={id} /> : null}
      {!daVisao ? (
        <p className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">Seu perfil não tem acesso a nenhuma aba desta tela.</p>
      ) : podeEditar ? (
        <EdicaoDRE key={visao} id={id} visao={Number(visao)} nome={nome} />
      ) : (
        <Visao id={id} visao={Number(visao)} nome={nome} analitico={analitico} />
      )}
    </div>
  );
}
