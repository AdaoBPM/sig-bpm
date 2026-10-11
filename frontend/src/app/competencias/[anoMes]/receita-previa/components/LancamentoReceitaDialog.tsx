"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { atualizarCompetencia } from "@/lib/atualizarCompetencia";
import { textoParaDecimal } from "@/lib/numero";

import {
  mensagemDeErro,
  pedeVenda,
  receitaPreviaService,
  rotuloLancamento,
  ROTULO_UNIDADE,
  ROTULO_VENDA,
  type Componente,
  type LancamentoReceita,
  type Natureza,
  type OpcoesLancamentoReceita,
  type Venda,
} from "../services/receitaPreviaService";

type Props = {
  anoMes: string;
  opcoes: OpcoesLancamentoReceita | undefined;
  /** null: novo; um lançamento: edição. */
  editando: LancamentoReceita | null;
  onFechar: () => void;
};

const selectClasse = "h-9 w-full rounded-sm border border-gray-300 bg-white px-3 text-sm";

export function LancamentoReceitaDialog({ anoMes, opcoes, editando, onFechar }: Props) {
  const queryClient = useQueryClient();
  const [unidade, setUnidade] = useState(String(editando?.unidade ?? 1));
  const [linha, setLinha] = useState(editando ? `${editando.natureza}|${editando.componente}` : "PRE_FABRICADO|BRUTA");
  const [valor, setValor] = useState(editando ? editando.valor.replace(".", ",") : "");
  const [observacao, setObservacao] = useState(editando?.observacao ?? "");
  const [venda, setVenda] = useState<Venda | "">(editando?.venda ?? "");
  const componenteEscolhido = linha.split("|")[1] as Componente;
  const comVenda = pedeVenda(Number(unidade), componenteEscolhido);

  const linhas = (opcoes?.linhasPorUnidade[unidade] ?? []).flatMap((l) =>
    l.componentes.map((c) => ({ chave: `${l.natureza}|${c}`, rotulo: rotuloLancamento(l.natureza, c) })),
  );

  const salvar = useMutation({
    mutationFn: () => {
      const [natureza, componente] = linha.split("|") as [Natureza, Componente];
      const entrada = {
        unidade: Number(unidade),
        natureza,
        componente,
        valor: textoParaDecimal(valor),
        observacao,
        venda: pedeVenda(Number(unidade), componente) && venda ? venda : null,
      };
      return editando
        ? receitaPreviaService.atualizarLancamento(editando.id, entrada)
        : receitaPreviaService.criarLancamento(anoMes, entrada);
    },
    onSuccess: () => {
      toast.success(editando ? "Lançamento alterado. Apure de novo para refletir na receita." : "Lançamento incluído. Apure de novo para refletir na receita.");
      atualizarCompetencia(queryClient, anoMes);
      onFechar();
    },
  });

  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent className="rounded-sm sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? "Alterar Lançamento de Receita" : "Novo Lançamento de Receita"}</DialogTitle>
          <DialogDescription>
            Correções e redistribuições da receita prévia — o que a aba Receita (Lanç. Manuais) registrava.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lr-unidade">Unidade</Label>
              <select
                id="lr-unidade"
                value={unidade}
                onChange={(e) => {
                  setUnidade(e.target.value);
                  const primeira = opcoes?.linhasPorUnidade[e.target.value]?.[0];
                  if (primeira) setLinha(`${primeira.natureza}|${primeira.componentes[0]}`);
                }}
                className={selectClasse}
              >
                {[1, 2, 3].map((u) => (
                  <option key={u} value={u}>
                    {ROTULO_UNIDADE[u]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lr-valor">Valor (R$)</Label>
              <Input id="lr-valor" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="-1.234,56" className="rounded-sm border-gray-300 text-right" />
            </div>
          </div>
          <div className={`grid gap-4 ${comVenda ? "sm:grid-cols-[1fr_10rem]" : ""}`}>
            <div className="space-y-1.5">
              <Label htmlFor="lr-linha">Linha da receita</Label>
              <select id="lr-linha" value={linha} onChange={(e) => setLinha(e.target.value)} className={selectClasse}>
                {linhas.map((l) => (
                  <option key={l.chave} value={l.chave}>
                    {l.rotulo}
                  </option>
                ))}
              </select>
            </div>
            {comVenda ? (
              <div className="space-y-1.5">
                <Label htmlFor="lr-venda">Venda</Label>
                <select id="lr-venda" value={venda} onChange={(e) => setVenda(e.target.value as Venda | "")} className={selectClasse}>
                  <option value="">Escolha…</option>
                  {(["GLOBAL", "MERCANTIL"] as const).map((v) => (
                    <option key={v} value={v}>
                      {ROTULO_VENDA[v]}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lr-obs">Observação</Label>
            <Input id="lr-obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: correção conforme fechamento com o contábil" className="rounded-sm border-gray-300" />
          </div>
          {salvar.error ? (
            <div className="flex items-center gap-2 rounded-sm border border-red-200 bg-red-50 p-3">
              <AlertCircle className="size-4 shrink-0 text-red-700" />
              <p className="text-sm text-red-700">{mensagemDeErro(salvar.error, "Não foi possível salvar.")}</p>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onFechar} className="rounded-sm">
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending || !valor.trim() || !observacao.trim() || (comVenda && !venda)}
            className="bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm"
          >
            {salvar.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
