"use client";

import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileStack } from "lucide-react";

import { Abas } from "@/components/shared/Abas";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { Button } from "@/components/ui/button";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { TabelaResultados } from "@/app/relatorios/resultados/ResultadosContent";
import { Seletor, SeletorPeriodo, useExercicios } from "@/app/relatorios/components/SeletorPeriodo";
import { formato, mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

import { DocumentosDialog } from "./DocumentosDialog";
import { resultadosLinhaService, type LinhaDoNegocio, type Origem, type ResultadosPorLinha } from "./services/resultadosLinhaService";

const RATEIOS = "rateios";
const CONFERENCIA = "conferencia";
const Carregando = () => <div className="h-64 animate-pulse rounded-sm bg-gray-100" />;

/** Uma série mensal (as origens, o custo rateado, a conferência): o rótulo, os meses e o total. */
type Serie = { rotulo: string; meses: Array<number | null>; total?: number | null; formato?: "inteiro" | "valor"; destaque?: boolean };
const somaDos = (xs: Array<number | null>) => (xs.every((x) => x === null) ? null : xs.reduce<number>((s, x) => s + (x ?? 0), 0));

/** Uma tabela simples mês a mês, no padrão das tabelas da tela (rótulos amarelo-ouro, números à direita). */
function TabelaMensal({ titulo, meses, series, rodape }: { titulo: string; meses: ResultadosPorLinha["meses"]; series: Serie[]; rodape?: ReactNode }) {
  const numero = (s: Serie, v: number | null | undefined) => (v === null || v === undefined ? "—" : s.formato === "valor" ? formato.valor(v) : formato.inteiro(v));
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-bold text-gray-900">{titulo}</h3>
      <div className="overflow-x-auto rounded-sm border border-gray-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-bpm-primary text-xs font-bold text-black">
              <th className="min-w-56 px-3 py-2 text-left" />
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
                    {numero(s, v)}
                  </td>
                ))}
                <td className="border-l border-gray-100 px-3 py-1.5 text-right whitespace-nowrap text-gray-900">{numero(s, s.total === undefined ? somaDos(s.meses) : s.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rodape}
    </section>
  );
}

const seriesDaOrigem = (origem: Origem[]): Serie[] => origem.map((o) => ({ rotulo: o.rotulo, meses: o.meses }));

/** Uma linha: a DRE dela (da receita à Margem de Contribuição) e a origem dos valores. */
function AbaDaLinha({ dados, linha }: { dados: ResultadosPorLinha; linha: LinhaDoNegocio }) {
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
          titulo="Origem dos Valores (Receitas e Custos)"
          meses={dados.meses}
          series={seriesDaOrigem(linha.origem)}
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

/** Os rateios para as obras de uma linha: o custo que não veio dos centros de obra, e o custo por unidade da base. */
function AbaDosRateios({ dados, linhaId, onLinha }: { dados: ResultadosPorLinha; linhaId: string; onLinha: (id: string) => void }) {
  const linha = dados.linhas.find((l) => l.id === linhaId) ?? dados.linhas[0];
  if (!linha) return null;
  const c = linha.custoRateado;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Seletor rotulo="Linha" valor={linha.id} opcoes={dados.linhas.map((l) => ({ valor: l.id, rotulo: `${l.nome} (${l.nomeUnidade})` }))} onMudar={onLinha} largura="w-64" />
        <p className="max-w-3xl text-xs text-gray-600">
          Só os custos que não vieram dos centros de obra (esses já são das obras): é o que os Resultados por Obra vão levar a cada obra, pelo volume dela na
          linha.
        </p>
      </div>
      <TabelaMensal
        titulo={`Custo Rateado por Unidade (${c.base})`}
        meses={dados.meses}
        series={[
          { rotulo: "Custo Rateado (R$)", meses: c.meses.map((m) => m.custo), total: c.total.custo },
          { rotulo: `Base (${c.base})`, meses: c.meses.map((m) => m.base), total: c.total.base, formato: "valor" },
          { rotulo: `R$ por ${c.base === "m³ produzido" ? "m³" : "dia"}`, meses: c.meses.map((m) => m.unitario), total: c.total.unitario, formato: "valor", destaque: true },
        ]}
      />
      <TabelaResultados
        key={`rateios-${linha.id}`}
        dados={{ ano: dados.ano, ate: dados.ate, meses: dados.meses, linhas: linha.rateios }}
        titulo={`Rateios para Obras · ${linha.nome}`}
        visao={{ unidade: linha.unidade }}
        nomeVisao={linha.nome}
        consultas={false}
      />
    </div>
  );
}

