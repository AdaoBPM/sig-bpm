"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { Abas } from "@/components/shared/Abas";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { useAcessibilidade } from "@/lib/acessibilidade";

import { MESES } from "../../competencias/[anoMes]/utils/formatacao";

import { ConfigurarGraficos } from "../components/ConfigurarGraficos";
import { CopiarComoImagem } from "../components/CopiarComoImagem";
import { MiniGrafico } from "../components/MiniGrafico";
import {
  LegendaRealizadoOrcado,
  Quadradinho,
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

const desvio = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${n1.format(v * 100)}%`);

/**
 * As cores do sinal (lista Cores, 11/10/2026): Padrão, as da formatação condicional da planilha (verde, amarelo e
 * vermelho); Daltonismo (a Acessibilidade do menu do usuário, 16/10/2026), com azul no lugar do verde (melhor que o
 * orçado), amarelo e vermelho. O selo do desvio fica num tom claro da mesma cor (14/10/2026: o fundo em SVG, pelas variáveis --cor-selo-*,
 * e o contorno como borda: no Firefox do usuário, o fundo em CSS saía em branco na imagem copiada). O valor guardado
 * continua "daltonismo", para manter a escolha já feita nos navegadores.
 */
export type Cores = "padrao" | "daltonismo";
const SINAIS = {
  padrao: {
    1: { cor: "#92D050", fundo: "var(--cor-selo-verde)", selo: "text-green-800 border-green-200", texto: "Melhor que o" },
    0: { cor: "#FFFF00", fundo: "var(--cor-selo-amarelo)", selo: "text-yellow-800 border-yellow-200", texto: "Até 5% do" },
    [-1]: { cor: "var(--cor-sinal-vermelho)", fundo: "var(--cor-selo-vermelho)", selo: "text-red-700 border-red-200", texto: "Pior que o" },
  },
  daltonismo: {
    1: { cor: "#0070C0", fundo: "var(--cor-selo-azul)", selo: "text-blue-800 border-blue-200", texto: "Melhor que o" },
    0: { cor: "#FFFF00", fundo: "var(--cor-selo-amarelo)", selo: "text-yellow-800 border-yellow-200", texto: "Até 5% do" },
    [-1]: { cor: "var(--cor-sinal-vermelho)", fundo: "var(--cor-selo-vermelho)", selo: "text-red-700 border-red-200", texto: "Pior que o" },
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
  // Em SVG (13/10/2026), para sair no Copiar como Imagem.
  return <Quadradinho cor={SINAL[s].cor} titulo={SINAL[s].texto} />;
}

/** O desvio contra o orçado num selo com a cor do sinal. */
function SeloDesvio({ b }: { b: BlocoPainel }) {
  const SINAL = useSinais();
  const { orcado } = useRotulosDoGrafico();
  const tom = b.sinal === null ? "text-gray-600 border-gray-200" : SINAL[b.sinal].selo;
  const fundo = b.sinal === null ? "var(--cor-selo-neutro)" : SINAL[b.sinal].fundo;
  return (
    <span className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-xs font-bold ${tom}`} title={b.sinal === null ? `Sem ${orcado.toLowerCase()}` : SINAL[b.sinal].texto}>
      {/* O fundo em SVG, atrás do conteúdo, para sair no Copiar como Imagem. */}
      <svg className="pointer-events-none absolute inset-0 size-full" preserveAspectRatio="none" aria-hidden>
        <rect width="100%" height="100%" style={{ fill: fundo }} />
      </svg>
      <span className="relative inline-flex items-center gap-1.5">
        <Sinal s={b.sinal} />
        {desvio(b.vsOrcado)}
      </span>
    </span>
  );
}

/** O percentual sob o realizado (▪ 48,4% (/RL)), quando o item tem. */
const percentualDaBase = (i: ItemPainel, b: BlocoPainel) =>
  i.base ? `${b.base === null ? "—" : `${(i.base.casas === 2 ? n2 : n1).format(b.base * 100)}%`} ${i.base.rotulo}` : null;

