"use client";

import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { SemResultado, useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import type { Coluna } from "@/lib/filtrosDeTabela";

import { ExportarRelatorio } from "../components/ExportarRelatorio";
import { SeletorPeriodo, useExercicios } from "../components/SeletorPeriodo";
import { formato, mensagemDeErro, relatoriosService, type Indicador, type MesRelatorio } from "../services/relatoriosService";

/** Os grupos, na ordem e com os nomes das abas da planilha (Produção, Serviços…). */
const NOME_DO_GRUPO: Record<string, string> = { GME: "Metas Estratégicas (GME)" };

const SENTIDO: Record<string, string> = { "↑": "Quanto maior, melhor", "↓": "Quanto menor, melhor", "=": "Acompanhamento", "-": "Sem sentido definido" };

/** O valor na unidade do indicador, como nas abas dos setores. */
function valor(i: Indicador, v: number | null) {
  if (v === null) return "—";
  switch (i.unidade) {
    case "%":
      return formato.pct(v);
    case "R$":
      return formato.inteiro(v);
    case "colab.":
    case "ocorr.":
      return formato.inteiro(v);
    case "pistas":
      return formato.umaCasa(v);
    default:
      return formato.valor(v);
  }
}

/** As larguras das colunas fixas (Indicador, Sent., Und.) e das de valor. */
const LARGURA = { indicador: 400, sentido: 84, unidade: 100, mes: 112, acumulado: 124 };

/**
 * As colunas, com os filtros e a ordem nos rótulos, como nas demais tabelas.
 * As três primeiras ficam presas à esquerda; os meses (e o acumulado) rolam.
 * A posição das presas segue a largura real da coluna Indicador (--largura-indicador),
 * que cresce quando a tabela é mais estreita que a área.
 */
function montarColunas(meses: MesRelatorio[], indices: number[], acumulado: boolean): Coluna<Indicador>[] {
  return [
    { chave: "indicador", rotulo: "Indicador", valor: (i) => i.nome, classe: "sticky left-0 !z-30" },
    {
      chave: "sentido",
      rotulo: "Sent.",
      valor: (i) => i.sentido,
      texto: (i) => `${i.sentido} ${SENTIDO[i.sentido] ?? ""}`.trim(),
      classe: "sticky left-[var(--largura-indicador)] !z-30",
    },
    { chave: "unidade", rotulo: "Und.", valor: (i) => i.unidade, classe: `sticky left-[calc(var(--largura-indicador)+84px)] !z-30 shadow-[inset_-1px_0_0_#d1d5db]` },
    ...indices.map(
      (k): Coluna<Indicador> => ({
        chave: `mes:${meses[k].mes}`,
        rotulo: meses[k].rotulo,
        tipo: "numero",
        alinhamento: "direita",
        valor: (i) => i.meses[k],
        texto: (i) => valor(i, i.meses[k]),
      }),
    ),
    ...(acumulado
      ? [
          {
            chave: "acumulado",
            rotulo: "Acumulado",
            tipo: "numero",
            alinhamento: "direita",
            valor: (i: Indicador) => i.total,
            texto: (i: Indicador) => valor(i, i.total),
            classe: "border-l border-gray-300",
          } as Coluna<Indicador>,
        ]
      : []),
  ];
}

/**
 * A tela Indicadores (Resultados e Indicadores), com o exercício e o mês
 * escolhidos no topo; ou, com `periodoFixo`, a etapa Indicadores do
 * Fechamento Mensal: só os valores do mês da competência, que se troca na
 * barra de etapas.
 */
export function IndicadoresContent({ periodoFixo }: { periodoFixo?: { ano: number; mes: number } } = {}) {
  useRegistrarAcessoTela(
    periodoFixo ? `/competencias/${periodoFixo.ano}-${String(periodoFixo.mes).padStart(2, "0")}/indicadores` : "/relatorios/indicadores",
  );
  const exercicios = useExercicios();
  const [anoEscolhido, setAno] = useState<number | null>(null);
  const [ateEscolhido, setAte] = useState<number | null>(null);
  const ano = periodoFixo?.ano ?? anoEscolhido ?? exercicios.anos[0];
  const meses = ano ? exercicios.mesesDe(ano) : [];
  const ate = periodoFixo ? periodoFixo.mes : ateEscolhido && meses.includes(ateEscolhido) ? ateEscolhido : meses[meses.length - 1];
  const consulta = useQuery({
    queryKey: ["relatorios", "indicadores", ano, ate],
    queryFn: () => relatoriosService.indicadores(ano!, ate),
    enabled: !!ano && !!ate,
  });
  const dados = consulta.data;

  // No mês da competência, só a coluna dele (sem os meses anteriores nem o acumulado).
  const mesesDaTabela = dados?.meses;
  const colunas = useMemo(() => {
    if (!mesesDaTabela) return [];
    const indices = periodoFixo ? [mesesDaTabela.length - 1] : mesesDaTabela.map((_, k) => k);
    return montarColunas(mesesDaTabela, indices, !periodoFixo);
  }, [mesesDaTabela, periodoFixo]);
  const tabela = useTabelaFiltravel(dados?.indicadores, colunas);
  const larguras = [LARGURA.indicador, LARGURA.sentido, LARGURA.unidade, ...colunas.slice(3).map((c) => (c.chave === "acumulado" ? LARGURA.acumulado : LARGURA.mes))];
  const total = larguras.reduce((s, w) => s + w, 0);

  // A largura real da coluna Indicador posiciona as outras duas colunas presas.
  const area = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = area.current;
    const th = el?.querySelector("thead th");
    if (!el || !th) return;
    const medir = () => el.style.setProperty("--largura-indicador", `${th.getBoundingClientRect().width}px`);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(th);
    return () => obs.disconnect();
  }, [colunas]);

  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Indicadores"
        comoUsar={
          <ul>
            <li>
              {periodoFixo
                ? "Os valores do mês desta competência; troque o mês no seletor da barra de etapas. Num mês não apurado, os indicadores da DRE ficam sem valor."
                : "Escolha o exercício e o mês até onde ver; os meses seguintes e os não apurados ficam de fora."}
            </li>
            <li>Use os filtros nos rótulos das colunas para escolher indicadores ou ordenar por um valor.</li>
            <li>As colunas Indicador, Sent. e Und. ficam fixas; role a tabela para os lados e para baixo na barra dela.</li>
            <li>Passe o mouse sobre a seta do sentido para ver se o indicador é melhor quanto maior ou quanto menor.</li>
            <li>Use “Exportar” para baixar em Excel ou PDF (A4 deitada).</li>
          </ul>
        }
        sobre={
          <>
            <p>
              Os indicadores gerenciais do exercício, {periodoFixo ? "no mês da competência" : "mês a mês e acumulados"}, na ordem e com os nomes do
              INDICADORES DE RESULTADO (aba Realizado (SIG)); a metodologia, o sentido e a forma do acumulado vêm da aba Metas.
            </p>
            <p>
              Os valores saem da DRE apurada (congelada) de cada competência, dos volumes da apuração (projetos liberados) e dos indicadores
              importados no fechamento: a aba Indicadores (Admin.) do LISTAS REALIZADO (OPERAÇÃO) — quadro de lotação, fluxo de caixa,
              inadimplência, turnover, vagas e acidentes — e a aba Indicadores (Comercial) do CONTROLE DAS VENDAS - COMERCIAL — vendas, receita
              vendida, margem, demanda e mix. O acumulado soma os meses ou, nos indicadores de razão (%, R$/m³, eficiências, margem das vendas,
              turnover), é a média ponderada da planilha. Os de posição (quadro de lotação, inadimplência, vagas) valem o último mês.
            </p>
            <p>
              Os indicadores numerados do Comercial e do Administrativo também podem ser digitados nas Listas Operacionais (abas Comercial e
              Administrativo): o valor digitado substitui o importado até uma nova importação da aba. Um indicador importado fica sem valor no
              mês em que a aba não foi importada nem o valor digitado.
            </p>
          </>
        }
        acoes={
          ano && ate ? (
            <div className="flex flex-wrap items-center gap-4">
              {periodoFixo ? null : (
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
              )}
              <ExportarRelatorio
                caminho="indicadores"
                padrao={periodoFixo ? `Indicadores ${ano}-${String(ate).padStart(2, "0")}` : `Indicadores ${ano}`}
                opcoes={[
                  {
                    chave: "todos",
                    excel: "Todos os Indicadores",
                    pdf: "Todos os Indicadores",
                    params: periodoFixo ? { ano, ate, escopo: "mes" } : { ano, ate },
                  },
                ]}
              />
            </div>
          ) : null
        }
      />

      {!periodoFixo && exercicios.carregando ? (
        <div className="h-64 animate-pulse rounded-sm bg-gray-100" />
      ) : !ano || !ate ? (
        <p className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">Nenhuma competência apurada ainda.</p>
      ) : consulta.isError ? (
        <div className="rounded-sm border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{mensagemDeErro(consulta.error, "Erro ao carregar os indicadores.")}</p>
        </div>
      ) : !dados ? (
        <div className="h-64 animate-pulse rounded-sm bg-gray-100" />
      ) : (
        <>
          {tabela.ativos ? (
            <div className="flex justify-end">
              <button type="button" onClick={tabela.limpar} className="text-xs font-medium text-gray-900 underline underline-offset-2">
                Limpar Filtros
              </button>
            </div>
          ) : null}
          {/* Uma tabela só (rótulos e valores alinhados), com rolagem própria: os rótulos presos no alto da área e as três primeiras colunas à esquerda. */}
          <div
            ref={area}
            className="max-h-[calc(100vh-14rem)] overflow-auto rounded-sm border border-gray-200 bg-white [--largura-indicador:400px] [--topo-tabela:0px]"
          >
            <table className="tabela-sig table-fixed border-collapse text-sm" style={{ width: total, minWidth: "100%" }}>
              <colgroup>
                {/* A coluna Indicador sem largura: fica com o que sobra quando a tabela é mais estreita que a área. */}
                <col style={{ minWidth: LARGURA.indicador }} />
                {larguras.slice(1).map((w, k) => (
                  <col key={k} style={{ width: w }} />
                ))}
              </colgroup>
              {tabela.cabecalho}
              <tbody>
                {tabela.visiveis.length === 0 ? (
                  <SemResultado colunas={colunas.length} onLimpar={tabela.limpar} />
                ) : (
                  tabela.visiveis.map((i, k) => {
                    const anterior = tabela.visiveis[k - 1];
                    const principal = i.numero === "";
                    const tom = principal ? "text-gray-900" : "text-gray-700";
                    return (
                      <Fragment key={i.nome}>
                        {!anterior || anterior.grupo !== i.grupo ? (
                          <tr className="border-y border-gray-300">
                            <td colSpan={colunas.length} className="bg-yellow-50 px-3 py-2 text-sm font-bold tracking-wide text-gray-900 uppercase">
                              <span className="sticky left-3">{NOME_DO_GRUPO[i.grupo] ?? i.grupo}</span>
                            </td>
                          </tr>
                        ) : null}
                        <tr className={`border-t border-gray-100 ${principal ? "font-bold" : ""}`}>
                          <td className={`sticky left-0 z-10 bg-white py-1.5 pr-3 ${principal ? "pl-4" : "pl-9"} ${tom}`}>
                            <div className="flex items-baseline gap-2">
                              {i.numero ? <span className="w-10 shrink-0 text-xs font-normal text-gray-400">{i.numero}</span> : null}
                              <span>{i.nome}</span>
                            </div>
                            <div className={`text-xs font-normal text-gray-500 ${i.numero ? "pl-12" : ""}`}>
                              {i.metodologia}
                              {i.acumulado === "ATUAL" && !periodoFixo ? " · acumulado: o último mês" : ""}
                            </div>
                          </td>
                          <td
                            className="sticky left-[var(--largura-indicador)] z-10 bg-white px-4 py-1.5 font-normal text-gray-600"
                            title={SENTIDO[i.sentido]}
                          >
                            {i.sentido}
                          </td>
                          <td
                            className={`sticky left-[calc(var(--largura-indicador)+84px)] z-10 bg-white shadow-[inset_-1px_0_0_#d1d5db] px-4 py-1.5 text-xs font-normal whitespace-nowrap text-gray-600`}
                          >
                            {i.unidade}
                          </td>
                          {colunas.slice(3).map((c) => (
                            <td
                              key={c.chave}
                              className={`px-4 py-1.5 text-right whitespace-nowrap ${tom} ${c.chave === "acumulado" ? "border-l border-gray-300" : ""}`}
                            >
                              {c.texto?.(i)}
                            </td>
                          ))}
                        </tr>
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
