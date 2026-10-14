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
import { AvisoRateiosSemBase, CentrosDoCenario, RateiosDoCenario } from "../../../components/CentrosDoCenario";
import { Erro } from "../../../components/CenarioDialog";
import { ExtraDoCenario, InvestimentosDoCenario } from "../../../components/InvestimentosDoCenario";
import { IndicadoresManuais } from "../../../components/IndicadoresManuais";
import { TabelaPremissas } from "../../../components/TabelaPremissas";
import { cenariosService } from "../../../services/cenariosService";

/** As abas das premissas: as unidades, os centros de custo, os rateios, os investimentos, o extra-operacional e os indicadores manuais. */
const ABAS = [
  { chave: "1", rotulo: "Matriz" },
  { chave: "2", rotulo: "Filial" },
  { chave: "3", rotulo: "Serviços" },
  { chave: "centros", rotulo: "Centros de Custo" },
  { chave: "rateios", rotulo: "Rateios" },
  { chave: "investimentos", rotulo: "Investimentos" },
  { chave: "extra", rotulo: "Extra-Operacional" },
  { chave: "manuais", rotulo: "Indicadores Manuais" },
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
  const rateios = aba === "rateios";
  const investimentos = aba === "investimentos";
  const extra = aba === "extra";
  const manuais = aba === "manuais";
  const deUnidade = !centros && !rateios && !investimentos && !extra && !manuais;
  const consulta = useQuery({ queryKey: ["cenarios", id, "premissas", aba], queryFn: () => cenariosService.premissas(id, Number(aba) as 1 | 2 | 3), enabled: deUnidade });
  const travado = !!cenario.data && estaTravado(cenario.data);
  const podeEditar = hasPermission("cenarios_analiticos:editar") && !travado && (!deUnidade || !!consulta.data?.editavel);
  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Premissas"
        comoUsar={
          <ul>
            <li>Escolha a unidade nas abas: Matriz e Filial têm uma tabela para a venda Global e outra, embaixo, para a Mercantil; Serviços, só a Global.</li>
            <li>
              Na aba Centros de Custo, escolha o grupo de centros da Controladoria na lista à esquerda (com a busca e o total do exercício; os centros de
              estoque e de investimento não entram) e digite, à direita, os valores mensais das contas dele: mão de obra direta e indireta e gastos
              gerais diretos, indiretos e comerciais (as Matérias Primas, a Mão de Obra Terceirizada, os Gastos Gerais Variáveis e o Estoque ficam nas
              tabelas das unidades, em R$ por unidade; a depreciação, nos investimentos). Embaixo do título, os centros do grupo, o balde e para onde vai o valor; o grupo com centros de
              baldes diferentes tem um asterisco na lista e o aviso (o valor vai pelo balde mais comum).
            </li>
            <li>
              Na aba Rateios, a base de cada mês (das premissas) e o percentual de cada destino: Produção pelo m³ produzido; Projeto pelo m³ produzido da venda
              Global; Metalurgia e Armadura pelo kg de cada linha (o volume × a Metalurgia ou a Armadura por Unidade); Acompanhamento pelos
              Acompanhamentos por Dia das linhas de Serviços (× os dias úteis). Sem base no mês, o percentual é zero, e o valor dos grupos daquela chave não entra.
            </li>
            <li>
              Na aba Investimentos, em cima, a Depreciação Base de cada unidade mês a mês (digitada: o maquinário de produção na Matriz e na Filial, o de
              serviços em Serviços e o patrimônio em Despesas e Extra), com a depreciação dos investimentos e a total; embaixo, a lista dos investimentos.
              {podeEditar ? " Clique em “Novo Investimento” para incluir um, ou numa linha da lista para editá-lo ou excluí-lo." : null} Cada investimento
              tem a unidade (a conta é a de depreciação dela), a descrição, o ganho previsto, a receita bruta prevista, o mês de início, o valor total, o
              valor pós uso e a vida útil em meses; a lista mostra a depreciação mensal e o ROI.
            </li>
            <li>
              Na aba Extra-Operacional, como nos Lançamentos Manuais do fechamento, os valores mensais do imposto de renda e da contribuição social e das
              receitas e despesas financeiras, em Despesas e Extra e no RN.
            </li>
            <li>
              Na aba Indicadores Manuais, como nos cenários sintéticos, os quadros de lotação e os indicadores do Comercial e do Administrativo, que não
              saem da DRE{podeEditar ? ": clique numa linha para digitar os doze meses (as células digitadas ficam em amarelo)" : ""}.
            </li>
            <li>
              A base das premissas pode vir da referência (Configurações / Referência): o resultado realizado (as Médias de Referência, os centros de
              custo, a depreciação, o extra-operacional e os indicadores) ou outro cenário analítico.
            </li>
            <li>
              Cada tabela traz, mês a mês: a Jornada (os dias úteis, já calculados pelo calendário — segunda a sexta, menos os feriados nacionais), os
              Ajustes (o percentual sobre a receita bruta e líquida e o percentual sobre os custos e despesas), a Demanda Diária de cada linha (na
              unidade de medida dela; nas linhas de m³ e pistas, as pistas por dia e o volume por pista), a Armadura e a Metalurgia por Unidade (em kg por
              unidade da linha: kg/m³, kg/kg, kg/m²; só nas linhas que as levam), a Receita Bruta Média (na Matriz e na Filial, também a de Devoluções e
              Inventários, negativa) e os Impostos, os Custos (Matérias Primas, Mão de Obra Terceirizada, Gastos Gerais Variáveis e Estoque, por conta) e
              as Despesas Variáveis de Venda, em R$ por unidade da linha.
            </li>
            <li>
              Os cálculos ficam em cinza-escuro e não se editam: o volume do mês (a demanda × os dias úteis), a armadura e a metalurgia do mês (o
              volume × o kg por unidade), a Receita Líquida Média e, no fim, o
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
              expedição, iguais, a metalurgia consumida pelas linhas da unidade e a montagem), e os totais e o Consolidado saem da Estrutura da DRE.
            </p>
            <p>
              Em Serviços, as linhas de Montagem e Vedação levam à receita de montagem e aos custos da CSM; as demais, à receita complementar e à CSC. A
              Média de Referência é a média realizada da referência do cenário (Configurações / Referência / Resultado Realizado): o total do período ÷ o
              volume da linha — o m³ produzido (o kg na Metalúrgica), o m³ montado na Montagem e o kg na Metálica; as linhas de Serviços sem volume nas
              listas vão por dia útil (a demanda diária fica 1). A demanda diária é o volume do período ÷ os dias úteis dele, e os doze meses começam
              iguais às médias.
              A mão de obra direta e indireta, os gastos gerais diretos e indiretos e as despesas vêm dos centros de custo; a depreciação, dos investimentos; o imposto de
              renda, a contribuição social e o resultado financeiro, do extra-operacional.
            </p>
            <p>
              Os valores dos grupos de centros de custo vão para as unidades como no fechamento mensal, pelo balde do grupo: nos custos de produção, Matriz e
              Filial vão direto para a unidade, Unidade para a da filial dos centros, e Produção e Projeto se rateiam entre Matriz e Filial; Metalurgia e
              Armadura, também entre a Montagem e a Complementar de Serviços; nos custos de montagem, Obras vai para Serviços e Acompanhamento se rateia entre
              a Montagem e a Complementar; as despesas vão para Despesas e Extra. Os percentuais saem das bases das premissas (a aba Rateios). Em Serviços, os
              Acompanhamentos no Mês somam o Acompanhamento de Obra (d) da DRE.
            </p>
            <p>
              Na referência realizada, a receita de cada conta (Pré-Fabricado, Frete, Devoluções e Inventários, Montagem e Complementar) é a da DRE da unidade, dividida entre as
              linhas e as vendas pelos itens da receita prévia, e os impostos são os dos itens, ajustados aos da DRE da unidade. Os custos (Matérias
              Primas, Mão de Obra Terceirizada, Gastos Gerais Variáveis e Estoque) e as despesas variáveis de venda de cada conta e mês são os da DRE da unidade, divididos entre as
              linhas na proporção das requisições e das notas fiscais com a tarefa de cada linha (a Correspondência Tarefa × Linha, nos Cadastros da Controladoria / Linhas);
              o que não tem tarefa vai pelo m³ das linhas (pela receita, nas despesas variáveis de venda e em Serviços). A armadura e a metalurgia por
              unidade são as das listas de cada linha ÷ o volume dela.
            </p>
            <p>
              A depreciação de cada unidade é a base digitada mais a dos investimentos: cada investimento deprecia (valor total − valor pós uso) ÷ vida útil
              por mês, do mês de início até o fim da vida útil (ou do ano). O ROI do investimento é (receita bruta prevista − valor total) ÷ valor total ×
              100.
            </p>
          </>
        }
      />
      <Abas rotulo="Unidade das premissas" ativa={aba} onMudar={setAba} abas={ABAS} />
      <AvisoRateiosSemBase id={id} />
      {cenario.data && travado && hasPermission("cenarios_analiticos:editar") ? <AvisoMarcado cenario={cenario.data} oQue="as premissas" /> : null}
      {centros ? (
        <CentrosDoCenario id={id} editavel={podeEditar} />
      ) : rateios ? (
        <RateiosDoCenario id={id} />
      ) : investimentos ? (
        <InvestimentosDoCenario id={id} editavel={podeEditar} />
      ) : extra ? (
        <ExtraDoCenario id={id} editavel={podeEditar} />
      ) : manuais ? (
        <IndicadoresManuais id={id} podeEditar={podeEditar} />
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