/**
 * Um período do card (o Atual ou o Acumulado; 13/10/2026): à esquerda, "Realizado (Atual)" (ou "(Acumulado)"; nos
 * cenários, "Cenário"), o valor em destaque e o percentual da base; à direita, na altura do rótulo, o selo do desvio e,
 * embaixo dele, "vs. Orçado" (ou "vs. Comparado") com o valor orçado.
 */
function GrupoPeriodo({ periodo, b, formato, base, dica }: { periodo: string; b: BlocoPainel; formato: FormatoPainel; base: string | null; dica?: string }) {
  const rotulos = useRotulosDoGrafico();
  return (
    <div className="flex min-w-0 items-start justify-between gap-2" title={dica}>
      <div className="min-w-0">
        <p className="text-xs whitespace-nowrap text-gray-600">
          {rotulos.realizado} ({periodo})
        </p>
        {/* 22 px até 1536 px (26 px acima), para o valor e o orçado caberem lado a lado em 1/5 do card. */}
        <p className="text-[22px] leading-tight font-extrabold whitespace-nowrap text-gray-900 2xl:text-[26px]">{formatar(b.realizado, formato)}</p>
        <p className="h-4 text-xs text-gray-500">{base}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end text-right">
        <SeloDesvio b={b} />
        <p className="mt-1.5 text-xs whitespace-nowrap text-gray-600">vs. {rotulos.orcado}</p>
        <p className="text-sm font-bold whitespace-nowrap text-gray-900">{formatar(b.orcado, formato)}</p>
      </div>
    </div>
  );
}

/**
 * Um indicador num card da largura da tela (09/10/2026; a versão com os cards lado a lado está na etiqueta
 * painel-cards-lado-a-lado do git): o título e a legenda em cima do Atual e do Acumulado (2/5 do card, 1/5 cada) e o
 * gráfico dos meses do exercício, com o do acumulado ao lado (3/5). Em telas estreitas, um embaixo do outro.
 */
function CardIndicador({ i, rotuloMes, tipo, comRotulos }: { i: ItemPainel; rotuloMes: string; tipo: TipoGrafico; comRotulos: boolean }) {
  const sentido = (
    <span title={i.sentido === "↑" ? "Quanto maior, melhor" : "Quanto menor, melhor"} className="font-bold text-gray-700">
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
      {/* O nome e, à direita dele, a sigla e o sentido, alinhados ao vs. Orçado do Acumulado; o mês fica no nome do grupo (13/10/2026). */}
      <header className="flex min-w-0 items-baseline justify-between gap-3 lg:col-span-2 lg:pr-3">
        <h3 className="text-xl leading-snug font-bold text-gray-900" title={i.titulo}>
          {i.titulo}
        </h3>
        <p className="shrink-0 text-sm whitespace-nowrap text-gray-500">
          {i.sigla} {sentido}
        </p>
      </header>
      <div className="self-end lg:col-start-1 lg:row-start-2 lg:pr-3">
        <GrupoPeriodo periodo="Atual" b={i.mes} formato={i.formato} base={percentualDaBase(i, i.mes)} dica={`Atual: ${rotuloMes}`} />
      </div>
      <div className={`self-end lg:col-start-2 lg:row-start-2 lg:pr-3 ${coluna}`}>
        <GrupoPeriodo periodo="Acumulado" b={i.acumulado} formato={i.formatoAcumulado} base={percentualDaBase(i, i.acumulado)} dica={`Acumulado: ${acumulado}`} />
      </div>
      {/*
        O gráfico dos meses e, ao lado, o do acumulado (realizado × orçado), como na planilha, na altura do card: os meses e
        o ACUM. perto do pé dele. O gráfico fica preso à célula (absolute), para a altura do card vir dos valores.
      */}
      <div data-grafico-do-card className="relative min-h-32 min-w-0 lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:border-l lg:border-gray-100">
        <div className="absolute inset-0 flex gap-3 lg:left-5">
          <div className="min-w-0 flex-1">
            <MiniGrafico dados={i.serie} formatar={(v) => formatar(v, i.formato)} formatarCurto={(v) => formatarCurto(v, i.formato)} tipo={tipo} comRotulos={comRotulos} comEscala={!comRotulos} />
          </div>
          {/* O acumulado também com os rótulos ou com a escala; com a escala, um pouco mais largo. */}
          <div className={`${comRotulos ? "w-24" : "w-36"} shrink-0 border-l border-gray-100 pl-3`} title={`Acumulado do exercício (${acumulado}): realizado × orçado`}>
            <MiniGrafico
              dados={[{ mes: "ACUM.", realizado: i.acumulado.realizado, orcado: i.acumulado.orcado }]}
              formatar={(v) => formatar(v, i.formatoAcumulado)}
              formatarCurto={(v) => formatarCurto(v, i.formatoAcumulado)}
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
  comRotulos = false,
}: {
  i: ItemPainel;
  rotuloMes: string;
  tipo: TipoGrafico;
  cores: Cores;
  comGrafico: boolean;
  comRotulos?: boolean;
}) {
  return (
    <CoresDoPainel.Provider value={cores}>
      <div className={`h-full [&>article]:h-full ${comGrafico ? "" : "[&_[data-grafico-do-card]]:hidden lg:[&_[data-card-indicador]]:grid-cols-2"}`}>
        <CardIndicador i={i} rotuloMes={rotuloMes} tipo={tipo} comRotulos={comRotulos} />
      </div>
    </CoresDoPainel.Provider>
  );
}

