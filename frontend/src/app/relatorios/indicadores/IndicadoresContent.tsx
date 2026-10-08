"use client";

import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { ExportarRelatorio } from "../components/ExportarRelatorio";
import { SeletorPeriodo, useExercicios } from "../components/SeletorPeriodo";
import { TabelaLarga } from "../components/TabelaLarga";
import { formato, mensagemDeErro, relatoriosService, type Indicador } from "../services/relatoriosService";

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

export function IndicadoresContent() {
  useRegistrarAcessoTela("/relatorios/indicadores");
  const exercicios = useExercicios();
  const [anoEscolhido, setAno] = useState<number | null>(null);
  const [ateEscolhido, setAte] = useState<number | null>(null);
  const ano = anoEscolhido ?? exercicios.anos[0];
  const meses = ano ? exercicios.mesesDe(ano) : [];
  const ate = ateEscolhido && meses.includes(ateEscolhido) ? ateEscolhido : meses[meses.length - 1];
  const consulta = useQuery({
    queryKey: ["relatorios", "indicadores", ano, ate],
    queryFn: () => relatoriosService.indicadores(ano!, ate),
    enabled: !!ano && !!ate,
  });
  const dados = consulta.data;
  const lista = dados?.indicadores ?? [];
  const grupos = [...new Set(lista.map((i) => i.grupo))];
  const colunas = 5 + (dados?.meses.length ?? 0);
  const th = "px-2 py-2 text-right text-xs font-bold whitespace-nowrap text-gray-900";

  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Indicadores"
        comoUsar={
          <ul>
            <li>Escolha o exercício e o mês até onde ver; os meses seguintes e os não apurados ficam de fora.</li>
            <li>Passe o mouse sobre a seta do sentido para ver se o indicador é melhor quanto maior ou quanto menor.</li>
            <li>Use “Exportar” para baixar em Excel ou PDF (A4 deitada).</li>
          </ul>
        }
        sobre={
          <>
            <p>
              Os indicadores gerenciais do exercício, mês a mês e acumulados, na ordem e com os nomes do INDICADORES DE RESULTADO (aba
              Realizado (SIG)); a metodologia, o sentido e a forma do acumulado vêm da aba Metas.
            </p>
            <p>
              Os valores saem da DRE apurada (congelada) de cada competência, dos volumes da apuração (projetos liberados) e dos indicadores
              importados no fechamento: a aba Indicadores (Admin.) do LISTAS REALIZADO (OPERAÇÃO) — quadro de lotação, fluxo de caixa,
              inadimplência, turnover, vagas e acidentes — e a aba Indicadores (Comercial) do CONTROLE DAS VENDAS - COMERCIAL — vendas, receita
              vendida, margem, demanda e mix. O acumulado soma os meses ou, nos indicadores de razão (%, R$/m³, eficiências, margem das vendas,
              turnover), é a média ponderada da planilha. Os de posição (quadro de lotação, inadimplência, vagas) valem o último mês.
            </p>
            <p>Um indicador importado fica sem valor no mês em que a aba não foi importada.</p>
          </>
        }
        acoes={
          ano && ate ? (
            <div className="flex flex-wrap items-center gap-4">
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
              <ExportarRelatorio
                caminho="indicadores"
                padrao={`Indicadores ${ano}`}
                opcoes={[{ chave: "todos", excel: "Todos os Indicadores", pdf: "Todos os Indicadores", params: { ano, ate } }]}
              />
            </div>
          ) : null
        }
      />

      {exercicios.carregando ? (
        <div className="h-64 animate-pulse rounded-sm bg-gray-100" />
      ) : !ano || !ate ? (
        <p className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">Nenhuma competência apurada ainda.</p>
      ) : (
        <>

          {consulta.isError ? (
            <div className="rounded-sm border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">{mensagemDeErro(consulta.error, "Erro ao carregar os indicadores.")}</p>
            </div>
          ) : !dados ? (
            <div className="h-64 animate-pulse rounded-sm bg-gray-100" />
          ) : (
            // Os rótulos presos no topo da página, abaixo do título; o corpo rola para os lados (TabelaLarga).
            <TabelaLarga
              larguras={[400, 56, 84, ...dados.meses.map(() => 104), 120]}
              cabecalho={
                  <tr className="border-b border-gray-300">
                    <th className="left-0 !z-20 px-3 py-2 text-left text-xs font-bold text-gray-900">Indicador</th>
                    <th className="px-2 py-2 text-center text-xs font-bold text-gray-900" title="Sentido">
                      Sent.
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-bold text-gray-900">Und.</th>
                    {dados.meses.map((m) => (
                      <th key={m.mes} className={th}>
                        {m.rotulo}
                      </th>
                    ))}
                    <th className={`${th} border-l border-gray-300`}>Acumulado</th>
                  </tr>
              }
              corpo={grupos.map((g) => (
                    <Fragment key={g}>
                      <tr className="border-y border-gray-300">
                        <td colSpan={colunas} className="bg-gray-50 px-3 py-2 text-sm font-bold tracking-wide text-gray-900 uppercase">
                          <span className="sticky left-3">{NOME_DO_GRUPO[g] ?? g}</span>
                        </td>
                      </tr>
                      {lista
                        .filter((i) => i.grupo === g)
                        .map((i) => {
                          const principal = i.numero === "";
                          const tom = principal ? "text-gray-900" : "text-gray-700";
                          return (
                            <tr key={i.nome} className={`border-t border-gray-100 ${principal ? "font-bold" : ""}`}>
                              <td className={`sticky left-0 z-10 bg-white py-1.5 pr-3 ${principal ? "pl-4" : "pl-9"} ${tom}`}>
                                <div className="flex items-baseline gap-2">
                                  {i.numero ? <span className="w-10 shrink-0 text-xs font-normal text-gray-400">{i.numero}</span> : null}
                                  <span>{i.nome}</span>
                                </div>
                                <div className={`text-xs font-normal text-gray-500 ${i.numero ? "pl-12" : ""}`}>
                                  {i.metodologia}
                                  {i.acumulado === "ATUAL" ? " · acumulado: o último mês" : ""}
                                </div>
                              </td>
                              <td className="px-2 py-1.5 text-center font-normal text-gray-600" title={SENTIDO[i.sentido]}>
                                {i.sentido}
                              </td>
                              <td className="px-2 py-1.5 text-xs font-normal whitespace-nowrap text-gray-600">{i.unidade}</td>
                              {i.meses.map((v, k) => (
                                <td key={k} className={`px-2 py-1.5 text-right whitespace-nowrap ${tom}`}>
                                  {valor(i, v)}
                                </td>
                              ))}
                              <td className={`border-l border-gray-300 px-2 py-1.5 text-right whitespace-nowrap ${tom}`}>{valor(i, i.total)}</td>
                            </tr>
                          );
                        })}
                    </Fragment>
                  ))}
            />
          )}
        </>
      )}
    </div>
  );
}
