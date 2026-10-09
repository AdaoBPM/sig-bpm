"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";

import { Abas } from "@/components/shared/Abas";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { SeletorPeriodo, useExercicios } from "../components/SeletorPeriodo";
import { mensagemDeErro, relatoriosService, type BlocoPainel, type FormatoPainel, type ItemPainel, type QuadroPainel } from "../services/relatoriosService";

const numero = (casas: number) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas, signDisplay: "negative" });
const n0 = numero(0);
const n1 = numero(1);
const n2 = numero(2);

/** R$ com o sinal antes do símbolo (-R$ 381,2K), como nas demais telas. */
const moeda = (v: number, texto: (x: number) => string) => `${v < 0 ? "-" : ""}R$ ${texto(Math.abs(v))}`;

/** Os formatos dos valores do painel, como na planilha: R$ em milhões (M) ou milhares (K), volumes, percentuais e R$/m³. */
function formatar(v: number | null, f: FormatoPainel) {
  if (v === null) return "—";
  switch (f) {
    case "MILHOES":
      return moeda(v, (x) => `${n1.format(x / 1e6)}M`);
    case "MILHARES":
      return moeda(v, (x) => `${n1.format(x / 1e3)}K`);
    case "M3":
      return `${n0.format(v)} m³`;
    case "PISTAS":
      return `${n0.format(v)} pst`;
    case "PCT":
      return `${n1.format(v * 100)}%`;
    case "PCT_RL":
      return `${n1.format(v * 100)}%/RL`;
    case "RS_M3":
      return moeda(v, (x) => `${n0.format(x)}/m³`);
  }
}

const desvio = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${n1.format(v * 100)}%`);

/** As cores do sinal, as da formatação condicional da planilha; o selo do desvio num tom claro da mesma cor. */
const SINAL = {
  1: { cor: "bg-[#92D050]", selo: "bg-green-50 text-green-800 ring-green-200", texto: "Melhor que o orçado" },
  0: { cor: "bg-[#FFFF00]", selo: "bg-yellow-50 text-yellow-800 ring-yellow-200", texto: "Até 5% do orçado" },
  [-1]: { cor: "bg-[#C00000]", selo: "bg-red-50 text-red-700 ring-red-200", texto: "Pior que o orçado" },
} as const;

function Sinal({ s }: { s: BlocoPainel["sinal"] }) {
  if (s === null) return <span className="inline-block size-3 rounded-[2px] border border-gray-300" title="Sem orçado" />;
  return <span className={`inline-block size-3 rounded-[2px] ring-1 ring-black/10 ${SINAL[s].cor}`} title={SINAL[s].texto} aria-label={SINAL[s].texto} />;
}

/** O desvio contra o orçado num selo com a cor do sinal. */
function SeloDesvio({ b }: { b: BlocoPainel }) {
  const tom = b.sinal === null ? "bg-gray-50 text-gray-600 ring-gray-200" : SINAL[b.sinal].selo;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-xs font-bold ring-1 ${tom}`} title={b.sinal === null ? "Sem orçado" : SINAL[b.sinal].texto}>
      <Sinal s={b.sinal} />
      {desvio(b.vsOrcado)}
    </span>
  );
}

/** As cores dos gráficos, como os da planilha INDICADORES DE RESULTADO: o realizado em amarelo-ouro e a meta em preto. */
const CORES: ChartConfig = {
  realizado: { label: "Realizado", color: "#ffcc00" },
  orcado: { label: "Orçado", color: "#111111" },
};

function Grafico({ item }: { item: ItemPainel }) {
  return (
    <ChartContainer config={CORES} className="aspect-auto h-28 w-full" initialDimension={{ width: 300, height: 112 }}>
      <BarChart data={item.serie} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barGap={1} barCategoryGap="18%">
        <CartesianGrid vertical={false} stroke="#e5e7eb" />
        <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={4} fontSize={10} interval={0} />
        <YAxis hide />
        <Tooltip
          cursor={{ fill: "#f3f4f6" }}
          content={({ active, payload, label }: TooltipContentProps<number, string>) =>
            active && payload?.length ? (
              <div className="rounded-sm border border-gray-200 bg-white px-2.5 py-1.5 text-xs shadow-sm">
                <p className="font-bold text-gray-900">{label}</p>
                {payload.map((p) => (
                  <p key={String(p.dataKey)} className="flex items-center gap-1.5 text-gray-700">
                    <span className="inline-block size-2.5 rounded-[2px]" style={{ background: p.color }} />
                    {p.dataKey === "realizado" ? "Realizado" : "Orçado"}: {formatar((p.value as number | null) ?? null, item.formato)}
                  </p>
                ))}
              </div>
            ) : null
          }
        />
        <Bar dataKey="realizado" fill="var(--color-realizado)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="orcado" fill="var(--color-orcado)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  );
}

