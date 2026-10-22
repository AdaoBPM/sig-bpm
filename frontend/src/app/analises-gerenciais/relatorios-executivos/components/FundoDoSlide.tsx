"use client";

import { useRef, useState } from "react";
import { ImageUp, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { botaoPrimario } from "@/app/cenarios/components/CenarioDialog";

import { enderecoDaFoto, type Fundo } from "../services/relatoriosExecutivosService";
import { ControlesDosAjustes, estiloDosAjustes } from "./AjustesDaImagem";
import { enviarImagem } from "./enviarImagem";

/** O zoom da Imagem de Fundo: de 1 (o tamanho que cobre a tela) a 4. */
const ZOOM_MAXIMO = 4;
const entre = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * A Imagem de Fundo (20/10/2026): a foto cobrindo a caixa (object-fit: cover), aumentada pelo zoom a partir do ponto da
 * posição. Com a origem do aumento no mesmo ponto de `object-position`, x = 0 encosta a imagem à esquerda e x = 1 à
 * direita, com qualquer zoom; ela sempre cobre a caixa inteira.
 */
export function CamadaDoFundo({ relatorioId, fundo, className, style }: { relatorioId: string; fundo: Fundo; className?: string; style?: React.CSSProperties }) {
  const ponto = `${fundo.x * 100}% ${fundo.y * 100}%`;
  return (
    <div aria-hidden className={`pointer-events-none overflow-hidden ${className ?? ""}`} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a foto vem do servidor, pelo proxy, com o login. */}
      <img
        src={enderecoDaFoto(relatorioId, fundo.arquivo)}
        alt=""
        draggable={false}
        className="size-full max-w-none object-cover select-none"
        style={{ objectPosition: ponto, transform: `scale(${fundo.zoom})`, transformOrigin: ponto, ...estiloDosAjustes(fundo.ajustes) }}
      />
    </div>
  );
}

/** A tela inteira (a da apresentação): a proporção e a altura do cabeçalho do slide (24 px de margem e 40 px do título). */
function daTela() {
  const largura = typeof window === "undefined" ? 1920 : window.screen.width;
  const altura = typeof window === "undefined" ? 1080 : window.screen.height;
  return { proporcao: largura / altura, cabecalho: (24 + 40) / altura };
}

/**
 * O modal Imagem de Fundo (20/10/2026): a miniatura da tela inteira, com a imagem como ficará no slide. Arraste a imagem
 * para posicioná-la; o Tamanho (ou a roda do mouse sobre ela) a aumenta. A faixa tracejada do topo é o cabeçalho do
 * slide, que a imagem cobre.
 */
export function AjustarFundoDialog({ relatorioId, fundo, onAplicar, onFechar }: { relatorioId: string; fundo: Fundo; onAplicar: (f: Fundo) => void; onFechar: () => void }) {
  const [f, setF] = useState(fundo);
  const caixa = useRef<HTMLDivElement>(null);
  const arrasto = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const tela = daTela();
  // O quanto a imagem passa da caixa (em px), na largura e na altura: o arrasto de tudo isso a leva de uma ponta à outra.
  const sobras = () => {
    const el = caixa.current;
    if (!el) return { x: 0, y: 0 };
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    return { x: Math.max(cw, ch * f.proporcao) * f.zoom - cw, y: Math.max(ch, cw / f.proporcao) * f.zoom - ch };
  };
  const mudar = (m: Partial<Fundo>) => setF((x) => ({ ...x, ...m }));
  // Trocar Imagem (22/10/2026): a nova imagem no lugar, com a posição, o tamanho e os ajustes de agora.
  const seletor = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const trocar = async (arquivo: File) => {
    setEnviando(true);
    try {
      mudar(await enviarImagem(relatorioId, arquivo, 2560));
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Não foi possível enviar a imagem.");
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Dialog open onOpenChange={(a) => (!a ? onFechar() : undefined)}>
      <DialogContent avisoAoSair className="rounded-sm sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Imagem de Fundo</DialogTitle>
          <DialogDescription>
            A imagem cobre o slide inteiro, por cima do cabeçalho, atrás dos blocos. Arraste-a para posicionar; o Tamanho (ou a roda do mouse sobre ela) a
            aumenta; embaixo, o brilho, a matiz, a saturação, o desfoque e a transparência. “Trocar Imagem” põe outra imagem no lugar, com a posição, o tamanho e os ajustes.
          </DialogDescription>
        </DialogHeader>
        <div
          ref={caixa}
          className="relative w-full cursor-grab touch-none overflow-hidden rounded-sm border border-gray-300 bg-gray-100 select-none active:cursor-grabbing"
          style={{ aspectRatio: tela.proporcao }}
          onPointerDown={(e) => {
            // Sem selecionar os textos do modal ao arrastar.
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            arrasto.current = { px: e.clientX, py: e.clientY, x: f.x, y: f.y };
          }}
          onPointerMove={(e) => {
            const a = arrasto.current;
            if (!a) return;
            const s = sobras();
            mudar({ x: s.x > 0 ? entre(a.x - (e.clientX - a.px) / s.x, 0, 1) : a.x, y: s.y > 0 ? entre(a.y - (e.clientY - a.py) / s.y, 0, 1) : a.y });
          }}
          onPointerUp={() => (arrasto.current = null)}
          onPointerCancel={() => (arrasto.current = null)}
          onWheel={(e) => mudar({ zoom: entre(f.zoom - e.deltaY * 0.001, 1, ZOOM_MAXIMO) })}
        >
          <CamadaDoFundo relatorioId={relatorioId} fundo={f} className="absolute inset-0" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 border-b border-dashed border-white/90 bg-black/10" style={{ height: `${tela.cabecalho * 100}%` }}>
            <span className="absolute top-1/2 left-2 -translate-y-1/2 rounded-sm bg-black/50 px-1.5 text-[10px] text-white">Cabeçalho</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="fundo-tamanho" className="shrink-0 text-sm font-medium">
            Tamanho
          </label>
          <input
            id="fundo-tamanho"
            type="range"
            min={1}
            max={ZOOM_MAXIMO}
            step={0.01}
            value={f.zoom}
            onChange={(e) => mudar({ zoom: Number(e.target.value) })}
            className="min-w-0 flex-1 accent-black"
          />
          <span className="w-12 shrink-0 text-right text-sm text-gray-600">{Math.round(f.zoom * 100)}%</span>
          <Button type="button" variant="outline" className="rounded-sm" onClick={() => mudar({ zoom: 1, x: 0.5, y: 0.5 })} title="A imagem centralizada, no tamanho que cobre a tela">
            <RotateCcw className="size-4" />
            Restaurar
          </Button>
        </div>
        {/* Os ajustes da imagem (21/10/2026). */}
        <ControlesDosAjustes ajustes={f.ajustes} onMudar={(ajustes) => mudar({ ajustes })} />
        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="outline" className="rounded-sm" disabled={enviando} onClick={() => seletor.current?.click()} title="Outra imagem no lugar desta, com a posição, o tamanho e os ajustes de agora">
            <ImageUp className="size-4" />
            {enviando ? "Enviando…" : "Trocar Imagem"}
          </Button>
          <input
            ref={seletor}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              e.target.value = "";
              if (arquivo) void trocar(arquivo);
            }}
          />
          <div className="flex gap-2">
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" className={botaoPrimario} disabled={enviando} onClick={() => onAplicar(f)}>
            Aplicar
          </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
