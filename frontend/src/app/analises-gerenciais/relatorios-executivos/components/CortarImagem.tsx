"use client";

import { Fragment, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { plural } from "@/lib/texto";

import { botaoPrimario } from "@/app/cenarios/components/CenarioDialog";

import type { AjustesDeImagem, Bloco, RecorteDaImagem } from "../services/relatoriosExecutivosService";
import { ajustesNoPadrao, ajustesRestaurados, BarraComValor, BotaoRestaurarAjustes, ControlesDosAjustes } from "./AjustesDaImagem";
import { CamadaDoFundo } from "./FundoDoSlide";

type Foto = Extract<Bloco, { tipo: "FOTO" }>;
type Modo = "PROPORCAO" | "PRONTO" | "ATUAL";
/** O que o modal aplica: as colunas e as linhas do bloco, o corte (sem ele, a imagem inteira, na proporção) e os ajustes. */
export type CorteDaImagem = { w: number; h: number; recorte?: RecorteDaImagem; ajustes?: AjustesDeImagem };

/** As frações da tela dos tamanhos prontos (27/10/2026): de inteira a ¼, na largura e na altura. */
const FRACOES: Array<[number, string]> = [
  [1, "Inteira"],
  [3 / 4, "3/4"],
  [2 / 3, "2/3"],
  [1 / 2, "1/2"],
  [1 / 3, "1/3"],
  [1 / 4, "1/4"],
];
const ZOOM_MAXIMO = 4;
const entre = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const CENTRO: RecorteDaImagem = { zoom: 1, x: 0.5, y: 0.5 };
const colunasELinhas = (w: number, h: number) => `${w} ${plural(w, "coluna", "colunas")} × ${h} ${plural(h, "linha", "linhas")}`;

/** A fração do tamanho pronto por extenso (a dica): "1/2 da largura × 1/3 da altura". */
const porExtenso = (i: number, j: number) =>
  `${FRACOES[i][0] === 1 ? "Largura inteira" : `${FRACOES[i][1]} da largura`} × ${FRACOES[j][0] === 1 ? "altura inteira" : `${FRACOES[j][1]} da altura`}`;

/**
 * O tamanho pronto: o desenho do slide (16:9) com a parte que o bloco ocupa e a fração da largura × a da altura ("1/2 ×
 * 1/3"); na lista (`comColunas`), também as colunas e as linhas, em cinza.
 */
function TamanhoPronto({ i, j, colunas, linhas, comColunas = false }: { i: number; j: number; colunas: number; linhas: number; comColunas?: boolean }) {
  const [fw, rw] = FRACOES[i];
  const [fh, rh] = FRACOES[j];
  const { w, h } = doPronto(fw, fh, colunas, linhas);
  return (
    <span className="flex items-center gap-2" title={porExtenso(i, j)}>
      <span aria-hidden className="relative inline-block h-[18px] w-8 shrink-0 rounded-[2px] border border-gray-400 bg-white">
        <span className="absolute top-px left-px rounded-[1px] bg-gray-700" style={{ width: `calc((100% - 2px) * ${fw})`, height: `calc((100% - 2px) * ${fh})` }} />
      </span>
      {rw} × {rh}
      {comColunas ? <span className="text-gray-500">({colunasELinhas(w, h)})</span> : null}
    </span>
  );
}

/** As colunas e as linhas de um tamanho pronto: a fração da largura em colunas e a da altura em linhas (ao menos 2). */
function doPronto(fw: number, fh: number, colunas: number, linhas: number) {
  return { w: Math.max(1, Math.round(colunas * fw)), h: Math.max(2, Math.floor(linhas * fh)) };
}

/**
 * O modal Cortar e Posicionar (27/10/2026, pedido do Adão), nas imagens com legenda e nas livres: o tamanho do bloco — na
 * proporção da imagem (a largura em colunas; as linhas acompanham), num tamanho pronto (a lista das frações da tela, de
 * inteira a ¼, na largura e na altura, cada uma com o desenho dela no slide) ou o tamanho atual —, o corte e os ajustes.
 * Como na Imagem de Fundo, a imagem cobre o quadro em qualquer tamanho: arraste-a para posicionar e aumente-a pelo Tamanho
 * (ou pela roda do mouse); embaixo, o brilho, a matiz, a saturação, o desfoque e a transparência, com os valores também
 * digitados. O Restaurar Ajustes, no rodapé, volta a imagem ao centro, a 100% e sem os ajustes. Na proporção da imagem e
 * sem aumentar, ela fica inteira (sem corte).
 */
export function CortarImagemDialog({
  relatorioId,
  bloco,
  colunas,
  linhas,
  linhasNaProporcao,
  quadro,
  onAplicar,
  onFechar,
}: {
  relatorioId: string;
  bloco: Foto;
  /** As colunas e as linhas da página. */
  colunas: number;
  linhas: number;
  /** As linhas da imagem na proporção dela, com `w` colunas. */
  linhasNaProporcao: (w: number) => number;
  /** As medidas (px) do quadro da imagem num bloco de `w` × `h`. */
  quadro: (w: number, h: number) => { largura: number; altura: number };
  onAplicar: (t: CorteDaImagem) => void;
  onFechar: () => void;
}) {
  const [modo, setModo] = useState<Modo>(bloco.recorte ? "ATUAL" : "PROPORCAO");
  // De início, a largura de agora (ou a maior abaixo dela que cabe na altura da página).
  const [largura, setLargura] = useState(() => {
    let w = Math.min(colunas, bloco.w);
    while (w > 1 && linhasNaProporcao(w) > linhas) w--;
    return w;
  });
  // O tamanho pronto: os índices da fração da largura e da altura (de início, 1/2 × 1/2).
  const [pronto, setPronto] = useState<[number, number]>([3, 3]);
  const [r, setR] = useState<RecorteDaImagem>(bloco.recorte ?? CENTRO);
  const [ajustes, setAjustes] = useState(bloco.ajustes);
  const tamanho =
    modo === "PROPORCAO"
      ? { w: largura, h: linhasNaProporcao(largura) }
      : modo === "PRONTO"
        ? doPronto(FRACOES[pronto[0]][0], FRACOES[pronto[1]][0], colunas, linhas)
        : { w: bloco.w, h: bloco.h };
  const q = quadro(tamanho.w, tamanho.h);
  const proporcaoDoQuadro = modo === "PROPORCAO" ? bloco.proporcao : q.largura / q.altura;
  // A miniatura do quadro: até 560 × 280 px, na proporção dele.
  const mini = proporcaoDoQuadro >= 2 ? { largura: 560, altura: 560 / proporcaoDoQuadro } : { largura: 280 * proporcaoDoQuadro, altura: 280 };
  const caixa = useRef<HTMLDivElement>(null);
  const arrasto = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  // Na proporção da imagem, sem aumentar, ela fica inteira; aumentada, ou nos outros tamanhos, é cortada no quadro.
  const corta = modo !== "PROPORCAO" || r.zoom > 1;
  // O quanto a imagem passa do quadro (px), na largura e na altura: o arrasto de tudo isso a leva de uma ponta à outra.
  const sobras = () => {
    const el = caixa.current;
    if (!el) return { x: 0, y: 0 };
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    return { x: Math.max(cw, ch * bloco.proporcao) * r.zoom - cw, y: Math.max(ch, cw / bloco.proporcao) * r.zoom - ch };
  };
  const mudar = (m: Partial<RecorteDaImagem>) => setR((x) => ({ ...x, ...m }));
  const opcao = (m: Modo, rotulo: string, dica: string, nota?: string) => (
    <label className="flex items-center gap-2 text-sm" title={dica}>
      <input type="radio" name="tamanho-da-imagem" className="accent-black" checked={modo === m} onChange={() => setModo(m)} />
      {rotulo}
      {nota ? <span className="text-gray-500">({nota})</span> : null}
    </label>
  );
  // A lista do tamanho, até a metade do modal (o rótulo na largura dos das barras, embaixo).
  const lista = (id: string, rotulo: string, controle: ReactNode, nota?: string) => (
    <div className="grid items-center gap-y-1 sm:grid-cols-2">
      <div className="flex min-w-0 items-center gap-3">
        <label htmlFor={id} className="w-28 shrink-0 text-sm font-medium">
          {rotulo}
        </label>
        {controle}
      </div>
      {nota ? <span className="text-xs text-gray-500 sm:pl-3">{nota}</span> : null}
    </div>
  );
  return (
    <Dialog open onOpenChange={(a) => (!a ? onFechar() : undefined)}>
      <DialogContent avisoAoSair className="max-h-[92vh] overflow-y-auto rounded-sm sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Cortar e Posicionar a Imagem</DialogTitle>
          <DialogDescription>
            Escolha o tamanho do bloco: na proporção da imagem, num tamanho pronto (frações do slide) ou o tamanho atual. A imagem cobre o quadro: arraste-a
            para posicionar e use o Tamanho (ou a roda do mouse sobre ela) para aumentá-la; embaixo, o brilho, a matiz, a saturação, o desfoque e a
            transparência (os valores também se digitam). “Restaurar Ajustes” volta a imagem ao centro, a 100% e sem os ajustes.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {opcao("PROPORCAO", "Na Proporção da Imagem", "A largura em colunas; a altura acompanha a proporção da imagem, que fica inteira (aumentada, é cortada no quadro)")}
          {opcao("PRONTO", "Tamanho Pronto", "Uma fração da largura e da altura do slide; a imagem é cortada para cobrir o quadro")}
          {opcao("ATUAL", "Tamanho Atual", "O tamanho do bloco de agora; a imagem é cortada para cobrir o quadro", modo === "ATUAL" ? colunasELinhas(bloco.w, bloco.h) : undefined)}
        </div>
        {modo === "PROPORCAO"
          ? lista(
              "imagem-largura",
              "Largura",
              <Select value={String(largura)} onValueChange={(v) => (v ? setLargura(Number(v)) : undefined)}>
                <SelectTrigger id="imagem-largura" className="w-full min-w-0 rounded-sm">
                  <SelectValue>{(v: string | null) => (v ? colunasELinhas(Number(v), linhasNaProporcao(Number(v))) : "")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: colunas }, (_, k) => k + 1).map((w) => (
                    <SelectItem key={w} value={String(w)} disabled={linhasNaProporcao(w) > linhas}>
                      {colunasELinhas(w, linhasNaProporcao(w))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>,
              `A grade tem ${colunas} colunas e ${linhas} linhas.`,
            )
          : null}
        {modo === "PRONTO"
          ? lista(
              "imagem-pronto",
              "Fração do Slide",
              <Select
                value={`${pronto[0]}-${pronto[1]}`}
                onValueChange={(v) => {
                  if (v) setPronto(v.split("-").map(Number) as [number, number]);
                }}
              >
                <SelectTrigger id="imagem-pronto" className="w-full min-w-0 rounded-sm">
                  <SelectValue>
                    {(v: string | null) => {
                      if (!v) return "";
                      const [i, j] = v.split("-").map(Number);
                      return <TamanhoPronto i={i} j={j} colunas={colunas} linhas={linhas} />;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="w-max! min-w-(--anchor-width)">
                  {/* Por largura, de inteira a 1/4; em cada uma, as alturas. */}
                  {FRACOES.map(([, rw], i) => (
                    <Fragment key={rw}>
                      {i > 0 ? <SelectSeparator /> : null}
                      {FRACOES.map(([, rh], j) => (
                        <SelectItem key={rh} value={`${i}-${j}`}>
                          <TamanhoPronto i={i} j={j} colunas={colunas} linhas={linhas} comColunas />
                        </SelectItem>
                      ))}
                    </Fragment>
                  ))}
                </SelectContent>
              </Select>,
            )
          : null}
        <div className="flex justify-center rounded-sm bg-gray-100 p-3">
          {/* O quadro do bloco, com a imagem como ficará: arrastar a posiciona, e a roda do mouse a aumenta. O xadrez mostra as
              imagens claras, as transparentes e a Transparência. */}
          <div
            ref={caixa}
            className="relative cursor-grab touch-none overflow-hidden rounded-sm border border-gray-300 bg-white bg-[repeating-conic-gradient(var(--color-gray-200)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] select-none active:cursor-grabbing"
            style={{ width: mini.largura, height: mini.altura, maxWidth: "100%" }}
            onPointerDown={(e) => {
              // Sem selecionar os textos do modal ao arrastar.
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              arrasto.current = { px: e.clientX, py: e.clientY, x: r.x, y: r.y };
            }}
            onPointerMove={(e) => {
              const a = arrasto.current;
              if (!a) return;
              // Até 2 px de sobra (a imagem do tamanho do quadro, com o arredondamento da miniatura): nada a arrastar nesse sentido.
              const s = sobras();
              mudar({ x: s.x > 2 ? entre(a.x - (e.clientX - a.px) / s.x, 0, 1) : a.x, y: s.y > 2 ? entre(a.y - (e.clientY - a.py) / s.y, 0, 1) : a.y });
            }}
            onPointerUp={() => (arrasto.current = null)}
            onPointerCancel={() => (arrasto.current = null)}
            onWheel={(e) => mudar({ zoom: entre(r.zoom - e.deltaY * 0.001, 1, ZOOM_MAXIMO) })}
          >
            <CamadaDoFundo relatorioId={relatorioId} fundo={{ arquivo: bloco.arquivo, proporcao: bloco.proporcao, ...r, ajustes }} className="absolute inset-0" />
          </div>
        </div>
        {/* O Tamanho (em %) e os ajustes, como na Imagem de Fundo; a borda e o sombreamento ficam nos Ajustes da Imagem. */}
        <div className="space-y-2">
          <BarraComValor id="imagem-tamanho" rotulo="Tamanho" min={100} max={ZOOM_MAXIMO * 100} valor={Math.round(r.zoom * 100)} unidade="%" onMudar={(v) => mudar({ zoom: v / 100 })} />
          <ControlesDosAjustes ajustes={ajustes} onMudar={setAjustes} />
        </div>
        <DialogFooter className="sm:justify-between">
          <BotaoRestaurarAjustes
            disabled={ajustesNoPadrao(ajustes) && r.zoom === 1 && r.x === 0.5 && r.y === 0.5}
            titulo="A imagem no centro do quadro, a 100% e sem os ajustes"
            onClick={() => {
              setR(CENTRO);
              setAjustes(ajustesRestaurados(ajustes));
            }}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="button" className={botaoPrimario} onClick={() => onAplicar({ ...tamanho, recorte: corta ? r : undefined, ajustes })}>
              Aplicar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