/** A Conferência: a soma das linhas contra a DRE de cada unidade, os passos de cada unidade, os documentos e os avisos. */
function AbaDaConferencia({ dados }: { dados: ResultadosPorLinha }) {
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
        rodape={<p className="text-xs text-gray-500">Sem os documentos de um mês, os custos dele vão às linhas sem a Tarefa (a partir da Regra do Centro). Importe-os em “Documentos”.</p>}
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
 * Os Resultados por Linha (26/10/2026, pedido do Adão; Apuração dos Resultados): a DRE de cada linha de produto e de
 * obra, da receita à Margem de Contribuição, mês a mês, a partir da DRE de cada unidade; os rateios para as obras (o custo
 * que não veio dos centros de obra); e a Conferência com a DRE.
 */
export function ResultadosPorLinhaContent() {
  useRegistrarAcessoTela("/resultados-por-linha");
  const exercicios = useExercicios();
  const [anoEscolhido, setAno] = useState<number | null>(null);
  const [ateEscolhido, setAte] = useState<number | null>(null);
  const [aba, setAba] = useState<string | null>(null);
  const [linhaDosRateios, setLinhaDosRateios] = useState<string | null>(null);
  const [documentos, setDocumentos] = useState(false);
  const ano = anoEscolhido ?? exercicios.anos[0];
  const meses = ano ? exercicios.mesesDe(ano) : [];
  const ate = ateEscolhido && meses.includes(ateEscolhido) ? ateEscolhido : meses[meses.length - 1];
  const consulta = useQuery({
    queryKey: ["resultados-por-linha", ano, ate],
    queryFn: () => resultadosLinhaService.calcular(ano!, ate!),
    enabled: !!ano && !!ate,
  });
  const dados = consulta.data;
  const abas = dados
    ? [
        ...dados.linhas.map((l) => ({ chave: l.id, rotulo: l.ativo ? l.nome : `${l.nome} (Inativa)` })),
        { chave: RATEIOS, rotulo: "Rateios para Obras" },
        { chave: CONFERENCIA, rotulo: "Conferência" },
      ]
    : [];
  const ativa = abas.some((a) => a.chave === aba) ? aba! : (abas[0]?.chave ?? "");
  const linha = dados?.linhas.find((l) => l.id === ativa);
  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Resultados por Linha"
        sobre={
          <>
            <p>
              A DRE de cada linha de produto e de obra — da receita bruta à Margem de Contribuição —, mês a mês, a partir da DRE apurada de cada unidade (Matriz,
              Filial e Serviços) das competências fechadas: a soma das linhas de uma unidade é a DRE dela, conta a conta.
            </p>
            <p>
              A receita vem da Receita Prévia das linhas. Os custos e as despesas variáveis de venda vêm dos lançamentos que formaram cada valor da unidade (os
              diretos e a parte de cada rateio), e cada lançamento vai às linhas por esta ordem: a tarefa das requisições e das notas fiscais (Cadastros da
              Controladoria › Linhas › Tarefas), a regra do centro de custo, a obra (os centros de obra, pela produção, pelos acompanhamentos ou pela receita da
              própria obra), a regra do rateio do centro (Cadastros da Controladoria › Alocação nas Linhas) e, por último, o volume da unidade. Os volumes vêm
              das listas, pela mesma regra da aba Totais dos rateios.
            </p>
          </>
        }
        comoUsar={
          <ul>
            <li>Escolha o exercício e o mês até onde ver; só as competências fechadas aparecem (os meses abertos ou em conferência ficam de fora).</li>
            <li>
              Cada linha tem uma aba: a DRE dela mês a mês, com o % e o R$/m³ (as mesmas bases de Resultados Empresariais) e, abaixo, a Origem dos Valores — de
              que passo veio cada parte (a Receita Prévia, a Tarefa, a Regra do Centro, a Obra, a Regra do Rateio ou o Volume da Unidade). A linha inativa que
              ainda tem valores no período aparece com “(Inativa)”.
            </li>
            <li>
              Rateios para Obras: escolha a linha; a tabela traz só os custos que não vieram dos centros de obra (os desses centros já são das obras) e, acima, o
              custo rateado por unidade da base da linha (o m³ produzido na Matriz e na Filial; os dias de acompanhamento em Serviços) — o que os Resultados por
              Obra vão levar a cada obra.
            </li>
            <li>
              Conferência: a Margem de Contribuição da DRE de cada unidade contra a soma das linhas (iguais, com o que ficou Sem Linha), a origem dos valores de
              cada unidade, os documentos de cada mês e os avisos.
            </li>
            <li>
              “Documentos” mostra as requisições e as notas fiscais de cada mês; quem edita a tela importa o LISTAS REALIZADO (RESULTADOS) do mês (as abas
              Requisições (Lista) e Notas Fiscais (Lista)), também num mês fechado. Sem eles, os custos do mês vão às linhas sem a tarefa.
            </li>
            <li>Os meses anteriores recolhem com a seta ao lado do menu de níveis, e os níveis (Totais, Atribuições ou Contas) funcionam como em Resultados Empresariais.</li>
          </ul>
        }
        acoes={
          ano && ate ? (
            <div className="flex flex-wrap items-center justify-end gap-3">
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
              <Button type="button" variant="outline" className="rounded-sm" onClick={() => setDocumentos(true)}>
                <FileStack className="size-4" />
                Documentos
              </Button>
            </div>
          ) : null
        }
      />
      {exercicios.carregando ? (
        <Carregando />
      ) : !ano || !ate ? (
        <p className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">Nenhuma competência fechada ainda.</p>
      ) : consulta.isError ? (
        <div className="rounded-sm border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{mensagemDeErro(consulta.error, "Erro ao carregar os Resultados por Linha.")}</p>
        </div>
      ) : !dados ? (
        <Carregando />
      ) : (
        <>
          <Abas rotulo="Linhas" ativa={ativa} onMudar={setAba} abas={abas} />
          {ativa === RATEIOS ? (
            <AbaDosRateios dados={dados} linhaId={linhaDosRateios ?? dados.linhas[0]?.id ?? ""} onLinha={setLinhaDosRateios} />
          ) : ativa === CONFERENCIA ? (
            <AbaDaConferencia dados={dados} />
          ) : linha ? (
            <AbaDaLinha dados={dados} linha={linha} />
          ) : null}
        </>
      )}
      {documentos && ano ? <DocumentosDialog ano={ano} onFechar={() => setDocumentos(false)} /> : null}
    </div>
  );
}
