"use client";

import { useCallback, useEffect, useRef, useState, useLayoutEffect } from "react";
import GridLayout, { type Layout } from "react-grid-layout";
import { moveElement } from "react-grid-layout/build/utils";
import { ChartColumn, CircleAlert, CirclePlay, ImagePlus, Settings, SlidersHorizontal, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { blocoComparado, CardDoPainel, type FormatacaoDoCard, type Cores } from "@/app/relatorios/painel/PainelContent";
import type { ItemPainel } from "@/app/relatorios/services/relatoriosService";
import { SeletorRotulos, SeletorTipoGrafico } from "@/app/relatorios/components/GraficoRealizadoOrcado";
import { botaoPrimario, OpcaoEmLinha } from "@/app/cenarios/components/CenarioDialog";
import { valor, valorCurto } from "@/app/relatorios/indicadores/TabelaIndicadores";
import { fatorDaEscalaDa } from "@/app/relatorios/services/relatoriosService";
import type { TipoGrafico } from "@/app/relatorios/components/GraficoRealizadoOrcado";

import { enderecoDaFoto, type Bloco, type DadosDoRelatorio, type Fundo, type Nota, type TelaDoSumario } from "../services/relatoriosExecutivosService";
import { AjustesDaImagemDialog, ImagemComMoldura } from "./AjustesDaImagem";
import { CamadaDoFundo } from "./FundoDoSlide";
import { BarraDoSumario, ConfigurarSumarioDialog, ListaDoSumario } from "./SumarioDoRelatorio";
import { alturaDaLinha, BarraDeTexto, familiaDa, TAMANHO_DO_TITULO, TextoRico } from "./TextoRico";
import { estadoDoPlayer, irPara, pausarPlayer, PlayerDoVideo } from "./PlayerDoVideo";
import { videoDoLink } from "./videoIncorporado";
import { ConfigurarTabelaDialog, TabelaDoBloco } from "./TabelaDoRelatorio";


/** A grade: 12 colunas, linhas de 24 px, 12 px entre os blocos. */
export const COLUNAS = 12;
const ALTURA_DA_LINHA = 24;
const MARGEM = 12;

/**
 * O gráfico dos cards (22/10/2026): os meses e o acumulado, só o acumulado ou nenhum. O ícone do gráfico passa de um ao
 * outro, nessa ordem, e o card muda de largura na proporção: os valores são 2 partes, o gráfico dos meses e do acumulado
 * mais 3, e o só do acumulado mais 1.
 */
export type ModoDoGrafico = "MESES" | "ACUMULADO" | "NENHUM";
export function modoDoGrafico(b: Pick<Bloco, "tipo"> & { comGrafico?: boolean; soAcumulado?: boolean; grafico?: "MESES" | "ACUMULADO" }): ModoDoGrafico {
  if (b.tipo === "PAINEL") return !b.comGrafico ? "NENHUM" : b.soAcumulado ? "ACUMULADO" : "MESES";
  if (b.tipo === "INDICADOR") return b.grafico ?? "NENHUM";
  return "NENHUM";
}
const PARTES: Record<ModoDoGrafico, number> = { MESES: 5, ACUMULADO: 3, NENHUM: 2 };
const PROXIMO: Record<ModoDoGrafico, ModoDoGrafico> = { MESES: "ACUMULADO", ACUMULADO: "NENHUM", NENHUM: "MESES" };
/** A largura mínima dos cards em cada modo do gráfico. */
const MINIMO: Record<"PAINEL" | "INDICADOR", Record<ModoDoGrafico, number>> = {
  PAINEL: { MESES: 10, ACUMULADO: 6, NENHUM: 5 },
  // O card de indicador é o card do Painel (22/10/2026): as mesmas larguras.
  INDICADOR: { MESES: 10, ACUMULADO: 6, NENHUM: 5 },
};
/** O próximo modo do gráfico do card e a largura dele nesse modo (na proporção das partes, entre o mínimo e a grade). */
function proximoGrafico(b: Extract<Bloco, { tipo: "PAINEL" | "INDICADOR" }>): Partial<Bloco> {
  const atual = modoDoGrafico(b);
  const novo = PROXIMO[atual];
  const w = Math.min(COLUNAS, Math.max(MINIMO[b.tipo][novo], Math.round((b.w * PARTES[novo]) / PARTES[atual])));
  return (b.tipo === "PAINEL" ? { comGrafico: novo !== "NENHUM", soAcumulado: novo === "ACUMULADO", w } : { grafico: novo === "NENHUM" ? undefined : novo, w }) as Partial<Bloco>;
}

/** O tamanho inicial de cada tipo de bloco (colunas × linhas); o card do Painel sem o gráfico, 2/5 dele com o gráfico. */
export function tamanhoInicial(b: Pick<Bloco, "tipo"> & { comGrafico?: boolean; grafico?: "MESES" | "ACUMULADO" }) {
  if (b.tipo === "PAINEL") return b.comGrafico ? { w: 12, h: 9 } : { w: 5, h: 9 };
  // O card de indicador, como o do Painel (22/10/2026).
  if (b.tipo === "INDICADOR") return b.grafico ? { w: 12, h: 9 } : { w: 5, h: 9 };
  if (b.tipo === "FOTO") return { w: 4, h: 6 };
  if (b.tipo === "VIDEO") return { w: 6, h: 8 };
  if (b.tipo === "TEXTO") return { w: 6, h: 3 };
  if (b.tipo === "SUMARIO") return { w: 6, h: 10 };
  // A tabela de Resultados (22/10/2026): a largura da página.
  if (b.tipo === "TABELA") return { w: 12, h: 16 };
  return { w: 6, h: 6 };
}

/** O tamanho mínimo de cada tipo de bloco (16/10/2026), para as informações não se amontoarem; `largura`, a da grade. */
function tamanhoMinimo(b: Bloco, largura: number) {
  if (b.tipo === "PAINEL") return { minW: MINIMO.PAINEL[modoDoGrafico(b)], minH: 6 };
  if (b.tipo === "INDICADOR") return { minW: MINIMO.INDICADOR[modoDoGrafico(b)], minH: 6 };
  // A Imagem Livre (22/10/2026) diminui até duas linhas de altura ou uma coluna de largura, o que vier antes (a altura
  // acompanha a largura, na proporção da imagem); a com legenda, até 2 × 2.
  if (b.tipo === "FOTO" && b.livre) {
    const minW = Array.from({ length: COLUNAS }, (_, k) => k + 1).find((w) => linhasSemMinimo(w, b.proporcao, largura) >= 2) ?? COLUNAS;
    return { minW, minH: linhasDaFoto(minW, b.proporcao, largura, true) };
  }
  if (b.tipo === "FOTO") return { minW: 2, minH: 2 };
  if (b.tipo === "VIDEO") return { minW: 3, minH: 3 };
  // O Texto Livre baixa até uma linha; o Sumário, até duas (20/10/2026).
  if (b.tipo === "TEXTO") return { minW: 2, minH: 1 };
  if (b.tipo === "SUMARIO") return { minW: 3, minH: 2 };
  if (b.tipo === "TABELA") return { minW: 3, minH: 3 };
  // A anotação baixa a ponto de mostrar uma linha só do texto (16/10/2026).
  return { minW: 3, minH: 2 };
}

/**
 * A grade no fundo, ao mover ou redimensionar (16/10/2026): as células das colunas e das linhas, bem claras, desenhadas
 * por uma máscara (o SVG de uma célula, repetido) sobre o cinza do tema.
 */
function GradeDeFundo({ largura }: { largura: number }) {
  const coluna = (largura - MARGEM * (COLUNAS - 1) - MARGEM * 2) / COLUNAS;
  const celula = `<svg xmlns="http://www.w3.org/2000/svg" width="${coluna + MARGEM}" height="${ALTURA_DA_LINHA + MARGEM}"><rect width="${coluna}" height="${ALTURA_DA_LINHA}" rx="2"/></svg>`;
  const mascara = `url("data:image/svg+xml,${encodeURIComponent(celula)}")`;
  const tamanho = `${coluna + MARGEM}px ${ALTURA_DA_LINHA + MARGEM}px`;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 bg-gray-200/60"
      style={{ maskImage: mascara, WebkitMaskImage: mascara, maskSize: tamanho, WebkitMaskSize: tamanho, maskPosition: `${MARGEM}px ${MARGEM}px`, WebkitMaskPosition: `${MARGEM}px ${MARGEM}px` }}
    />
  );
}

