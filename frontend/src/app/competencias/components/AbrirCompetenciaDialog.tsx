"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { etapasDoMes } from "@/lib/etapasDoMes";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";

import { competenciasService } from "../services/competenciasService";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const botaoPrimario = "bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm";

type Props = {
  /** O mês sugerido: o seguinte ao mais recente já aberto. */
  sugestao: { ano: number; mes: number };
};

/**
 * "Abrir competência" num botão com diálogo (E2 do levantamento de layout),
 * em vez do cartão sempre aberto no topo da lista. Aberto o mês, a tela vai
 * para a primeira etapa dele.
 */
export function AbrirCompetenciaDialog({ sugestao }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [aberto, setAberto] = useState(false);
  const [ano, setAno] = useState(String(sugestao.ano));
  const [mes, setMes] = useState(String(sugestao.mes));

  const abrir = useMutation({
    mutationFn: () => competenciasService.abrir(Number(ano), Number(mes)),
    onSuccess: (competencia) => {
      const am = `${competencia.ano}-${String(competencia.mes).padStart(2, "0")}`;
      toast.success(`Competência ${String(competencia.mes).padStart(2, "0")}/${competencia.ano} aberta.`);
      queryClient.invalidateQueries({ queryKey: ["competencias"] });
      setAberto(false);
      const primeira = etapasDoMes(hasPermission, user?.acesso)[0];
      if (primeira) router.push(`/competencias/${am}/${primeira.caminho}`);
    },
  });

  // O backend recusa duplicata com 409 e uma mensagem pronta; mostrá-la é mais
  // útil do que um texto genérico de erro.
  const mensagemErro =
    abrir.error &&
    ((abrir.error as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Não foi possível abrir a competência.");

  const atual = new Date().getFullYear();
  const anos = [...new Set([atual - 1, atual, atual + 1, sugestao.ano])].sort();

  const mostrar = () => {
    setAno(String(sugestao.ano));
    setMes(String(sugestao.mes));
    abrir.reset();
    setAberto(true);
  };

  return (
    <>
      <Button type="button" onClick={mostrar} className={botaoPrimario}>
        <Plus className="size-4" />
        Abrir competência
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="rounded-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Abrir Competência</DialogTitle>
            <DialogDescription>
              O mês nasce aberto. Importação e digitação só acontecem enquanto ele estiver aberto ou em conferência.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="competencia-mes" className="text-sm font-medium text-gray-900">
                Mês
              </Label>
              <Select value={mes} onValueChange={(v) => { if (v) setMes(v); }}>
                <SelectTrigger id="competencia-mes" className="w-48 rounded-sm">
                  <SelectValue>{(v: string | null) => (v ? `${v.padStart(2, "0")} — ${MESES[Number(v) - 1]}` : "")}</SelectValue>
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
                  {anos.map((a) => (
                    <SelectItem key={a} value={String(a)}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {mensagemErro ? (
            <div className="flex items-center gap-2 rounded-sm border border-red-200 bg-red-50 p-3">
              <AlertCircle className="size-4 shrink-0 text-red-700" />
              <p className="text-sm text-red-700">{mensagemErro}</p>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-sm" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => abrir.mutate()} disabled={abrir.isPending} className={botaoPrimario}>
              {abrir.isPending ? "Abrindo…" : `Abrir ${mes.padStart(2, "0")}/${ano}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