/** Um quadro do painel (Consolidado, Produção: Matriz…): uma seção com um card por indicador, um abaixo do outro, e uma seção abaixo da outra. */
function Secao({ q, rotuloMes, tipo, comRotulos }: { q: QuadroPainel; rotuloMes: string; tipo: TipoGrafico; comRotulos: boolean }) {
  const secao = useRef<HTMLElement>(null);
  return (
    <section ref={secao}>
      {/* O nome do grupo e o mês de referência (13/10/2026; antes, em cada card): o mês em cinza; ao lado, o botão de copiar o grupo. Em 24 px (14/10/2026; antes, 16). */}
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-2xl font-bold tracking-wide text-gray-900 uppercase">
          {q.titulo}
          <span className="font-semibold text-gray-500"> · {rotuloMes}</span>
        </h2>
        <CopiarComoImagem alvo={secao} nome={`${q.titulo} ${rotuloMes}`} dica="Copiar o grupo como imagem" />
        {/* Ao lado, o grupo sem os gráficos: só os valores dos cards (14/10/2026). */}
        <CopiarComoImagem alvo={secao} nome={`${q.titulo} ${rotuloMes}`} dica="Copiar o grupo como imagem (sem gráficos)" semGraficos />
      </div>
      <div className="space-y-3">
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
  // O servidor manda só as abas que o perfil lê (14/10/2026).
  if (!atual) return <p className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">Seu perfil não tem acesso a nenhuma aba desta tela.</p>;
  return (
    <CoresDoPainel.Provider value={cores}>
      <Abas rotulo="Painel de Bordo" ativa={atual.chave} onMudar={onAba} abas={dados.abas.map((a) => ({ chave: a.chave, rotulo: a.titulo }))} />
      {aviso}
      <div className="space-y-6">
        {atual.quadros.map((q) => (
          <Secao key={q.titulo} q={q} rotuloMes={dados.rotuloMes} tipo={tipo} comRotulos={comRotulos} />
        ))}
      </div>
    </CoresDoPainel.Provider>
  );
}

/** A legenda: as cores do gráfico e os sinais (a comparação com o orçado), na linha do título, antes do Configurar Gráficos (14/10/2026). */
export function LegendaDoPainel({ tipo, cores }: { tipo: TipoGrafico; cores: Cores }) {
  return (
    <CoresDoPainel.Provider value={cores}>
      <ItensDaLegenda tipo={tipo} />
    </CoresDoPainel.Provider>
  );
}
function ItensDaLegenda({ tipo }: { tipo: TipoGrafico }) {
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
  const [aba, setAba] = useState("resultados");
  // O tipo dos gráficos (Barras ou Área), lembrado neste navegador; as cores dos sinais, as da Acessibilidade do menu do usuário.
  const [tipoGrafico, setTipoGrafico] = useTipoGrafico();
  const [comRotulos, setComRotulos] = useRotulosDosValores();
  const [cores] = useCoresDoPainel();
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
              Em “Configurar Gráficos”, à direita do título, escolha o Exercício, o Período (o mês de referência, entre as competências fechadas; o
              acumulado vai de janeiro até ele), os Rótulos (Com: os valores de cada mês escritos nos gráficos, o realizado por cima do orçado), o
              Tipo dos gráficos; cada escolha vale na hora. O Tipo e os Rótulos ficam guardados neste navegador (e valem também para o gráfico do
              indicador em Indicadores). As legendas (as cores das séries e os sinais) ficam antes do botão.
            </li>
            <li>Troque entre as abas Resultados e Performance (os unitários). Aparecem só as abas que o seu perfil lê (Controle de Usuários / Perfis).</li>
            <li>Os itens (os cards), os quadros e a ordem deles vêm do cadastro Cadastros da Controladoria / Analítico / Painel de Bordo: nome, abreviação, comportamento, grupo, quadro e modelo de apuração.</li>
            <li>
              Cada grupo (Consolidado, Produção: Matriz…) é uma seção, uma abaixo da outra, com um card por indicador, da largura da tela: em
              cima, o nome e, à direita dele, a sigla e o sentido (o mês de referência fica ao lado do nome do grupo); embaixo, o Realizado (Atual) e o Realizado (Acumulado), cada
              um com o valor em destaque e, à direita, o selo do desvio e o orçado (vs. Orçado); e, ao lado, o gráfico dos meses do exercício, com
              o realizado em amarelo-ouro e o orçado em preto, e o gráfico do acumulado (ACUM.), do mesmo tipo.
            </li>
            <li>
              Tipo: Barras (colunas do realizado e do orçado, como na planilha) ou Área (o realizado numa área amarela, mais forte no máximo do
              período e transparente no zero, com o contorno em amarelo-ouro, e o orçado numa linha preta; no gráfico do acumulado, a coluna do
              realizado com o mesmo degradê e o orçado como uma linha preta). As cores dos sinais seguem a Acessibilidade, no menu do usuário (o
              nome no canto de cima, à direita): Padrão (verde, amarelo e vermelho) ou Daltonismo (azul no lugar do verde, para quem não distingue
              o verde do vermelho); a legenda acompanha.
            </li>
            <li>Passe o mouse sobre o gráfico para ver os valores do mês, sobre o selo para ler o sinal e sobre a seta para ver o sentido do indicador.</li>
            <li>
              Com os Rótulos, o valor do realizado fica à esquerda do centro de cada mês (e do acumulado) e o do orçado à direita, e os gráficos
              ficam sem as linhas da escala (só a do zero). O botão ao lado do nome de cada grupo copia o grupo inteiro (o nome e os cards) como
              imagem, para colar num e-mail ou numa apresentação; o botão seguinte (o mesmo ícone, com um asterisco: “Copiar o grupo como imagem (sem
              gráficos)”) copia só os valores dos cards, com a borda de cada um. Se o navegador não deixar copiar, a imagem é baixada.
            </li>
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
              (azul, com a Acessibilidade Daltonismo) quando o realizado está do lado bom do orçado, vermelho do lado ruim, e amarelo quando o desvio é de até 5%. O lado bom depende
              do sentido do indicador: ↑ quanto maior, melhor; ↓ quanto menor, melhor.
            </p>
            <p>
              Como na planilha, o resultado financeiro e as despesas fixas aparecem em milhares (K) no mês e em milhões (M) no acumulado. O
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
              <LegendaDoPainel tipo={tipoGrafico} cores={cores} />
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
      ) : !atual ? (
        <p className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">Seu perfil não tem acesso a nenhuma aba desta tela.</p>
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
