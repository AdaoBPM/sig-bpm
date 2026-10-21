"use client";

import { useState, type CSSProperties } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { botaoPrimario } from "@/app/cenarios/components/CenarioDialog";

import { enderecoDaFoto, type AjustesDeImagem } from "../services/relatoriosExecutivosService";

/**
 * Os ajustes das imagens (21/10/2026): o Brilho, a Matiz, a Saturação, o Desfoque e a Transparência, nas imagens com
 * legenda, nas livres e na Imagem de Fundo. Sem um ajuste, o valor padrão (a imagem como veio).
 */
const CONTROLES: Array<{ chave: keyof AjustesDeImagem; rotulo: string; min: number; max: number; padrao: number; unidade: string }> = [
  { chave: "brilho", rotulo: "Brilho", min: 0, max: 200, padrao: 100, unidade: "%" },
  { chave: "matiz", rotulo: "Matiz", min: -180, max: 180, padrao: 0, unidade: "°" },
  { chave: "saturacao", rotulo: "Saturação", min: 0, max: 200, padrao: 100, unidade: "%" },
  { chave: "desfoque", rotulo: "Desfoque", min: 0, max: 20, padrao: 0, unidade: " px" },
  { chave: "transparencia", rotulo: "Transparência", min: 0, max: 100, padrao: 0, unidade: "%" },
];

const valorDe = (a: AjustesDeImagem | undefined, c: (typeof CONTROLES)[number]) => a?.[c.chave] ?? c.padrao;

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

/** Só os ajustes fora do padrão (o que se grava); nenhum, nada. */
function semPadroes(a: AjustesDeImagem): AjustesDeImagem | undefined {
  const r: AjustesDeImagem = {};
  for (const c of CONTROLES) if (valorDe(a, c) !== c.padrao) r[c.chave] = valorDe(a, c);
  return Object.keys(r).length ? r : undefined;
}

/** Os cinco controles deslizantes e o Restaurar (o modal das imagens e o da Imagem de Fundo). */
export function ControlesDosAjustes({ ajustes, onMudar }: { ajustes: AjustesDeImagem | undefined; onMudar: (a: AjustesDeImagem | undefined) => void }) {
  return (
    <div className="space-y-2">
      {CONTROLES.map((c) => (
        <div key={c.chave} className="flex items-center gap-3">
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
      ))}
      <div className="flex justify-end">
        <Button type="button" variant="outline" className="rounded-sm" disabled={!ajustes} onClick={() => onMudar(undefined)} title="A imagem como veio, sem os ajustes">
          <RotateCcw className="size-4" />
          Restaurar Ajustes
        </Button>
      </div>
    </div>
  );
}

/** O modal Ajustes da Imagem (21/10/2026), das imagens com legenda e das livres: a prévia e os controles. */
export function AjustesDaImagemDialog({
  relatorioId,
  arquivo,
  inicial,
  onAplicar,
  onFechar,
}: {
  relatorioId: string;
  arquivo: string;
  inicial: AjustesDeImagem | undefined;
  onAplicar: (a: AjustesDeImagem | undefined) => void;
  onFechar: () => void;
}) {
  const [a, setA] = useState(inicial);
  return (
    <Dialog open onOpenChange={(aberto) => (!aberto ? onFechar() : undefined)}>
      <DialogContent avisoAoSair className="rounded-sm sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Ajustes da Imagem</DialogTitle>
          <DialogDescription>O brilho, a matiz, a saturação, o desfoque e a transparência da imagem no slide.</DialogDescription>
        </DialogHeader>
        {/* A prévia sobre o xadrez, para a transparência aparecer. */}
        <div className="flex h-56 items-center justify-center overflow-hidden rounded-sm border border-gray-200 bg-[repeating-conic-gradient(var(--color-gray-200)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
          {/* eslint-disable-next-line @next/next/no-img-element -- a imagem vem do servidor, pelo proxy, com o login. */}
          <img src={enderecoDaFoto(relatorioId, arquivo)} alt="Prévia" draggable={false} className="max-h-full max-w-full object-contain" style={estiloDosAjustes(a)} />
        </div>
        <ControlesDosAjustes ajustes={a} onMudar={setA} />
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" className={botaoPrimario} onClick={() => onAplicar(a)}>
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
