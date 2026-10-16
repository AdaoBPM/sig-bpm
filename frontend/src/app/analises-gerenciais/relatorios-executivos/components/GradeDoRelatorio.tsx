"use client";

import { useRef, useState } from "react";
import GridLayout, { WidthProvider, type Layout } from "react-grid-layout";
import { ChartColumn, CircleAlert, GripVertical, Settings, ThumbsDown, ThumbsUp, X } from "lucide-react";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { CardDoPainel, SeletorCores, type Cores } from "@/app/relatorios/painel/PainelContent";
import { SeletorRotulos, SeletorTipoGrafico } from "@/app/relatorios/components/GraficoRealizadoOrcado";
import { botaoPrimario, OpcaoEmLinha } from "@/app/cenarios/components/CenarioDialog";
import { valor } from "@/app/relatorios/indicadores/TabelaIndicadores";
import type { TipoGrafico } from "@/app/relatorios/components/GraficoRealizadoOrcado";

import { enderecoDaFoto, type Bloco, type DadosDoRelatorio, type Nota } from "../services/relatoriosExecutivosService";

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
  return { w: 6, h: 6 };
}

/** O tamanho mínimo de cada tipo de bloco (16/10/2026), para as informações não se amontoarem. */
function tamanhoMinimo(b: Bloco) {
  if (b.tipo === "PAINEL") return b.comGrafico ? { minW: 10, minH: 6 } : { minW: 5, minH: 6 };
  if (b.tipo === "INDICADOR") return { minW: 3, minH: 4 };
  if (b.tipo === "FOTO") return { minW: 2, minH: 2 };
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

/** O card do Painel sem o gráfico fica com 2/5 da largura (as duas colunas dos valores, do mesmo tamanho); com ele, 5/2. */
const LARGURA_SEM_GRAFICO = 2 / 5;

/** A altura da legenda da foto (o destaque e o espaço acima dele), em px. */
const ALTURA_DA_LEGENDA = 44;

/**
 * As linhas de uma foto com `w` colunas na grade de `largura` px (16/10/2026): a altura da foto na proporção dela, mais a
 * legenda — a foto aumenta e diminui sempre na mesma proporção.
 */
export function linhasDaFoto(w: number, proporcao: number, largura: number) {
  const coluna = (largura - MARGEM * (COLUNAS - 1) - MARGEM * 2) / COLUNAS;
  const alto = (coluna * w + MARGEM * (w - 1)) / proporcao + ALTURA_DA_LEGENDA;
  return Math.max(2, Math.round((alto + MARGEM) / (ALTURA_DA_LINHA + MARGEM)));
}

/**
 * As notas das anotações (15/10/2026): o ícone e as cores, no padrão do Painel de Bordo — positivo em verde (azul nas
 * cores Acessíveis), negativo em vermelho e atenção em amarelo. O rótulo é o título da anotação até alguém o mudar.
 */
export const NOTAS: Record<Nota, { rotulo: string; Icone: typeof ThumbsUp; classe: (cores: Cores) => string; icone: (cores: Cores) => string }> = {
  POSITIVO: {
    rotulo: "Positivo",
    Icone: ThumbsUp,
    classe: (c) => (c === "daltonismo" ? "border-l-blue-600" : "border-l-green-600"),
    icone: (c) => (c === "daltonismo" ? "text-blue-700" : "text-green-700"),
  },
  NEGATIVO: { rotulo: "Negativo", Icone: ThumbsDown, classe: () => "border-l-red-600", icone: () => "text-red-700" },
  ATENCAO: { rotulo: "Atenção", Icone: CircleAlert, classe: () => "border-l-yellow-500", icone: () => "text-yellow-700" },
};

/**
 * A grade do relatório (15/10/2026): os blocos de uma aba — os cards do Painel de Bordo (com ou sem o gráfico), os
 * cards dos Indicadores (o destaque, como nas Listas), as anotações e as fotos. Na edição, cada bloco se move pela alça,
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
  onMudar,
}: {
  relatorioId: string;
  blocos: Bloco[];
  dados: DadosDoRelatorio | undefined;
  editavel: boolean;
  cores: Cores;
  tipo: TipoGrafico;
  onMudar: (blocos: Bloco[]) => void;
}) {
  const [configurando, setConfigurando] = useState<string | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  // A largura da grade enquanto um bloco se move ou se redimensiona (para a grade de fundo); fora disso, null.
  const [ajustando, setAjustando] = useState<number | null>(null);
  const comecar = () => setAjustando(caixa.current?.offsetWidth ?? null);
  const terminar = () => setAjustando(null);
  const layout: Layout[] = blocos.map((b) => ({ i: b.id, x: b.x, y: b.y, w: b.w, h: b.h, ...tamanhoMinimo(b) }));
  // A foto se redimensiona pela largura: a altura acompanha, na proporção dela.
  const aoRedimensionar = (_l: Layout[], _antes: Layout, novo: Layout, sombra: Layout) => {
    const b = blocos.find((x) => x.id === novo.i);
    if (b?.tipo !== "FOTO" || !caixa.current) return;
    novo.h = sombra.h = linhasDaFoto(novo.w, b.proporcao, caixa.current.offsetWidth);
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
  return (
    // Ao ajustar, a área cresce até boa parte da tela, para a grade de fundo ir além dos blocos; a sombra do bloco, em cinza.
    <div ref={caixa} className={`relative -mx-3 [&_.react-grid-placeholder]:!bg-gray-400 ${ajustando ? "min-h-[70vh]" : ""}`}>
      {ajustando ? <GradeDeFundo largura={ajustando} /> : null}
      <Grade
        layout={layout}
        cols={COLUNAS}
        rowHeight={ALTURA_DA_LINHA}
        margin={[12, 12]}
        isDraggable={editavel}
        isResizable={editavel}
        draggableHandle=".alca-do-bloco"
        compactType="vertical"
        onLayoutChange={aoMudarLeiaute}
        onResize={aoRedimensionar}
        onDragStart={comecar}
        onDragStop={terminar}
        onResizeStart={comecar}
        onResizeStop={terminar}
      >
        {blocos.map((b) => (
          <div key={b.id} className="group relative">
            {editavel ? (
              <BarraDoBloco b={b} onMudar={(m) => mudarBloco(b.id, m)} onConfigurar={() => setConfigurando(b.id)} onExcluir={() => onMudar(blocos.filter((x) => x.id !== b.id))} />
            ) : null}
            <div className="h-full overflow-hidden">
              <ConteudoDoBloco relatorioId={relatorioId} b={b} dados={dados} editavel={editavel} cores={cores} tipo={tipo} onMudar={(m) => mudarBloco(b.id, m)} />
            </div>
          </div>
        ))}
      </Grade>
      {doCard?.tipo === "PAINEL" ? (
        <ConfigurarGraficoDialog
          b={doCard}
          tipo={tipo}
          cores={cores}
          onFechar={() => setConfigurando(null)}
          onAplicar={(opcoes, todos) => {
            // Neste card ou em todos os cards do Painel de Bordo da aba.
            onMudar(blocos.map((x) => (x.tipo === "PAINEL" && (todos || x.id === doCard.id) ? { ...x, ...opcoes } : x)));
            setConfigurando(null);
          }}
        />
      ) : null}
    </div>
  );
}

type OpcoesDoGrafico = { tipoGrafico: TipoGrafico; comRotulos: boolean; cores: Cores };

/**
 * O Configurar Gráfico de um card do Painel de Bordo (16/10/2026): as opções do Configurar Gráficos do Painel — os
 * Rótulos, o Tipo e as Cores —, aplicadas a este card ou a todos os cards do Painel da aba.
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
  const [o, setO] = useState<OpcoesDoGrafico>({ tipoGrafico: b.tipoGrafico ?? tipo, comRotulos: b.comRotulos ?? false, cores: b.cores ?? cores });
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
          <SeletorCores cores={o.cores} onMudar={(c) => setO((x) => ({ ...x, cores: c }))} />
        </div>
        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-sm leading-none font-medium">Aplicar</legend>
          <OpcaoEmLinha nome="aplicar-grafico" marcada={!todos} onMarcar={() => setTodos(false)} rotulo="Neste Card" detalhe="Só o card escolhido." />
          <OpcaoEmLinha nome="aplicar-grafico" marcada={todos} onMarcar={() => setTodos(true)} rotulo="Em Toda a Aba" detalhe="Todos os cards do Painel de Bordo desta aba." />
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
function BarraDoBloco({ b, onMudar, onConfigurar, onExcluir }: { b: Bloco; onMudar: (m: Partial<Bloco>) => void; onConfigurar: () => void; onExcluir: () => void }) {
  const botao = "inline-flex size-6 items-center justify-center rounded-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900";
  return (
    <div className="absolute top-1 right-1 z-10 flex items-center gap-0.5 rounded-sm border border-gray-200 bg-white/95 p-0.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-within:opacity-100">
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
  onMudar,
}: {
  relatorioId: string;
  b: Bloco;
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
        <header className={`flex h-5 shrink-0 items-center gap-1.5 pb-1 text-xs font-bold tracking-wide uppercase ${n.icone(cores)}`}>
          <n.Icone className="size-3.5 shrink-0" />
          {editavel ? (
            <input
              value={b.titulo ?? n.rotulo}
              onChange={(e) => onMudar({ titulo: e.target.value } as Partial<Bloco>)}
              placeholder={n.rotulo}
              maxLength={120}
              aria-label="Título da anotação"
              className="h-4 min-w-0 flex-1 rounded-sm bg-transparent font-bold tracking-wide uppercase outline-none placeholder:text-current placeholder:opacity-60 hover:bg-gray-100 focus:bg-gray-100"
            />
          ) : (
            <span className="min-w-0 truncate">{titulo}</span>
          )}
        </header>
        <article className={`flex min-h-0 flex-1 rounded-sm border border-l-4 border-gray-200 bg-white ${n.classe(cores)}`}>
          {editavel ? (
            <textarea
              value={b.texto}
              onChange={(e) => onMudar({ texto: e.target.value } as Partial<Bloco>)}
              placeholder="Escreva a anotação…"
              aria-label={`Anotação (${titulo})`}
              className="min-h-0 w-full flex-1 resize-none bg-transparent px-4 py-2 text-sm text-gray-900 outline-none"
            />
          ) : (
            <p className="min-h-0 flex-1 overflow-auto px-4 py-2 text-sm whitespace-pre-wrap text-gray-900">{b.texto}</p>
          )}
        </article>
      </div>
    );
  }
  if (b.tipo === "FOTO") {
    // A foto inteira (na proporção dela) e, embaixo, a legenda no destaque das Listas (16/10/2026).
    return (
      <figure className="flex h-full flex-col gap-2">
        <div className="min-h-0 flex-1">
          {/* eslint-disable-next-line @next/next/no-img-element -- a foto vem do servidor, pelo proxy, com o login. */}
          <img src={enderecoDaFoto(relatorioId, b.arquivo)} alt={b.legenda || "Foto"} draggable={false} className="h-full w-full object-contain" />
        </div>
        {editavel ? (
          <input
            value={b.legenda}
            onChange={(e) => onMudar({ legenda: e.target.value } as Partial<Bloco>)}
            placeholder="Escreva a legenda…"
            maxLength={500}
            aria-label="Legenda da foto"
            className="h-9 shrink-0 rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:border-gray-300 focus:border-l-bpm-primary"
          />
        ) : b.legenda ? (
          <figcaption className="shrink-0 truncate rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white px-3 py-1.5 text-sm font-semibold text-gray-900" title={b.legenda}>
            {b.legenda}
          </figcaption>
        ) : null}
      </figure>
    );
  }
  if (!dados) return <div className="h-full animate-pulse rounded-sm bg-gray-100" />;
  if (b.tipo === "PAINEL") {
    const item = dados.painel.abas.find((a) => a.chave === b.aba)?.quadros.find((q) => q.titulo === b.quadro)?.itens.find((i) => i.titulo === b.titulo && i.sigla === b.sigla);
    if (!item) return indisponivel(`O card ${b.titulo} (${b.quadro}) não está mais no Painel de Bordo.`);
    return (
      <div className="flex h-full flex-col">
        <p className="truncate pb-1 text-xs font-bold tracking-wide text-gray-500 uppercase">{b.quadro}</p>
        <div className="min-h-0 flex-1">
          <CardDoPainel i={item} rotuloMes={dados.painel.rotuloMes} tipo={b.tipoGrafico ?? tipo} cores={b.cores ?? cores} comGrafico={b.comGrafico} comRotulos={b.comRotulos ?? false} />
        </div>
      </div>
    );
  }
  const i = dados.indicadores.indicadores.find((x) => x.nome === b.nome);
  if (!i) return indisponivel(`O indicador ${b.nome} não está mais na Estrutura dos Indicadores.`);
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
