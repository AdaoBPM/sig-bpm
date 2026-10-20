"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { botaoPrimario, OpcaoEmLinha } from "@/app/cenarios/components/CenarioDialog";

import type { ListarDoSumario, TelaDoSumario } from "../services/relatoriosExecutivosService";

export type OpcoesDoSumario = { listar: ListarDoSumario; telas: string[] };

/**
 * O Sumário (20/10/2026): as telas marcadas, na ordem do relatório, com o número do primeiro slide de cada uma e, em
 * Telas e Slides, os slides delas. Os números são a contagem dos slides a partir da Introdução (a Capa não conta), a
 * mesma do contador do topo dos slides; a tela marcada sem slides não aparece.
 */
export function ListaDoSumario({ opcoes, sumario, editavel }: { opcoes: OpcoesDoSumario; sumario: TelaDoSumario[]; editavel: boolean }) {
  const telas = sumario.filter((t) => opcoes.telas.includes(t.chave) && t.slides.length);
  if (!telas.length) {
    return editavel ? (
      <div className="flex h-full items-center justify-center rounded-sm border border-dashed border-gray-300 p-3 text-center text-xs text-gray-500">
        Nenhuma tela marcada tem slides: marque as telas no Configurar Sumário (o botão de engrenagem do bloco).
      </div>
    ) : null;
  }
  const linha = (rotulo: string, numero: number, tela: boolean) => (
    <div className={`flex items-baseline gap-2 ${tela ? "text-base font-bold text-gray-900" : "pl-5 text-sm text-gray-700"}`}>
      <span className="min-w-0 truncate">{rotulo}</span>
      <span aria-hidden className="min-w-4 flex-1 border-b border-dotted border-gray-400" />
      <span className="shrink-0">{numero}</span>
    </div>
  );
  return (
    <nav aria-label="Sumário" className={`h-full overflow-hidden ${editavel ? "rounded-sm border border-dashed border-transparent hover:border-gray-300" : ""}`}>
      <ol className="space-y-2">
        {telas.map((t) => (
          <li key={t.chave} className="space-y-1">
            {linha(t.titulo, t.slides[0].numero, true)}
            {opcoes.listar === "TELAS_E_SLIDES" ? (
              <ol className="space-y-0.5">
                {t.slides.map((s) => (
                  <li key={`${s.numero}`}>{linha(s.nome, s.numero, false)}</li>
                ))}
              </ol>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * O modal do Sumário (20/10/2026): listar só as telas ou as telas e os slides, e as telas que entram (da Introdução em
 * diante; de início, todas).
 */
export function ConfigurarSumarioDialog({
  titulo,
  inicial,
  sumario,
  onAplicar,
  onFechar,
}: {
  titulo: string;
  inicial?: OpcoesDoSumario;
  sumario: TelaDoSumario[];
  onAplicar: (o: OpcoesDoSumario) => void;
  onFechar: () => void;
}) {
  const [listar, setListar] = useState<ListarDoSumario>(inicial?.listar ?? "TELAS");
  const [telas, setTelas] = useState<Set<string>>(() => new Set(inicial?.telas ?? sumario.map((t) => t.chave)));
  const alternar = (c: string) =>
    setTelas((s) => {
      const n = new Set(s);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });
  return (
    <Dialog open onOpenChange={(a) => (!a ? onFechar() : undefined)}>
      <DialogContent avisoAoSair className="rounded-sm sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>A lista das telas do relatório, com o número do slide de cada uma (a contagem começa na Introdução; a Capa não conta).</DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-sm leading-none font-medium">Listar</legend>
          <OpcaoEmLinha nome="listar-sumario" marcada={listar === "TELAS"} onMarcar={() => setListar("TELAS")} rotulo="Telas" detalhe="Cada tela, com o número do primeiro slide dela." />
          <OpcaoEmLinha nome="listar-sumario" marcada={listar === "TELAS_E_SLIDES"} onMarcar={() => setListar("TELAS_E_SLIDES")} rotulo="Telas e Slides" detalhe="Cada tela e, abaixo dela, os slides, com os números." />
        </fieldset>
        <fieldset className="space-y-1.5">
          <legend className="mb-1.5 text-sm leading-none font-medium">Telas</legend>
          {sumario.map((t) => (
            <label key={t.chave} className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5 text-sm hover:bg-gray-50">
              <input type="checkbox" className="size-4 accent-black" checked={telas.has(t.chave)} onChange={() => alternar(t.chave)} />
              <span className="min-w-0 flex-1 truncate">{t.titulo}</span>
              <span className="shrink-0 text-xs text-gray-500">{t.slides.length ? `slide ${t.slides[0].numero}` : "sem slides"}</span>
            </label>
          ))}
        </fieldset>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" className={botaoPrimario} disabled={!telas.size} onClick={() => onAplicar({ listar, telas: sumario.map((t) => t.chave).filter((c) => telas.has(c)) })}>
            {inicial ? "Aplicar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
