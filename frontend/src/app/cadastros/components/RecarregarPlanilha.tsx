"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

import { PermissionGuard } from "@/components/shared/PermissionGuard";
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
import { atualizarCompetencia } from "@/lib/atualizarCompetencia";

import {
  cadastrosService,
  type MudancaCadastro,
  type PreviaRecarga,
  type SecaoRecarga,
} from "../services/cadastrosService";

function mensagem(error: unknown, padrao: string) {
  return (error as { response?: { data?: { error?: string } } }).response?.data?.error ?? padrao;
}

function ListaMudancas({ titulo, itens, total, tom }: { titulo: string; itens: MudancaCadastro[]; total: number; tom: string }) {
  if (total === 0) return null;
  return (
    <details className="rounded-sm border border-gray-200" open={total <= 10}>
      <summary className={`cursor-pointer px-3 py-2 text-sm font-medium ${tom}`}>
        {titulo}: {total}
        {itens.length < total ? <span className="ml-1 text-xs text-gray-500">(mostrando {itens.length})</span> : null}
      </summary>
      <ul className="divide-y divide-gray-100 border-t border-gray-100">
        {itens.map((m) => (
          <li key={m.chave} className="px-3 py-2 text-sm">
            <div className="font-medium text-gray-900">
              <span>{m.chave}</span>
              {m.rotulo !== m.chave ? <span className="ml-2 font-normal text-gray-600">{m.rotulo}</span> : null}
            </div>
            {m.campos.length > 0 ? (
              <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
                {m.campos.map((c) => (
                  <li key={c.campo}>
                    <span className="text-gray-500">{c.campo}:</span>{" "}
                    {c.antes !== null ? <span className="text-red-700 line-through">{c.antes}</span> : null}
                    {c.antes !== null && c.depois !== null ? " → " : null}
                    {c.depois !== null ? <span className="text-green-700">{c.depois}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

function Secao({ nome, s }: { nome: string; s: SecaoRecarga }) {
  const c = s.contagem;
  const nada = c.novos + c.alterados + c.removidos + c.mantidos === 0;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-gray-900">
        {nome}{" "}
        <span className="font-normal text-gray-500">
          · {c.iguais} sem mudança
        </span>
      </h3>
      {nada ? (
        <p className="text-sm text-gray-500">Nada muda.</p>
      ) : (
        <div className="space-y-2">
          <ListaMudancas titulo="Novos" itens={s.novos} total={c.novos} tom="text-green-700" />
          <ListaMudancas titulo="Alterados" itens={s.alterados} total={c.alterados} tom="text-yellow-800" />
          <ListaMudancas titulo="Removidos" itens={s.removidos} total={c.removidos} tom="text-red-700" />
          <ListaMudancas titulo="Fora da planilha, mantidos no cadastro" itens={s.mantidos} total={c.mantidos} tom="text-gray-600" />
        </div>
      )}
    </div>
  );
}

/**
 * Recarga dos cadastros a partir do SIG BPM 2026 - UNIDADES E CENTROS DE CUSTO,
 * para o período de paralelo: primeiro mostra o que muda, depois grava.
 */
export function RecarregarPlanilha() {
  const queryClient = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<PreviaRecarga | null>(null);

  const fechar = () => {
    setAberto(false);
    setArquivo(null);
    setPrevia(null);
    verPrevia.reset();
    confirmar.reset();
  };

  const verPrevia = useMutation({
    mutationFn: () => cadastrosService.recargaPrevia(arquivo!),
    onSuccess: setPrevia,
  });
  const confirmar = useMutation({
    mutationFn: () => cadastrosService.recargaConfirmar(previa!.hash),
    onSuccess: (r) => {
      toast.success(
        `Cadastros recarregados.${r.reclassificadas.length ? ` Competências reclassificadas: ${r.reclassificadas.join(", ")}.` : ""}${r.apuradasSemReclassificar.length ? ` Apuradas, sem mudança até serem reapuradas: ${r.apuradasSemReclassificar.join(", ")}.` : ""}`,
      );
      atualizarCompetencia(queryClient);
      fechar();
    },
  });

  const totalMudancas = previa
    ? [previa.centros, previa.contas, previa.dre].reduce(
        (n, s) => n + s.contagem.novos + s.contagem.alterados + s.contagem.removidos,
        0,
      )
    : 0;

  return (
    <PermissionGuard permission="cadastros:editar">
      <Button
        type="button"
        onClick={() => setAberto(true)}
        className="bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm"
      >
        <FileSpreadsheet className="size-4" />
        Recarregar da planilha
      </Button>

      <Dialog open={aberto} onOpenChange={(o) => (!o ? fechar() : undefined)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-sm sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Recarregar cadastros da planilha</DialogTitle>
            <DialogDescription>
              Envie o SIG BPM 2026 - UNIDADES E CENTROS DE CUSTO. O sistema mostra o que
              muda nos centros de custo, nas contas de resultado e na estrutura da DRE
              antes de gravar. As competências ainda não apuradas são reclassificadas depois; as apuradas
              ficam como foram apuradas até serem reapuradas. A planilha prevalece: uma correção feita
              aqui na ferramenta e que não esteja nela aparece como alteração e é desfeita.
            </DialogDescription>
          </DialogHeader>

          {!previa ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Input
                aria-label="Planilha UNIDADES E CENTROS DE CUSTO (.xlsx)"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => {
                  setArquivo(e.target.files?.[0] ?? null);
                  verPrevia.reset();
                }}
                className="rounded-sm border-gray-300 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium"
              />
              <Button
                type="button"
                onClick={() => verPrevia.mutate()}
                disabled={!arquivo || verPrevia.isPending}
                className="bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm"
              >
                {verPrevia.isPending ? "Lendo…" : "Ver o que muda"}
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              {totalMudancas === 0 ? (
                <p className="flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle2 className="size-4" />
                  A planilha é igual ao cadastro. Nada muda.
                </p>
              ) : null}
              <Secao nome="Centros de custo" s={previa.centros} />
              <Secao nome="Contas de resultado" s={previa.contas} />
              <Secao nome="Estrutura da DRE" s={previa.dre} />

              {previa.semDestino.length > 0 || previa.avisos.length > 0 || previa.ajustesObsoletos.length > 0 ? (
                <div className="rounded-sm border border-yellow-200 bg-yellow-50 p-3">
                  <div className="flex items-start gap-2 text-sm text-yellow-800">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <ul className="space-y-1">
                      {previa.semDestino.map((s) => (
                        <li key={s}>Conta sem linha correspondente na DRE: {s}</li>
                      ))}
                      {previa.avisos.map((a) => (
                        <li key={`${a.origem}${a.chave}${a.motivo}`}>
                          {a.origem} · {a.chave}: {a.motivo}
                        </li>
                      ))}
                      {previa.ajustesObsoletos.map((a) => (
                        <li key={a}>Ajuste de carga sem correspondência (a planilha já foi corrigida?): {a}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {verPrevia.error || confirmar.error ? (
            <div className="flex items-center gap-2 rounded-sm border border-red-200 bg-red-50 p-3">
              <AlertCircle className="size-4 shrink-0 text-red-700" />
              <p className="text-sm text-red-700">
                {mensagem(verPrevia.error ?? confirmar.error, "Não foi possível concluir a recarga.")}
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={fechar} className="rounded-sm">
              Cancelar
            </Button>
            {previa ? (
              <Button
                type="button"
                onClick={() => confirmar.mutate()}
                disabled={confirmar.isPending || totalMudancas === 0}
                className="bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm"
              >
                {confirmar.isPending ? "Gravando…" : `Confirmar recarga (${totalMudancas} mudança(s))`}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PermissionGuard>
  );
}
