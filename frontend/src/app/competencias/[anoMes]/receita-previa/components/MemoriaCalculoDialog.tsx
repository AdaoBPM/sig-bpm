"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Carregando } from "@/components/shared/Estados";

import { inteiro, moeda } from "../../utils/formatacao";
import {
  receitaPreviaService,
  ROTULO_CRITERIO,
  ROTULO_NATUREZA,
  ROTULO_ORIGEM,
  ROTULO_UNIDADE,
  type Natureza,
} from "../services/receitaPreviaService";

type Props = { anoMes: string; unidade: number; natureza: Natureza; onFechar: () => void };

const valorOuTraco = (v: string | null) => (v === null ? "—" : moeda(v));

/** Memória de cálculo: cada registro de lista ou lançamento que compôs a linha. */
export function MemoriaCalculoDialog({ anoMes, unidade, natureza, onFechar }: Props) {
  const [pagina, setPagina] = useState(1);
  const { data, isPending, isError } = useQuery({
    queryKey: ["receita-previa", anoMes, "itens", unidade, natureza, pagina],
    queryFn: () => receitaPreviaService.itens(anoMes, unidade, natureza, pagina),
    placeholderData: keepPreviousData,
  });
  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / data.porPagina)) : 1;
  const mostraVariacao = unidade === 2 && natureza === "PRE_FABRICADO";

  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-sm sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            {ROTULO_UNIDADE[unidade]} · {ROTULO_NATUREZA[natureza]}
          </DialogTitle>
          <DialogDescription>
            Memória de cálculo: {data ? inteiro(data.total) : "…"} item(ns). Os valores ficam como foram
            apurados, com o preço vigente na apuração.
          </DialogDescription>
        </DialogHeader>
        {isError ? <p className="text-sm text-red-700">Erro ao carregar a memória de cálculo.</p> : null}
        <div className="overflow-x-auto">
          <table className="tabela-sig w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-bold text-gray-600">
                <th className="px-3 py-2">Origem</th>
                <th className="px-3 py-2">Obra · Linha</th>
                <th className="px-3 py-2">Critério</th>
                <th className="px-3 py-2 text-right">Quant.</th>
                <th className="px-3 py-2 text-right">Preço Bruto</th>
                <th className="px-3 py-2 text-right">Preço Líq.</th>
                <th className="px-3 py-2 text-right">ROB</th>
                <th className="px-3 py-2 text-right">ROL</th>
                {mostraVariacao ? <th className="px-3 py-2 text-right">Var. Estoque</th> : null}
              </tr>
            </thead>
            <tbody>
              {isPending && !data ? (
                <tr>
                  <td colSpan={9}>
                    <Carregando linhas={4} />
                  </td>
                </tr>
              ) : (
                data?.itens.map((i) => (
                  <tr key={i.id} className="border-b border-gray-100 align-top">
                    <td className="px-3 py-2">{ROTULO_ORIGEM[i.origem] ?? i.origem}</td>
                    <td className="px-3 py-2">
                      <span className="font-medium tabular-nums">{i.obra ?? "—"}</span>
                      {i.linha ? <span className="text-gray-500"> · {i.linha}</span> : null}
                      {i.observacao ? <div className="text-xs text-yellow-800">{i.observacao}</div> : null}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{ROTULO_CRITERIO[i.criterio] ?? i.criterio}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {i.quantidade === null ? "—" : Number(i.quantidade).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{valorOuTraco(i.precoBruto)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{valorOuTraco(i.precoLiquido)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{moeda(i.receitaBruta)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{moeda(i.receitaLiquida)}</td>
                    {mostraVariacao ? <td className="px-3 py-2 text-right tabular-nums">{moeda(i.variacaoEstoque)}</td> : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPaginas > 1 ? (
          <div className="flex items-center justify-end gap-2 text-sm text-gray-600">
            <Button type="button" variant="ghost" size="icon" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} aria-label="Anterior">
              <ChevronLeft className="size-4" />
            </Button>
            {pagina} de {totalPaginas}
            <Button type="button" variant="ghost" size="icon" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)} aria-label="Próxima">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
