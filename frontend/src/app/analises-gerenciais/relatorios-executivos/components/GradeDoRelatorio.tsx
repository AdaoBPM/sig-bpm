"use client";

import { useEffect, useRef, useState } from "react";
import GridLayout, { WidthProvider, type Layout } from "react-grid-layout";
import { ChartColumn, CircleAlert, GripVertical, ImagePlus, Settings, SlidersHorizontal, ThumbsDown, ThumbsUp, X } from "lucide-react";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { CardDoPainel, type Cores } from "@/app/relatorios/painel/PainelContent";
import { SeletorRotulos, SeletorTipoGrafico } from "@/app/relatorios/components/GraficoRealizadoOrcado";
import { botaoPrimario, OpcaoEmLinha } from "@/app/cenarios/components/CenarioDialog";
import { valor } from "@/app/relatorios/indicadores/TabelaIndicadores";
import type { TipoGrafico } from "@/app/relatorios/components/GraficoRealizadoOrcado";

import { enderecoDaFoto, type Bloco, type DadosDoRelatorio, type Fundo, type Nota, type TelaDoSumario } from "../services/relatoriosExecutivosService";
import { AjustesDaImagemDialog, estiloDosAjustes } from "./AjustesDaImagem";
import { CamadaDoFundo } from "./FundoDoSlide";
import { BarraDoSumario, ConfigurarSumarioDialog, ListaDoSumario } from "./SumarioDoRelatorio";
import { alturaDaLinha, BarraDeTexto, familiaDa, TAMANHO_DO_TITULO, TextoRico } from "./TextoRico";
import { estadoDoPlayer, irPara, pausarPlayer, PlayerDoVideo } from "./PlayerDoVideo";
import { videoDoLink } from "./videoIncorporado";

const Grade = WidthProvider(GridLayout);

/** A grade: 12 colunas, linhas de 24 px, 12 px entre os blocos. */
export const COLUNAS = 12;
const ALTURA_DA_LINHA = 24;
const MARGEM = 12;

/** O tamanho inicial de cada tipo de bloco (colunas × linhas); o card do Painel sem o gráfico, 2/5 dele com o gráfico. */
export function tamanhoInicial(b: Pick<Bloco, "tipo"> & { comGrafico?: boolean }) {
  if (b.tipo === "PAINEL") return b.comGrafico ? { w: 12, h: 9 } : { w: 5, h: 9 };
  if (b.tipo === "INDICADOR") return { w: 4, h: 5 };
  if (b.tipo === "FOTO") return { w: 4, h: 6 };
  if (b.tipo === "VIDEO") return { w: 6, h: 8 };
  if (b.tipo === "TEXTO") return { w: 6, h: 3 };
  if (b.tipo === "SUMARIO") return { w: 6, h: 10 };
  return { w: 6, h: 6 };
}

