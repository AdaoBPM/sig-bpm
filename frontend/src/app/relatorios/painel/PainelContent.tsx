"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { Abas } from "@/components/shared/Abas";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { usePermissions } from "@/context/PermissionContext";
import { useAcessibilidade } from "@/lib/acessibilidade";

import { MESES } from "../../competencias/[anoMes]/utils/formatacao";

import { ConfigurarGraficos } from "../components/ConfigurarGraficos";
import { ExportarRelatorio } from "../components/ExportarRelatorio";
import { IndicadoresDoPainel } from "./IndicadoresDoPainel";
import { CopiarComoImagem } from "../components/CopiarComoImagem";
import { useComparaCom } from "../components/ComparaCom";
import { MiniGrafico } from "../components/MiniGrafico";
import {
  LegendaRealizadoOrcado,
  SeletorRotulos,
  SeletorTipoGrafico,
  useRotulosDosValores,
  RotulosDoGrafico,
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

/**
 * O valor sem a unidade (13/10/2026: os rótulos e a escala dos gráficos), com as mesmas casas de `formatar`: os
 * milhões e os milhares sem o R$ e sem o M/K, os percentuais sem o %, os volumes sem o m³/pst, o R$/m³ sem o R$.
 */
function formatarCurto(v: number | null, f: FormatoPainel) {
  if (v === null) return "—";
  switch (f) {
    case "MILHOES":
      return n1.format(v / 1e6);
    case "MILHARES":
      return n1.format(v / 1e3);
    case "M3":
    case "PISTAS":
    case "RS_M3":
      return n0.format(v);
    case "PCT":
    case "PCT_RL":
      return n1.format(v * 100);
  }
}

/**
 * A unidade de cada formato (21/10/2026), no rótulo do Atual e do Acumulado: os valores dos cards vão sem ela. O espaço
 * inquebrável não parte "R$ M" em duas linhas.
 */
const UNIDADE_DO_FORMATO: Record<FormatoPainel, string> = {
  MILHOES: "R$ M",
  MILHARES: "R$ K",
  M3: "m³",
  PISTAS: "pst",
  PCT: "%",
  PCT_RL: "%/RL",
  RS_M3: "R$/m³",
};

/**
 * A formatação de um card (22/10/2026): a unidade (no rótulo do Atual e do Acumulado), o valor com e sem a unidade e o
 * fator da escala dos gráficos — a do formato do item do painel ou, nos cards de Indicadores dos Relatórios Executivos, a
 * do indicador.
 */
export type FormatacaoDoCard = { unidade: string; formatar: (v: number | null) => string; formatarCurto: (v: number | null) => string; fatorDaEscala: number };

/** O fator da escala dos gráficos de cada formato (19/10/2026): a unidade em que as marcas práticas se escolhem. */
const fatorDaEscala = (f: FormatoPainel) => (f === "MILHOES" ? 1e-6 : f === "MILHARES" ? 1e-3 : f === "PCT" || f === "PCT_RL" ? 100 : 1);
const formatacaoDo = (f: FormatoPainel): FormatacaoDoCard => ({ unidade: UNIDADE_DO_FORMATO[f], formatar: (v) => formatar(v, f), formatarCurto: (v) => formatarCurto(v, f), fatorDaEscala: fatorDaEscala(f) });

const desvio = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${n1.format(v * 100)}%`);

/**
 * As cores do sinal (lista Cores, 11/10/2026): Padrão, verde, amarelo e vermelho; Daltonismo (a Acessibilidade do menu
 * do usuário, 16/10/2026), com azul no lugar do verde (melhor que o orçado). Desde 21/10/2026, o destaque do desvio é
 * cinza (claro ou escuro, conforme o tema), e a cor do sinal fica na faixa à direita dele e no ícone (antes, o destaque
 * todo na cor forte, com o texto em branco). O valor guardado continua "daltonismo", para manter a escolha já feita.
 */
export type Cores = "padrao" | "daltonismo";
// O rótulo curto é o da legenda (21/10/2026); o texto completo ("Melhor que o Orçado"), o das dicas.
const SINAIS = {
  padrao: {
    1: { cor: "var(--color-green-600)", texto: "Melhor que o", rotulo: "Melhor" },
    0: { cor: "var(--color-yellow-500)", texto: "Até 5% do", rotulo: "Até 5% Var." },
    [-1]: { cor: "var(--color-red-600)", texto: "Pior que o", rotulo: "Pior" },
  },
  daltonismo: {
    1: { cor: "var(--color-blue-600)", texto: "Melhor que o", rotulo: "Melhor" },
    0: { cor: "var(--color-yellow-500)", texto: "Até 5% do", rotulo: "Até 5% Var." },
    [-1]: { cor: "var(--color-red-600)", texto: "Pior que o", rotulo: "Pior" },
  },
} as const;
const CoresDoPainel = createContext<Cores>("padrao");
/** Os sinais com o texto completo: "Melhor que o Orçado" (ou "… o Comparado", nos cenários). */
function useSinais() {
  const base = SINAIS[useContext(CoresDoPainel)];
  const { orcado } = useRotulosDoGrafico();
  return { 1: { ...base[1], texto: `${base[1].texto} ${orcado}` }, 0: { ...base[0], texto: `${base[0].texto} ${orcado}` }, [-1]: { ...base[-1], texto: `${base[-1].texto} ${orcado}` } } as const;
}

/** O ícone do sinal (21/10/2026), na cor dele: ▲ melhor, ▼ pior e ■ até 5%. Em SVG, para sair no Copiar como Imagem. */
function IconeDoSinal({ s, titulo }: { s: -1 | 0 | 1; titulo?: string }) {
  const SINAL = useSinais();
  const fill = SINAL[s].cor;
  return (
    <svg viewBox="0 0 12 12" className="inline-block size-3 shrink-0" role={titulo ? "img" : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : true}>
      {titulo ? <title>{titulo}</title> : null}
      {s === 1 ? (
        <polygon points="6,1 11.5,11 0.5,11" style={{ fill }} />
      ) : s === -1 ? (
        <polygon points="0.5,1 11.5,1 6,11" style={{ fill }} />
      ) : (
        <rect x={1.5} y={1.5} width={9} height={9} style={{ fill }} />
      )}
    </svg>
  );
}

/** O sinal da legenda: o ícone na cor do sinal, como no destaque dos cards. */
function Sinal({ s }: { s: -1 | 0 | 1 }) {
  return <IconeDoSinal s={s} titulo={useSinais()[s].texto} />;
}

/**
 * O destaque do desvio (21/10/2026; antes, só o selo da variação): a variação com o ícone do sinal, "vs. Orçado" (ou
 * "vs. Comparado") e o valor orçado, num quadro cinza (claro ou escuro, conforme o tema), com os valores em preto e o
 * "vs." em cinza, e, à direita, a faixa na cor do sinal, com o triplo da espessura da faixa amarela à esquerda dos cards
 * (12 px; sem orçado, cinza). A faixa é uma borda (no Copiar como Imagem do Firefox, o fundo em CSS saía em branco; o do
 * quadro vai em SVG).
 */
function DestaqueDoDesvio({ b, formatarOrcado }: { b: Pick<BlocoPainel, "orcado" | "vsOrcado" | "sinal">; formatarOrcado: (v: number | null) => string }) {
  const SINAL = useSinais();
  const { orcado } = useRotulosDoGrafico();
  const cor = b.sinal === null ? "var(--color-gray-400)" : SINAL[b.sinal].cor;
  return (
    <div
      className="relative flex shrink-0 flex-col items-end overflow-hidden rounded-sm border-r-[12px] px-2 py-1 text-right"
      style={{ borderRightColor: cor }}
      title={b.sinal === null ? `Sem ${orcado.toLowerCase()}` : SINAL[b.sinal].texto}
    >
      <svg className="pointer-events-none absolute inset-0 size-full" preserveAspectRatio="none" aria-hidden>
        <rect width="100%" height="100%" style={{ fill: "var(--color-gray-100)" }} />
      </svg>
      {/* A variação 50% maior (21/10/2026; antes, 12 px). */}
      <span className="relative inline-flex items-center gap-1.5 text-lg leading-snug font-bold text-gray-900">
        {b.sinal === null ? null : <IconeDoSinal s={b.sinal} />}
        {desvio(b.vsOrcado)}
      </span>
      <span className="relative mt-0.5 text-xs whitespace-nowrap text-gray-600">vs. {orcado}</span>
      {/* 25% maior (21/10/2026; antes, 14 px); sem a unidade, que fica no rótulo do período. */}
      <span className="relative text-[17.5px] leading-tight font-bold whitespace-nowrap text-gray-900">{formatarOrcado(b.orcado)}</span>
    </div>
  );
}

/**
 * O realizado contra o orçado fora do painel (22/10/2026: os cards de Indicadores dos Relatórios Executivos), com a mesma
 * regra do painel: o desvio é o realizado sobre o orçado, menos 1, com o sinal invertido no orçado negativo; até 5%,
 * amarelo; senão, melhor ou pior conforme o sentido — ↑ quanto maior, melhor; ↓ quanto menor, melhor; nos indicadores
 * de acompanhamento, sem sinal (cinza).
 */
export function blocoComparado(realizado: number | null, orcado: number | null, sentido: string, comOrcado = true): BlocoPainel {
  const vsOrcado = realizado === null || orcado === null || orcado === 0 ? null : (realizado / orcado - 1) * (orcado < 0 ? -1 : 1);
  const comSentido = sentido === "↑" || sentido === "↓";
  // Com o orçado zero (22/10/2026: a meta zero, como a de Acidentes c/ Afastamento), sem o desvio, o sinal pelo lado do
  // realizado: até 5% se também for zero; senão melhor ou pior conforme o sentido (sem o cenário orçado, `comOrcado`
  // falso, o zero é a falta dele: sem sinal). É a regra do painelDeBordo.sinal do backend.
  const sinal: BlocoPainel["sinal"] =
    orcado === 0 && realizado !== null
      ? !comOrcado || !comSentido
        ? null
        : realizado === 0
          ? 0
          : (sentido === "↑" ? realizado > 0 : realizado < 0)
            ? 1
            : -1
      : vsOrcado === null || !comSentido
        ? null
        : Math.abs(vsOrcado) <= 0.05
          ? 0
          : (sentido === "↑" ? realizado! < orcado! : realizado! > orcado!)
            ? -1
            : 1;
  return { realizado, orcado, base: null, vsOrcado, sinal };
}

/** A largura da escala dos gráficos dos cards (a do MiniGrafico, w-10). */
const LARGURA_DA_ESCALA = 40;

/** O percentual sob o realizado (▪ 48,4% (/RL)), quando o item tem. */
const percentualDaBase = (i: ItemPainel, b: BlocoPainel) =>
  i.base ? `${b.base === null ? "—" : `${(i.base.casas === 2 ? n2 : n1).format(b.base * 100)}%`} ${i.base.rotulo}` : null;

/**
 * Um período do card (o Atual ou o Acumulado; 13/10/2026): à esquerda, "Atual (R$ M)" (ou "Acumulado"; 21/10/2026: antes,
 * "Realizado (Atual)", e o valor com a unidade), o valor em destaque e o percentual da base; à direita, na altura do rótulo, o destaque do desvio
 * (a variação, "vs. Orçado" ou "vs. Comparado" e o valor orçado).
 */
function GrupoPeriodo({ periodo, b, f, base, dica }: { periodo: string; b: BlocoPainel; f: FormatacaoDoCard; base: string | null; dica?: string }) {
  return (
    // Sem espaço para os dois lado a lado (21/10/2026), o destaque do desvio desce para baixo do valor, em vez de cortá-lo.
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-2" title={dica}>
      {/* Na largura mínima do conteúdo (21/10/2026): apertado, o rótulo quebra antes de o destaque descer para baixo do valor. */}
      <div className="min-w-min flex-1 basis-0">
        <p className="text-xs text-gray-600">
          {periodo}
          {f.unidade ? ` (${f.unidade})` : ""}
        </p>
        {/* 25% maior (21/10/2026; antes, 22 px até 1536 px e 26 px acima). */}
        <p className="text-[27.5px] leading-tight font-extrabold whitespace-nowrap text-gray-900 2xl:text-[32.5px]">{f.formatarCurto(b.realizado)}</p>
        <p className="h-4 text-xs whitespace-nowrap text-gray-500">{base}</p>
      </div>
      <DestaqueDoDesvio b={b} formatarOrcado={f.formatarCurto} />
    </div>
  );
}

/**
 * Um indicador num card da largura da tela (09/10/2026; a versão com os cards lado a lado está na etiqueta
 * painel-cards-lado-a-lado do git): o título e a Metodologia em cima do Atual e do Acumulado (2/5 do card, 1/5 cada) e o
 * gráfico dos meses do exercício, com o do acumulado ao lado (3/5). Em telas estreitas, um embaixo do outro.
 */
function CardIndicador({
  i,
  rotuloMes,
  tipo,
  comRotulos,
  formatacao,
}: {
  i: ItemPainel;
  rotuloMes: string;
  tipo: TipoGrafico;
  comRotulos: boolean;
  /** A formatação do Atual e do Acumulado, quando não é a do formato do item (os cards de Indicadores, 22/10/2026). */
  formatacao?: { mes: FormatacaoDoCard; acumulado: FormatacaoDoCard };
}) {
  const fm = formatacao?.mes ?? formatacaoDo(i.formato);
  const fa = formatacao?.acumulado ?? formatacaoDo(i.formatoAcumulado);
  const sentido = (
    <span title={i.sentido === "↑" ? "Quanto maior, melhor" : i.sentido === "↓" ? "Quanto menor, melhor" : "Acompanhamento"} className="font-bold">
      {i.sentido}
    </span>
  );
  const acumulado = rotuloMes.startsWith("JAN") ? rotuloMes : `JAN–${rotuloMes}`;
  // O espaço entre os blocos menor (12 px), para o rótulo, a tag e os valores caberem em 1/5 do card.
  const coluna = "lg:border-l lg:border-gray-100 lg:pl-3";
  return (
    // O leiaute de 13/10/2026: o título e a legenda, maiores, em cima dos dois blocos (o Atual e o Acumulado); o gráfico
    // na terceira coluna, na altura do card. Em telas estreitas, um embaixo do outro.
    // data-card-indicador e data-grafico-do-card: a imagem sem os gráficos (globals.css, 14/10/2026).
    <article
      data-card-indicador
      className="grid gap-4 rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white px-4 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,3fr)] lg:grid-rows-[auto_1fr] lg:gap-x-0 lg:gap-y-2"
    >
      {/*
        O nome e, à direita dele, a Metodologia e o comportamento entre parênteses, no texto do Atual e do Acumulado
        (21/10/2026; antes, a abreviação e a seta); o mês fica no nome do grupo (13/10/2026).
      */}
      <header className="flex min-w-0 items-baseline justify-between gap-3 lg:col-span-2 lg:pr-3">
        <h3 className="shrink-0 text-xl leading-snug font-bold text-gray-900" title={i.titulo}>
          {i.titulo}
        </h3>
        {/* data-metodologia: nos Relatórios Executivos, em até metade da largura (22/10/2026). */}
        <p data-metodologia className="min-w-0 text-right text-xs text-gray-600" title={i.metodologia ? `Metodologia: ${i.metodologia}` : undefined}>
          {/* O espaço inquebrável: a seta não fica sozinha numa linha. */}
          {i.metodologia ? `${i.metodologia} ` : ""}({sentido})
        </p>
      </header>
      <div className="self-end lg:col-start-1 lg:row-start-2 lg:pr-3">
        <GrupoPeriodo periodo="Atual" b={i.mes} f={fm} base={percentualDaBase(i, i.mes)} dica={`Atual: ${rotuloMes}`} />
      </div>
      <div className={`self-end lg:col-start-2 lg:row-start-2 lg:pr-3 ${coluna}`}>
        <GrupoPeriodo periodo="Acumulado" b={i.acumulado} f={fa} base={percentualDaBase(i, i.acumulado)} dica={`Acumulado: ${acumulado}`} />
      </div>
      {/*
        O gráfico dos meses e, ao lado, o do acumulado (realizado × orçado), como na planilha, na altura do card: os meses e
        o ACUM. perto do pé dele. O gráfico fica preso à célula (absolute), para a altura do card vir dos valores.
      */}
      <div data-grafico-do-card className="relative min-h-32 min-w-0 lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:border-l lg:border-gray-100">
        <div className="absolute inset-0 flex gap-3 lg:left-5">
          {/*
            O acumulado na largura de um mês (23/10/2026; antes, 96 px com os rótulos e 144 px com a escala): os dois gráficos
            crescem na proporção dos períodos (os meses e 1), a partir da mesma base (a escala, quando há, e, no acumulado, o
            espaço do quadro cinza).
          */}
          <div data-grafico-dos-meses className="min-w-0" style={{ flex: `${Math.max(1, i.serie.length)} 1 ${comRotulos ? 0 : LARGURA_DA_ESCALA}px` }}>
            <MiniGrafico
              dados={i.serie}
              formatar={fm.formatar}
              formatarCurto={fm.formatarCurto}
              tipo={tipo}
              comRotulos={comRotulos}
              comEscala={!comRotulos}
              fatorDaEscala={fm.fatorDaEscala}
            />
          </div>
          {/*
            O acumulado também com os rótulos ou com a escala, num quadro no cinza do destaque do desvio (23/10/2026; antes, só
            separado por uma linha); o fundo em SVG, como o do destaque (o Copiar como Imagem do Firefox perdia o fundo em CSS).
          */}
          <div
            data-grafico-acumulado
            className="relative min-w-0 overflow-hidden rounded-sm px-1.5"
            style={{ flex: `1 1 ${(comRotulos ? 0 : LARGURA_DA_ESCALA) + 12}px` }}
            title={`Acumulado do exercício (${acumulado}): realizado × orçado`}
          >
            <svg className="pointer-events-none absolute inset-0 size-full" preserveAspectRatio="none" aria-hidden>
              <rect width="100%" height="100%" style={{ fill: "var(--color-gray-100)" }} />
            </svg>
            <div className="relative h-full">
            <MiniGrafico
              dados={[{ mes: "ACUM.", realizado: i.acumulado.realizado, orcado: i.acumulado.orcado }]}
              formatar={fa.formatar}
              formatarCurto={fa.formatarCurto}
              tipo={tipo}
              comRotulos={comRotulos}
              comEscala={!comRotulos}
              fatorDaEscala={fa.fatorDaEscala}
              acumulado
            />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * Um card do painel fora dele (15/10/2026: os Relatórios Executivos), com as cores escolhidas, na altura e na largura do
 * bloco; sem o gráfico, os valores em duas colunas, como no Copiar como Imagem (sem gráficos), mas sem estreitar o card.
 */
export function CardDoPainel({
  i,
  rotuloMes,
  tipo,
  cores,
  comGrafico,
  soAcumulado = false,
  comRotulos = false,
  formatacao,
}: {
  i: ItemPainel;
  rotuloMes: string;
  tipo: TipoGrafico;
  cores: Cores;
  comGrafico: boolean;
  /** Só o gráfico do acumulado (22/10/2026), na terceira coluna, da largura dos valores. */
  soAcumulado?: boolean;
  comRotulos?: boolean;
  /** A formatação do indicador (os cards de Indicadores dos Relatórios Executivos, 22/10/2026). */
  formatacao?: { mes: FormatacaoDoCard; acumulado: FormatacaoDoCard };
}) {
  const doGrafico = !comGrafico
    ? "[&_[data-grafico-do-card]]:hidden lg:[&_[data-card-indicador]]:grid-cols-2"
    : soAcumulado
      ? "[&_[data-grafico-dos-meses]]:hidden lg:[&_[data-card-indicador]]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] [&_[data-grafico-acumulado]]:w-full"
      : "";
  return (
    <CoresDoPainel.Provider value={cores}>
      <div className={`h-full [&>article]:h-full ${doGrafico}`}>
        <CardIndicador i={i} rotuloMes={rotuloMes} tipo={tipo} comRotulos={comRotulos} formatacao={formatacao} />
      </div>
    </CoresDoPainel.Provider>
  );
}

/** Os grupos recolhidos do Painel de Bordo (21/10/2026), pelo título, guardados no navegador. */
const CHAVE_DOS_RECOLHIDOS = "sig.painel.recolhidos";
function lerRecolhidos(): Set<string> {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(CHAVE_DOS_RECOLHIDOS) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function useGrupoRecolhido(titulo: string): [boolean, () => void] {
  const [recolhido, setRecolhido] = useState(() => (typeof window === "undefined" ? false : lerRecolhidos().has(titulo)));
  const alternar = () => {
    const novo = !recolhido;
    setRecolhido(novo);
    try {
      const todos = lerRecolhidos();
      if (novo) todos.add(titulo);
      else todos.delete(titulo);
      window.localStorage.setItem(CHAVE_DOS_RECOLHIDOS, JSON.stringify([...todos]));
    } catch {
      // Sem o armazenamento do navegador, vale só nesta tela.
    }
  };
  return [recolhido, alternar];
}

/** Um quadro do painel (Consolidado, Produção: Matriz…): uma seção com um card por indicador, um abaixo do outro, e uma seção abaixo da outra. */
function Secao({ q, rotuloMes, tipo, comRotulos }: { q: QuadroPainel; rotuloMes: string; tipo: TipoGrafico; comRotulos: boolean }) {
  const secao = useRef<HTMLElement>(null);
  const [recolhido, alternar] = useGrupoRecolhido(q.titulo);
  return (
    <section ref={secao}>
      {/* O nome do grupo e o mês de referência (13/10/2026; antes, em cada card): o mês em cinza; ao lado, o botão de copiar o grupo. Em 24 px (14/10/2026; antes, 16). */}
      <div className="mb-2 flex items-center gap-2">
        {/* Recolher e expandir o grupo (21/10/2026). */}
        <button
          type="button"
          onClick={alternar}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          title={recolhido ? "Expandir o grupo" : "Recolher o grupo"}
          aria-label={recolhido ? `Expandir ${q.titulo}` : `Recolher ${q.titulo}`}
          aria-expanded={!recolhido}
        >
          {recolhido ? <ChevronRight className="size-5" /> : <ChevronDown className="size-5" />}
        </button>
        <h2 className="text-2xl font-bold tracking-wide text-gray-900 uppercase">
          {q.titulo}
          <span className="font-semibold text-gray-500"> · {rotuloMes}</span>
        </h2>
        <CopiarComoImagem alvo={secao} nome={`${q.titulo} ${rotuloMes}`} dica="Copiar o grupo como imagem" />
        {/* Ao lado, o grupo sem os gráficos: só os valores dos cards (14/10/2026). */}
        <CopiarComoImagem alvo={secao} nome={`${q.titulo} ${rotuloMes}`} dica="Copiar o grupo como imagem (sem gráficos)" semGraficos />
      </div>
      <div className={recolhido ? "hidden" : "space-y-3"}>
        {q.itens.map((i) => (
          <CardIndicador key={`${i.titulo}|${i.sigla}`} i={i} rotuloMes={rotuloMes} tipo={tipo} comRotulos={comRotulos} />
        ))}
      </div>
    </section>
  );
}

/**
 * O corpo do painel (13/10/2026; reaproveitado no Painel de Bordo dos cenários): as abas, o aviso (`aviso`) e as seções com
 * os cards (a legenda das cores e dos sinais foi para a linha do título, 14/10/2026). Os nomes das séries vêm do
 * RotulosDoGrafico.
 */
export function CorpoDoPainel({
  dados,
  aba,
  onAba,
  tipo,
  cores,
  aviso,
  comRotulos = false,
  extras = [],
}: {
  dados: Painel;
  aba: string;
  onAba: (a: string) => void;
  tipo: TipoGrafico;
  cores: Cores;
  aviso?: ReactNode;
  /** Os rótulos dos valores mensais nos gráficos (caixa Rótulos). */
  comRotulos?: boolean;
  /** As abas depois de Resultados e Performance (19/10/2026: os Indicadores), com o conteúdo de cada uma. */
  extras?: Array<{ chave: string; rotulo: string; conteudo: ReactNode }>;
}) {
  const extra = extras.find((e) => e.chave === aba);
  const atual = extra ? null : (dados.abas.find((a) => a.chave === aba) ?? dados.abas[0]);
  const daTela = extra ?? (atual ? null : extras[0]);
  // O servidor manda só as abas que o perfil lê (14/10/2026); as de mais, a tela já filtrou.
  if (!atual && !daTela) return <p className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">Seu perfil não tem acesso a nenhuma aba desta tela.</p>;
  return (
    <CoresDoPainel.Provider value={cores}>
      <Abas
        rotulo="Painel de Bordo"
        ativa={daTela?.chave ?? atual!.chave}
        onMudar={onAba}
        abas={[...dados.abas.map((a) => ({ chave: a.chave, rotulo: a.titulo })), ...extras.map((e) => ({ chave: e.chave, rotulo: e.rotulo }))]}
      />
      {aviso}
      {daTela ? (
        daTela.conteudo
      ) : (
        <div className="space-y-6">
          {atual!.quadros.map((q) => (
            <Secao key={q.titulo} q={q} rotuloMes={dados.rotuloMes} tipo={tipo} comRotulos={comRotulos} />
          ))}
        </div>
      )}
    </CoresDoPainel.Provider>
  );
}

/**
 * A legenda, na linha do título, antes do Configurar Gráficos (14/10/2026): os sinais (Melhor, Até 5% Var. e Pior), as
 * cores do gráfico (Realizado e Orçado ou Comparado) e, numa etiqueta, o cenário comparado, "(vs. <nome>)", quando há
 * (21/10/2026; antes, as cores primeiro e os sinais com o texto completo).
 */
export function LegendaDoPainel({ tipo, cores, comparado }: { tipo: TipoGrafico; cores: Cores; comparado?: string | null }) {
  return (
    <CoresDoPainel.Provider value={cores}>
      <ItensDaLegenda tipo={tipo} comparado={comparado} />
    </CoresDoPainel.Provider>
  );
}
function ItensDaLegenda({ tipo, comparado }: { tipo: TipoGrafico; comparado?: string | null }) {
  const SINAL = useSinais();
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-600 lg:justify-end">
      <span className="inline-flex flex-wrap items-center gap-x-5 gap-y-1">
        {([1, 0, -1] as const).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <Sinal s={s} />
            {SINAL[s].rotulo}
          </span>
        ))}
      </span>
      <LegendaRealizadoOrcado tipo={tipo} />
      <EtiquetaDoComparado nome={comparado} />
    </div>
  );
}

/** O cenário comparado no fim da legenda (21/10/2026), numa etiqueta: "(vs. <nome>)". */
export function EtiquetaDoComparado({ nome }: { nome?: string | null }) {
  if (!nome) return null;
  return <span className="inline-flex rounded-sm border border-gray-300 bg-white px-1.5 py-px text-xs font-medium whitespace-nowrap text-gray-700">(vs. {nome})</span>;
}

/**
 * As cores dos sinais: as da Acessibilidade do menu do usuário (16/10/2026; antes, a lista Cores do Configurar Gráficos),
 * Padrão (verde) ou Daltonismo (azul no lugar do verde), as mesmas em todas as telas.
 */
export function useCoresDoPainel(): [Cores] {
  const [a] = useAcessibilidade();
  return [a];
}

/** O quadro dos avisos do painel (13/10/2026): o quadro comum, com o destaque vermelho à esquerda. */
export const AVISO_DO_PAINEL = "rounded-sm border border-l-4 border-gray-200 border-l-red-600 bg-white px-4 py-3 text-sm text-gray-700";

export function PainelContent() {
  useRegistrarAcessoTela("/relatorios/painel");
  const exercicios = useExercicios();
  const [anoEscolhido, setAno] = useState<number | null>(null);
  const [ateEscolhido, setAte] = useState<number | null>(null);
  // A aba pedida no endereço (?aba=indicadores: o endereço antigo da tela Indicadores, 19/10/2026).
  const pedida = useSearchParams().get("aba");
  const [aba, setAba] = useState(pedida ?? "resultados");
  const { hasPermission } = usePermissions();
  const comIndicadores = hasPermission("relatorio_painel.indicadores:ler");
  // O tipo dos gráficos (Barras ou Área), lembrado neste navegador; as cores dos sinais, as da Acessibilidade do menu do usuário.
  const [tipoGrafico, setTipoGrafico] = useTipoGrafico();
  const [comRotulos, setComRotulos] = useRotulosDosValores();
  const [cores] = useCoresDoPainel();
  const ano = anoEscolhido ?? exercicios.anos[0];
  const meses = ano ? exercicios.mesesDe(ano) : [];
  const ate = ateEscolhido && meses.includes(ateEscolhido) ? ateEscolhido : meses[meses.length - 1];
  // O cenário comparado (21/10/2026): o Compara Com, entre os marcados (de qualquer exercício; o mesmo de Resultados).
  const comparacao = useComparaCom(ano ?? null);
  const consulta = useQuery({
    queryKey: ["relatorios", "painel", ano, ate, comparacao.comparaCom],
    queryFn: () => relatoriosService.painel(ano!, ate, comparacao.comparaCom),
    enabled: !!ano && !!ate && comparacao.pronta,
  });
  const dados = consulta.data;
  // A aba Indicadores (19/10/2026; antes, a tela Indicadores): o Exercício, o Período, os Rótulos e o Tipo do Configurar Gráficos valem nela.
  const extras =
    comIndicadores && ano && ate ? [{ chave: "indicadores", rotulo: "Indicadores", conteudo: <IndicadoresDoPainel ano={ano} ate={ate} tipo={tipoGrafico} comRotulos={comRotulos} comparaCom={comparacao.comparaCom} /> }] : [];
  const naAbaIndicadores = comIndicadores && (aba === "indicadores" || (dados ? dados.abas.length === 0 : false));
  const atual = dados?.abas.find((a) => a.chave === aba) ?? dados?.abas[0];

  return (
    // O nome do comparado nos rótulos (21/10/2026): "Orçado" no Orçamento Empresarial; nos outros, o nome da marcação.
    <RotulosDoGrafico.Provider value={{ realizado: "Realizado", orcado: dados?.rotuloComparado ?? "Orçado" }}>
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Painel de Bordo"
        comoUsar={
          <ul>
            <li>
              Em “Configurar Gráficos”, à direita do título, escolha o Exercício, o Período (o mês de referência, entre as competências fechadas; o
              acumulado vai de janeiro até ele), os Rótulos (Com: os valores de cada mês escritos nos gráficos, o realizado por cima do orçado), o
              Tipo dos gráficos; cada escolha vale na hora e também na aba Indicadores. O Tipo e os Rótulos ficam guardados neste navegador. As
              legendas (as cores das séries e os sinais) ficam antes do botão.
            </li>
            <li>Troque entre as abas Resultados e Performance (os unitários) e Indicadores. Aparecem só as abas que o seu perfil lê (Controle de Usuários / Perfis).</li>
            <li>Os itens (os cards), os quadros e a ordem deles vêm do cadastro Cadastros da Controladoria / Analítico / Painel de Bordo: nome, comportamento, grupo, quadro, Metodologia e formato.</li>
            <li>
              Na aba Indicadores, os indicadores do exercício mês a mês até o Período, com o acumulado e, nas colunas de
              rótulo preto, o orçado do último mês e o acumulado do orçado. O Exercício, o Período, os Rótulos e o Tipo do Configurar Gráficos valem
              também nela; fora do Orçamento, as colunas do orçado trazem o nome da marcação escolhida na Comparação (Previsão SET/26, Previsão
              Acum.…), como em Resultados. Na lista antes do rótulo Indicador (a seta), escolha Todos os Grupos ou um grupo; use os filtros nos rótulos das colunas;
              as colunas Indicador, Sent. e Und. ficam fixas. Clique num indicador para abrir o gráfico dele (o realizado e o orçado mês a mês e o
              acumulado), que o botão ao lado do nome copia como imagem. Nesta aba, “Exportar” baixa os indicadores em Excel ou PDF.
            </li>
            <li>
              Cada grupo (Consolidado, Produção: Matriz…) é uma seção, uma abaixo da outra, com um card por indicador, da largura da tela: em cima, o nome e, à direita dele, a Metodologia (a fórmula do item) e o comportamento entre parênteses (o mês de referência fica ao lado do nome
              do grupo); embaixo, o Atual e o Acumulado, com a unidade no rótulo (Atual (R$ M), Acumulado (m³)…), cada um com o valor em destaque e, à direita, o destaque do desvio — a variação, “vs. Orçado” e o valor orçado, num quadro cinza com uma
              faixa na cor do sinal à direita; e, ao lado, o gráfico dos meses do exercício, com
              o realizado em amarelo-ouro e o orçado em preto, e o gráfico do acumulado (ACUM.), do mesmo tipo, na largura de um mês e num quadro cinza (o do destaque do desvio).
            </li>
            <li>
              Tipo: Barras (colunas do realizado e do orçado) ou Área (o realizado numa área amarela, mais forte no máximo do
              período e transparente no zero, com o contorno em amarelo-ouro, e o orçado numa linha preta; no gráfico do acumulado, a coluna do
              realizado com o mesmo degradê e o orçado como uma linha preta). As cores dos sinais seguem a Acessibilidade, no menu do usuário (o
              nome no canto de cima, à direita): Padrão (verde, amarelo e vermelho) ou Daltonismo (azul no lugar do verde, para quem não distingue
              o verde do vermelho); a legenda acompanha.
            </li>
            <li>Passe o mouse sobre o gráfico para ver os valores do mês, sobre o selo para ler o sinal e sobre a seta para ver o sentido do indicador.</li>
            <li>A seta antes do nome de cada grupo recolhe e expande os cards dele; a escolha fica guardada no navegador.</li>
            <li>
              O cenário comparado é o escolhido na “Comparação” da tela Resultados (a escolha fica guardada neste navegador), entre os cenários marcados, de qualquer exercício (Previsão, Orçamento, Anterior e Vendido; o
              padrão é a primeira marcação que houver, nessa ordem), e o nome dele aparece no fim da legenda, “(vs. …)”; fora do Orçamento, os
              cards dizem “vs.” e o nome da marcação.
            </li>
            <li>
              Com os Rótulos, o valor do realizado fica à esquerda do centro de cada mês (e do acumulado) e o do orçado à direita, e os gráficos
              ficam sem as linhas da escala (só a do zero). O botão ao lado do nome de cada grupo copia o grupo inteiro (o nome e os cards) como
              imagem, para colar num e-mail ou numa apresentação; o botão seguinte (o mesmo ícone, com um asterisco: “Copiar o grupo como imagem (sem
              gráficos)”) copia só os valores dos cards, com a borda de cada um. Se o navegador não deixar copiar, a imagem é baixada.
            </li>
            <li>O orçado vem do cenário escolhido na Comparação (de início, o marcado como Previsão ou, sem ele, como Orçamento, Anterior ou Vendido, em Criação de Cenários / Cenários Sintéticos); sem nenhum cenário marcado, o orçado fica zero.</li>
            <li>Sem os Rótulos, a escala à esquerda de cada gráfico usa marcas práticas, sem casas decimais: múltiplos de 1, 2, 5, 10, 25, 50, 100, 250, 500, 1.000… (ou 0,1, 0,2, 0,5 quando os valores são pequenos), na unidade do card (milhões, milhares, %, m³…).</li>
          </ul>
        }
        sobre={
          <>
            <p>
              O realizado contra o orçado do mês e do acumulado do exercício, nos grupos Resultados e Performance, com os gráficos mês a mês
              (realizado em amarelo-ouro, meta em preto).
            </p>
            <p>
              O realizado sai dos mesmos valores da aba Indicadores, só das competências fechadas: a DRE apurada, os volumes da apuração e os indicadores importados (ou
              digitados nas Listas Operacionais). O orçado sai das Metas do cenário escolhido na Comparação (de início, o marcado como Previsão ou,
              sem ele, como Orçamento, Anterior ou Vendido, em Criação de Cenários / Cenários Sintéticos), calculadas como o realizado, e o acumulado do orçado também. Sem nenhum cenário
              marcado, ou sem o valor no cenário, o orçado é zero.
            </p>
            <p>
              O desvio (vs. Orçado) é o realizado sobre o orçado, menos 1 (com o orçado negativo, o sinal se inverte). A faixa à direita do destaque
              e o ícone ficam verdes (azuis, com a Acessibilidade Daltonismo), com um triângulo para cima, quando o realizado está do lado bom do
              orçado; vermelhos, com um triângulo para baixo, do lado ruim; e amarelos, com um quadrado, quando o desvio é de até 5%. O lado bom depende
              do sentido do indicador: ↑ quanto maior, melhor; ↓ quanto menor, melhor. Com o orçado zero (uma meta zero, como a de acidentes), o
              desvio não se calcula (—), mas o destaque ainda tem a cor: amarelo se o realizado também for zero; senão, verde ou vermelho pelo sentido.
            </p>
            <p>
              O resultado financeiro e as despesas fixas aparecem em milhares de reais (R$ K), no Atual e no Acumulado. O
              percentual sob o resultado financeiro também é sobre a receita líquida (/RL), como os demais.
            </p>
            <p>
              Nos quadros Consolidado, Produção: Matriz, Produção: Filial e Serviços, o card Custos de Produção (▪ CPV) traz o Custo do Produto
              Vendido da unidade (a linha CPV da DRE), entre a receita e a margem bruta, com o percentual sobre a receita líquida do quadro; quanto
              menor, melhor.
            </p>
          </>
        }
        acoes={
          // As legendas e o botão Configurar Gráficos, com as listas no modal (14/10/2026; antes, as listas na linha do título).
          ano && ate ? (
            <div className="flex flex-wrap items-center justify-end gap-4">
              {/* Na aba Indicadores, só as cores das séries (os sinais são dos cards). */}
              {naAbaIndicadores ? (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-600">
                  <LegendaRealizadoOrcado tipo={tipoGrafico} />
                  <EtiquetaDoComparado nome={dados?.cenarioOrcado} />
                </div>
              ) : (
                <LegendaDoPainel tipo={tipoGrafico} cores={cores} comparado={dados?.cenarioOrcado} />
              )}
              <ConfigurarGraficos>
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
              </ConfigurarGraficos>
              {naAbaIndicadores ? (
                <ExportarRelatorio
                  caminho="indicadores"
                  padrao={`Indicadores ${ano}`}
                  opcoes={[{ chave: "todos", excel: "Todos os Indicadores", pdf: "Todos os Indicadores", params: { ano, ate } }]}
                />
              ) : null}
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
      ) : !dados ? (
        <div className="h-64 animate-pulse rounded-sm bg-gray-100" />
      ) : !atual && extras.length === 0 ? (
        <p className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">Seu perfil não tem acesso a nenhuma aba desta tela.</p>
      ) : (
        <CorpoDoPainel
          dados={dados}
          aba={aba === "indicadores" ? aba : (atual?.chave ?? aba)}
          onAba={setAba}
          extras={extras}
          tipo={tipoGrafico}
          cores={cores}
          comRotulos={comRotulos}
          aviso={
            // Os avisos como um quadro comum, com o destaque vermelho à esquerda (13/10/2026; antes, amarelos).
            !dados.cenarioOrcado ? (
              <div className={AVISO_DO_PAINEL}>
                Nenhum cenário está marcado (Orçamento, Anterior, Vendido ou Previsão): o orçado aparece como zero. Marque um cenário em Criação de
                Cenários / Cenários Sintéticos.
              </div>
            ) : dados.mesesSemMeta.length > 0 ? (
              <div className={AVISO_DO_PAINEL}>
                O cenário {dados.cenarioOrcado} ({comparacao.atual?.rotulo ?? "Orçamento"}) não tem valores de {dados.mesesSemMeta.join(", ")}: o orçado desses meses aparece
                como zero. Importe nele um arquivo com esses meses (Cenários Sintéticos).
              </div>
            ) : null
          }
        />
      )}
    </div>
    </RotulosDoGrafico.Provider>
  );
}
