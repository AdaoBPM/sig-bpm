"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { Abas } from "@/components/shared/Abas";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { MESES } from "../../competencias/[anoMes]/utils/formatacao";

import { MiniGrafico } from "../components/MiniGrafico";
import {
  LegendaRealizadoOrcado,
  SeletorRotulos,
  SeletorTipoGrafico,
  useRotulosDosValores,
  useRotulosDoGrafico,
  useTipoGrafico,
  type TipoGrafico,
} from "../components/GraficoRealizadoOrcado";
import { Seletor, useExercicios } from "../components/SeletorPeriodo";
import { mensagemDeErro, relatoriosService, type BlocoPainel, type FormatoPainel, type ItemPainel, type Painel, type QuadroPainel } from "../services/relatoriosService";

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

/**
 * As cores do sinal (lista Cores, 11/10/2026): Padrão, as da formatação condicional da planilha (verde, amarelo e
 * vermelho); Daltonismo, com azul no lugar do verde (melhor que o orçado), amarelo e vermelho. O selo do desvio fica
 * num tom claro da mesma cor.
 */
export type Cores = "padrao" | "daltonismo";
const SINAIS = {
  padrao: {
    1: { cor: "bg-[#92D050]", selo: "bg-green-50 text-green-800 ring-green-200", texto: "Melhor que o" },
    0: { cor: "bg-[#FFFF00]", selo: "bg-yellow-50 text-yellow-800 ring-yellow-200", texto: "Até 5% do" },
    [-1]: { cor: "bg-[#C00000]", selo: "bg-red-50 text-red-700 ring-red-200", texto: "Pior que o" },
  },
  daltonismo: {
    1: { cor: "bg-[#0070C0]", selo: "bg-blue-50 text-blue-800 ring-blue-200", texto: "Melhor que o" },
    0: { cor: "bg-[#FFFF00]", selo: "bg-yellow-50 text-yellow-800 ring-yellow-200", texto: "Até 5% do" },
    [-1]: { cor: "bg-[#C00000]", selo: "bg-red-50 text-red-700 ring-red-200", texto: "Pior que o" },
  },
} as const;
const CoresDoPainel = createContext<Cores>("padrao");
/** Os sinais com o texto completo: "Melhor que o Orçado" (ou "… o Comparado", nos cenários). */
function useSinais() {
  const base = SINAIS[useContext(CoresDoPainel)];
  const { orcado } = useRotulosDoGrafico();
  return { 1: { ...base[1], texto: `${base[1].texto} ${orcado}` }, 0: { ...base[0], texto: `${base[0].texto} ${orcado}` }, [-1]: { ...base[-1], texto: `${base[-1].texto} ${orcado}` } } as const;
}

function Sinal({ s }: { s: BlocoPainel["sinal"] }) {
  const SINAL = useSinais();
  const { orcado } = useRotulosDoGrafico();
  if (s === null) return <span className="inline-block size-3 rounded-[2px] border border-gray-300" title={`Sem ${orcado.toLowerCase()}`} />;
  return <span className={`inline-block size-3 rounded-[2px] ring-1 ring-black/10 ${SINAL[s].cor}`} title={SINAL[s].texto} aria-label={SINAL[s].texto} />;
}

