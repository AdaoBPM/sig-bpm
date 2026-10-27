"use client";

import { useRef, useState, type CSSProperties } from "react";
import { ImageUp, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { botaoPrimario } from "@/app/cenarios/components/CenarioDialog";

import { enderecoDaFoto, type AjustesDeImagem, type RecorteDaImagem } from "../services/relatoriosExecutivosService";
import { enviarImagem } from "./enviarImagem";
import { COR_PADRAO, CORES_DA_FONTE } from "./TextoRico";

type Controle = { chave: keyof AjustesDeImagem; rotulo: string; min: number; max: number; padrao: number; unidade: string };

/**
 * Os ajustes das imagens (21/10/2026): o Brilho, a Matiz, a Saturação, o Desfoque e a Transparência, nas imagens com
 * legenda, nas livres e na Imagem de Fundo. Sem um ajuste, o valor padrão (a imagem como veio).
 */
const CONTROLES: Controle[] = [
  { chave: "brilho", rotulo: "Brilho", min: 0, max: 200, padrao: 100, unidade: "%" },
  { chave: "matiz", rotulo: "Matiz", min: -180, max: 180, padrao: 0, unidade: "°" },
  { chave: "saturacao", rotulo: "Saturação", min: 0, max: 200, padrao: 100, unidade: "%" },
  { chave: "desfoque", rotulo: "Desfoque", min: 0, max: 20, padrao: 0, unidade: " px" },
  { chave: "transparencia", rotulo: "Transparência", min: 0, max: 100, padrao: 0, unidade: "%" },
];
/** A moldura (22/10/2026; só as imagens com legenda e as livres): a borda e o sombreamento centralizado. */
const BORDA: Controle = { chave: "bordaEspessura", rotulo: "Espessura", min: 0, max: 20, padrao: 0, unidade: " px" };
const SOMBRA: Controle[] = [
  { chave: "sombraIntensidade", rotulo: "Intensidade", min: 0, max: 100, padrao: 0, unidade: "%" },
  { chave: "sombraDesfoque", rotulo: "Desfoque", min: 0, max: 60, padrao: 16, unidade: " px" },
];
const NUMERICOS = [...CONTROLES, BORDA, ...SOMBRA];
const COR_DA_BORDA = COR_PADRAO;

const valorDe = (a: AjustesDeImagem | undefined, c: Controle) => (a?.[c.chave] as number | undefined) ?? c.padrao;
const corDaBorda = (a: AjustesDeImagem | undefined) => a?.bordaCor ?? COR_DA_BORDA;

/** O estilo da imagem com os ajustes (o filtro e a opacidade); sem ajustes, vazio. */
export function estiloDosAjustes(a: AjustesDeImagem | undefined): CSSProperties {
  if (!a) return {};
  const [brilho, matiz, saturacao, desfoque, transparencia] = CONTROLES.map((c) => valorDe(a, c));
  const filtros = [
    brilho !== 100 ? `brightness(${brilho}%)` : null,
    matiz !== 0 ? `hue-rotate(${matiz}deg)` : null,
    saturacao !== 100 ? `saturate(${saturacao}%)` : null,
    desfoque !== 0 ? `blur(${desfoque}px)` : null,
  ].filter(Boolean);
  return { ...(filtros.length ? { filter: filtros.join(" ") } : {}), ...(transparencia ? { opacity: 1 - transparencia / 100 } : {}) };
}

/**
 * A imagem com a moldura (22/10/2026): na proporção dela, o maior tamanho que cabe no espaço (como antes, com o
 * object-contain), e a borda e o sombreamento em volta da imagem mostrada, e não do espaço inteiro. A sombra é a do
 * contorno da imagem (drop-shadow: no PNG transparente, a do desenho), centralizada; o espaço em volta dela (o desfoque)
 * sai do tamanho da imagem, para a sombra não ser cortada pelo bloco.
 */
export function ImagemComMoldura({ src, alt, proporcao, ajustes, recorte }: { src: string; alt: string; proporcao: number; ajustes: AjustesDeImagem | undefined; recorte?: RecorteDaImagem }) {
  const borda = valorDe(ajustes, BORDA);
  const intensidade = valorDe(ajustes, SOMBRA[0]);
  const desfoque = valorDe(ajustes, SOMBRA[1]);
  const folga = intensidade ? desfoque : 0;
  // A imagem cortada (27/10/2026, o Cortar e Posicionar): ela cobre o quadro inteiro, com o zoom e a posição, como a Imagem
  // de Fundo; a borda e a sombra, em volta do quadro.
  if (recorte) {
    const ponto = `${recorte.x * 100}% ${recorte.y * 100}%`;
    return (
      <div className="h-full w-full" style={{ padding: folga }}>
        <div
          className="h-full w-full overflow-hidden"
          style={{
            ...(borda ? { border: `${borda}px solid ${corDaBorda(ajustes)}` } : {}),
            ...(intensidade ? { filter: `drop-shadow(0 0 ${desfoque}px rgb(0 0 0 / ${intensidade / 100}))` } : {}),
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a imagem vem do servidor, pelo proxy, com o login. */}
          <img
            src={src}
            alt={alt}
            draggable={false}
            className="block size-full max-w-none object-cover"
            style={{ objectPosition: ponto, transform: `scale(${recorte.zoom})`, transformOrigin: ponto, ...estiloDosAjustes(ajustes) }}
          />
        </div>
      </div>
    );
  }
  // Os cq (container query) são as medidas do espaço da imagem; a largura, a que cabe na largura e na altura dele.
  const largura = `min(100cqw - ${2 * borda}px, (100cqh - ${2 * borda}px) * ${proporcao || 1})`;
  return (
    // A folga da sombra fora do espaço medido (os cq medem a caixa de dentro, sem ela).
    <div className="h-full w-full" style={{ padding: folga }}>
      <div className="grid h-full w-full place-items-center [container-type:size]">
      <div
        className="leading-none"
        style={{
          ...(borda ? { border: `${borda}px solid ${corDaBorda(ajustes)}` } : {}),
          ...(intensidade ? { filter: `drop-shadow(0 0 ${desfoque}px rgb(0 0 0 / ${intensidade / 100}))` } : {}),
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a imagem vem do servidor, pelo proxy, com o login. */}
        <img src={src} alt={alt} draggable={false} className="block h-auto" style={{ width: `calc(${largura})`, ...estiloDosAjustes(ajustes) }} />
      </div>
      </div>
    </div>
  );
}

/** Só os ajustes fora do padrão (o que se grava); nenhum, nada. A cor da borda só com a borda. */
function semPadroes(a: AjustesDeImagem): AjustesDeImagem | undefined {
  const r: AjustesDeImagem = {};
  for (const c of NUMERICOS) if (valorDe(a, c) !== c.padrao) (r as Record<string, number>)[c.chave] = valorDe(a, c);
  if (r.bordaEspessura && corDaBorda(a) !== COR_DA_BORDA) r.bordaCor = corDaBorda(a);
  return Object.keys(r).length ? r : undefined;
}

function Deslizante({ c, ajustes, onMudar }: { c: Controle; ajustes: AjustesDeImagem | undefined; onMudar: (a: AjustesDeImagem | undefined) => void }) {
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={`ajuste-${c.chave}`} className="w-28 shrink-0 text-sm font-medium">
        {c.rotulo}
      </label>
      <input
        id={`ajuste-${c.chave}`}
        type="range"
        min={c.min}
        max={c.max}
        step={1}
        value={valorDe(ajustes, c)}
        onChange={(e) => onMudar(semPadroes({ ...ajustes, [c.chave]: Number(e.target.value) }))}
        className="min-w-0 flex-1 accent-black"
      />
      <span className="w-16 shrink-0 text-right text-sm text-gray-600">
        {valorDe(ajustes, c)}
        {c.unidade}
      </span>
    </div>
  );
}

/**
 * Os controles deslizantes e o Restaurar (o modal das imagens, o da Imagem de Fundo e o Cortar e Posicionar); com
 * `comMoldura` (as imagens com legenda e as livres, 22/10/2026), também a Borda (a espessura e a cor) e o Sombreamento (a
 * intensidade e o desfoque). O Restaurar Ajustes volta só os controles mostrados: sem a moldura (o Cortar e Posicionar,
 * 27/10/2026), a borda e o sombreamento ficam.
 */
export function ControlesDosAjustes({ ajustes, onMudar, comMoldura = false }: { ajustes: AjustesDeImagem | undefined; onMudar: (a: AjustesDeImagem | undefined) => void; comMoldura?: boolean }) {
  const titulo = "pt-1 text-xs font-bold tracking-wide text-gray-500 uppercase";
  const mostrados = comMoldura ? NUMERICOS : CONTROLES;
  const restaurados = semPadroes({ ...ajustes, ...Object.fromEntries(mostrados.map((c) => [c.chave, c.padrao])) });
  return (
    <div className="space-y-2">
      {CONTROLES.map((c) => (
        <Deslizante key={c.chave} c={c} ajustes={ajustes} onMudar={onMudar} />
      ))}
      {comMoldura ? (
        <>
          <p className={titulo}>Borda</p>
          <Deslizante c={BORDA} ajustes={ajustes} onMudar={onMudar} />
          <div className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-sm font-medium">Cor</span>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Cor da borda">
              {CORES_DA_FONTE.map((x) => (
                <button
                  key={x.cor}
                  type="button"
                  role="radio"
                  aria-checked={corDaBorda(ajustes) === x.cor}
                  title={x.nome === "Padrão" ? "Preto" : x.nome}
                  onClick={() => onMudar(semPadroes({ ...ajustes, bordaCor: x.cor, bordaEspessura: valorDe(ajustes, BORDA) || 2 }))}
                  className={`size-6 rounded-sm border border-gray-300 ${corDaBorda(ajustes) === x.cor ? "ring-2 ring-bpm-primary ring-offset-1" : ""}`}
                  style={{ backgroundColor: x.cor }}
                />
              ))}
              {/* Outra cor, no seletor do navegador. */}
              <label className="relative flex h-6 cursor-pointer items-center gap-1 rounded-sm border border-gray-300 px-1.5 text-xs text-gray-700 hover:bg-gray-100" title="Outra cor">
                <span className="size-3.5 rounded-sm border border-gray-300" style={{ backgroundColor: corDaBorda(ajustes) }} />
                Outra
                <input
                  type="color"
                  value={corDaBorda(ajustes)}
                  onChange={(e) => onMudar(semPadroes({ ...ajustes, bordaCor: e.target.value, bordaEspessura: valorDe(ajustes, BORDA) || 2 }))}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label="Outra cor da borda"
                />
              </label>
            </div>
          </div>
          <p className={titulo}>Sombreamento (centralizado)</p>
          {SOMBRA.map((c) => (
            <Deslizante key={c.chave} c={c} ajustes={ajustes} onMudar={onMudar} />
          ))}
        </>
      ) : null}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          className="rounded-sm"
          disabled={mostrados.every((c) => valorDe(ajustes, c) === c.padrao)}
          onClick={() => onMudar(restaurados)}
          title="A imagem como veio, sem os ajustes"
        >
          <RotateCcw className="size-4" />
          Restaurar Ajustes
        </Button>
      </div>
    </div>
  );
}

/** A imagem trocada no modal (22/10/2026): o arquivo novo e a proporção dele. */
export type ImagemTrocada = { arquivo: string; proporcao: number };

/**
 * O modal Ajustes da Imagem (21/10/2026), das imagens com legenda e das livres: a prévia e os controles; com
 * `comMoldura`, a borda e o sombreamento. "Trocar Imagem" (22/10/2026) envia outra imagem, que fica no lugar desta com os
 * ajustes de agora (no Aplicar; o Cancelar mantém a de antes).
 */
export function AjustesDaImagemDialog({
  relatorioId,
  arquivo,
  proporcao,
  inicial,
  comMoldura = false,
  onAplicar,
  onFechar,
}: {
  relatorioId: string;
  arquivo: string;
  proporcao: number;
  inicial: AjustesDeImagem | undefined;
  comMoldura?: boolean;
  onAplicar: (a: AjustesDeImagem | undefined, troca?: ImagemTrocada) => void;
  onFechar: () => void;
}) {
  const [a, setA] = useState(inicial);
  const [troca, setTroca] = useState<ImagemTrocada | undefined>(undefined);
  const [enviando, setEnviando] = useState(false);
  const seletor = useRef<HTMLInputElement>(null);
  const trocar = async (escolhido: File) => {
    setEnviando(true);
    try {
      setTroca(await enviarImagem(relatorioId, escolhido));
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Não foi possível enviar a imagem.");
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Dialog open onOpenChange={(aberto) => (!aberto ? onFechar() : undefined)}>
      <DialogContent avisoAoSair className="rounded-sm sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Ajustes da Imagem</DialogTitle>
          <DialogDescription>
            O brilho, a matiz, a saturação, o desfoque e a transparência da imagem no slide{comMoldura ? ", a borda e o sombreamento" : ""}. “Trocar Imagem” põe
            outra imagem no lugar, com estes ajustes.
          </DialogDescription>
        </DialogHeader>
        {/* A prévia sobre o xadrez, para a transparência aparecer. */}
        <div className="h-56 overflow-hidden rounded-sm border border-gray-200 bg-[repeating-conic-gradient(var(--color-gray-200)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] p-2">
          <ImagemComMoldura src={enderecoDaFoto(relatorioId, troca?.arquivo ?? arquivo)} alt="Prévia" proporcao={troca?.proporcao ?? proporcao} ajustes={a} />
        </div>
        <ControlesDosAjustes ajustes={a} onMudar={setA} comMoldura={comMoldura} />
        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="outline" className="rounded-sm" disabled={enviando} onClick={() => seletor.current?.click()} title="Outra imagem no lugar desta, com os ajustes de agora">
            <ImageUp className="size-4" />
            {enviando ? "Enviando…" : "Trocar Imagem"}
          </Button>
          <input
            ref={seletor}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const escolhido = e.target.files?.[0];
              e.target.value = "";
              if (escolhido) void trocar(escolhido);
            }}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="button" className={botaoPrimario} disabled={enviando} onClick={() => onAplicar(a, troca)}>
              Aplicar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
