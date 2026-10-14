"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Abas } from "@/components/shared/Abas";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { usePermissions } from "@/context/PermissionContext";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

import { AvisoMarcado, estaTravado } from "../../../components/AvisoMarcado";
import { CentrosDoCenario } from "../../../components/CentrosDoCenario";
import { Erro } from "../../../components/CenarioDialog";
import { TabelaPremissas } from "../../../components/TabelaPremissas";
import { cenariosService } from "../../../services/cenariosService";

/** As abas das premissas: as unidades e os centros de custo (os investimentos e o extra-operacional virão depois). */
const ABAS = [
  { chave: "1", rotulo: "Matriz" },
  { chave: "2", rotulo: "Filial" },
  { chave: "3", rotulo: "Serviços" },
  { chave: "centros", rotulo: "Centros de Custo" },
];

/**
 * A tela Premissas de um cenário analítico (13/10/2026): as tabelas de cada unidade (Matriz e Filial, Global e
 * Mercantil; Serviços, só Global), de onde a DRE do cenário se calcula.
 */
export function PremissasContent() {
  const { id } = useParams<{ id: string }>();
  useRegistrarAcessoTela(`/cenarios/analiticos/${id}/premissas`);
  const [aba, setAba] = useState("1");
  const { hasPermission } = usePermissions();
  const cenario = useQuery({ queryKey: ["cenarios", id], queryFn: () => cenariosService.obter(id) });
  const centros = aba === "centros";
  const consulta = useQuery({ queryKey: ["cenarios", id, "premissas", aba], queryFn: () => cenariosService.premissas(id, Number(aba) as 1 | 2 | 3), enabled: !centros });
  const travado = !!cenario.data && estaTravado(cenario.data);
  const podeEditar = hasPermission("cenarios_analiticos:editar") && !travado && (centros || !!consulta.data?.editavel);
  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Premissas"
        comoUsar={
          <ul>
            <li>Escolha a unidade nas abas: Matriz e Filial têm uma tabela para a venda Global e outra, embaixo, para a Mercantil; Serviços, só a Global.</li>
            <li>
              Na aba Centros de Custo, escolha o centro na lista à esquerda (agrupada como em Resultados Realizados, com a busca e o total do exercício) e digite,
              à direita, os valores mensais das contas dele: mão de obra direta, indireta e terceirizada e gastos gerais diretos, indiretos e comerciais (as
              Matérias Primas, os Gastos Gerais Variáveis e o Estoque ficam nas tabelas das unidades, em R$ por unidade; a depreciação, nos investimentos).
              Embaixo do título do centro, o balde e para onde vai o valor; no fim da aba, os percentuais de rateio de cada mês.
            </li>
            <li>
              Cada tabela traz, mês a mês: a Jornada (os dias úteis, já calculados pelo calendário — segunda a sexta, menos os feriados nacionais), os
              Ajustes (o percentual sobre a receita bruta e líquida e o percentual sobre os custos e despesas), a Demanda Diária de cada linha (na
              unidade de medida dela; nas linhas de m³ e pistas, as pistas por dia e o volume por pista), a Receita Bruta Média e os Impostos, os
              Custos (Matérias Primas, Gastos Gerais Variáveis e Estoque, por conta) e as Despesas Variáveis de Venda, em R$ por unidade da linha.
            </li>
            <li>
              Os cálculos ficam em cinza-escuro e não se editam: o volume do mês (a demanda × os dias úteis), a Receita Líquida Média e, no fim, o
              Resultado das Premissas em R$ (o que a tabela leva para a DRE).
            </li>
            {podeEditar ? (
              <>
                <li>
                  Para editar um valor: clique nele. O modal mostra o valor atual, o reajuste (percentual ou absoluto) e o valor recalculado, que também se
                  digita direto; a chave “Replicar aos meses posteriores” copia o valor aos meses seguintes.
                </li>
                <li>
                  Para reajustar vários valores: marque as premissas (a caixa de uma seção ou de uma linha de produto marca as premissas dela) e os meses (a
                  caixa no rótulo de cada mês, ou “Marcar Todos os Meses”), e clique em “Reajustar Marcados”.
                </li>
                <li>Os valores em cinza-claro são os padrões (os dias úteis do calendário, ou zero), ainda não gravados. Cada gravação recalcula a DRE do cenário (tela Resultados) e fica no histórico (tela Reajustes).</li>
              </>
            ) : null}
          </ul>
        }
        sobre={
          <>
            <p>
              As premissas do cenário analítico, de onde a DRE dele se calcula: em cada unidade e venda, o volume de cada linha é a demanda diária ×
              os dias úteis (nas linhas de m³ e pistas, as pistas × o volume por pista); cada conta é o volume × o valor unitário × (1 + o ajuste); a
              receita líquida é a bruta × (1 − os impostos). As contas de Global e Mercantil somam-se na DRE da unidade, com os volumes (a produção e a
              expedição, iguais, a metalurgia e a montagem), e os totais e o Consolidado saem da Estrutura da DRE.
            </p>
            <p>
              Em Serviços, as linhas de Montagem e Vedação levam à receita de montagem e aos custos da CSM; as demais, à receita complementar e à CSC. A
              Média de Referência é a média realizada da referência do cenário (em desenvolvimento): o valor total ÷ a produção ou o serviço equivalente.
              A mão de obra, os gastos gerais diretos e indiretos, a depreciação, as despesas e o extra-operacional virão dos centros de custo, dos
              investimentos e do extra-operacional.
            </p>
            <p>
              Os valores dos centros de custo vão para as unidades como no fechamento mensal: nos custos de produção, os centros dos baldes Matriz e Filial vão
              direto para a unidade, os do balde Unidade para a da filial deles, e os de Produção e Projeto se rateiam entre Matriz e Filial; os de
              Metalurgia e Armadura, também entre a Montagem e a Complementar de Serviços; nos custos de montagem, os de Obras vão para Serviços e os de
              Acompanhamento se rateiam entre a Montagem e a Complementar; os das despesas vão para Despesas e Extra. Os percentuais: a Produção pelo m³
              produzido do cenário (Matriz × Filial, mês a mês); as demais chaves, sem premissa do destino, pela média do realizado.
            </p>
          </>
        }
      />
      <Abas rotulo="Unidade das premissas" ativa={aba} onMudar={setAba} abas={ABAS} />
      {cenario.data && travado && hasPermission("cenarios_analiticos:editar") ? <AvisoMarcado cenario={cenario.data} oQue="as premissas" /> : null}
      {centros ? (
        <CentrosDoCenario id={id} editavel={podeEditar} />
      ) : consulta.isError ? (
        <Erro erro={mensagemDeErro(consulta.error, "Erro ao carregar as premissas.")} />
      ) : consulta.isPending ? (
        <div className="h-64 animate-pulse rounded-sm bg-gray-100" />
      ) : (
        <div className="space-y-8">
          {consulta.data.tabelas.map((t) => (
            <TabelaPremissas key={`${aba}-${t.venda}`} id={id} dados={consulta.data} tabela={t} editavel={podeEditar} />
          ))}
        </div>
      )}
    </div>
  );
}
