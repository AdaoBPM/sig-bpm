"use client";

import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { Abas } from "@/components/shared/Abas";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { TabelaResultados } from "@/app/relatorios/resultados/ResultadosContent";
import { Seletor, SeletorPeriodo, useExercicios } from "@/app/relatorios/components/SeletorPeriodo";
import { formato, mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

import { resultadosLinhaService, type LinhaDoNegocio, type ResultadosPorLinha } from "../services/resultadosLinhaService";

const ABAS = [
  { chave: "resultados", rotulo: "Resultados" },
  { chave: "rateios", rotulo: "Rateios por Obras" },
  { chave: "conferencia", rotulo: "Conferência" },
] as const;
type ChaveDaAba = (typeof ABAS)[number]["chave"];
const Carregando = () => <div className="h-64 animate-pulse rounded-sm bg-gray-100" />;

/** Uma série mensal (as origens, a conferência): o rótulo, os meses e o total (sem ele, a soma dos meses). */
type Serie = { rotulo: string; meses: Array<number | null>; total?: number | null; destaque?: boolean };
const somaDos = (xs: Array<number | null>) => (xs.every((x) => x === null) ? null : xs.reduce<number>((s, x) => s + (x ?? 0), 0));

/**
 * Uma tabela simples mês a mês, no padrão das tabelas de Resultados: o nome da tabela na primeira célula dos rótulos
 * amarelo-ouro, os meses e o total à direita.
 */
function TabelaMensal({ titulo, meses, series, rodape }: { titulo: string; meses: ResultadosPorLinha["meses"]; series: Serie[]; rodape?: ReactNode }) {
  const numero = (v: number | null | undefined) => (v === null || v === undefined ? "—" : formato.inteiro(v));
  return (
    <section className="space-y-2">
      <div className="overflow-x-auto rounded-sm border border-gray-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-bpm-primary text-xs font-bold text-black">
              <th className="min-w-72 px-3 py-2 text-left text-sm tracking-wide whitespace-nowrap uppercase">{titulo}</th>
              {meses.map((m) => (
                <th key={m.mes} className="px-2 py-2 text-right whitespace-nowrap">
                  {m.rotulo}
                </th>
              ))}
              <th className="border-l border-black/10 px-3 py-2 text-right whitespace-nowrap">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {series.map((s) => (
              <tr key={s.rotulo} className={`border-b border-gray-100 last:border-b-0 ${s.destaque ? "font-bold" : ""}`}>
                <td className="px-3 py-1.5 whitespace-nowrap text-gray-800">{s.rotulo}</td>
                {s.meses.map((v, i) => (
                  <td key={i} className="px-2 py-1.5 text-right whitespace-nowrap text-gray-800">
                    {numero(v)}
                  </td>
                ))}
                <td className="border-l border-gray-100 px-3 py-1.5 text-right whitespace-nowrap text-gray-900">{numero(s.total === undefined ? somaDos(s.meses) : s.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rodape}
    </section>
  );
}

/** A aba Resultados: a DRE da linha (da receita à Margem de Contribuição) e a origem dos valores. */
function AbaResultados({ dados, linha }: { dados: ResultadosPorLinha; linha: LinhaDoNegocio }) {
  return (
    <div className="space-y-6">
      <TabelaResultados
        key={linha.id}
        dados={{ ano: dados.ano, ate: dados.ate, meses: dados.meses, linhas: linha.resultado }}
        titulo={`${linha.nome} · ${linha.nomeUnidade}`}
        visao={{ unidade: linha.unidade }}
        nomeVisao={linha.nome}
        consultas={false}
      />
      {linha.origem.length ? (
        <TabelaMensal
          titulo={`Origem dos Valores · ${linha.nome}`}
          meses={dados.meses}
          series={linha.origem.map((o) => ({ rotulo: o.rotulo, meses: o.meses }))}
          rodape={
            <p className="text-xs text-gray-500">
              De que passo veio cada valor da linha: a Receita Prévia (as receitas) e, nos custos, a Tarefa, a Regra do Centro, a Obra, a Regra do Rateio e o
              Volume da Unidade (Cadastros da Controladoria › Alocação nas Linhas).
            </p>
          }
        />
      ) : null}
    </div>
  );
}

/** A aba Rateios por Obras: só os custos da linha que não vieram dos centros de obra (os que os Resultados por Obra levam às obras). */
function AbaRateios({ dados, linha }: { dados: ResultadosPorLinha; linha: LinhaDoNegocio }) {
  return (
    <TabelaResultados
      key={`rateios-${linha.id}`}
      dados={{ ano: dados.ano, ate: dados.ate, meses: dados.meses, linhas: linha.rateios }}
      titulo={`Rateios por Obras · ${linha.nome}`}
      visao={{ unidade: linha.unidade }}
      nomeVisao={linha.nome}
      consultas={false}
    />
  );
}

/** A aba Conferência: a soma das linhas contra a DRE de cada unidade, a origem de cada unidade, os documentos e os avisos. */
function AbaConferencia({ dados }: { dados: ResultadosPorLinha }) {
  const c = dados.conferencia;
  return (
    <div className="space-y-6">
      <TabelaMensal
        titulo="Margem de Contribuição: DRE × Soma das Linhas"
        meses={dados.meses}
        series={c.unidades.flatMap((u) => [
          { rotulo: `${u.nome}: DRE`, meses: u.meses.map((m) => m?.mcDaDRE ?? null), destaque: true },
          { rotulo: `${u.nome}: Soma das Linhas`, meses: u.meses.map((m) => m?.mcDasLinhas ?? null) },
          { rotulo: `${u.nome}: Sem Linha (Receitas e Custos)`, meses: u.meses.map((m) => m?.semLinha ?? null) },
        ])}
        rodape={<p className="text-xs text-gray-500">A soma das linhas de cada unidade é a DRE dela, conta a conta: o que nenhum passo leva a uma linha fica Sem Linha.</p>}
      />
      {c.unidades.map((u) => (
        <TabelaMensal
          key={u.unidade}
          titulo={`Origem dos Valores · ${u.nome}`}
          meses={dados.meses}
          series={c.niveis
            .map((nv) => ({ rotulo: nv.rotulo, meses: nv.porUnidade.find((p) => p.unidade === u.unidade)?.meses ?? [] }))
            .filter((s) => s.meses.some((v) => v !== null && Math.abs(v) >= 0.005))}
        />
      ))}
      <TabelaMensal
        titulo="Requisições e Notas Fiscais (Itens)"
        meses={dados.meses}
        series={[
          { rotulo: "Requisições", meses: c.documentos.map((d) => d.requisicoes) },
          { rotulo: "Notas Fiscais", meses: c.documentos.map((d) => d.notas) },
        ]}
        rodape={<p className="text-xs text-gray-500">Sem os documentos de um mês, os custos dele vão às linhas sem a Tarefa (a partir da Regra do Centro). Importe-os na tela Importação.</p>}
      />
      {c.avisos.length ? (
        <div className="space-y-1 rounded-sm border border-l-4 border-gray-200 border-l-red-600 bg-white px-4 py-3 text-sm text-gray-700">
          {c.avisos.map((a) => (
            <p key={a}>{a}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A tela Resultados dos Resultados por Linha (26/10/2026, pedido do Adão; Apuração dos Resultados): a linha e o período no
 * topo; as abas Resultados (a DRE da linha, da receita à Margem de Contribuição), Rateios por Obras (o custo que não veio
 * dos centros de obra) e Conferência (a soma das linhas contra a DRE de cada unidade).
 */
export function ResultadosDaLinhaContent() {
  useRegistrarAcessoTela("/resultados-por-linha/resultados");
  const exercicios = useExercicios();
  const [anoEscolhido, setAno] = useState<number | null>(null);
  const [ateEscolhido, setAte] = useState<number | null>(null);
  const [aba, setAba] = useState<ChaveDaAba>("resultados");
  const [linhaEscolhida, setLinha] = useState<string | null>(null);
  const ano = anoEscolhido ?? exercicios.anos[0];
  const meses = ano ? exercicios.mesesDe(ano) : [];
  const ate = ateEscolhido && meses.includes(ateEscolhido) ? ateEscolhido : meses[meses.length - 1];
  const consulta = useQuery({
    queryKey: ["resultados-por-linha", ano, ate],
    queryFn: () => resultadosLinhaService.calcular(ano!, ate!),
    enabled: !!ano && !!ate,
  });
  const dados = consulta.data;
  // A linha escolhida vale enquanto estiver no período; senão, a primeira.
  const linha = dados?.linhas.find((l) => l.id === linhaEscolhida) ?? dados?.linhas[0];
  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Resultados"
        sobre={
          <>
            <p>
              A DRE de cada linha de produto e de obra — da receita bruta à Margem de Contribuição —, mês a mês, a partir da DRE apurada de cada unidade (Matriz,
              Filial e Serviços) das competências fechadas: a soma das linhas de uma unidade é a DRE dela, conta a conta.
            </p>
            <p>
              A receita vem da Receita Prévia das linhas. Os custos e as despesas variáveis de venda vêm dos lançamentos que formaram cada valor da unidade (os
              diretos e a parte de cada rateio), e cada lançamento vai às linhas por esta ordem: a tarefa das requisições e das notas fiscais (Cadastros da
              Controladoria › Linhas › Tarefas; os documentos entram pela tela Importação), a regra do centro de custo, a obra (os centros de obra, pela produção,
              pelos acompanhamentos ou pela receita da própria obra), a regra do rateio do centro (Cadastros da Controladoria › Alocação nas Linhas) e, por
              último, o volume da unidade. Os volumes vêm das listas, pela mesma regra da aba Totais dos rateios.
            </p>
          </>
        }
        comoUsar={
          <ul>
            <li>No topo, escolha a Linha (as ativas e as inativas com valores no período, com “(Inativa)”), o exercício e o mês até onde ver; só as competências fechadas aparecem.</li>
            <li>
              Resultados: a DRE da linha mês a mês, com o % e o R$/m³ (as mesmas bases de Resultados Empresariais) e, abaixo, a Origem dos Valores — de que passo
              veio cada parte (a Receita Prévia, a Tarefa, a Regra do Centro, a Obra, a Regra do Rateio ou o Volume da Unidade).
            </li>
            <li>
              Rateios por Obras: só os custos da linha que não vieram dos centros de obra (os desses centros já são das obras) — o que os Resultados por Obra vão
              levar a cada obra, pelo volume dela na linha.
            </li>
            <li>
              Conferência (para todas as linhas): a Margem de Contribuição da DRE de cada unidade contra a soma das linhas (iguais, com o que ficou Sem Linha), a
              origem dos valores de cada unidade, os documentos de cada mês e os avisos.
            </li>
            <li>Os meses anteriores recolhem com a seta ao lado do menu de níveis, e os níveis (Totais, Atribuições ou Contas) funcionam como em Resultados Empresariais.</li>
          </ul>
        }
        acoes={
          ano && ate ? (
            <div className="flex flex-wrap items-center justify-end gap-3">
              {dados && linha && aba !== "conferencia" ? (
                <Seletor
                  rotulo="Linha"
                  valor={linha.id}
                  opcoes={dados.linhas.map((l) => ({ valor: l.id, rotulo: `${l.nome} (${l.nomeUnidade}${l.ativo ? "" : ", Inativa"})` }))}
                  onMudar={setLinha}
                  largura="w-60"
                />
              ) : null}
              <SeletorPeriodo
                ano={ano}
                ate={ate}
                anos={exercicios.anos}
                meses={meses}
                onAno={(a) => {
                  setAno(a);
                  setAte(null);
                }}
                onAte={setAte}
              />
            </div>
          ) : null
        }
      />
      {exercicios.carregando ? (
        <Carregando />
      ) : !ano || !ate ? (
        <p className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">Nenhuma competência fechada ainda.</p>
      ) : (
        <>
          <Abas rotulo="Abas dos Resultados" ativa={aba} onMudar={(a) => setAba(a as ChaveDaAba)} abas={[...ABAS]} />
          {consulta.isError ? (
            <div className="rounded-sm border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">{mensagemDeErro(consulta.error, "Erro ao carregar os Resultados por Linha.")}</p>
            </div>
          ) : !dados ? (
            <Carregando />
          ) : aba === "conferencia" ? (
            <AbaConferencia dados={dados} />
          ) : !linha ? null : aba === "rateios" ? (
            <AbaRateios dados={dados} linha={linha} />
          ) : (
            <AbaResultados dados={dados} linha={linha} />
          )}
        </>
      )}
    </div>
  );
}
