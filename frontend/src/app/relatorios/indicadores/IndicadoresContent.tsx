"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChartColumn } from "lucide-react";

import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { ExportarRelatorio } from "../components/ExportarRelatorio";
import { SeletorTipoGrafico, useTipoGrafico } from "../components/GraficoRealizadoOrcado";
import { SeletorPeriodo, useExercicios } from "../components/SeletorPeriodo";
import { mensagemDeErro, relatoriosService, type Indicador } from "../services/relatoriosService";
import { GraficoIndicadorDialog } from "./GraficoIndicadorDialog";
import { TabelaIndicadores, valor } from "./TabelaIndicadores";

/**
 * A tela Indicadores (Resultados Realizados), com o exercício e o mês
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
  // O indicador com o gráfico aberto (só em Resultados Realizados; a etapa do Fechamento Mensal mostra um mês só).
  const [comGrafico, setComGrafico] = useState<Indicador | null>(null);
  const abreGrafico = !periodoFixo;
  // O tipo do gráfico do indicador (Barras ou Área), o mesmo do Painel de Bordo.
  const [tipoGrafico, setTipoGrafico] = useTipoGrafico();

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
            {periodoFixo ? null : (
              <>
              <li>Clique num indicador para abrir o gráfico dele: os meses do exercício até o escolhido, com o realizado em amarelo-ouro e o orçado (do cenário Orçamento Empresarial) em preto, como no Painel de Bordo, e o último mês e o acumulado no alto.</li>
              <li>Na lista Tipo, escolha Barras (colunas do realizado e do orçado) ou Área (o realizado numa área amarela, transparente no zero e forte no máximo do período, com o contorno em amarelo-ouro, e o orçado numa linha preta). A escolha vale também para o Painel de Bordo e fica guardada neste navegador.</li>
              </>
            )}
            <li>Use “Exportar” para baixar em Excel ou PDF (A4 deitada).</li>
          </ul>
        }
        sobre={
          <>
            <p>
              Os indicadores gerenciais do exercício, {periodoFixo ? "no mês da competência" : "mês a mês e acumulados"}, na ordem e com os nomes do
              INDICADORES DE RESULTADO (aba Realizado (SIG)). O catálogo — grupo, numeração, nome, comportamento, unidade, a fórmula de cada indicador e a forma do acumulado — fica em Cadastros da Controladoria / Estrutura dos Indicadores, onde se edita.
            </p>
            <p>
              Os valores saem da DRE apurada (congelada) de cada competência, dos volumes da apuração (projetos liberados) e dos indicadores
              importados no fechamento: a aba Indicadores (Admin.) do LISTAS REALIZADO (OPERAÇÃO) — quadro de lotação, fluxo de caixa,
              inadimplência, turnover, vagas e acidentes — e a aba Indicadores (Comercial) do CONTROLE DAS VENDAS - COMERCIAL — vendas, receita
              vendida, margem, demanda e mix. O acumulado soma os meses ou, nos indicadores de razão (%, R$/m³, eficiências, margem das vendas,
              turnover), é a média ponderada da planilha. Os de posição (quadro de lotação, inadimplência, vagas) valem o último mês.
            </p>
            <p>
              Nas Metas Estratégicas (GME), a Média Móvel da Demanda Gerada e a da Demanda Expedida (GME 4) dividem a demanda e a expedição do mês
              pela capacidade de produção, que é a meta de Produção (Vol.): Total do mês; o Atingimento do FCOL e o da MC (GME 8) dividem o
              realizado de janeiro até o mês pelo orçado do mesmo período, e o acumulado é o do
              último mês — como as linhas 112 a 115 da aba Realizado do INDICADORES DE RESULTADO.
            </p>
            <p>
              O orçado (o gráfico do indicador) vem das Metas Orçadas do cenário marcado como Orçamento Empresarial no exercício (Criação de
              Cenários / Cenários Sintéticos){dados?.cenarioOrcado ? ` — hoje, ${dados.cenarioOrcado}` : ""}; sem cenário marcado, das metas
              importadas da aba Metas (Orçamento) do INDICADORES DE RESULTADO.
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
              {abreGrafico ? <SeletorTipoGrafico tipo={tipoGrafico} onMudar={setTipoGrafico} /> : null}
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
          <TabelaIndicadores
            meses={dados.meses}
            indicadores={dados.indicadores}
            soUltimoMes={!!periodoFixo}
            onClicar={abreGrafico ? setComGrafico : undefined}
            dicaDoClique="Ver o gráfico do indicador"
            iconeDoClique={abreGrafico ? ChartColumn : undefined}
          />
          {comGrafico ? (
            <GraficoIndicadorDialog indicador={comGrafico} meses={dados.meses} formatar={(v) => valor(comGrafico, v)} tipo={tipoGrafico} onFechar={() => setComGrafico(null)} />
          ) : null}
        </>
      )}
    </div>
  );
}
