"use client";

import { useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { botaoPrimario } from "@/app/cenarios/components/CenarioDialog";

import { enderecoDaFoto, type Bloco, type RecorteDaImagem } from "../services/relatoriosExecutivosService";
import { estiloDosAjustes } from "./AjustesDaImagem";
import { CamadaDoFundo } from "./FundoDoSlide";

type Foto = Extract<Bloco, { tipo: "FOTO" }>;
type Modo = "PROPORCAO" | "PRONTO" | "ATUAL";
/** O tamanho escolhido: as colunas e as linhas do bloco e, fora da proporção da imagem, o corte. */
export type TamanhoDaImagem = { w: number; h: number; recorte?: RecorteDaImagem };

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
 * ¼, na largura e na altura) ou o tamanho atual — e, fora da proporção, o corte: a imagem cobre o quadro, e se arrasta
 * para posicionar e se aumenta pelo Tamanho (ou pela roda do mouse), como a Imagem de Fundo.
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
  onAplicar: (t: TamanhoDaImagem) => void;
  onFechar: () => void;
}) {
  const [modo, setModo] = useState<Modo>(bloco.recorte ? "ATUAL" : "PROPORCAO");
  const [largura, setLargura] = useState(Math.min(colunas, bloco.w));
  const [pronto, setPronto] = useState<[number, number]>([1 / 2, 1 / 2]);
  const [r, setR] = useState<RecorteDaImagem>(bloco.recorte ?? CENTRO);
  const tamanho =
    modo === "PROPORCAO"
      ? { w: largura, h: linhasNaProporcao(largura) }
      : modo === "PRONTO"
        ? { w: Math.max(1, Math.round(colunas * pronto[0])), h: Math.max(2, Math.floor(linhas * pronto[1])) }
        : { w: bloco.w, h: bloco.h };
  const q = quadro(tamanho.w, tamanho.h);
  const proporcaoDoQuadro = modo === "PROPORCAO" ? bloco.proporcao : q.largura / q.altura;
  // A miniatura do quadro: até 640 × 320 px, na proporção dele.
  const mini = proporcaoDoQuadro >= 2 ? { largura: 640, altura: 640 / proporcaoDoQuadro } : { largura: 320 * proporcaoDoQuadro, altura: 320 };
  const caixa = useRef<HTMLDivElement>(null);
  const arrasto = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const corta = modo !== "PROPORCAO";
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
            Escolha o tamanho do bloco: na proporção da imagem (a imagem inteira, sem cortar), num tamanho pronto (frações da tela) ou o tamanho atual. Fora da
            proporção, a imagem cobre o quadro: arraste-a para posicionar e use o Tamanho (ou a roda do mouse sobre ela) para aumentá-la.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {opcao("PROPORCAO", "Na Proporção da Imagem", "A imagem inteira, sem cortar: escolha a largura; a altura acompanha a proporção dela")}
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
          {tamanho.h > linhas ? `: passa da altura da página (${linhas} linhas)` : ""}.
        </p>
        <div className="flex justify-center rounded-sm bg-gray-100 p-3">
          <div
            ref={caixa}
            className={`relative overflow-hidden rounded-sm border border-gray-300 bg-white ${corta ? "cursor-grab touch-none select-none active:cursor-grabbing" : ""}`}
            style={{ width: mini.largura, height: mini.altura, maxWidth: "100%" }}
            onPointerDown={
              corta
                ? (e) => {
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    arrasto.current = { px: e.clientX, py: e.clientY, x: r.x, y: r.y };
                  }
                : undefined
            }
            onPointerMove={
              corta
                ? (e) => {
                    const a = arrasto.current;
                    if (!a) return;
                    const s = sobras();
                    mudar({ x: s.x > 0 ? entre(a.x - (e.clientX - a.px) / s.x, 0, 1) : a.x, y: s.y > 0 ? entre(a.y - (e.clientY - a.py) / s.y, 0, 1) : a.y });
                  }
                : undefined
            }
            onPointerUp={() => (arrasto.current = null)}
            onPointerCancel={() => (arrasto.current = null)}
            onWheel={corta ? (e) => mudar({ zoom: entre(r.zoom - e.deltaY * 0.001, 1, ZOOM_MAXIMO) }) : undefined}
          >
            {corta ? (
              <CamadaDoFundo relatorioId={relatorioId} fundo={{ arquivo: bloco.arquivo, proporcao: bloco.proporcao, ...r, ajustes: bloco.ajustes }} className="absolute inset-0" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- a imagem vem do servidor, pelo proxy, com o login.
              <img src={enderecoDaFoto(relatorioId, bloco.arquivo)} alt="" draggable={false} className="size-full object-contain" style={estiloDosAjustes(bloco.ajustes)} />
            )}
          </div>
        </div>
        {corta ? (
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
            <Button type="button" variant="outline" className="rounded-sm" onClick={() => setR(CENTRO)} title="A imagem centralizada, no tamanho que cobre o quadro">
              <RotateCcw className="size-4" />
              Restaurar
            </Button>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" className={botaoPrimario} onClick={() => onAplicar(corta ? { ...tamanho, recorte: r } : tamanho)}>
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
