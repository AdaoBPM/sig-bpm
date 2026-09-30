"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Calculator, LockKeyhole, LockKeyholeOpen } from "lucide-react";
import { toast } from "sonner";

import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { StatusCompetenciaBadge } from "../../../components/StatusCompetenciaBadge";
import { apuracaoService } from "../../../services/apuracaoService";
import { dataHora } from "../../utils/formatacao";
import { mensagemDeErro } from "../services/dreService";

type Props = { anoMes: string; onAvisos: (avisos: string[]) => void };

const botaoPrimario = "bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm";

/**
 * Apuração, fechamento e reabertura da competência (Passo 21). Apurar refaz
 * tudo o que forma o resultado do mês e congela os valores; fechar exige a
 * apuração em dia; reabrir exige justificativa.
 */
export function PainelApuracao({ anoMes, onAvisos }: Props) {
  const queryClient = useQueryClient();
  const [dialogo, setDialogo] = useState<"fechar" | "reabrir" | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const situacao = useQuery({ queryKey: ["apuracao", anoMes], queryFn: () => apuracaoService.situacao(anoMes) });

  // A apuração refaz a classificação, o estoque, a receita, os rateios e a DRE: tudo do mês se atualiza.
  const atualizar = () => {
    queryClient.invalidateQueries({ predicate: (q) => q.queryKey.includes(anoMes) });
    queryClient.invalidateQueries({ queryKey: ["competencias"] });
  };
  const apurar = useMutation({
    mutationFn: () => apuracaoService.apurar(anoMes),
    onSuccess: (r) => {
      onAvisos(r.avisos);
      toast.success(`Competência apurada e congelada (${r.etapas.join(", ")}).`);
      atualizar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível apurar a competência.")),
  });
  const fechar = useMutation({
    mutationFn: () => apuracaoService.fechar(anoMes),
    onSuccess: () => {
      toast.success("Competência fechada.");
      setDialogo(null);
      atualizar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível fechar a competência.")),
  });
  const reabrir = useMutation({
    mutationFn: () => apuracaoService.reabrir(anoMes, justificativa),
    onSuccess: () => {
      toast.success("Competência reaberta.");
      setDialogo(null);
      setJustificativa("");
      atualizar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível reabrir a competência.")),
  });

  const s = situacao.data;
  if (!s) return <div className="h-24 animate-pulse rounded-sm bg-gray-100" />;
  const fechada = s.competencia.status === "FECHADA";

  return (
    <div className="space-y-3 rounded-sm border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 text-sm text-gray-600">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-gray-900">Apuração da competência</span>
            <StatusCompetenciaBadge status={s.competencia.status} />
          </div>
          <p>
            {s.apurada
              ? `Apurada em ${dataHora(s.apuradaEm!)}${s.apuradaPor ? ` por ${s.apuradaPor}` : ""} (${s.apuracoes} apuração(ões)). Os valores estão congelados: cadastros alterados depois só valem se a competência for reapurada.`
              : "Ainda não apurada. Apurar refaz, em ordem, a classificação, o estoque, a receita prévia, os rateios e a DRE, e congela os valores."}
          </p>
          {fechada ? <p>Fechada em {dataHora(s.fechadaEm!)}{s.fechadaPor ? ` por ${s.fechadaPor}` : ""}. Para mudar qualquer valor, reabra com justificativa.</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {s.podeApurar ? (
            <PermissionGuard permission="apuracao:editar">
              <Button type="button" onClick={() => apurar.mutate()} disabled={apurar.isPending} className={botaoPrimario}>
                <Calculator className="size-4" />
                {apurar.isPending ? "Apurando…" : s.apurada ? "Reapurar competência" : "Apurar competência"}
              </Button>
            </PermissionGuard>
          ) : null}
          {!fechada ? (
            <PermissionGuard permission="competencia:editar">
              <Button type="button" variant="outline" className="rounded-sm" disabled={!s.podeFechar || apurar.isPending} onClick={() => setDialogo("fechar")}>
                <LockKeyhole className="size-4" />
                Fechar competência
              </Button>
            </PermissionGuard>
          ) : null}
          {s.podeReabrir ? (
            <PermissionGuard permission="competencia:editar">
              <Button type="button" variant="outline" className="rounded-sm" onClick={() => setDialogo("reabrir")}>
                <LockKeyholeOpen className="size-4" />
                Reabrir competência
              </Button>
            </PermissionGuard>
          ) : null}
        </div>
      </div>

      {s.apurada && s.mudancas.length > 0 ? (
        <div className="flex items-start gap-2 rounded-sm border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Entradas alteradas depois da apuração. Os valores abaixo são os da apuração; reapure para incluir as mudanças.</p>
            <ul className="list-disc pl-5">{s.mudancas.map((m) => <li key={m}>{m}</li>)}</ul>
          </div>
        </div>
      ) : null}
      {!fechada && !s.podeFechar && s.motivosNaoFechar.length > 0 ? (
        <p className="text-xs text-gray-500">Para fechar: {s.motivosNaoFechar.join(" ")}</p>
      ) : null}
      {s.reaberturas.length > 0 ? (
        <details className="text-xs text-gray-600">
          <summary className="cursor-pointer">{s.reaberturas.length} reabertura(s)</summary>
          <ul className="mt-1 space-y-1 pl-4">
            {s.reaberturas.map((r) => (
              <li key={r.reabertaEm}>
                {dataHora(r.reabertaEm)} · {r.reabertaPor}: {r.justificativa}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <Dialog open={dialogo !== null} onOpenChange={(o) => (!o ? setDialogo(null) : undefined)}>
        <DialogContent className="rounded-sm sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogo === "fechar" ? "Fechar a competência" : "Reabrir a competência"}</DialogTitle>
            <DialogDescription>
              {dialogo === "fechar"
                ? "Fechada, a competência não aceita importação, digitação nem apuração. Os valores ficam como foram apurados; mudar exige reabrir com justificativa."
                : "A reabertura fica registrada, com a justificativa. Os valores continuam os da apuração até a competência ser reapurada."}
            </DialogDescription>
          </DialogHeader>
          {dialogo === "reabrir" ? (
            <div className="space-y-1.5">
              <label htmlFor="justificativa" className="text-sm font-medium text-gray-900">
                Justificativa
              </label>
              <textarea
                id="justificativa"
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                rows={4}
                className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2 text-sm"
                placeholder="Por que a competência precisa ser reaberta?"
              />
              <p className="text-xs text-gray-500">Ao menos 15 caracteres.</p>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-sm" onClick={() => setDialogo(null)}>
              Cancelar
            </Button>
            {dialogo === "fechar" ? (
              <Button type="button" className={botaoPrimario} disabled={fechar.isPending} onClick={() => fechar.mutate()}>
                {fechar.isPending ? "Fechando…" : "Fechar"}
              </Button>
            ) : (
              <Button type="button" className={botaoPrimario} disabled={reabrir.isPending || justificativa.trim().length < 15} onClick={() => reabrir.mutate()}>
                {reabrir.isPending ? "Reabrindo…" : "Reabrir"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