/** O tamanho mínimo de cada tipo de bloco (16/10/2026), para as informações não se amontoarem. */
function tamanhoMinimo(b: Bloco) {
  if (b.tipo === "PAINEL") return b.comGrafico ? { minW: 10, minH: 6 } : { minW: 5, minH: 6 };
  if (b.tipo === "INDICADOR") return { minW: 3, minH: 4 };
  if (b.tipo === "FOTO") return { minW: 2, minH: 2 };
  if (b.tipo === "VIDEO") return { minW: 3, minH: 3 };
  // O Texto Livre baixa até uma linha; o Sumário, até duas (20/10/2026).
  if (b.tipo === "TEXTO") return { minW: 2, minH: 1 };
  if (b.tipo === "SUMARIO") return { minW: 3, minH: 2 };
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

/** O card do Painel sem o gráfico fica com 2/5 da largura (as duas colunas dos valores, do mesmo tamanho); com ele, 5/2. */
const LARGURA_SEM_GRAFICO = 2 / 5;

/** A altura da legenda da foto (o destaque e o espaço acima dele), em px. */
const ALTURA_DA_LEGENDA = 44;

/**
 * As linhas de uma foto com `w` colunas na grade de `largura` px (16/10/2026): a altura da foto na proporção dela, mais a
 * legenda — a foto aumenta e diminui sempre na mesma proporção.
 */
export function linhasDaFoto(w: number, proporcao: number, largura: number, semLegenda = false) {
  const coluna = (largura - MARGEM * (COLUNAS - 1) - MARGEM * 2) / COLUNAS;
  // A Imagem Livre (21/10/2026) não tem a legenda: a altura é só a da imagem.
  const alto = (coluna * w + MARGEM * (w - 1)) / proporcao + (semLegenda ? 0 : ALTURA_DA_LEGENDA);
  return Math.max(2, Math.round((alto + MARGEM) / (ALTURA_DA_LINHA + MARGEM)));
}

/**
 * O bloco se redimensiona na proporção (20/10/2026): a foto, o vídeo do computador e o do YouTube (o player tem a proporção
 * do vídeo); os vídeos do Instagram, do Facebook e do LinkedIn (a publicação, com o texto dela), livres.
 */
const naProporcao = (b: Bloco | undefined): b is Extract<Bloco, { tipo: "FOTO" | "VIDEO" }> =>
  b?.tipo === "FOTO" || (b?.tipo === "VIDEO" && (b.origem === "ARQUIVO" || !!videoDoLink(b.url)?.comandos));

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
  livre = false,
  onCarregarImagem,
  onEscolherVideo,
  onMudar,
}: {
  relatorioId: string;
  /** As telas e os slides do relatório, com os números (20/10/2026), para os blocos de Sumário. */
  sumario?: TelaDoSumario[];
  /** A Imagem de Fundo da página (20/10/2026), atrás dos blocos (na edição; a apresentação a põe no slide inteiro). */
  fundo?: Fundo;
  /**
   * Os blocos ficam onde se põem (20/10/2026: nas páginas da Capa e nas com a Imagem de Fundo, para o título ir ao meio do
   * slide); nas demais, a grade os encosta em cima. A apresentação usa o mesmo, para o slide sair igual.
   */
  livre?: boolean;
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
  const caixa = useRef<HTMLDivElement>(null);
  // Os campos de texto formatado dos blocos (anotações e legendas), para a barra de formatação de cada um.
  const campos = useRef(new Map<string, HTMLElement>());
  // A largura da grade enquanto um bloco se move ou se redimensiona (para a grade de fundo); fora disso, null.
  const [ajustando, setAjustando] = useState<number | null>(null);
  const comecar = () => setAjustando(caixa.current?.offsetWidth ?? null);
  const terminar = () => setAjustando(null);
  const layout: Layout[] = blocos.map((b) => ({ i: b.id, x: b.x, y: b.y, w: b.w, h: b.h, ...tamanhoMinimo(b) }));
  // A foto se redimensiona pela largura: a altura acompanha, na proporção dela.
  const aoRedimensionar = (_l: Layout[], _antes: Layout, novo: Layout, sombra: Layout) => {
    const b = blocos.find((x) => x.id === novo.i);
    if (!naProporcao(b) || !caixa.current) return;
    novo.h = sombra.h = linhasDaFoto(novo.w, b.proporcao, caixa.current.offsetWidth, b.tipo === "FOTO" && !!b.livre);
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
    // A página na altura do espaço útil da tela inteira; na edição, com o contorno tracejado dela (o bloco que passa dele,
    // de antes do limite, aparece abaixo e volta para dentro ao ser movido). A sombra do bloco, em cinza.
    <div ref={caixa} className="relative -mx-3 [&_.react-grid-placeholder]:!bg-gray-400" style={{ minHeight: linhas * (ALTURA_DA_LINHA + MARGEM) + MARGEM }}>
      {editavel ? (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 rounded-sm border border-dashed border-gray-300" style={{ height: linhas * (ALTURA_DA_LINHA + MARGEM) + MARGEM }} />
      ) : null}
      {fundo ? <CamadaDoFundo relatorioId={relatorioId} fundo={fundo} className="absolute inset-x-0 top-0 rounded-sm" style={{ height: linhas * (ALTURA_DA_LINHA + MARGEM) + MARGEM }} /> : null}
      {ajustando ? <GradeDeFundo largura={ajustando} /> : null}
      <Grade
        layout={layout}
        cols={COLUNAS}
        rowHeight={ALTURA_DA_LINHA}
        maxRows={linhas}
        margin={[12, 12]}
        isDraggable={editavel}
        isResizable={editavel}
        draggableHandle=".alca-do-bloco"
        compactType={livre ? null : "vertical"}
        onLayoutChange={aoMudarLeiaute}
        onResize={aoRedimensionar}
        onDragStart={comecar}
        onDragStop={terminar}
        onResizeStart={comecar}
        onResizeStop={terminar}
      >
        {blocos.map((b) => {
          // O Texto Livre e o Sumário (20/10/2026) e a Imagem Livre (21/10/2026) são da composição do slide: na apresentação,
          // sem o destaque do fundo e sem ampliar.
          const amplia = ampliavel && b.tipo !== "TEXTO" && b.tipo !== "SUMARIO" && !(b.tipo === "FOTO" && b.livre);
          return (
          // Sob o mouse, o bloco fica por cima dos vizinhos (a dica do gráfico e o destaque da apresentação passam por cima deles).
          <div key={b.id} className="group relative focus-within:z-10 hover:z-10">
            {editavel ? (
              <BarraDoBloco
                b={b}
                campo={() => campos.current.get(b.id) ?? null}
                onMudar={(m) => mudarBloco(b.id, m)}
                onConfigurar={() => setConfigurando(b.id)}
                onExcluir={() => onMudar(blocos.filter((x) => x.id !== b.id))}
              />
            ) : null}
            {/* Na apresentação, sob o mouse, o bloco cresce 10% com uma sombra fraca, sem sair da tela; o clique o amplia. */}
            <div
              // O card do Painel sem recorte (16/10/2026): a dica do mês, ao passar o mouse no gráfico, sai dos limites do card.
              className={`h-full ${b.tipo === "PAINEL" ? "" : "overflow-hidden"} ${amplia ? "cursor-zoom-in rounded-sm transition duration-200 hover:bg-background hover:shadow-lg" : ""}`}
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
                onMudar={(m) => mudarBloco(b.id, m)}
              />
            </div>
          </div>
          );
        })}
      </Grade>
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
          inicial={doCard.ajustes}
          onFechar={() => setConfigurando(null)}
          onAplicar={(ajustes) => {
            mudarBloco(doCard.id, { ajustes } as Partial<Bloco>);
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
      {doCard?.tipo === "PAINEL" ? (
        <ConfigurarGraficoDialog
          b={doCard}
          tipo={tipo}
          cores={cores}
          onFechar={() => setConfigurando(null)}
          onAplicar={(opcoes, todos) => {
            // Neste card ou em todos os cards do Painel de Bordo da aba.
            // As cores próprias do card (de antes de 16/10/2026) saem: valem as da Acessibilidade.
            onMudar(blocos.map((x) => (x.tipo === "PAINEL" && (todos || x.id === doCard.id) ? { ...x, ...opcoes, cores: undefined } : x)));
            setConfigurando(null);
          }}
        />
      ) : null}
    </div>
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
 * O Configurar Gráfico de um card do Painel de Bordo (16/10/2026): as opções do Configurar Gráficos do Painel — os
 * Rótulos e o Tipo (as cores são as da Acessibilidade, 16/10/2026) —, aplicadas a este card ou a todos os cards do Painel
 * da aba.
 */
function ConfigurarGraficoDialog({
  b,
  tipo,
  cores,
  onAplicar,
  onFechar,
}: {
  b: Extract<Bloco, { tipo: "PAINEL" }>;
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
            {b.titulo} ({b.quadro}): as opções do Configurar Gráficos do Painel de Bordo.
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

/** Os botões do bloco na edição, no canto de cima: a alça de mover, as opções do tipo e excluir. */
function BarraDoBloco({
  b,
  campo,
  onMudar,
  onConfigurar,
  onExcluir,
}: {
  b: Bloco;
  campo: () => HTMLElement | null;
  onMudar: (m: Partial<Bloco>) => void;
  onConfigurar: () => void;
  onExcluir: () => void;
}) {
  const botao = "inline-flex size-6 items-center justify-center rounded-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900";
  return (
    // Aparece com o mouse sobre o bloco e enquanto se escreve nele (o foco no texto), logo acima do bloco (19/10/2026; antes,
    // por cima do canto dele, onde cobria a primeira linha do texto e atrapalhava a seleção). Sem a barra à vista, ela não
    // pega o mouse (o bloco de cima continua clicável).
    <div className="pointer-events-none absolute right-1 bottom-full z-10 flex items-center gap-0.5 rounded-sm border border-gray-200 bg-white p-0.5 opacity-0 shadow-sm transition-opacity group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
      <span className={`alca-do-bloco cursor-move ${botao}`} title="Mover (arraste)" aria-label="Mover">
        <GripVertical className="size-4" />
      </span>
      {b.tipo === "PAINEL" ? (
        <button type="button" className={`${botao} ${b.comGrafico ? "text-gray-900" : ""}`} title={b.comGrafico ? "Tirar o gráfico" : "Mostrar o gráfico"} aria-label={b.comGrafico ? "Tirar o gráfico" : "Mostrar o gráfico"} onClick={() => onMudar({ comGrafico: !b.comGrafico, w: b.comGrafico ? Math.max(5, Math.round(b.w * LARGURA_SEM_GRAFICO)) : Math.min(COLUNAS, Math.max(10, Math.round(b.w / LARGURA_SEM_GRAFICO))) } as Partial<Bloco>)}>
          <ChartColumn className="size-4" />
          {b.comGrafico ? null : <span className="absolute h-px w-4 rotate-45 bg-current" />}
        </button>
      ) : null}
      {/* As opções do gráfico (16/10/2026), nos cards com o gráfico. */}
      {b.tipo === "PAINEL" && b.comGrafico ? (
        <button type="button" className={botao} title="Configurar o gráfico" aria-label="Configurar o gráfico" onClick={onConfigurar}>
          <Settings className="size-4" />
        </button>
      ) : null}
      {/* Os ajustes da imagem (21/10/2026): brilho, matiz, saturação, desfoque e transparência. */}
      {b.tipo === "FOTO" && b.arquivo ? (
        <button type="button" className={`${botao} ${b.ajustes ? "text-gray-900" : ""}`} title="Ajustes da imagem" aria-label="Ajustes da imagem" onClick={onConfigurar}>
          <SlidersHorizontal className="size-4" />
        </button>
      ) : null}
      {b.tipo === "SUMARIO" ? (
        <button type="button" className={botao} title="Configurar o sumário" aria-label="Configurar o sumário" onClick={onConfigurar}>
          <Settings className="size-4" />
        </button>
      ) : null}
      {/* A formatação do Sumário (20/10/2026): a do texto, sem os marcadores, por nível (as telas ou os slides). */}
      {b.tipo === "SUMARIO" ? (
        <>
          <span className="mx-0.5 h-4 w-px bg-gray-200" />
          <BarraDoSumario b={b} botao={botao} onMudar={(m) => onMudar(m as Partial<Bloco>)} />
          <span className="mx-0.5 h-4 w-px bg-gray-200" />
        </>
      ) : null}
      {b.tipo === "ANOTACAO"
        ? (Object.keys(NOTAS) as Nota[]).map((n) => {
            const { Icone, rotulo } = NOTAS[n];
            return (
              <button key={n} type="button" className={`${botao} ${b.nota === n ? "bg-gray-200 text-gray-900" : ""}`} title={rotulo} aria-label={rotulo} aria-pressed={b.nota === n} onClick={() => onMudar({ nota: n } as Partial<Bloco>)}>
                <Icone className="size-4" />
              </button>
            );
          })
        : null}
      {/* A formatação do texto (17/10/2026), nas anotações, no Texto Livre e nas legendas das fotos e dos vídeos. */}
      {b.tipo === "ANOTACAO" || b.tipo === "TEXTO" || (b.tipo === "FOTO" && !b.livre) || b.tipo === "VIDEO" ? (
        <>
          <span className="mx-0.5 h-4 w-px bg-gray-200" />
          <BarraDeTexto
            campo={campo}
            botao={botao}
            // A fonte e o espaçamento entre as linhas (20/10/2026), nas anotações e no Texto Livre.
            fontes={b.tipo === "ANOTACAO" || b.tipo === "TEXTO"}
            espacamento={b.tipo === "ANOTACAO" || b.tipo === "TEXTO" ? { valor: b.espacamento, definir: (espacamento) => onMudar({ espacamento } as Partial<Bloco>) } : undefined}
            titulo={
              b.tipo === "ANOTACAO"
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
          <span className="mx-0.5 h-4 w-px bg-gray-200" />
        </>
      ) : null}
      <button type="button" className={`${botao} hover:text-red-700`} title="Excluir o bloco" aria-label="Excluir o bloco" onClick={onExcluir}>
        <X className="size-4" />
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
  onMudar,
}: {
  relatorioId: string;
  b: Bloco;
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
          {/* O texto formatado (17/10/2026; antes, só texto): a formatação na barra do bloco. */}
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
      // eslint-disable-next-line @next/next/no-img-element -- a imagem vem do servidor, pelo proxy, com o login.
      <img src={enderecoDaFoto(relatorioId, b.arquivo)} alt="Imagem" draggable={false} className="h-full w-full object-contain" style={estiloDosAjustes(b.ajustes)} />
    );
  }
  if (b.tipo === "FOTO") {
    // A foto inteira (na proporção dela) e, embaixo, a legenda no destaque das Listas (16/10/2026).
    return (
      <figure className="flex h-full flex-col gap-2">
        <div className="min-h-0 flex-1">
          {b.arquivo ? (
            // eslint-disable-next-line @next/next/no-img-element -- a foto vem do servidor, pelo proxy, com o login.
            <img src={enderecoDaFoto(relatorioId, b.arquivo)} alt={b.legenda || "Imagem"} draggable={false} className="h-full w-full object-contain" style={estiloDosAjustes(b.ajustes)} />
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
        {/* A legenda formatada (17/10/2026; antes, só texto): a formatação na barra do bloco. A Imagem Livre não a tem. */}
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
          <PlayerDoVideo
            relatorioId={relatorioId}
            b={b}
            modo={ampliado ? "ampliado" : editavel ? "edicao" : apresentacao ? "apresentacao" : "leitura"}
            inicio={video?.tempo}
            tocar={video?.tocando}
            onEscolher={editavel ? onEscolherVideo : undefined}
          />
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
  if (!dados) return <div className="h-full animate-pulse rounded-sm bg-gray-100" />;
  if (b.tipo === "PAINEL") {
    const item = dados.painel.abas.find((a) => a.chave === b.aba)?.quadros.find((q) => q.titulo === b.quadro)?.itens.find((i) => i.titulo === b.titulo && i.sigla === b.sigla);
    if (!item) return indisponivel(`O card ${b.titulo} (${b.quadro}) não está mais no Painel de Bordo.`);
    const card = <CardDoPainel i={item} rotuloMes={dados.painel.rotuloMes} tipo={b.tipoGrafico ?? tipo} cores={cores} comGrafico={b.comGrafico && !semGrafico} comRotulos={b.comRotulos ?? false} />;
    if (soCard) return <div className="h-full">{card}</div>;
    return (
      <div className="flex h-full flex-col">
        <p className="truncate pb-1 text-xs font-bold tracking-wide text-gray-500 uppercase">{b.quadro}</p>
        <div className="min-h-0 flex-1">{card}</div>
      </div>
    );
  }
  const i = dados.indicadores.indicadores.find((x) => x.nome === b.nome);
  if (!i) return indisponivel(`O indicador ${b.nome} não está mais no cadastro Indicadores (Cadastros da Controladoria / Analítico).`);
  const ate = dados.indicadores.ate;
  const campo = (rotulo: string, v: number | null, destaque = false) => (
    <div className="flex items-baseline gap-1.5">
      <span className={destaque ? "text-2xl font-extrabold text-gray-900" : "text-base font-bold text-gray-800"}>{valor(i, v)}</span>
      <span className="text-xs text-gray-600">{rotulo}</span>
    </div>
  );
  // O card de destaque, como os totais das Listas: o destaque amarelo-ouro à esquerda, o valor do mês em evidência.
  return (
    <article className="flex h-full flex-col justify-between gap-2 rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white px-4 py-3">
      <header>
        <h3 className="text-sm leading-snug font-bold text-gray-900" title={i.metodologia}>
          {i.numero ? <span className="mr-1 font-normal text-gray-400">{i.numero}</span> : null}
          {i.nome}
        </h3>
        <p className="text-xs text-gray-500">
          {i.grupo} · {i.unidade} {i.sentido}
        </p>
      </header>
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        {campo(dados.painel.rotuloMes, i.meses[ate - 1] ?? null, true)}
        {campo(i.acumulado === "ACUM" ? "Acumulado" : "Atual", i.total)}
        {campo("Orçado", i.orcado[ate - 1] ?? null)}
      </div>
    </article>
  );
}