/** O desvio contra o orçado num selo com a cor do sinal. */
function SeloDesvio({ b }: { b: BlocoPainel }) {
  const SINAL = useSinais();
  const { orcado } = useRotulosDoGrafico();
  const tom = b.sinal === null ? "bg-gray-50 text-gray-600 ring-gray-200" : SINAL[b.sinal].selo;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-xs font-bold ring-1 ${tom}`} title={b.sinal === null ? `Sem ${orcado.toLowerCase()}` : SINAL[b.sinal].texto}>
      <Sinal s={b.sinal} />
      {desvio(b.vsOrcado)}
    </span>
  );
}

/** O percentual sob o realizado (▪ 48,4% (/RL)), quando o item tem. */
const percentualDaBase = (i: ItemPainel, b: BlocoPainel) =>
  i.base ? `${b.base === null ? "—" : `${(i.base.casas === 2 ? n2 : n1).format(b.base * 100)}%`} ${i.base.rotulo}` : null;

/**
 * Um período do card (o Atual ou o Acumulado): o rótulo com o selo do desvio, o realizado em destaque com o orçado e o
 * percentual da base. Os dois períodos têm as mesmas linhas, para ficarem alinhados.
 */
function GrupoPeriodo({ titulo, subtitulo, b, formato, base }: { titulo: ReactNode; subtitulo: ReactNode; b: BlocoPainel; formato: FormatoPainel; base: string | null }) {
  const rotulos = useRotulosDoGrafico();
  // Os valores no pé do grupo (13/10/2026): com o nome em duas linhas, o Atual e o Acumulado continuam alinhados.
  return (
    <div className="flex min-w-0 flex-col">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {titulo}
          <p className="text-xs text-gray-500">{subtitulo}</p>
        </div>
        <SeloDesvio b={b} />
      </header>
      {/* O realizado em destaque e, embaixo dele, o orçado (13/10/2026; antes, lado a lado): o grupo cabe em 1/5 do card. */}
      <div className="mt-auto pt-2">
        <p className="text-xs text-gray-600">{rotulos.realizado}</p>
        <p className="text-2xl font-extrabold whitespace-nowrap text-gray-900">{formatar(b.realizado, formato)}</p>
        {/* O percentual (/RL) logo abaixo do realizado, antes do orçado (13/10/2026); a linha fica mesmo vazia, para alinhar. */}
        <p className="h-4 text-xs text-gray-500">{base}</p>
        <p className="mt-1 text-xs whitespace-nowrap text-gray-600">
          {rotulos.orcado}: <span className="font-bold text-gray-900">{formatar(b.orcado, formato)}</span>
        </p>
      </div>
    </div>
  );
}

/**
 * Um indicador num card da largura da tela (09/10/2026; a versão com os cards lado a lado está na etiqueta
 * painel-cards-lado-a-lado do git), em três grupos: o Atual e o Acumulado com 2/5 do card, 1/5 cada (1 : 1 : 3, desde 13/10/2026; antes, 1 : 1 : 1,6), e o gráfico com 3/5 (o do acumulado ao lado desde 10/10/2026): o Atual (o mês de referência), o Acumulado e o
 * Gráfico dos meses do exercício (realizado × orçado, como os da planilha). Em telas estreitas, um grupo abaixo do outro.
 */
function CardIndicador({ i, rotuloMes, tipo, comRotulos }: { i: ItemPainel; rotuloMes: string; tipo: TipoGrafico; comRotulos: boolean }) {
  const sentido = (
    <span title={i.sentido === "↑" ? "Quanto maior, melhor" : "Quanto menor, melhor"} className="font-bold text-gray-700">
      {i.sentido}
    </span>
  );
  return (
    <article className="grid gap-4 rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white px-4 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,3fr)] lg:gap-0 lg:divide-x lg:divide-gray-100 lg:[&>*]:px-5 lg:[&>*:first-child]:pl-0 lg:[&>*:last-child]:pr-0">
      {/* O nome por extenso quebra a linha, em vez de cortar (13/10/2026). */}
      <GrupoPeriodo
        titulo={
          <h3 className="text-base leading-snug font-bold text-gray-900" title={i.titulo}>
            {i.titulo}
          </h3>
        }
        subtitulo={
          <>
            {i.sigla} {sentido} · {rotuloMes}
          </>
        }
        b={i.mes}
        formato={i.formato}
        base={percentualDaBase(i, i.mes)}
      />
      <GrupoPeriodo
        titulo={<h3 className="text-base font-bold text-gray-900">Acumulado</h3>}
        subtitulo={rotuloMes.startsWith("JAN") ? rotuloMes : `JAN–${rotuloMes}`}
        b={i.acumulado}
        formato={i.formatoAcumulado}
        base={percentualDaBase(i, i.acumulado)}
      />
      {/* O gráfico dos meses e, ao lado, o do acumulado (realizado × orçado), como na planilha (10/10/2026). */}
      {/*
        Na altura do card (13/10/2026; antes, centrado): os meses e o ACUM. perto do pé dele. O gráfico fica preso à célula
        (absolute), para a altura do card vir dos valores; sem isso, o desenho tomava a altura pela largura.
      */}
      <div className="relative min-h-32 min-w-0">
        <div className="absolute inset-0 flex gap-3">
          <div className="min-w-0 flex-1">
            <MiniGrafico dados={i.serie} formatar={(v) => formatar(v, i.formato)} tipo={tipo} comRotulos={comRotulos} comEscala={!comRotulos} />
          </div>
          {/* O acumulado também com os rótulos ou com a escala (13/10/2026); com a escala, um pouco mais largo. */}
          <div className={`${comRotulos ? "w-24" : "w-36"} shrink-0 border-l border-gray-100 pl-3`} title="Acumulado do exercício: realizado × orçado">
            <MiniGrafico
              dados={[{ mes: "ACUM.", realizado: i.acumulado.realizado, orcado: i.acumulado.orcado }]}
              formatar={(v) => formatar(v, i.formatoAcumulado)}
              tipo={tipo}
              comRotulos={comRotulos}
              comEscala={!comRotulos}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

/** Um quadro do painel (Consolidado, Produção: Matriz…): uma seção com um card por indicador, um abaixo do outro, e uma seção abaixo da outra. */
function Secao({ q, rotuloMes, tipo, comRotulos }: { q: QuadroPainel; rotuloMes: string; tipo: TipoGrafico; comRotulos: boolean }) {
  return (
    <section>
      <h2 className="mb-2 text-base font-bold tracking-wide text-gray-900 uppercase">{q.titulo}</h2>
      <div className="space-y-3">
        {q.itens.map((i) => (
          <CardIndicador key={`${i.titulo}|${i.sigla}`} i={i} rotuloMes={rotuloMes} tipo={tipo} comRotulos={comRotulos} />
        ))}
      </div>
    </section>
  );
}

/**
 * O corpo do painel (13/10/2026; reaproveitado no Painel de Bordo dos cenários): as abas, o aviso (`aviso`), a legenda
 * das cores e dos sinais e as seções com os cards. Os nomes das séries vêm do RotulosDoGrafico.
 */
export function CorpoDoPainel({
  dados,
  aba,
  onAba,
  tipo,
  cores,
  aviso,
  comRotulos = false,
}: {
  dados: Painel;
  aba: string;
  onAba: (a: string) => void;
  tipo: TipoGrafico;
  cores: Cores;
  aviso?: ReactNode;
  /** Os rótulos dos valores mensais nos gráficos (caixa Rótulos). */
  comRotulos?: boolean;
}) {
  const atual = dados.abas.find((a) => a.chave === aba) ?? dados.abas[0];
  return (
    <CoresDoPainel.Provider value={cores}>
      {/* As legendas à direita, na linha das abas (13/10/2026); o traço de baixo continua até o fim da linha. */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:gap-0">
        <div className="min-w-0 lg:flex-1">
          <Abas rotulo="Painel de Bordo" ativa={atual.chave} onMudar={onAba} abas={dados.abas.map((a) => ({ chave: a.chave, rotulo: a.titulo }))} />
        </div>
        <div className="pb-2 lg:border-b lg:border-gray-200 lg:pl-4">
          <LegendaDoPainel tipo={tipo} />
        </div>
      </div>
      {aviso}
      <div className="space-y-6">
        {atual.quadros.map((q) => (
          <Secao key={q.titulo} q={q} rotuloMes={dados.rotuloMes} tipo={tipo} comRotulos={comRotulos} />
        ))}
      </div>
    </CoresDoPainel.Provider>
  );
}

/** A legenda: as cores do gráfico e os sinais (a comparação com o orçado), na linha das abas (13/10/2026). */
function LegendaDoPainel({ tipo }: { tipo: TipoGrafico }) {
  const SINAL = useSinais();
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-600 lg:justify-end">
      <LegendaRealizadoOrcado tipo={tipo} />
      <span className="inline-flex flex-wrap items-center gap-x-5 gap-y-1">
        {([1, 0, -1] as const).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <Sinal s={s} />
            {SINAL[s].texto}
          </span>
        ))}
      </span>
    </div>
  );
}

/** A lista Cores (Padrão ou Daltonismo), guardada neste navegador; a mesma nos dois painéis. */
export function useCoresDoPainel(): [Cores, (c: Cores) => void] {
  const [cores, setCores] = useState<Cores>(() => guardado(CHAVE_CORES, ["padrao", "daltonismo"] as const, "padrao"));
  return [
    cores,
    (c) => {
      setCores(c);
      guardar(CHAVE_CORES, c);
    },
  ];
}
export function SeletorCores({ cores, onMudar }: { cores: Cores; onMudar: (c: Cores) => void }) {
  return (
    <Seletor
      rotulo="Cores"
      valor={cores}
      onMudar={(v) => onMudar(v === "daltonismo" ? "daltonismo" : "padrao")}
      largura="w-32"
      opcoes={[
        { valor: "padrao", rotulo: "Padrão" },
        { valor: "daltonismo", rotulo: "Daltonismo" },
      ]}
    />
  );
}

/** O quadro dos avisos do painel (13/10/2026): o quadro comum, com o destaque vermelho à esquerda. */
export const AVISO_DO_PAINEL = "rounded-sm border border-l-4 border-gray-200 border-l-red-600 bg-white px-4 py-3 text-sm text-gray-700";

const CHAVE_CORES = "sig.painel.cores";
/** Uma escolha guardada neste navegador (o tipo dos gráficos, as cores), ou o padrão. */
function guardado<T extends string>(chave: string, valores: readonly T[], padrao: T): T {
  try {
    const v = window.localStorage.getItem(chave);
    return valores.includes(v as T) ? (v as T) : padrao;
  } catch {
    // Sem armazenamento (janela privada, ou no servidor): o padrão.
    return padrao;
  }
}
function guardar(chave: string, valor: string) {
  try {
    window.localStorage.setItem(chave, valor);
  } catch {
    // Sem armazenamento: a escolha só não é lembrada.
  }
}

export function PainelContent() {
  useRegistrarAcessoTela("/relatorios/painel");
  const exercicios = useExercicios();
  const [anoEscolhido, setAno] = useState<number | null>(null);
  const [ateEscolhido, setAte] = useState<number | null>(null);
  const [aba, setAba] = useState("resultados");
  // O tipo dos gráficos (Barras ou Área) e as cores dos sinais (Padrão ou Daltonismo), lembrados neste navegador.
  const [tipoGrafico, setTipoGrafico] = useTipoGrafico();
  const [comRotulos, setComRotulos] = useRotulosDosValores();
  const [cores, setCores] = useCoresDoPainel();
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
            <li>
              Nas listas à direita do título, escolha o Exercício, o Período (o mês de referência, entre as competências fechadas; o acumulado vai de janeiro até ele), os Rótulos (Com: os valores de cada mês escritos nos gráficos, o realizado por cima do orçado), o Tipo
              dos gráficos e as Cores dos sinais. O Tipo e as Cores ficam guardados neste navegador (o Tipo vale também para o gráfico do indicador em Indicadores).
            </li>
            <li>Troque entre as abas Resultados e Performance (os unitários).</li>
            <li>
              Cada grupo (Consolidado, Produção: Matriz…) é uma seção, uma abaixo da outra, com um card por indicador, da largura da tela, em
              três partes: o Atual (o mês de referência) e o Acumulado, cada um com o realizado em destaque, o orçado e o desvio (vs. Orçado) no
              selo colorido; e o gráfico dos meses do exercício, com o realizado em amarelo-ouro e o orçado em preto, e ao lado o gráfico do acumulado (ACUM.), do mesmo tipo.
            </li>
            <li>
              Tipo: Barras (colunas do realizado e do orçado, como na planilha) ou Área (o realizado numa área amarela, mais forte no máximo do
              período e transparente no zero, com o contorno em amarelo-ouro, e o orçado numa linha preta; no gráfico do acumulado, a coluna do
              realizado com o mesmo degradê e o orçado como uma linha preta). Cores: Padrão (verde, amarelo e vermelho) ou Daltonismo (azul
              no lugar do verde, amarelo e vermelho); a legenda acompanha.
            </li>
            <li>Passe o mouse sobre o gráfico para ver os valores do mês, sobre o selo para ler o sinal e sobre a seta para ver o sentido do indicador.</li>
            <li>O orçado vem do cenário marcado como Orçamento Empresarial no exercício (Criação de Cenários / Cenários Sintéticos); sem ele, o orçado fica zero.</li>
          </ul>
        }
        sobre={
          <>
            <p>
              O realizado contra o orçado do mês e do acumulado do exercício, como as abas Painel (Resultados) e Painel (Performance) do SIG
              BPM 2026 - INDICADORES DE RESULTADO, com os gráficos mês a mês no padrão dos da planilha (realizado em amarelo-ouro, meta em preto).
            </p>
            <p>
              O realizado sai dos mesmos valores da tela Indicadores, só das competências fechadas: a DRE apurada, os volumes da apuração e os indicadores importados (ou
              digitados nas Listas Operacionais). O orçado sai das Metas do cenário marcado como Orçamento Empresarial no exercício
              (Criação de Cenários / Cenários Sintéticos), calculadas como o realizado, e o acumulado do orçado também. Sem cenário marcado no
              exercício, ou sem o valor no cenário, o orçado é zero.
            </p>
            <p>
              O desvio (vs. Orçado) é o realizado sobre o orçado, menos 1 (com o orçado negativo, o sinal se inverte). O sinal fica verde
              (azul, nas cores para daltonismo) quando o realizado está do lado bom do orçado, vermelho do lado ruim, e amarelo quando o desvio é de até 5%. O lado bom depende
              do sentido do indicador: ↑ quanto maior, melhor; ↓ quanto menor, melhor.
            </p>
            <p>
              Como na planilha, o resultado financeiro e as despesas fixas aparecem em milhares (K) no mês e em milhões (M) no acumulado. O
              percentual sob o resultado financeiro é sobre a margem de contribuição (/MC).
            </p>
          </>
        }
        acoes={
          // As listas na linha do título, como em Resultados Realizados (de volta do botão Configurações, 11/10/2026).
          ano && ate ? (
            <div className="flex flex-wrap items-center gap-4">
              <Seletor
                rotulo="Exercício"
                valor={String(ano)}
                onMudar={(v) => {
                  setAno(Number(v));
                  setAte(null);
                }}
                largura="w-28"
                opcoes={exercicios.anos.map((a) => ({ valor: String(a), rotulo: String(a) }))}
              />
              <Seletor rotulo="Período" valor={String(ate)} onMudar={(v) => setAte(Number(v))} largura="w-36" opcoes={meses.map((m) => ({ valor: String(m), rotulo: MESES[m - 1] }))} />
              <SeletorRotulos com={comRotulos} onMudar={setComRotulos} />
              <SeletorTipoGrafico tipo={tipoGrafico} onMudar={setTipoGrafico} />
              <SeletorCores cores={cores} onMudar={setCores} />
            </div>
          ) : null
        }
      />

      {exercicios.carregando ? (
        <div className="h-64 animate-pulse rounded-sm bg-gray-100" />
      ) : !ano || !ate ? (
        <p className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">Nenhuma competência fechada ainda.</p>
      ) : consulta.isError ? (
        <div className="rounded-sm border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{mensagemDeErro(consulta.error, "Erro ao carregar o painel.")}</p>
        </div>
      ) : !dados || !atual ? (
        <div className="h-64 animate-pulse rounded-sm bg-gray-100" />
      ) : (
        <CorpoDoPainel
          dados={dados}
          aba={atual.chave}
          onAba={setAba}
          tipo={tipoGrafico}
          cores={cores}
          comRotulos={comRotulos}
          aviso={
            // Os avisos como um quadro comum, com o destaque vermelho à esquerda (13/10/2026; antes, amarelos).
            !dados.cenarioOrcado ? (
              <div className={AVISO_DO_PAINEL}>
                Nenhum cenário está marcado como Orçamento Empresarial para {dados.ano}: o orçado aparece como zero. Marque um cenário de {dados.ano} em
                Criação de Cenários / Cenários Sintéticos.
              </div>
            ) : dados.mesesSemMeta.length > 0 ? (
              <div className={AVISO_DO_PAINEL}>
                O cenário {dados.cenarioOrcado} (Orçamento Empresarial) não tem valores de {dados.mesesSemMeta.join(", ")}: o orçado desses meses aparece
                como zero. Importe nele um arquivo com esses meses (Cenários Sintéticos).
              </div>
            ) : null
          }
        />
      )}
    </div>
  );
}
