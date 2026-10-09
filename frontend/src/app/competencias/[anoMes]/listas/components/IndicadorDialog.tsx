"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { atualizarCompetencia } from "@/lib/atualizarCompetencia";

import { listasService, mensagemDeErro, type IndicadoresDaLista } from "../services/listasService";

type Indicador = IndicadoresDaLista["indicadores"][number];

type Props = {
  anoMes: string;
  slug: string;
  rotuloLista: string;
  indicadores: Indicador[];
  /** O valor atual, como a tabela o mostra. */
  formatar: (i: Indicador) => string;
  onFechar: () => void;
};

/** "1.234,5" ou "1234.5" → 1234.5; null se não for número. */
function lerNumero(t: string): number | null {
  const s = t.trim().replace(/\s/g, "");
  if (!s) return null;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : null;
}

/**
 * "Novo Registro" das abas Comercial e Administrativo: escolhe o indicador e
 * digita o valor do mês, que sobrepõe o atual (importado ou digitado antes).
 * Os percentuais se digitam em % (1,4 para 1,4%).
 */
export function IndicadorDialog({ anoMes, slug, rotuloLista, indicadores, formatar, onFechar }: Props) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [texto, setTexto] = useState("");
  const indicador = indicadores.find((i) => i.nome === nome);
  const pct = indicador?.unidade === "%";
  const numero = lerNumero(texto);

  const salvar = useMutation({
    mutationFn: () => listasService.digitarIndicador(anoMes, slug, nome, pct ? numero! / 100 : numero!),
    onSuccess: () => {
      toast.success("Indicador atualizado.");
      atualizarCompetencia(queryClient, anoMes);
      // A tela Indicadores e o Painel de Bordo usam o valor do mês.
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
      onFechar();
    },
  });

  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent className="rounded-sm sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Registro · {rotuloLista}</DialogTitle>
          <DialogDescription>
            Escolha o indicador e digite o valor do mês. O valor digitado substitui o atual; uma nova importação da aba volta a valer sobre
            ele.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="indicador">Indicador</Label>
            <select
              id="indicador"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="h-9 w-full rounded-sm border border-gray-300 bg-white px-2 text-sm"
            >
              <option value="" disabled>
                Selecione o indicador
              </option>
              {indicadores.map((i) => (
                <option key={i.nome} value={i.nome}>
                  {i.numero} · {i.nome}
                </option>
              ))}
            </select>
            {indicador ? (
              <p className="text-xs text-gray-500">
                Valor atual: <span className="font-medium text-gray-700">{formatar(indicador)}</span>
                {indicador.origem ? ` (${indicador.origem === "DIGITADA" ? "digitado" : "importado"})` : ""} · {indicador.metodologia}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="valor">Valor do Mês{indicador ? <span className="ml-1 text-xs font-normal text-gray-500">({indicador.unidade})</span> : null}</Label>
            <div className="flex items-center gap-2">
              <Input
                id="valor"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                inputMode="decimal"
                placeholder={pct ? "0,0" : "0,00"}
                className="w-48 rounded-sm border-gray-300"
              />
              {pct ? <span className="text-sm text-gray-600">%</span> : null}
            </div>
            {texto.trim() && numero === null ? <p className="text-xs text-red-700">Digite um número.</p> : null}
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
            disabled={salvar.isPending || !indicador || numero === null}
            className="bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm"
          >
            {salvar.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
