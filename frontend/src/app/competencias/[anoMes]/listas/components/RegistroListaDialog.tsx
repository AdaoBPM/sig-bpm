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

import {
  listasService,
  mensagemDeErro,
  type CampoDigitacao,
  type RegistroLista,
} from "../services/listasService";

type Props = {
  anoMes: string;
  slug: string;
  rotuloLista: string;
  campos: CampoDigitacao[];
  /** null: novo registro; um registro digitado: edição. */
  editando: RegistroLista | null;
  onFechar: () => void;
};

/**
 * Formulário montado a partir da definição de campos que o backend devolve.
 * As regras (linha, unidade, volume adotado) são as da importação e rodam lá.
 */
export function RegistroListaDialog({ anoMes, slug, rotuloLista, campos, editando, onFechar }: Props) {
  const queryClient = useQueryClient();
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      campos.map((c) => [c.coluna, editando?.valores?.[c.coluna] ?? (c.tipo === "opcoes" ? (c.opcoes?.[0]?.valor ?? "") : "")]),
    ),
  );

  const salvar = useMutation({
    mutationFn: () =>
      editando
        ? listasService.atualizar(anoMes, slug, editando.id, valores)
        : listasService.criar(anoMes, slug, valores),
    onSuccess: () => {
      toast.success(editando ? "Registro atualizado." : "Registro incluído.");
      queryClient.invalidateQueries({ queryKey: ["listas", anoMes, slug] });
      queryClient.invalidateQueries({ queryKey: ["classificacao", anoMes] });
      onFechar();
    },
  });

  const faltando = campos.some((c) => c.obrigatorio && !String(valores[c.coluna] ?? "").trim());

  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent className="rounded-sm sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar registro" : "Novo registro"} · {rotuloLista}</DialogTitle>
          <DialogDescription>
            O registro entra no mês da competência. Linha, unidade e volume seguem as
            mesmas regras da importação.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {campos.map((c) => {
            const id = `campo-${c.coluna.replace(/[^A-Za-z0-9]/g, "")}`;
            return (
              <div key={c.coluna} className="space-y-1.5">
                <Label htmlFor={id}>
                  {c.rotulo}
                  {c.obrigatorio ? null : <span className="ml-1 text-xs font-normal text-gray-400">(opcional)</span>}
                </Label>
                {c.tipo === "opcoes" ? (
                  <select
                    id={id}
                    value={valores[c.coluna] ?? ""}
                    onChange={(e) => setValores((v) => ({ ...v, [c.coluna]: e.target.value }))}
                    className="h-9 w-full rounded-sm border border-gray-300 bg-white px-2 text-sm"
                  >
                    {(c.opcoes ?? []).map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.rotulo}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id={id}
                    value={valores[c.coluna] ?? ""}
                    onChange={(e) => setValores((v) => ({ ...v, [c.coluna]: e.target.value }))}
                    inputMode={c.tipo === "numero" ? "decimal" : undefined}
                    placeholder={c.tipo === "numero" ? "0,000" : undefined}
                    className={`rounded-sm border-gray-300 ${c.tipo === "numero" ? "w-48 tabular-nums" : ""}`}
                  />
                )}
                {c.ajuda ? <p className="text-xs text-gray-500">{c.ajuda}</p> : null}
              </div>
            );
          })}

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
            disabled={salvar.isPending || faltando}
            className="bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm"
          >
            {salvar.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