/** O percentual sob o realizado (▪ 48,4% (/RL)), quando o item tem. */
const percentualDaBase = (i: ItemPainel, b: BlocoPainel) =>
  i.base ? `${b.base === null ? "—" : `${(i.base.casas === 2 ? n2 : n1).format(b.base * 100)}%`} ${i.base.rotulo}` : null;

/**
 * Um indicador em card (09/10/2026): o realizado do mês em destaque, com o orçado e o desvio; o gráfico dos meses do
 * exercício (realizado × orçado, como os da planilha); e o acumulado no rodapé.
 */
function CardIndicador({ i, rotuloMes }: { i: ItemPainel; rotuloMes: string }) {
  const baseMes = percentualDaBase(i, i.mes);
  const baseAcum = percentualDaBase(i, i.acumulado);
  return (
    <article className="flex flex-col rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white px-4 pt-3 pb-2">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-gray-900" title={i.titulo}>
            {i.titulo}
          </h3>
          <p className="text-xs text-gray-500">
            {i.sigla}{" "}
            <span title={i.sentido === "↑" ? "Quanto maior, melhor" : "Quanto menor, melhor"} className="font-bold text-gray-700">
              {i.sentido}
            </span>
          </p>
        </div>
        <SeloDesvio b={i.mes} />
      </header>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <p className="text-2xl font-extrabold whitespace-nowrap text-gray-900" title={`Realizado de ${rotuloMes}`}>
          {formatar(i.mes.realizado, i.formato)}
        </p>
        <p className="text-right text-xs whitespace-nowrap text-gray-600">
          Orçado <span className="font-bold text-gray-900">{formatar(i.mes.orcado, i.formato)}</span>
        </p>
      </div>
      <p className="h-4 text-xs text-gray-500">{baseMes}</p>

      <div className="mt-1">
        <Grafico item={i} />
      </div>

      {/* O acumulado no rodapé, em três partes como o mês: o realizado (com o percentual), o orçado e o desvio. */}
      <footer className="mt-1 flex items-end justify-between gap-3 border-t border-gray-100 pt-2 text-xs">
        <div className="min-w-0">
          <p className="font-bold tracking-wide text-gray-500 uppercase">Acumulado</p>
          <p className="whitespace-nowrap">
            <span className="text-sm font-bold text-gray-900">{formatar(i.acumulado.realizado, i.formatoAcumulado)}</span>
            {baseAcum ? <span className="text-gray-500"> · {baseAcum}</span> : null}
          </p>
        </div>
        <div className="ml-auto text-right whitespace-nowrap">
          <p className="text-gray-500">Orçado</p>
          <p className="text-sm font-bold text-gray-900">{formatar(i.acumulado.orcado, i.formatoAcumulado)}</p>
        </div>
        <SeloDesvio b={i.acumulado} />
      </footer>
    </article>
  );
}

/** Um quadro do painel (Consolidado, Produção: Matriz…): uma seção com um card por indicador, uma seção abaixo da outra. */
function Secao({ q, rotuloMes }: { q: QuadroPainel; rotuloMes: string }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-bold tracking-wide text-gray-900 uppercase">{q.titulo}</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 min-[1700px]:grid-cols-4">
        {q.itens.map((i) => (
          <CardIndicador key={`${i.titulo}|${i.sigla}`} i={i} rotuloMes={rotuloMes} />
        ))}
      </div>
    </section>
  );
}

