"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { competenciasService } from "../services/competenciasService";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function anosSugeridos(): number[] {
  const atual = new Date().getFullYear();
  return [atual - 1, atual, atual + 1];
}

export function AbrirCompetenciaForm() {
  const hoje = new Date();
  const [ano, setAno] = useState(String(hoje.getFullYear()));
  const [mes, setMes] = useState(String(hoje.getMonth() + 1));
  const queryClient = useQueryClient();

  const abrir = useMutation({
    mutationFn: () => competenciasService.abrir(Number(ano), Number(mes)),
    onSuccess: (competencia) => {
      toast.success(
        `Competência ${String(competencia.mes).padStart(2, "0")}/${competencia.ano} aberta.`,
      );
      queryClient.invalidateQueries({ queryKey: ["competencias"] });
    },
  });

  // O backend recusa duplicata com 409 e uma mensagem pronta; mostrá-la é mais
  // útil do que um texto genérico de erro.
  const mensagemErro =
    abrir.error &&
    ((abrir.error as { response?: { data?: { error?: string } } }).response?.data
      ?.error ??
      "Não foi possível abrir a competência.");

  return (
    <div className="max-w-3xl rounded-sm border border-gray-200 bg-white p-6">
      <h2 className="text-xl font-bold tracking-tight text-gray-900">
        Abrir competência
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        O mês nasce aberto. Importação e digitação só acontecem enquanto ele
        estiver aberto ou em conferência.
      </p>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="competencia-mes" className="text-sm font-medium text-gray-900">
            Mês
          </Label>
          <Select value={mes} onValueChange={(v) => { if (v) setMes(v); }}>
            <SelectTrigger id="competencia-mes" className="w-48 rounded-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((nome, i) => (
                <SelectItem key={nome} value={String(i + 1)}>
                  {String(i + 1).padStart(2, "0")} — {nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="competencia-ano" className="text-sm font-medium text-gray-900">
            Ano
          </Label>
          <Select value={ano} onValueChange={(v) => { if (v) setAno(v); }}>
            <SelectTrigger id="competencia-ano" className="w-32 rounded-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anosSugeridos().map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          onClick={() => abrir.mutate()}
          disabled={abrir.isPending}
          className="bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm"
        >
          <Plus className="size-4" />
          {abrir.isPending ? "Abrindo…" : "Abrir competência"}
        </Button>
      </div>

      {mensagemErro ? (
        <div className="mt-4 flex items-center gap-2 rounded-sm border border-red-200 bg-red-50 p-4">
          <AlertCircle className="size-4 shrink-0 text-red-700" />
          <p className="text-sm text-red-700">{mensagemErro}</p>
        </div>
      ) : null}
    </div>
  );
}