/**
 * As linhas de uma página (16/10/2026): só o espaço útil da tela inteira, onde a apresentação a mostra — a altura da tela,
 * menos o topo do slide (24 px de margem, o título em 40 px e 16 px abaixo dele) e a margem de baixo (24 px).
 */
export function linhasDaPagina() {
  const altura = typeof window === "undefined" ? 1080 : window.screen.height;
  const grade = altura - 24 - 40 - 16 - 24;
  // A grade: 12 px em cima e embaixo, e cada linha com 12 px entre elas.
  return Math.max(8, Math.floor((grade - MARGEM) / (ALTURA_DA_LINHA + MARGEM)));
}

/**
 * A largura da grade do slide (22/10/2026): a da apresentação — a tela inteira menos as margens de 32 px, mais os 12 px de
 * cada lado da grade. A grade tem sempre essa largura; na edição, o slide inteiro se reduz na mesma proporção para caber
 * na tela, e sai igual na apresentação (antes, a grade tinha a largura da área da tela e as linhas, a mesma altura: na tela
 * inteira, os blocos ficavam mais largos e mais baixos, e a imagem, na proporção dela, mais estreita que a legenda).
 */
export function larguraDoSlide() {
  const largura = typeof window === "undefined" ? 1920 : window.screen.width;
  return largura - 64 + 24;
}

/** O card do Painel sem o gráfico fica com 2/5 da largura (as duas colunas dos valores, do mesmo tamanho); com ele, 5/2. */
const LARGURA_SEM_GRAFICO = 2 / 5;

/** A altura da legenda da foto (o destaque e o espaço acima dele), em px. */
const ALTURA_DA_LEGENDA = 44;

/**
 * As linhas de uma foto com `w` colunas na grade de `largura` px (16/10/2026): a altura da foto na proporção dela, mais a
 * legenda — a foto aumenta e diminui sempre na mesma proporção.
 */
export function linhasDaFoto(w: number, proporcao: number, largura: number, semLegenda = false) {
  // A Imagem Livre (21/10/2026) não tem a legenda: a altura é só a da imagem.
  return Math.max(2, linhasSemMinimo(w, proporcao, largura, semLegenda ? 0 : ALTURA_DA_LEGENDA));
}

/** As linhas da imagem com `w` colunas, na proporção dela (mais `extra` px), sem o mínimo de duas. */
function linhasSemMinimo(w: number, proporcao: number, largura: number, extra = 0) {
  const coluna = (largura - MARGEM * (COLUNAS - 1) - MARGEM * 2) / COLUNAS;
  const alto = (coluna * w + MARGEM * (w - 1)) / proporcao + extra;
  return Math.round((alto + MARGEM) / (ALTURA_DA_LINHA + MARGEM));
}

/**
 * O bloco se redimensiona na proporção (20/10/2026): a foto, o vídeo do computador e o do YouTube (o player tem a proporção
 * do vídeo); os vídeos do Instagram, do Facebook e do LinkedIn (a publicação, com o texto dela), livres.
 */
const naProporcao = (b: Bloco | undefined): b is Extract<Bloco, { tipo: "FOTO" | "VIDEO" }> =>
  b?.tipo === "FOTO" || (b?.tipo === "VIDEO" && (b.origem === "ARQUIVO" || !!videoDoLink(b.url)?.comandos));

/**
 * Os quadrados de ancoragem do bloco escolhido (24/10/2026, como no Canva): os quatro cantos e o meio dos lados; nos
 * blocos na proporção (a foto e os vídeos), só os cantos — a altura acompanha a largura.
 */
