"use client";

import { useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { botaoPrimario } from "@/app/cenarios/components/CenarioDialog";

import type { AjustesDeImagem, Bloco, RecorteDaImagem } from "../services/relatoriosExecutivosService";
import { ControlesDosAjustes } from "./AjustesDaImagem";
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

/**
 * O modal Cortar e Posicionar (27/10/2026, pedido do Adão), nas imagens com legenda e nas livres: o tamanho do bloco — na
 * proporção da imagem (a largura em colunas; as linhas acompanham), num tamanho pronto (as frações da tela, de inteira a
 * ¼, na largura e na altura) ou o tamanho atual —, o corte e os ajustes. Como na Imagem de Fundo, a imagem cobre o quadro
 * em qualquer tamanho: arraste-a para posicionar, aumente-a pelo Tamanho (ou pela roda do mouse), e o Restaurar a volta ao
 * centro, no tamanho original; embaixo, o brilho, a matiz, a saturação, o desfoque e a transparência. Na proporção da
 * imagem e sem aumentar, ela fica inteira (sem corte).
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
  const [largura, setLargura] = useState(Math.min(colunas, bloco.w));
  const [pronto, setPronto] = useState<[number, number]>([1 / 2, 1 / 2]);
  const [r, setR] = useState<RecorteDaImagem>(bloco.recorte ?? CENTRO);
  const [ajustes, setAjustes] = useState(bloco.ajustes);
  const tamanho =
    modo === "PROPORCAO"
      ? { w: largura, h: linhasNaProporcao(largura) }
      : modo === "PRONTO"
        ? { w: Math.max(1, Math.round(colunas * pronto[0])), h: Math.max(2, Math.floor(linhas * pronto[1])) }
        : { w: bloco.w, h: bloco.h };
  const q = quadro(tamanho.w, tamanho.h);
  const proporcaoDoQuadro = modo === "PROPORCAO" ? bloco.proporcao : q.largura / q.altura;
  // A miniatura do quadro: até 560 × 240 px, na proporção dele (o modal, com os ajustes, cabe numa tela de 1080 px).
  const mini = proporcaoDoQuadro >= 560 / 240 ? { largura: 560, altura: 560 / proporcaoDoQuadro } : { largura: 240 * proporcaoDoQuadro, altura: 240 };
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
  const opcao = (m: Modo, rotulo: string, dica: string) => (
    <label className="flex items-center gap-2 text-sm" title={dica}>
      <input type="radio" name="tamanho-da-imagem" className="accent-black" checked={modo === m} onChange={() => setModo(m)} />
      {rotulo}
    </label>
  );
  return (
    <Dialog open onOpenChange={(a) => (!a ? onFechar() : undefined)}>
      <DialogContent avisoAoSair className="max-h-[92vh] overflow-y-auto rounded-sm sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Cortar e Posicionar a Imagem</DialogTitle>
          <DialogDescription>
            Escolha o tamanho do bloco: na proporção da imagem, num tamanho pronto (frações da tela) ou o tamanho atual. A imagem cobre o quadro: arraste-a
            para posicionar; o Tamanho (ou a roda do mouse sobre ela) a aumenta, e o Restaurar a volta ao centro, no tamanho original. Embaixo, o brilho, a
            matiz, a saturação, o desfoque e a transparência.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {opcao("PROPORCAO", "Na Proporção da Imagem", "A largura em colunas; a altura acompanha a proporção da imagem, que fica inteira (aumentada, é cortada no quadro)")}
          {opcao("PRONTO", "Tamanho Pronto", "Uma fração da largura e da altura da tela; a imagem é cortada para cobrir o quadro")}
          {opcao("ATUAL", "Tamanho Atual", "O tamanho do bloco de agora; a imagem é cortada para cobrir o quadro")}
        </div>
        {modo === "PROPORCAO" ? (
          <div className="flex items-center gap-3">
            <label htmlFor="imagem-largura" className="shrink-0 text-sm font-medium">
              Largura
            </label>
            <select id="imagem-largura" value={largura} onChange={(e) => setLargura(Number(e.target.value))} className="h-8 rounded-sm border border-gray-300 bg-white px-2 text-sm">
              {Array.from({ length: colunas }, (_, k) => k + 1).map((w) => (
                <option key={w} value={w} disabled={linhasNaProporcao(w) > linhas}>
                  {w === 1 ? "1 coluna" : `${w} colunas`} × {linhasNaProporcao(w)} linhas
                </option>
              ))}
            </select>
            <span className="text-xs text-gray-500">A grade tem {colunas} colunas e {linhas} linhas.</span>
          </div>
        ) : null}
        {modo === "PRONTO" ? (
          // Os tamanhos prontos: a largura nas colunas e a altura nas linhas da tabela, cada um com o desenho dele na tela.
          <div className="overflow-x-auto">
            <table className="border-collapse text-xs">
              <thead>
                <tr>
                  <th className="px-1 py-1 text-left font-medium text-gray-500">Altura \ Largura</th>
                  {FRACOES.map(([, rotulo]) => (
                    <th key={rotulo} className="px-1 py-1 font-medium text-gray-700">
                      {rotulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FRACOES.map(([fh, rotuloH]) => (
                  <tr key={rotuloH}>
                    <th className="px-1 py-1 text-left font-medium text-gray-700">{rotuloH}</th>
                    {FRACOES.map(([fw, rotuloW]) => {
                      const marcado = pronto[0] === fw && pronto[1] === fh;
                      return (
                        <td key={rotuloW} className="p-0.5">
                          <button
                            type="button"
                            onClick={() => setPronto([fw, fh])}
                            title={`${rotuloW} da largura × ${rotuloH} da altura`}
                            aria-label={`${rotuloW} da largura por ${rotuloH} da altura`}
                            aria-pressed={marcado}
                            className={`relative block h-[27px] w-12 rounded-[2px] border ${marcado ? "border-black bg-gray-100" : "border-gray-300 bg-white hover:border-gray-500"}`}
                          >
                            <span className={`absolute top-0.5 left-0.5 rounded-[1px] ${marcado ? "bg-black" : "bg-gray-400"}`} style={{ width: `calc((100% - 4px) * ${fw})`, height: `calc((100% - 4px) * ${fh})` }} />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <p className="text-xs text-gray-500">
          O bloco fica com {tamanho.w === 1 ? "1 coluna" : `${tamanho.w} colunas`} × {tamanho.h} linhas
          {tamanho.h > linhas ? `: passa da altura da página (${linhas} linhas)` : ""}
          {corta ? "" : "; a imagem fica inteira, sem corte (aumente o Tamanho para cortá-la e arrastá-la no quadro)"}.
        </p>
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
        <div className="flex items-center gap-3">
          <label htmlFor="imagem-tamanho" className="shrink-0 text-sm font-medium">
            Tamanho
          </label>
          <input
            id="imagem-tamanho"
            type="range"
            min={1}
            max={ZOOM_MAXIMO}
            step={0.01}
            value={r.zoom}
            onChange={(e) => mudar({ zoom: Number(e.target.value) })}
            className="min-w-0 flex-1 accent-black"
          />
          <span className="w-12 shrink-0 text-right text-sm text-gray-600">{Math.round(r.zoom * 100)}%</span>
          <Button type="button" variant="outline" className="rounded-sm" onClick={() => setR(CENTRO)} title="A imagem no centro do quadro, no tamanho original (100%)">
            <RotateCcw className="size-4" />
            Restaurar
          </Button>
        </div>
        {/* Os ajustes, como na Imagem de Fundo; a borda e o sombreamento ficam nos Ajustes da Imagem. */}
        <ControlesDosAjustes ajustes={ajustes} onMudar={setAjustes} />
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" className={botaoPrimario} onClick={() => onAplicar({ ...tamanho, recorte: corta ? r : undefined, ajustes })}>
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
