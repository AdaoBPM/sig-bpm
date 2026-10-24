"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleAlert, Image as Imagem, ImagePlus, ImageUp, ThumbsDown, ThumbsUp, Type } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { botaoPrimario, OpcaoEmLinha } from "@/app/cenarios/components/CenarioDialog";

import type { Nota } from "../services/relatoriosExecutivosService";

/** O que veio de outro programa: a imagem, o texto e o texto formatado (a cópia do Word traz os três). */
export type Colado = { imagem: File | null; texto: string; html: string };

/** Como o colado entra no slide: um tipo de texto (com ou sem a formatação básica) ou de imagem. */
export type ComoColar =
  | { tipo: "TEXTO"; formatado: boolean }
  | { tipo: "ANOTACAO"; nota: Nota; formatado: boolean }
  | { tipo: "IMAGEM"; como: "LEGENDA" | "LIVRE" | "FUNDO" };

type Opcao = "TEXTO" | Nota | "LEGENDA" | "LIVRE" | "FUNDO";

/**
 * O modal Colar no Slide (24/10/2026, pedido do Adão): o texto ou a imagem colados de outro programa (Ctrl+V na página)
 * entram na página aberta como um dos tipos de texto — Texto Livre ou Anotação (Positivo, Negativo ou Atenção), com ou sem
 * a formatação básica — ou de imagem — com Legenda, Livre ou de Fundo. Com o texto e a imagem (a cópia do Word ou do
 * Excel traz os dois), os dois grupos; de início, o texto.
 */
export function ColarNoSlideDialog({ colado, pagina, temFundo, onColar, onFechar }: { colado: Colado; pagina: string; temFundo: boolean; onColar: (c: ComoColar) => void; onFechar: () => void }) {
  const comTexto = !!colado.texto.trim();
  const [opcao, setOpcao] = useState<Opcao>(comTexto ? "TEXTO" : "LEGENDA");
  const [formatado, setFormatado] = useState(true);
  const previa = useMemo(() => (colado.imagem ? URL.createObjectURL(colado.imagem) : null), [colado.imagem]);
  useEffect(() => () => (previa ? URL.revokeObjectURL(previa) : undefined), [previa]);
  const colar = () =>
    onColar(
      opcao === "TEXTO"
        ? { tipo: "TEXTO", formatado }
        : opcao === "POSITIVO" || opcao === "NEGATIVO" || opcao === "ATENCAO"
          ? { tipo: "ANOTACAO", nota: opcao, formatado }
          : { tipo: "IMAGEM", como: opcao },
    );
  const opcaoDe = (o: Opcao, rotulo: string, detalhe: string, Icone: typeof Type) => (
    <OpcaoEmLinha key={o} nome="colar-no-slide" marcada={opcao === o} onMarcar={() => setOpcao(o)} rotulo={rotulo} detalhe={detalhe} Icone={Icone} />
  );
  return (
    <Dialog open onOpenChange={(a) => (!a ? onFechar() : undefined)}>
      <DialogContent className="rounded-sm sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Colar no Slide</DialogTitle>
          <DialogDescription>Escolha como o que você copiou entra na página {pagina}.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-3">
          {previa ? (
            // eslint-disable-next-line @next/next/no-img-element -- a imagem colada, ainda no navegador.
            <img src={previa} alt="Imagem colada" className="max-h-32 max-w-40 shrink-0 rounded-sm border border-gray-200 object-contain" />
          ) : null}
          {comTexto ? <p className="line-clamp-5 min-w-0 flex-1 rounded-sm bg-gray-50 p-2 text-xs whitespace-pre-line text-gray-700">{colado.texto.trim()}</p> : null}
        </div>
        {comTexto ? (
          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-sm leading-none font-medium">Texto</legend>
            {opcaoDe("TEXTO", "Texto Livre", "O texto solto no slide, sem o destaque e o título.", Type)}
            {opcaoDe("POSITIVO", "Anotação: Positivo", "Num card verde, com o título.", ThumbsUp)}
            {opcaoDe("NEGATIVO", "Anotação: Negativo", "Num card vermelho, com o título.", ThumbsDown)}
            {opcaoDe("ATENCAO", "Anotação: Atenção", "Num card laranja, com o título.", CircleAlert)}
            {colado.html ? (
              <label className="flex items-center gap-2 pt-1 text-sm text-gray-700">
                <input type="checkbox" className="size-4 accent-black" checked={formatado} onChange={(e) => setFormatado(e.target.checked)} />
                Manter a formatação (negrito, itálico, sublinhado e listas)
              </label>
            ) : null}
          </fieldset>
        ) : null}
        {colado.imagem ? (
          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-sm leading-none font-medium">Imagem</legend>
            {opcaoDe("LEGENDA", "Imagem com Legenda", "A imagem com a legenda embaixo.", ImagePlus)}
            {opcaoDe("LIVRE", "Imagem Livre", "Só a imagem, sem a legenda e o fundo.", Imagem)}
            {opcaoDe("FUNDO", "Imagem de Fundo", temFundo ? "Troca a imagem de fundo da página (abre o ajuste)." : "O fundo do slide inteiro (abre o ajuste).", ImageUp)}
          </fieldset>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" className={botaoPrimario} onClick={colar}>
            Colar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