type Alca = "s" | "w" | "e" | "n" | "sw" | "nw" | "se" | "ne";
const TODAS_AS_ALCAS: Alca[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const CANTOS: Alca[] = ["nw", "ne", "se", "sw"];

/**
 * O desenho dos quadrados de ancoragem e da borda do bloco escolhido (24/10/2026). As medidas se dividem pela escala do
 * slide na edição (--escala), para os quadrados terem o mesmo tamanho na tela em qualquer largura.
 */
const ESTILO_DA_EDICAO = `
.grade-do-relatorio .react-grid-item > .ancora-do-bloco {
  width: calc(10px / var(--escala, 1)) !important; height: calc(10px / var(--escala, 1)) !important;
  padding: 0 !important; margin: 0 !important; transform: none !important; box-sizing: border-box;
  background: var(--background) !important; background-image: none !important;
  border: calc(2px / var(--escala, 1)) solid var(--color-sky-600); border-radius: calc(2px / var(--escala, 1)); z-index: 30;
}
.grade-do-relatorio .react-grid-item > .ancora-do-bloco::after { display: none !important; }
.grade-do-relatorio .ancora-do-bloco.react-resizable-handle-nw { top: calc(-6px / var(--escala, 1)) !important; left: calc(-6px / var(--escala, 1)) !important; cursor: nwse-resize; }
.grade-do-relatorio .ancora-do-bloco.react-resizable-handle-ne { top: calc(-6px / var(--escala, 1)) !important; right: calc(-6px / var(--escala, 1)) !important; left: auto !important; cursor: nesw-resize; }
.grade-do-relatorio .ancora-do-bloco.react-resizable-handle-se { bottom: calc(-6px / var(--escala, 1)) !important; right: calc(-6px / var(--escala, 1)) !important; cursor: nwse-resize; }
.grade-do-relatorio .ancora-do-bloco.react-resizable-handle-sw { bottom: calc(-6px / var(--escala, 1)) !important; left: calc(-6px / var(--escala, 1)) !important; cursor: nesw-resize; }
.grade-do-relatorio .ancora-do-bloco.react-resizable-handle-n { top: calc(-6px / var(--escala, 1)) !important; left: calc(50% - 5px / var(--escala, 1)) !important; cursor: ns-resize; }
.grade-do-relatorio .ancora-do-bloco.react-resizable-handle-s { bottom: calc(-6px / var(--escala, 1)) !important; left: calc(50% - 5px / var(--escala, 1)) !important; cursor: ns-resize; }
.grade-do-relatorio .ancora-do-bloco.react-resizable-handle-e { right: calc(-6px / var(--escala, 1)) !important; top: calc(50% - 5px / var(--escala, 1)) !important; cursor: ew-resize; }
.grade-do-relatorio .ancora-do-bloco.react-resizable-handle-w { left: calc(-6px / var(--escala, 1)) !important; top: calc(50% - 5px / var(--escala, 1)) !important; cursor: ew-resize; }
`;

/** As faixas da borda do bloco escolhido que o movem ao arrastar (por cima da linha de destaque, 8 px na tela). */
const FAIXAS_DA_BORDA: Array<{ lado: string; estilo: React.CSSProperties }> = [
  { lado: "cima", estilo: { left: 0, right: 0, top: "calc(-6px / var(--escala, 1))", height: "calc(8px / var(--escala, 1))" } },
  { lado: "baixo", estilo: { left: 0, right: 0, bottom: "calc(-6px / var(--escala, 1))", height: "calc(8px / var(--escala, 1))" } },
  { lado: "esquerda", estilo: { top: 0, bottom: 0, left: "calc(-6px / var(--escala, 1))", width: "calc(8px / var(--escala, 1))" } },
  { lado: "direita", estilo: { top: 0, bottom: 0, right: "calc(-6px / var(--escala, 1))", width: "calc(8px / var(--escala, 1))" } },
];

/** O nome do bloco escolhido, no começo do menu da edição. */
function nomeDoBloco(b: Bloco) {
  if (b.tipo === "PAINEL") return "Card do Painel de Bordo";
  if (b.tipo === "INDICADOR") return "Card de Indicador";
  if (b.tipo === "ANOTACAO") return "Anotação";
  if (b.tipo === "TEXTO") return "Texto Livre";
  if (b.tipo === "SUMARIO") return "Sumário";
  if (b.tipo === "TABELA") return "Tabela";
  if (b.tipo === "VIDEO") return "Vídeo";
  return b.livre ? "Imagem Livre" : "Imagem com Legenda";
}

/** O campo de texto de quando nenhum bloco com texto está escolhido (estável, para a barra do texto). */
const semCampo = () => null;

/** O ícone do gráfico do card (22/10/2026): o modo de agora e, na dica, o próximo. */
function BotaoDoGrafico({ modo, botao, onClicar }: { modo: ModoDoGrafico; botao: string; onClicar: () => void }) {
  const AGORA: Record<ModoDoGrafico, string> = { MESES: "Gráfico dos meses e do acumulado", ACUMULADO: "Gráfico só do acumulado", NENHUM: "Sem gráfico" };
  const PROXIMA: Record<ModoDoGrafico, string> = { MESES: "clique para mostrar só o acumulado", ACUMULADO: "clique para tirar o gráfico", NENHUM: "clique para mostrar os meses e o acumulado" };
  const dica = `${AGORA[modo]}: ${PROXIMA[modo]}`;
  return (
    <button type="button" className={`relative ${botao} ${modo === "NENHUM" ? "" : "text-gray-900"}`} title={dica} aria-label={dica} onClick={onClicar}>
      <ChartColumn className="size-4" />
      {modo === "NENHUM" ? <span className="absolute h-px w-4 rotate-45 bg-current" /> : null}
      {modo === "ACUMULADO" ? <span className="absolute right-0 bottom-0 text-[8px] leading-none font-bold">A</span> : null}
    </button>
  );
}

/**
 * As notas das anotações (15/10/2026): o ícone e as cores, no padrão do Painel de Bordo — positivo em verde (azul com a
 * Acessibilidade Daltonismo, do menu do usuário), negativo em vermelho e atenção em laranja. O rótulo é o título da anotação até alguém o mudar.
 */
export const NOTAS: Record<Nota, { rotulo: string; Icone: typeof ThumbsUp; classe: (cores: Cores) => string; icone: (cores: Cores) => string }> = {
  POSITIVO: {
    rotulo: "Positivo",
    Icone: ThumbsUp,
    classe: (c) => (c === "daltonismo" ? "border-l-blue-600" : "border-l-green-500"),
    icone: (c) => (c === "daltonismo" ? "text-blue-700" : "text-green-600"),
  },
  // O vermelho mais escuro e o laranja (16/10/2026; antes, o amarelo, perto do amarelo-ouro da BPM).
  // O ícone e o título negativos (17/10/2026): no Escuro, o mesmo vermelho do destaque e do texto (--cor-nota-negativa).
  NEGATIVO: { rotulo: "Negativo", Icone: ThumbsDown, classe: () => "border-l-red-700", icone: () => "text-[var(--cor-nota-negativa)]" },
  ATENCAO: { rotulo: "Atenção", Icone: CircleAlert, classe: () => "border-l-orange-500", icone: () => "text-orange-600" },
};

/**
 * A grade do relatório (15/10/2026): os blocos de uma aba — os cards do Painel de Bordo (com ou sem o gráfico), os
 * cards dos Indicadores (o destaque, como nas Listas), as anotações, as fotos e os vídeos (20/10/2026). Na edição, cada bloco se move pela alça,
 * se redimensiona pelo canto (até o tamanho mínimo do tipo; a foto, na proporção dela) e tem os botões dele (com ou sem
 * gráfico, as opções do gráfico, a nota da anotação, excluir).
 */
export function GradeDoRelatorio({
  relatorioId,
  blocos,
  dados,
  editavel,
  cores,
  tipo,
  linhas,
  ampliavel = false,
  sumario = [],
  fundo,
  onCarregarImagem,
  onEscolherVideo,
  paraImagem = false,
  onMudar,
}: {
  relatorioId: string;
  /** Na imagem do slide (22/10/2026: a exportação em PDF): os vídeos como quadros com o ícone. */
  paraImagem?: boolean;
  /** As telas e os slides do relatório, com os números (20/10/2026), para os blocos de Sumário. */
  sumario?: TelaDoSumario[];
  /** A Imagem de Fundo da página (20/10/2026), atrás dos blocos (na edição; a apresentação a põe no slide inteiro). */
  fundo?: Fundo;
  /** O vídeo de um quadro de vídeo vazio (20/10/2026): abre o Adicionar Vídeo para ele. */
  onEscolherVideo?: (id: string) => void;
  /** A imagem escolhida para um quadro de foto vazio (17/10/2026). */
  onCarregarImagem?: (id: string, arquivo: File) => void;
  /** As linhas da página: os blocos não passam delas, e a página tem essa altura (o espaço útil da tela inteira). */
  linhas: number;
  /** Na apresentação (16/10/2026): o bloco se destaca sob o mouse e, clicado, se amplia na tela, com o fundo escurecido. */
  ampliavel?: boolean;
  blocos: Bloco[];
  dados: DadosDoRelatorio | undefined;
  editavel: boolean;
  cores: Cores;
  tipo: TipoGrafico;
  onMudar: (blocos: Bloco[]) => void;
}) {
  const [configurando, setConfigurando] = useState<string | null>(null);
  // O slide na largura da tela inteira (caixa) e a escala dele no espaço da tela (area): 1 na apresentação, menor na edição.
  const LARGURA = larguraDoSlide();
  const area = useRef<HTMLDivElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const alturaDaPagina = linhas * (ALTURA_DA_LINHA + MARGEM) + MARGEM;
  const [escala, setEscala] = useState(1);
  const [alturaDoSlide, setAlturaDoSlide] = useState(alturaDaPagina);
  useLayoutEffect(() => {
    const a = area.current;
    const c = caixa.current;
    if (!a || !c) return;
    const medir = () => {
      setEscala(a.clientWidth / LARGURA || 1);
      setAlturaDoSlide(c.offsetHeight);
    };
    const obs = new ResizeObserver(medir);
    obs.observe(a);
    obs.observe(c);
    return () => obs.disconnect();
  }, [LARGURA]);
  // Os campos de texto formatado dos blocos (anotações e legendas), para a barra de formatação do menu da edição.
  const campos = useRef(new Map<string, HTMLElement>());
  // O bloco escolhido na edição (24/10/2026, como no Canva): o clique o destaca, com os quadrados de ancoragem para
  // redimensionar e a borda para mover; o menu único, no alto, mostra as opções dele. Um clique fora dos blocos ou o Esc
  // o soltam; o Delete (fora de um texto) o exclui.
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const escolhido = editavel ? blocos.find((b) => b.id === selecionado) : undefined;
  const campoDoEscolhido = useCallback(() => (selecionado ? (campos.current.get(selecionado) ?? null) : null), [selecionado]);
  const excluir = (id: string) => {
    onMudar(blocos.filter((x) => x.id !== id));
    setSelecionado(null);
  };
  useEffect(() => {
    if (!editavel || !selecionado) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (document.querySelector("[role=dialog]")) return;
      const el = document.activeElement as HTMLElement | null;
      const escrevendo = !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
      if (e.key === "Escape") {
        if (escrevendo) el!.blur();
        setSelecionado(null);
      } else if (e.key === "Delete" && !escrevendo) {
        e.preventDefault();
        excluir(selecionado);
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  });
  // A largura da grade enquanto um bloco se move ou se redimensiona (para a grade de fundo); fora disso, null.
  const [ajustando, setAjustando] = useState<number | null>(null);
  const comecar = () => setAjustando(caixa.current?.offsetWidth ?? null);
  const terminar = () => setAjustando(null);
  // O arrasto (22/10/2026): os blocos empurrados voltam ao lugar quando o arrastado sai de cima deles. A grade acumula os
  // empurrões a cada passo do arrasto; aqui, a cada passo, os outros blocos voltam à posição do início do arrasto e só os
  // que o bloco encobre agora são empurrados (a mesma regra da grade, no próprio leiaute, antes de ela o guardar).
  const doInicio = useRef<Map<string, { x: number; y: number }> | null>(null);
  const comecarArrasto = (l: Layout[]) => {
    doInicio.current = new Map(l.map((b) => [b.i, { x: b.x, y: b.y }]));
    comecar();
  };
  const aoArrastar = (l: Layout[], _antes: Layout, arrastado: Layout) => {
    const inicio = doInicio.current;
    if (!inicio) return;
    const { x, y } = arrastado;
    for (const b of l) {
      const p = inicio.get(b.i);
      if (!p) continue;
      b.x = p.x;
      b.y = p.y;
      b.moved = false;
    }
    moveElement(l, arrastado, x, y, true, false, null, COLUNAS, false);
  };
  const terminarArrasto = () => {
    doInicio.current = null;
    terminar();
  };
  // Só o bloco escolhido se redimensiona, pelos quadrados de ancoragem (24/10/2026; antes, qualquer bloco, pelo canto).
  const layout: Layout[] = blocos.map((b) => ({
    i: b.id,
    x: b.x,
    y: b.y,
    w: b.w,
    h: b.h,
    ...tamanhoMinimo(b, LARGURA),
    isResizable: editavel && b.id === selecionado,
    resizeHandles: naProporcao(b) ? CANTOS : TODAS_AS_ALCAS,
  }));
  // A foto se redimensiona pela largura: a altura acompanha, na proporção dela. Por um canto de cima (24/10/2026), o pé
  // fica no lugar: o topo acompanha a altura.
  const aoRedimensionar = (_l: Layout[], antes: Layout, novo: Layout, sombra: Layout) => {
    const b = blocos.find((x) => x.id === novo.i);
    if (!naProporcao(b) || !caixa.current) return;
    const h = linhasDaFoto(novo.w, b.proporcao, caixa.current.offsetWidth, b.tipo === "FOTO" && !!b.livre);
    if (novo.y !== antes.y) novo.y = sombra.y = Math.max(0, antes.y + antes.h - h);
    novo.h = sombra.h = h;
  };
  const mudarBloco = (id: string, m: Partial<Bloco>) => onMudar(blocos.map((b) => (b.id === id ? ({ ...b, ...m } as Bloco) : b)));
  const aoMudarLeiaute = (novo: Layout[]) => {
    const pos = new Map(novo.map((l) => [l.i, l]));
    const mudou = blocos.some((b) => {
      const l = pos.get(b.id);
      return l && (l.x !== b.x || l.y !== b.y || l.w !== b.w || l.h !== b.h);
    });
    if (mudou) onMudar(blocos.map((b) => ({ ...b, ...(pos.has(b.id) ? { x: pos.get(b.id)!.x, y: pos.get(b.id)!.y, w: pos.get(b.id)!.w, h: pos.get(b.id)!.h } : {}) })));
  };
  const doCard = blocos.find((b) => b.id === configurando);
  // O bloco ampliado, com o tamanho dele na grade (sem a ampliação do mouse); Esc ou um clique o fecham. No card do Painel
  // (17/10/2026), só o card (sem o nome do grupo) ou só o gráfico, conforme o ponto clicado: `recorte` é a parte do card
  // que aparece (o gráfico), em px do card.
  // No vídeo (20/10/2026), `video`: de onde ele continua ampliado (o tempo e se estava tocando, na grade).
  const [ampliado, setAmpliado] = useState<{ b: Bloco; w: number; h: number; soCard?: boolean; semGrafico?: boolean; recorte?: Recorte; video?: { tempo: number; tocando: boolean } } | null>(null);
  // Fechar o ampliado: o vídeo da grade fica no tempo em que o ampliado parou (pausado).
  const fechar = () => {
    if (ampliado?.b.tipo === "VIDEO" && caixa.current) {
      const { tempo } = estadoDoPlayer(document.querySelector("[data-bloco-ampliado] [data-video-do-bloco]"));
      const daGrade = [...caixa.current.querySelectorAll(`[data-video-do-bloco="${ampliado.b.id}"]`)].find((el) => !el.closest("[data-bloco-ampliado]"));
      irPara(daGrade ?? null, tempo);
    }
    setAmpliado(null);
  };
  // O destaque sob o mouse (16/10/2026): o bloco cresce até 10%, a partir do ponto que o mantém dentro da tela.
  const [realce, setRealce] = useState<{ id: string; escala: number; origem: string } | null>(null);
  useEffect(() => {
    if (!ampliado) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      fechar();
    };
    window.addEventListener("keydown", aoTeclar, true);
    return () => window.removeEventListener("keydown", aoTeclar, true);
    // A cada desenho (20/10/2026): o fechar do momento (o do vídeo ampliado lê o tempo dele).
  });
  return (
    <>
      {/* O menu único da edição (24/10/2026; antes, a barra de cada bloco, com o mouse sobre ele), logo abaixo das abas. */}
      {editavel ? (
        <>
          <style>{ESTILO_DA_EDICAO}</style>
          <BarraDeEdicao
            b={escolhido}
            campo={campoDoEscolhido}
            onMudar={(m) => escolhido && mudarBloco(escolhido.id, m)}
            onConfigurar={() => escolhido && setConfigurando(escolhido.id)}
            onExcluir={() => escolhido && excluir(escolhido.id)}
          />
        </>
      ) : null}
    {/* A página na altura do espaço útil da tela inteira; na edição, com o contorno tracejado dela (o bloco que passa dele,
        de antes do limite, aparece abaixo e volta para dentro ao ser movido). A sombra do bloco, em cinza. */}
    <div ref={area} className="relative -mx-3" style={{ height: alturaDoSlide * escala }}>
      <div
        ref={caixa}
        className="grade-do-relatorio absolute top-0 left-0 [&_.react-grid-placeholder]:!bg-gray-400"
        style={{ width: LARGURA, minHeight: alturaDaPagina, transform: escala === 1 ? undefined : `scale(${escala})`, transformOrigin: "top left", ["--escala" as string]: escala }}
        // O clique fora dos blocos solta o escolhido.
        onMouseDown={editavel ? (e) => (!(e.target as HTMLElement).closest(".react-grid-item") ? setSelecionado(null) : undefined) : undefined}
      >
      {editavel ? (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 rounded-sm border border-dashed border-gray-300" style={{ height: linhas * (ALTURA_DA_LINHA + MARGEM) + MARGEM }} />
      ) : null}
      {fundo ? <CamadaDoFundo relatorioId={relatorioId} fundo={fundo} className="absolute inset-x-0 top-0 rounded-sm" style={{ height: linhas * (ALTURA_DA_LINHA + MARGEM) + MARGEM }} /> : null}
      {ajustando ? <GradeDeFundo largura={ajustando} /> : null}
      <GridLayout
        layout={layout}
        width={LARGURA}
        transformScale={escala}
        cols={COLUNAS}
        rowHeight={ALTURA_DA_LINHA}
        maxRows={linhas}
        margin={[12, 12]}
        isDraggable={editavel}
        isResizable={editavel}
        // Move-se pela borda do bloco escolhido (as faixas .alca-do-bloco, 24/10/2026; antes, pela alça da barra do bloco).
        draggableHandle=".alca-do-bloco"
        // Os quadrados de ancoragem do bloco escolhido (24/10/2026), no desenho de ESTILO_DA_EDICAO.
        resizeHandle={(eixo: Alca, ref: React.Ref<HTMLElement>) => (
          <span ref={ref as React.Ref<HTMLSpanElement>} className={`react-resizable-handle react-resizable-handle-${eixo} ancora-do-bloco`} />
        )}
        // Os blocos ficam onde se põem, em todas as páginas (22/10/2026; antes, só na Capa, no Encerramento e nas com a
        // Imagem de Fundo — nas demais, a grade os encostava em cima): sem se sobrepor (o bloco arrastado sobre outro o
        // empurra; e, se o arrasto continua, o empurrado volta ao lugar, 22/10/2026) e dentro da página (as linhas dela e as
        // colunas, isBounded).
        compactType={null}
        isBounded
        // A grade com a altura da página, no mínimo (22/10/2026): o isBounded limita o arrasto à altura da grade, que sem
        // isso era só a do bloco mais baixo (numa página com poucos blocos, eles não desciam).
        style={{ minHeight: alturaDaPagina }}
        onLayoutChange={aoMudarLeiaute}
        onResize={aoRedimensionar}
        onDragStart={comecarArrasto}
        onDrag={aoArrastar}
        onDragStop={terminarArrasto}
        onResizeStart={comecar}
        onResizeStop={terminar}
      >
        {blocos.map((b) => {
          // O Texto Livre e o Sumário (20/10/2026) são da composição do slide: na apresentação, sem o destaque e sem ampliar. A
          // Imagem Livre se destaca e se amplia como as demais (22/10/2026; antes, como o Texto Livre), sem o fundo atrás dela
          // e com a sombra no contorno da imagem (o PNG transparente continua transparente).
          const amplia = ampliavel && b.tipo !== "TEXTO" && b.tipo !== "SUMARIO";
          const imagemLivre = b.tipo === "FOTO" && !!b.livre;
          return (
          // Sob o mouse, o bloco fica por cima dos vizinhos (a dica do gráfico e o destaque da apresentação passam por cima deles).
          // Na edição, o clique (ou o foco num texto dele) escolhe o bloco.
          <div
            key={b.id}
            className={`group relative focus-within:z-10 hover:z-10 ${b.id === selecionado ? "z-20" : ""}`}
            onMouseDownCapture={editavel ? () => setSelecionado(b.id) : undefined}
            onFocusCapture={editavel ? () => setSelecionado(b.id) : undefined}
          >
            {editavel && b.id === selecionado ? (
              <>
                {/* O destaque do bloco escolhido e as faixas da borda, que o movem ao arrastar. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 z-20 rounded-[2px]"
                  style={{ outline: "calc(2px / var(--escala, 1)) solid var(--color-sky-600)", outlineOffset: "calc(2px / var(--escala, 1))" }}
                />
                {FAIXAS_DA_BORDA.map(({ lado, estilo }) => (
                  <span key={lado} className="alca-do-bloco absolute z-20 cursor-move" style={estilo} title="Arraste a borda para mover o bloco" />
                ))}
              </>
            ) : editavel ? (
              <>
                {/* Sob o mouse, o contorno tracejado mostra o bloco que o clique escolhe. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 z-20 rounded-[2px] opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ outline: "calc(1px / var(--escala, 1)) dashed var(--color-gray-400)", outlineOffset: "calc(2px / var(--escala, 1))" }}
                />
                {/* O player do vídeo (um iframe) não passa o clique adiante: a camada recebe o primeiro, que escolhe o bloco. */}
                {b.tipo === "VIDEO" ? <div className="absolute inset-0 z-10 cursor-pointer" title="Clique para escolher o vídeo" /> : null}
              </>
            ) : null}
            {/* Na apresentação, sob o mouse, o bloco cresce 10% com uma sombra fraca, sem sair da tela; o clique o amplia. */}
            <div
              // O card do Painel sem recorte (16/10/2026): a dica do mês, ao passar o mouse no gráfico, sai dos limites do card.
              className={`h-full ${b.tipo === "PAINEL" ? "" : "overflow-hidden"} ${amplia ? `cursor-zoom-in rounded-sm transition duration-200 ${imagemLivre ? "hover:drop-shadow-lg" : "hover:bg-background hover:shadow-lg"}` : ""}`}
              style={realce?.id === b.id ? { transform: `scale(${realce.escala})`, transformOrigin: realce.origem } : undefined}
              onMouseEnter={amplia ? (e) => setRealce({ id: b.id, ...destaqueNaTela(e.currentTarget.getBoundingClientRect()) }) : undefined}
              onMouseLeave={amplia ? () => setRealce(null) : undefined}
              onClick={amplia ? (e) => setAmpliado(oQueAmpliar(b, e.currentTarget, e.target as HTMLElement)) : undefined}
            >
              <ConteudoDoBloco
                relatorioId={relatorioId}
                b={b}
                dados={dados}
                editavel={editavel}
                cores={cores}
                tipo={tipo}
                apresentacao={ampliavel}
                sumario={sumario}
                registrar={(el) => (el ? campos.current.set(b.id, el) : campos.current.delete(b.id))}
                onCarregarImagem={onCarregarImagem ? (arquivo) => onCarregarImagem(b.id, arquivo) : undefined}
                onEscolherVideo={onEscolherVideo ? () => onEscolherVideo(b.id) : undefined}
                paraImagem={paraImagem}
                onMudar={(m) => mudarBloco(b.id, m)}
              />
            </div>
          </div>
          );
        })}
      </GridLayout>
      </div>
      {ampliado ? (
        <BlocoAmpliado w={ampliado.recorte?.w ?? ampliado.w} h={ampliado.recorte?.h ?? ampliado.h} onFechar={fechar}>
          {ampliado.recorte ? (
            // Só o gráfico: o card inteiro, no tamanho dele, deslocado para que só a área do gráfico fique à vista.
            <div className="relative size-full overflow-hidden">
              <div className="absolute" style={{ left: -ampliado.recorte.x, top: -ampliado.recorte.y, width: ampliado.w, height: ampliado.h }}>
                <ConteudoDoBloco relatorioId={relatorioId} b={ampliado.b} dados={dados} editavel={false} cores={cores} tipo={tipo} ampliado soCard onMudar={() => undefined} />
              </div>
            </div>
          ) : (
            <ConteudoDoBloco
              relatorioId={relatorioId}
              b={ampliado.b}
              dados={dados}
              editavel={false}
              cores={cores}
              tipo={tipo}
              ampliado
              soCard={ampliado.soCard}
              semGrafico={ampliado.semGrafico}
              video={ampliado.video}
              onMudar={() => undefined}
            />
          )}
        </BlocoAmpliado>
      ) : null}
      {doCard?.tipo === "FOTO" && doCard.arquivo ? (
        <AjustesDaImagemDialog
          relatorioId={relatorioId}
          arquivo={doCard.arquivo}
          proporcao={doCard.proporcao}
          inicial={doCard.ajustes}
          comMoldura
          onFechar={() => setConfigurando(null)}
          onAplicar={(ajustes, troca) => {
            // Com a imagem trocada (22/10/2026), o bloco fica com a altura da proporção da nova; os ajustes ficam.
            const nova = troca ? { arquivo: troca.arquivo, proporcao: troca.proporcao, h: linhasDaFoto(doCard.w, troca.proporcao, LARGURA, !!doCard.livre) } : {};
            mudarBloco(doCard.id, { ajustes, ...nova } as Partial<Bloco>);
            setConfigurando(null);
          }}
        />
      ) : null}
      {doCard?.tipo === "SUMARIO" ? (
        <ConfigurarSumarioDialog
          titulo="Configurar Sumário"
          inicial={{ listar: doCard.listar, telas: doCard.telas, linha: doCard.linha }}
          sumario={sumario}
          onFechar={() => setConfigurando(null)}
          onAplicar={(o) => {
            mudarBloco(doCard.id, o);
            setConfigurando(null);
          }}
        />
      ) : null}
      {doCard?.tipo === "TABELA" ? (
        <ConfigurarTabelaDialog
          relatorioId={relatorioId}
          titulo="Configurar Tabela"
          inicial={{ visao: doCard.visao, nivel: doCard.nivel, linhas: doCard.linhas, recolhido: doCard.recolhido }}
          onFechar={() => setConfigurando(null)}
          onAplicar={(o) => {
            // Sem as linhas (todas), o campo sai do bloco.
            mudarBloco(doCard.id, { ...o, linhas: o.linhas } as Partial<Bloco>);
            setConfigurando(null);
          }}
        />
      ) : null}
      {doCard?.tipo === "PAINEL" || doCard?.tipo === "INDICADOR" ? (
        <ConfigurarGraficoDialog
          b={doCard}
          tipo={tipo}
          cores={cores}
          onFechar={() => setConfigurando(null)}
          onAplicar={(opcoes, todos) => {
            // Neste card ou em todos os cards da aba (os do Painel de Bordo e, desde 22/10/2026, os dos Indicadores).
            // As cores próprias do card do Painel (de antes de 16/10/2026) saem: valem as da Acessibilidade.
            onMudar(
              blocos.map((x) =>
                !(todos || x.id === doCard.id) ? x : x.tipo === "PAINEL" ? { ...x, ...opcoes, cores: undefined } : x.tipo === "INDICADOR" ? { ...x, ...opcoes } : x,
              ),
            );
            setConfigurando(null);
          }}
        />
      ) : null}
    </div>
    </>
  );
}

/**
 * O destaque de um bloco (16/10/2026): a escala (até 1,1) e o ponto de origem dela que deixam o bloco ampliado dentro da
 * tela (8 px das bordas). Em cada direção, a origem fica no meio, se cabe; senão, encosta no lado que não tem espaço.
 */
function destaqueNaTela(r: DOMRect) {
  const folga = 8;
  const eixo = (inicio: number, tamanho: number, limite: number) => {
    const antes = Math.max(0, inicio - folga);
    const depois = Math.max(0, limite - folga - (inicio + tamanho));
    const escala = Math.min(1.1, (tamanho + antes + depois) / tamanho);
    const cresce = escala - 1;
    // A origem o, em px a partir do início: cresce·o ≤ antes e cresce·(tamanho − o) ≤ depois; de preferência, o meio.
    const o = cresce > 0 ? Math.min(Math.max(tamanho / 2, tamanho - depois / cresce), antes / cresce) : tamanho / 2;
    return { escala, o: Math.min(tamanho, Math.max(0, o)) };
  };
  const x = eixo(r.left, r.width, window.innerWidth);
  const y = eixo(r.top, r.height, window.innerHeight);
  return { escala: Math.min(x.escala, y.escala), origem: `${x.o}px ${y.o}px` };
}

type Recorte = { x: number; y: number; w: number; h: number };

/**
 * O que ampliar ao clicar num bloco da apresentação (17/10/2026): no card do Painel, o gráfico (clicado nele) ou a parte
 * antes dele (clicado no resto: o card como se não tivesse gráfico, na largura dessa parte), sem o nome do grupo; nos
 * demais blocos, o bloco inteiro. As medidas saem do card na tela, divididas
 * pela ampliação do destaque do mouse, para virem no tamanho da grade.
 */
function oQueAmpliar(b: Bloco, bloco: HTMLElement, alvo: HTMLElement) {
  const inteiro = { b, w: bloco.offsetWidth, h: bloco.offsetHeight };
  // O vídeo (20/10/2026): ampliado, continua de onde estava; o da grade pausa.
  if (b.tipo === "VIDEO") {
    const el = bloco.querySelector("[data-video-do-bloco]");
    const video = estadoDoPlayer(el);
    pausarPlayer(el);
    return { ...inteiro, video };
  }
  if (b.tipo !== "PAINEL") return inteiro;
  const card = bloco.querySelector<HTMLElement>("[data-card-indicador]");
  if (!card) return inteiro;
  const rc = card.getBoundingClientRect();
  const escala = rc.width / card.offsetWidth || 1;
  const grafico = alvo.closest<HTMLElement>("[data-grafico-do-card]");
  if (!grafico || !card.contains(grafico)) {
    // A parte antes do gráfico: o card sem o gráfico, na largura do card menos a do gráfico (o card sem gráfico já ocupa só ela).
    const doCard = card.querySelector<HTMLElement>("[data-grafico-do-card]");
    const comGrafico = !!doCard && doCard.offsetWidth > 0;
    return { b, w: card.offsetWidth - (comGrafico ? doCard.offsetWidth : 0), h: card.offsetHeight, soCard: true, semGrafico: comGrafico };
  }
  const rg = grafico.getBoundingClientRect();
  return {
    b,
    w: card.offsetWidth,
    h: card.offsetHeight,
    soCard: true,
    recorte: { x: (rg.left - rc.left) / escala, y: (rg.top - rc.top) / escala, w: grafico.offsetWidth, h: grafico.offsetHeight },
  };
}

/**
 * O bloco ampliado na apresentação (16/10/2026): o mesmo bloco, no tamanho da grade, ampliado (transform) até ocupar o
 * máximo da tela, sobre um fundo escurecido; um clique em qualquer lugar fecha.
 */
function BlocoAmpliado({ w, h, onFechar, children }: { w: number; h: number; onFechar: () => void; children: React.ReactNode }) {
  const borda = 16;
  const escala = Math.min((window.innerWidth * 0.94) / (w + 2 * borda), (window.innerHeight * 0.92) / (h + 2 * borda));
  return (
    // data-bloco-ampliado: com ele aberto, as setas e o espaço não mudam o slide (o vídeo ampliado usa o teclado).
    <div role="dialog" aria-modal aria-label="Bloco ampliado" data-bloco-ampliado className="fixed inset-0 z-[70] flex cursor-zoom-out items-center justify-center bg-black/75" onClick={onFechar}>
      <div className="shrink-0 rounded-sm bg-background shadow-2xl" style={{ width: w + 2 * borda, height: h + 2 * borda, padding: borda, transform: `scale(${escala})` }}>
        {children}
      </div>
    </div>
  );
}

type OpcoesDoGrafico = { tipoGrafico: TipoGrafico; comRotulos: boolean };

/**
 * O Configurar Gráfico de um card do Painel de Bordo (16/10/2026) ou dos Indicadores (22/10/2026): as opções do Configurar
 * Gráficos do Painel — os Rótulos e o Tipo (as cores são as da Acessibilidade, 16/10/2026) —, aplicadas a este card ou a
 * todos os cards da aba.
 */
function ConfigurarGraficoDialog({
  b,
  tipo,
  cores,
  onAplicar,
  onFechar,
}: {
  b: Extract<Bloco, { tipo: "PAINEL" | "INDICADOR" }>;
  tipo: TipoGrafico;
  cores: Cores;
  onAplicar: (o: OpcoesDoGrafico, todos: boolean) => void;
  onFechar: () => void;
}) {
  const [o, setO] = useState<OpcoesDoGrafico>({ tipoGrafico: b.tipoGrafico ?? tipo, comRotulos: b.comRotulos ?? false });
  const [todos, setTodos] = useState(false);
  return (
    <Dialog open onOpenChange={(a) => (!a ? onFechar() : undefined)}>
      <DialogContent className="rounded-sm sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Gráfico</DialogTitle>
          <DialogDescription>
            {b.tipo === "PAINEL" ? `${b.titulo} (${b.quadro})` : b.nome}: as opções do Configurar Gráficos do Painel de Bordo.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 [&_label]:justify-between [&_label>span]:text-sm [&_[data-slot=select-trigger]]:w-40">
          <SeletorRotulos com={o.comRotulos} onMudar={(comRotulos) => setO((x) => ({ ...x, comRotulos }))} />
          <SeletorTipoGrafico tipo={o.tipoGrafico} onMudar={(tipoGrafico) => setO((x) => ({ ...x, tipoGrafico }))} />
        </div>
        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-sm leading-none font-medium">Aplicar</legend>
          <OpcaoEmLinha nome="aplicar-grafico" marcada={!todos} onMarcar={() => setTodos(false)} rotulo="Neste Card" detalhe="Só o card escolhido." />
          <OpcaoEmLinha nome="aplicar-grafico" marcada={todos} onMarcar={() => setTodos(true)} rotulo="Em Toda a Aba" detalhe="Todos os cards da aba." />
        </fieldset>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" className={botaoPrimario} onClick={() => onAplicar(o, todos)}>
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * O menu único da edição (24/10/2026, pedido do Adão; antes, a barra de cada bloco, com o mouse sobre ele), logo abaixo
 * das abas e preso no alto ao rolar: o nome do bloco escolhido e, sempre nos mesmos lugares, as opções de todos os tipos —
 * o gráfico dos cards e o Configurar (o gráfico, o sumário ou a tabela), os ajustes da imagem, as notas das anotações, a
 * formatação do texto (no Sumário, a dele, por nível) e excluir. As que não valem para o bloco escolhido (ou sem bloco
 * escolhido) ficam à vista, quase apagadas (o cinza claro no tema claro, o escuro no Escuro).
 */
function BarraDeEdicao({
  b,
  campo,
  onMudar,
  onConfigurar,
  onExcluir,
}: {
  b: Bloco | undefined;
  campo: () => HTMLElement | null;
  onMudar: (m: Partial<Bloco>) => void;
  onConfigurar: () => void;
  onExcluir: () => void;
}) {
  const botao = "inline-flex size-7 items-center justify-center rounded-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 disabled:cursor-default disabled:text-gray-300 disabled:hover:bg-transparent";
  const card = b?.tipo === "PAINEL" || b?.tipo === "INDICADOR" ? b : undefined;
  const configurar = card && modoDoGrafico(card) !== "NENHUM" ? "Configurar o gráfico" : b?.tipo === "SUMARIO" ? "Configurar o sumário" : b?.tipo === "TABELA" ? "Configurar a tabela" : null;
  const imagem = b?.tipo === "FOTO" && b.arquivo ? b : undefined;
  // O texto formatado: as anotações, o Texto Livre e as legendas das fotos e dos vídeos (a fonte e o espaçamento, só nos dois primeiros).
  const comTexto = !!b && (b.tipo === "ANOTACAO" || b.tipo === "TEXTO" || (b.tipo === "FOTO" && !b.livre) || b.tipo === "VIDEO");
  const doTexto = b?.tipo === "ANOTACAO" || b?.tipo === "TEXTO";
  const separador = <span aria-hidden className="mx-1 h-5 w-px bg-gray-200" />;
  return (
    <div role="toolbar" aria-label="Edição do bloco escolhido" className="sticky top-[var(--topo-tabela,0px)] z-30 flex flex-wrap items-center gap-0.5 rounded-sm border border-gray-200 bg-white px-2 py-1 shadow-sm">
      <span className="mr-1 min-w-40 text-xs">{b ? <span className="font-semibold text-gray-900">{nomeDoBloco(b)}</span> : <span className="text-gray-500">Clique num bloco para editá-lo</span>}</span>
      {separador}
      {/* O gráfico do card (22/10/2026), em ciclo: os meses e o acumulado → só o acumulado → sem gráfico → os meses e o acumulado. */}
      {card ? (
        <BotaoDoGrafico modo={modoDoGrafico(card)} botao={botao} onClicar={() => onMudar(proximoGrafico(card))} />
      ) : (
        <button type="button" className={botao} disabled title="Gráfico do card" aria-label="Gráfico do card">
          <ChartColumn className="size-4" />
        </button>
      )}
      {/* O Configurar: as opções do gráfico dos cards com gráfico, o sumário ou a tabela. */}
      <button type="button" className={botao} disabled={!configurar} title={configurar ?? "Configurar"} aria-label={configurar ?? "Configurar"} onClick={onConfigurar}>
        <Settings className="size-4" />
      </button>
      {/* Os ajustes da imagem (21/10/2026): brilho, matiz, saturação, desfoque e transparência. */}
      <button type="button" className={`${botao} ${imagem?.ajustes ? "text-gray-900" : ""}`} disabled={!imagem} title="Ajustes da imagem" aria-label="Ajustes da imagem" onClick={onConfigurar}>
        <SlidersHorizontal className="size-4" />
      </button>
      {separador}
      {(Object.keys(NOTAS) as Nota[]).map((n) => {
        const { Icone, rotulo } = NOTAS[n];
        const marcada = b?.tipo === "ANOTACAO" && b.nota === n;
        return (
          <button
            key={n}
            type="button"
            className={`${botao} ${marcada ? "bg-gray-200 text-gray-900" : ""}`}
            disabled={b?.tipo !== "ANOTACAO"}
            title={`Nota: ${rotulo}`}
            aria-label={`Nota: ${rotulo}`}
            aria-pressed={marcada}
            onClick={() => onMudar({ nota: n } as Partial<Bloco>)}
          >
            <Icone className="size-4" />
          </button>
        );
      })}
      {separador}
      {/* A formatação: no Sumário, a dele, por nível (20/10/2026); nos demais, a do texto (17/10/2026). */}
      {b?.tipo === "SUMARIO" ? (
        <BarraDoSumario b={b} botao={botao} onMudar={(m) => onMudar(m as Partial<Bloco>)} />
      ) : (
        <BarraDeTexto
          campo={comTexto ? campo : semCampo}
          botao={botao}
          desabilitado={!comTexto}
          // A fonte e o espaçamento entre as linhas (20/10/2026), nas anotações e no Texto Livre.
          fontes={doTexto}
          espacamento={doTexto ? { valor: b.espacamento, definir: (espacamento) => onMudar({ espacamento } as Partial<Bloco>) } : undefined}
          titulo={
            b?.tipo === "ANOTACAO"
              ? {
                  campo: () => campo()?.closest(".group")?.querySelector<HTMLInputElement>("[data-titulo-da-anotacao]") ?? null,
                  tamanho: b.tamanhoTitulo ?? TAMANHO_DO_TITULO,
                  definir: (px) => onMudar({ tamanhoTitulo: px } as Partial<Bloco>),
                  fonte: b.fonteTitulo,
                  definirFonte: (fonteTitulo) => onMudar({ fonteTitulo } as Partial<Bloco>),
                }
              : undefined
          }
        />
      )}
      {separador}
      <button type="button" className={`${botao} hover:text-red-700`} disabled={!b} title="Excluir o bloco (Delete)" aria-label="Excluir o bloco" onClick={onExcluir}>
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

function ConteudoDoBloco({
  relatorioId,
  b,
  dados,
  editavel,
  cores,
  tipo,
  ampliado = false,
  soCard = false,
  semGrafico = false,
  apresentacao = false,
  sumario = [],
  video,
  registrar,
  onCarregarImagem,
  onEscolherVideo,
  paraImagem = false,
  onMudar,
}: {
  relatorioId: string;
  b: Bloco;
  /** Na imagem do slide (22/10/2026: a exportação em PDF): o vídeo como um quadro com o ícone (o player não vira imagem). */
  paraImagem?: boolean;
  /** Na apresentação (20/10/2026): o vídeo sem os controles do player, com os botões ao passar o mouse. */
  apresentacao?: boolean;
  /** As telas e os slides, com os números, para o Sumário (20/10/2026). */
  sumario?: TelaDoSumario[];
  /** No vídeo ampliado: de onde ele continua (o tempo e se estava tocando). */
  video?: { tempo: number; tocando: boolean };
  /** No quadro de vídeo vazio, na edição: escolher o vídeo. */
  onEscolherVideo?: () => void;
  /** No bloco ampliado da apresentação (16/10/2026): a legenda da foto com metade do tamanho. */
  ampliado?: boolean;
  /** No card do Painel ampliado (17/10/2026): só o card, sem o nome do grupo em cima. */
  soCard?: boolean;
  /** No card ampliado pela parte antes do gráfico (17/10/2026): o card como se não tivesse gráfico. */
  semGrafico?: boolean;
  /** O campo do texto formatado (anotação ou legenda), para a barra de formatação. */
  registrar?: (el: HTMLElement | null) => void;
  /** A imagem escolhida no quadro de foto vazio. */
  onCarregarImagem?: (arquivo: File) => void;
  dados: DadosDoRelatorio | undefined;
  editavel: boolean;
  cores: Cores;
  tipo: TipoGrafico;
  onMudar: (m: Partial<Bloco>) => void;
}) {
  const indisponivel = (o: string) => <div className="flex h-full items-center justify-center rounded-sm border border-dashed border-gray-300 bg-white p-3 text-center text-xs text-gray-500">{o}</div>;
  if (b.tipo === "ANOTACAO") {
    // No formato do card do Painel (16/10/2026): o título editável (de início, o nome da nota) no fundo da página, como o
    // nome do grupo em cima dos cards, e o texto num card branco com o destaque da cor da nota à esquerda.
    const n = NOTAS[b.nota];
    const titulo = b.titulo?.trim() ? b.titulo : n.rotulo;
    return (
      <div className="flex h-full flex-col">
        {/* O título no tamanho escolhido na barra (19/10/2026; antes, sempre 12 px); o ícone acompanha. */}
        <header
          className={`flex min-h-5 shrink-0 items-center gap-1.5 pb-1 font-bold tracking-wide uppercase ${n.icone(cores)}`}
          style={{ fontSize: b.tamanhoTitulo ?? TAMANHO_DO_TITULO, lineHeight: 1.2, fontFamily: familiaDa(b.fonteTitulo) }}
        >
          <n.Icone className="shrink-0" style={{ width: "1.15em", height: "1.15em" }} />
          {editavel ? (
            <input
              value={b.titulo ?? n.rotulo}
              onChange={(e) => onMudar({ titulo: e.target.value } as Partial<Bloco>)}
              placeholder={n.rotulo}
              maxLength={120}
              aria-label="Título da anotação"
              data-titulo-da-anotacao
              className="min-w-0 flex-1 rounded-sm bg-transparent font-bold tracking-wide uppercase outline-none placeholder:text-current placeholder:opacity-60 hover:bg-gray-100 focus:bg-gray-100"
            />
          ) : (
            <span className="min-w-0 truncate">{titulo}</span>
          )}
        </header>
        <article className={`flex min-h-0 flex-1 rounded-sm border border-l-4 border-gray-200 bg-white ${n.classe(cores)}`}>
          {/* O texto formatado (17/10/2026; antes, só texto): a formatação no menu da edição. */}
          <TextoRico
            html={b.html}
            texto={b.texto}
            editavel={editavel}
            placeholder="Escreva a anotação…"
            estilo={{ lineHeight: alturaDaLinha(b.espacamento) }}
            rotulo={`Anotação (${titulo})`}
            registrar={registrar}
            onMudar={(html, texto) => onMudar({ html, texto } as Partial<Bloco>)}
            className="min-h-0 w-full flex-1 overflow-auto px-4 py-2 text-sm text-gray-900"
          />
        </article>
      </div>
    );
  }
  if (b.tipo === "TEXTO") {
    // O Texto Livre (20/10/2026): o texto formatado das anotações, sem o destaque, o título, o ícone e o fundo; na edição,
    // o contorno tracejado com o mouse sobre ele.
    return (
      <TextoRico
        html={b.html}
        texto={b.texto}
        editavel={editavel}
        placeholder="Escreva o texto…"
        estilo={{ lineHeight: alturaDaLinha(b.espacamento) }}
        rotulo="Texto livre"
        registrar={registrar}
        onMudar={(html, texto) => onMudar({ html, texto } as Partial<Bloco>)}
        className={`h-full w-full overflow-auto text-sm text-gray-900 ${editavel ? "rounded-sm border border-dashed border-transparent px-1 hover:border-gray-300 focus:border-gray-300" : "px-1"}`}
      />
    );
  }
  if (b.tipo === "SUMARIO") return <ListaDoSumario b={b} sumario={sumario} editavel={editavel} />;
  if (b.tipo === "FOTO" && b.livre && b.arquivo) {
    // A Imagem Livre (21/10/2026): só a imagem, na proporção dela, sem a legenda e sem o fundo (o PNG transparente continua
    // transparente sobre o slide).
    return (
      <ImagemComMoldura src={enderecoDaFoto(relatorioId, b.arquivo)} alt="Imagem" proporcao={b.proporcao} ajustes={b.ajustes} />
    );
  }
  if (b.tipo === "FOTO") {
    // A foto inteira (na proporção dela) e, embaixo, a legenda no destaque das Listas (16/10/2026).
    return (
      <figure className="flex h-full flex-col gap-2">
        <div className="min-h-0 flex-1">
          {b.arquivo ? (
            <ImagemComMoldura src={enderecoDaFoto(relatorioId, b.arquivo)} alt={b.legenda || "Imagem"} proporcao={b.proporcao} ajustes={b.ajustes} />
          ) : (
            // O quadro sem a imagem (17/10/2026: o relatório importado sem as imagens): cinza, com o botão de carregar.
            <label
              className={`flex h-full w-full flex-col items-center justify-center gap-1 rounded-sm bg-gray-200 text-gray-500 ${editavel && onCarregarImagem ? "cursor-pointer hover:bg-gray-300 hover:text-gray-700" : ""}`}
              title={editavel ? "Carregar uma imagem neste quadro" : "Sem imagem"}
            >
              <ImagePlus className="size-8" />
              {editavel ? <span className="text-xs font-medium">Carregar Imagem</span> : null}
              {editavel && onCarregarImagem ? (
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const arquivo = e.target.files?.[0];
                    e.target.value = "";
                    if (arquivo) onCarregarImagem(arquivo);
                  }}
                />
              ) : null}
            </label>
          )}
        </div>
        {/* A legenda formatada (17/10/2026; antes, só texto): a formatação no menu da edição. A Imagem Livre não a tem. */}
        {!b.livre && (editavel || b.legenda) ? (
          <figcaption
            className="max-h-[40%] min-h-9 shrink-0 overflow-auto rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white text-sm font-semibold text-gray-900"
            style={ampliado ? { zoom: 0.5 } : undefined}
          >
            <TextoRico
              html={b.legendaHtml}
              texto={b.legenda}
              editavel={editavel}
              placeholder="Escreva a legenda…"
              rotulo="Legenda da foto"
              registrar={registrar}
              onMudar={(html, texto) => onMudar({ legendaHtml: html, legenda: texto.slice(0, 500) } as Partial<Bloco>)}
              className="px-3 py-1.5"
            />
          </figcaption>
        ) : null}
      </figure>
    );
  }
  if (b.tipo === "VIDEO") {
    // O vídeo (20/10/2026), como a foto: o player e, embaixo, a legenda no destaque das Listas.
    return (
      <figure className="flex h-full flex-col gap-2">
        <div className="min-h-0 flex-1">
          {paraImagem ? (
            <div className="flex size-full flex-col items-center justify-center gap-2 rounded-sm bg-gray-900 text-gray-100">
              <CirclePlay className="size-12" />
              <span className="text-sm">Vídeo (na apresentação)</span>
            </div>
          ) : (
          <PlayerDoVideo
            relatorioId={relatorioId}
            b={b}
            modo={ampliado ? "ampliado" : editavel ? "edicao" : apresentacao ? "apresentacao" : "leitura"}
            inicio={video?.tempo}
            tocar={video?.tocando}
            onEscolher={editavel ? onEscolherVideo : undefined}
          />
          )}
        </div>
        {editavel || b.legenda ? (
          <figcaption
            className="max-h-[40%] min-h-9 shrink-0 overflow-auto rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white text-sm font-semibold text-gray-900"
            style={ampliado ? { zoom: 0.5 } : undefined}
          >
            <TextoRico
              html={b.legendaHtml}
              texto={b.legenda}
              editavel={editavel}
              placeholder="Escreva a legenda…"
              rotulo="Legenda do vídeo"
              registrar={registrar}
              onMudar={(html, texto) => onMudar({ legendaHtml: html, legenda: texto.slice(0, 500) } as Partial<Bloco>)}
              className="px-3 py-1.5"
            />
          </figcaption>
        ) : null}
      </figure>
    );
  }
  // A tabela de Resultados (22/10/2026), com a consulta dela (não depende dos dados dos cards).
  if (b.tipo === "TABELA") return <TabelaDoBloco relatorioId={relatorioId} b={b} />;
  if (!dados) return <div className="h-full animate-pulse rounded-sm bg-gray-100" />;
  if (b.tipo === "PAINEL") {
    const item = dados.painel.abas.find((a) => a.chave === b.aba)?.quadros.find((q) => q.titulo === b.quadro)?.itens.find((i) => i.titulo === b.titulo && i.sigla === b.sigla);
    if (!item) return indisponivel(`O card ${b.titulo} (${b.quadro}) não está mais no Painel de Bordo.`);
    const card = <CardDoPainel i={item} rotuloMes={dados.painel.rotuloMes} tipo={b.tipoGrafico ?? tipo} cores={cores} comGrafico={b.comGrafico && !semGrafico} soAcumulado={!!b.soAcumulado} comRotulos={b.comRotulos ?? false} />;
    // Sem o nome do grupo em cima do card (22/10/2026; antes, "PRODUÇÃO: MATRIZ"…): o card ocupa o bloco inteiro.
    // A Metodologia em até metade da largura dos valores (22/10/2026), quebrando as linhas.
    return <div className="h-full [&_[data-metodologia]]:max-w-[50%]">{card}</div>;
  }
  const i = dados.indicadores.indicadores.find((x) => x.nome === b.nome);
  if (!i) return indisponivel(`O indicador ${b.nome} não está mais no cadastro Indicadores (Cadastros da Controladoria / Analítico).`);
  const ate = dados.indicadores.ate;
  // O card do indicador é o card do Painel de Bordo (22/10/2026), com a formatação do indicador: "Atual" e "Acumulado" com a
  // unidade entre parênteses, os valores sem ela, o destaque do desvio, o gráfico (o modo do ícone) e, à direita do nome,
  // o grupo e o comportamento. Nos percentuais, a escala dos gráficos em % (antes, em fração: 0,05 no lugar de 5).
  const modo = modoDoGrafico(b);
  const daSerie = dados.indicadores.meses.slice(0, ate).map((m, k) => ({ mes: m.rotulo.split("/")[0], realizado: i.meses[k] ?? null, orcado: i.orcado[k] ?? null }));
  const f: FormatacaoDoCard = { unidade: i.unidade, formatar: (v) => valor(i, v), formatarCurto: (v) => valorCurto(i, v), fatorDaEscala: fatorDaEscalaDa(i.unidade) };
  const item: ItemPainel = {
    titulo: i.nome,
    sigla: "",
    metodologia: i.grupo,
    sentido: i.sentido as ItemPainel["sentido"],
    formato: "PCT",
    formatoAcumulado: "PCT",
    base: null,
    separar: false,
    mes: blocoComparado(i.meses[ate - 1] ?? null, i.orcado[ate - 1] ?? null, i.sentido, !!dados.indicadores.cenarioOrcado),
    acumulado: blocoComparado(i.total, i.totalOrcado, i.sentido, !!dados.indicadores.cenarioOrcado),
    serie: daSerie,
  };
  return (
    <div className="h-full [&_[data-metodologia]]:max-w-[50%]">
      <CardDoPainel
        i={item}
        rotuloMes={dados.painel.rotuloMes}
        tipo={b.tipoGrafico ?? tipo}
        cores={cores}
        comGrafico={modo !== "NENHUM" && !semGrafico}
        soAcumulado={modo === "ACUMULADO"}
        comRotulos={b.comRotulos ?? false}
        formatacao={{ mes: f, acumulado: f }}
      />
    </div>
  );
}