export function PainelContent() {
  useRegistrarAcessoTela("/relatorios/painel");
  const exercicios = useExercicios();
  const [anoEscolhido, setAno] = useState<number | null>(null);
  const [ateEscolhido, setAte] = useState<number | null>(null);
  const [aba, setAba] = useState("resultados");
  const ano = anoEscolhido ?? exercicios.anos[0];
  const meses = ano ? exercicios.mesesDe(ano) : [];
  const ate = ateEscolhido && meses.includes(ateEscolhido) ? ateEscolhido : meses[meses.length - 1];
  const consulta = useQuery({
    queryKey: ["relatorios", "painel", ano, ate],
    queryFn: () => relatoriosService.painel(ano!, ate),
    enabled: !!ano && !!ate,
  });
  const dados = consulta.data;
  const atual = dados?.abas.find((a) => a.chave === aba) ?? dados?.abas[0];

  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Painel de Bordo"
        comoUsar={
          <ul>
            <li>Escolha o exercício e o mês de referência; o acumulado vai de janeiro até ele.</li>
            <li>Troque entre as abas Resultados e Performance (os unitários).</li>
            <li>
              Cada grupo (Consolidado, Produção: Matriz…) é uma seção, uma abaixo da outra, com um card por indicador: o realizado do mês em
              destaque, o orçado e o desvio (vs. Orçado) no selo colorido; o gráfico dos meses do exercício, com o realizado em amarelo-ouro e o
              orçado em preto; e, no rodapé, o acumulado com o orçado e o desvio.
            </li>
            <li>Passe o mouse sobre as colunas do gráfico para ver os valores do mês, sobre o selo para ler o sinal e sobre a seta para ver o sentido do indicador.</li>
            <li>O orçado vem das metas importadas: importe a aba Metas (Orçamento) em cada mês, na etapa Importações do Fechamento Mensal.</li>
          </ul>
        }
        sobre={
          <>
            <p>
              O realizado contra o orçado do mês e do acumulado do exercício, como as abas Painel (Resultados) e Painel (Performance) do SIG
              BPM 2026 - INDICADORES DE RESULTADO, com os gráficos mês a mês no padrão dos da planilha (realizado em amarelo-ouro, meta em preto).
            </p>
            <p>
              O realizado sai dos mesmos valores da tela Indicadores: a DRE apurada, os volumes da apuração e os indicadores importados (ou
              digitados nas Listas Operacionais). O orçado sai da aba Metas (Orçamento) do mesmo arquivo, importada mês a mês; o acumulado do
              orçado segue a aba Metas (soma dos meses ou, nas razões, a média ponderada pela base).
            </p>
            <p>
              O desvio (vs. Orçado) é o realizado sobre o orçado, menos 1 (com o orçado negativo, o sinal se inverte). O sinal fica verde
              quando o realizado está do lado bom do orçado, vermelho do lado ruim, e amarelo quando o desvio é de até 5%. O lado bom depende
              do sentido do indicador: ↑ quanto maior, melhor; ↓ quanto menor, melhor.
            </p>
            <p>
              Como na planilha, o resultado financeiro e as despesas fixas aparecem em milhares (K) no mês e em milhões (M) no acumulado. O
              percentual sob o resultado financeiro é sobre a margem de contribuição (/MC).
            </p>
          </>
        }
        acoes={
          ano && ate ? (
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
          ) : null
        }
      />

      {exercicios.carregando ? (
        <div className="h-64 animate-pulse rounded-sm bg-gray-100" />
      ) : !ano || !ate ? (
        <p className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">Nenhuma competência apurada ainda.</p>
      ) : consulta.isError ? (
        <div className="rounded-sm border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{mensagemDeErro(consulta.error, "Erro ao carregar o painel.")}</p>
        </div>
      ) : !dados || !atual ? (
        <div className="h-64 animate-pulse rounded-sm bg-gray-100" />
      ) : (
        <>
          <Abas rotulo="Painel de Bordo" ativa={atual.chave} onMudar={setAba} abas={dados.abas.map((a) => ({ chave: a.chave, rotulo: a.titulo }))} />

          {dados.mesesSemMeta.length > 0 ? (
            <div className="rounded-sm border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
              Sem as metas do orçamento de {dados.mesesSemMeta.join(", ")}: importe a aba Metas (Orçamento) do INDICADORES DE RESULTADO nesses
              meses (etapa Importações). Até lá, o orçado {dados.mesesSemMeta.includes(dados.rotuloMes) ? "do mês e o " : "o "}acumulado ficam sem
              valor.
            </div>
          ) : null}

          {/* A legenda: o mês de referência, as cores do gráfico e os sinais. */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-600">
            <span className="font-bold text-gray-900">
              {dados.rotuloMes} · {dados.rotuloAcumulado}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-[2px] bg-bpm-primary" />
              Realizado
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-[2px] bg-bpm-secondary" />
              Orçado
            </span>
            {([1, 0, -1] as const).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <Sinal s={s} />
                {SINAL[s].texto}
              </span>
            ))}
          </div>

          <div className="space-y-6">
            {atual.quadros.map((q) => (
              <Secao key={q.titulo} q={q} rotuloMes={dados.rotuloMes} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
