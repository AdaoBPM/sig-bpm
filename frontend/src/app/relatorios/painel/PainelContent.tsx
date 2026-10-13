"use client";

import { createContext, useContext, useRef, useState, type ReactNode, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { toBlob } from "html-to-image";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

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
 * vermelho); Acessíveis (antes, Daltonismo; 13/10/2026), com azul no lugar do verde (melhor que o orçado), amarelo e
 * vermelho. O selo do desvio fica num tom claro da mesma cor. O valor guardado continua "daltonismo", para manter a
 * escolha já feita nos navegadores.
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
    <article className="grid gap-4 rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white px-4 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,3fr)] lg:grid-rows-[auto_1fr] lg:gap-x-0 lg:gap-y-2">
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
      <div className="relative min-h-32 min-w-0 lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:border-l lg:border-gray-100">
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

/** Um quadro do painel (Consolidado, Produção: Matriz…): uma seção com um card por indicador, um abaixo do outro, e uma seção abaixo da outra. */
function Secao({ q, rotuloMes, tipo, comRotulos }: { q: QuadroPainel; rotuloMes: string; tipo: TipoGrafico; comRotulos: boolean }) {
  const secao = useRef<HTMLElement>(null);
  return (
    <section ref={secao}>
      {/* O nome do grupo e o mês de referência (13/10/2026; antes, em cada card): o mês em cinza; ao lado, o botão de copiar o grupo. */}
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-base font-bold tracking-wide text-gray-900 uppercase">
          {q.titulo}
          <span className="font-semibold text-gray-500"> · {rotuloMes}</span>
        </h2>
        <CopiarComoImagem alvo={secao} nome={`${q.titulo} ${rotuloMes}`} />
      </div>
      <div className="space-y-3">
        {q.itens.map((i) => (
          <CardIndicador key={`${i.titulo}|${i.sigla}`} i={i} rotuloMes={rotuloMes} tipo={tipo} comRotulos={comRotulos} />
        ))}
      </div>
    </section>
  );
}

/** O fundo de verdade atrás do elemento (o do primeiro ancestral com cor), para a imagem ter o fundo da tela no tema escolhido. */
function fundoAtras(no: HTMLElement) {
  for (let e: HTMLElement | null = no; e; e = e.parentElement) {
    const cor = getComputedStyle(e).backgroundColor;
    if (cor && cor !== "transparent" && !/^rgba\(.*,\s*0\)$/.test(cor)) return cor;
  }
  return "#ffffff";
}

/**
 * O botão Copiar como Imagem (13/10/2026), ao lado do nome do grupo: o grupo inteiro (o título e os cards, sem o botão)
 * numa imagem PNG, com o fundo da tela e uma margem, na área de transferência, para colar num e-mail ou numa
 * apresentação. Sem acesso à área de transferência (o endereço sem https, ou o navegador sem suporte), baixa o arquivo.
 */
function CopiarComoImagem({ alvo, nome }: { alvo: RefObject<HTMLElement | null>; nome: string }) {
  const [estado, setEstado] = useState<"livre" | "gerando" | "copiado">("livre");
  const copiar = async () => {
    const no = alvo.current;
    if (!no || estado === "gerando") return;
    setEstado("gerando");
    const margem = 16;
    const largura = no.offsetWidth + 2 * margem;
    const altura = no.offsetHeight + 2 * margem;
    const imagem = toBlob(no, {
      width: largura,
      height: altura,
      backgroundColor: fundoAtras(no),
      style: { margin: "0", padding: `${margem}px`, width: `${largura}px`, height: `${altura}px` },
      filter: (n) => !(n instanceof HTMLElement && n.dataset.foraDaImagem !== undefined),
    }).then((b) => {
      if (!b) throw new Error("Imagem vazia.");
      return b;
    });
    try {
      // A promessa vai direto para a área de transferência, para a cópia valer como feita no clique.
      await navigator.clipboard.write([new ClipboardItem({ "image/png": imagem })]);
      toast.success(`${nome}: copiado como imagem.`);
      setEstado("copiado");
      setTimeout(() => setEstado("livre"), 2000);
      return;
    } catch {
      // Sem a área de transferência: baixa a imagem (abaixo).
    }
    try {
      const url = URL.createObjectURL(await imagem);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${nome.replace(/[\\/:*?"<>|]/g, "-")}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${nome}: o navegador não deixou copiar, a imagem foi baixada.`);
    } catch {
      toast.error("Não foi possível gerar a imagem do grupo.");
    }
    setEstado("livre");
  };
  const Icone = estado === "copiado" ? Check : Copy;
  return (
    <button
      type="button"
      data-fora-da-imagem
      onClick={copiar}
      disabled={estado === "gerando"}
      title="Copiar o grupo como imagem"
      aria-label={`Copiar ${nome} como imagem`}
      className="inline-flex size-7 items-center justify-center rounded-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-wait disabled:opacity-60"
    >
      <Icone className="size-4" />
    </button>
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

/** A lista Cores (Padrão ou Acessíveis), guardada neste navegador; a mesma nos dois painéis. */
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
        { valor: "daltonismo", rotulo: "Acessíveis" },
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
  // O tipo dos gráficos (Barras ou Área) e as cores dos sinais (Padrão ou Acessíveis), lembrados neste navegador.
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
              Cada grupo (Consolidado, Produção: Matriz…) é uma seção, uma abaixo da outra, com um card por indicador, da largura da tela: em
              cima, o nome e, à direita dele, a sigla e o sentido (o mês de referência fica ao lado do nome do grupo); embaixo, o Realizado (Atual) e o Realizado (Acumulado), cada
              um com o valor em destaque e, à direita, o selo do desvio e o orçado (vs. Orçado); e, ao lado, o gráfico dos meses do exercício, com
              o realizado em amarelo-ouro e o orçado em preto, e o gráfico do acumulado (ACUM.), do mesmo tipo.
            </li>
            <li>
              Tipo: Barras (colunas do realizado e do orçado, como na planilha) ou Área (o realizado numa área amarela, mais forte no máximo do
              período e transparente no zero, com o contorno em amarelo-ouro, e o orçado numa linha preta; no gráfico do acumulado, a coluna do
              realizado com o mesmo degradê e o orçado como uma linha preta). Cores: Padrão (verde, amarelo e vermelho) ou Acessíveis (azul
              no lugar do verde, amarelo e vermelho, para quem não distingue o verde do vermelho); a legenda acompanha.
            </li>
            <li>Passe o mouse sobre o gráfico para ver os valores do mês, sobre o selo para ler o sinal e sobre a seta para ver o sentido do indicador.</li>
            <li>
              Com os Rótulos, o valor do realizado fica à esquerda do centro de cada mês (e do acumulado) e o do orçado à direita. O botão ao lado do
              nome de cada grupo copia o grupo inteiro (o nome e os cards) como imagem, para colar num e-mail ou numa apresentação; se o navegador não
              deixar copiar, a imagem é baixada.
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
              (azul, nas cores Acessíveis) quando o realizado está do lado bom do orçado, vermelho do lado ruim, e amarelo quando o desvio é de até 5%. O lado bom depende
              do sentido do indicador: ↑ quanto maior, melhor; ↓ quanto menor, melhor.
            </p>
            <p>
              Como na planilha, o resultado financeiro e as despesas fixas aparecem em milhares (K) no mês e em milhões (M) no acumulado. O
              percentual sob o resultado financeiro também é sobre a receita líquida (/RL), como os demais.
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
