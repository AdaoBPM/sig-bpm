"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Calculator, History, LockKeyhole, LockKeyholeOpen } from "lucide-react";
import { toast } from "sonner";

import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemResultado, useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import type { Coluna } from "@/lib/filtrosDeTabela";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { atualizarCompetencia } from "@/lib/atualizarCompetencia";

import { apuracaoService } from "../../../services/apuracaoService";
import { dataHora } from "../../utils/formatacao";
import { mensagemDeErro } from "../services/dreService";

type Props = { anoMes: string; onAvisos: (avisos: string[]) => void };

const botaoPrimario = "bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm";

/**
 * Apuração, fechamento e reabertura da competência (Passo 21). Apurar refaz
 * tudo o que forma o resultado do mês e congela os valores; fechar exige a
 * apuração em dia; reabrir exige justificativa.
 *
 * Os botões ficam no cabeçalho da tela (AcoesApuracao) e a situação numa
 * linha logo abaixo dele (SituacaoApuracao), para a DRE vir logo depois das
 * abas (E10 do levantamento de layout).
 */
export function AcoesApuracao({ anoMes, onAvisos }: Props) {
  const queryClient = useQueryClient();
  const { refresh } = useAuth();
  const [dialogo, setDialogo] = useState<"fechar" | "reabrir" | null>(null);
  const [historico, setHistorico] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const situacao = useQuery({ queryKey: ["apuracao", anoMes], queryFn: () => apuracaoService.situacao(anoMes) });

  // A apuração refaz a classificação, o estoque, a receita, os rateios e a DRE: tudo do mês se atualiza.
  const atualizar = () => {
    atualizarCompetencia(queryClient, anoMes);
    void refresh(); // as divergências de preço resolvidas saem do aviso
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
  if (!s) return null;
  const fechada = s.competencia.status === "FECHADA";

  return (
    <>
      <div className="flex flex-wrap gap-2">
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
            <Button
              type="button"
              variant="outline"
              className="rounded-sm"
              disabled={!s.podeFechar || apurar.isPending}
              title={s.podeFechar ? undefined : `Para fechar: ${s.motivosNaoFechar.join(" ")}`}
              onClick={() => setDialogo("fechar")}
            >
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
        {s.reaberturas.length > 0 ? (
          <Button type="button" variant="outline" className="rounded-sm" onClick={() => setHistorico(true)}>
            <History className="size-4" />
            Reaberturas ({s.reaberturas.length})
          </Button>
        ) : null}
      </div>
      {historico ? <HistoricoReaberturas reaberturas={s.reaberturas} onFechar={() => setHistorico(false)} /> : null}

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
    </>
  );
}

/** A situação da apuração numa linha, e o que pede atenção (entradas alteradas, motivos para não fechar). */
export function SituacaoApuracao({ anoMes }: { anoMes: string }) {
  const situacao = useQuery({ queryKey: ["apuracao", anoMes], queryFn: () => apuracaoService.situacao(anoMes) });
  const s = situacao.data;
  if (situacao.isError) {
    return (
      <div className="rounded-sm border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {mensagemDeErro(situacao.error, "Não foi possível carregar a situação da apuração.")}
      </div>
    );
  }
  if (!s) return <div className="h-5 w-96 animate-pulse rounded-sm bg-gray-100" />;
  const fechada = s.competencia.status === "FECHADA";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-gray-600">
        <span>
          {s.apurada
            ? `Apurada em ${dataHora(s.apuradaEm!)}${s.apuradaPor ? ` por ${s.apuradaPor}` : ""} · ${s.apuracoes} apuração(ões). Valores congelados: cadastros alterados depois só valem se a competência for reapurada.`
            : "Ainda não apurada. Apurar refaz, em ordem, a classificação, o estoque, a receita prévia, os rateios e a DRE, e congela os valores."}
        </span>
        {fechada ? <span>Fechada em {dataHora(s.fechadaEm!)}{s.fechadaPor ? ` por ${s.fechadaPor}` : ""}; para mudar qualquer valor, reabra com justificativa.</span> : null}
        {!fechada && !s.podeFechar && s.motivosNaoFechar.length > 0 ? <span className="text-xs text-gray-500">Para fechar: {s.motivosNaoFechar.join(" ")}</span> : null}
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
    </div>
  );
}

type Reabertura = { reabertaEm: string; reabertaPor: string; justificativa: string };

const COLUNAS_REABERTURA: Coluna<Reabertura>[] = [
  { chave: "quando", rotulo: "Reaberta em", tipo: "data", valor: (r) => new Date(r.reabertaEm).getTime(), texto: (r) => dataHora(r.reabertaEm), classe: "w-44" },
  { chave: "por", rotulo: "Por", valor: (r) => r.reabertaPor, classe: "w-48" },
  { chave: "justificativa", rotulo: "Justificativa", valor: (r) => r.justificativa },
];

/** O histórico das reaberturas da competência, com filtro e ordem nos rótulos. */
function HistoricoReaberturas({ reaberturas, onFechar }: { reaberturas: Reabertura[]; onFechar: () => void }) {
  const tabela = useTabelaFiltravel(reaberturas, COLUNAS_REABERTURA);
  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-sm sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Histórico de Reaberturas</DialogTitle>
          <DialogDescription>{reaberturas.length} reabertura(s) desta competência, com quem reabriu e a justificativa.</DialogDescription>
        </DialogHeader>
        <table className="tabela-sig w-full border-collapse text-sm">
          {tabela.cabecalho}
          <tbody>
            {tabela.visiveis.length === 0 ? (
              <SemResultado colunas={COLUNAS_REABERTURA.length} onLimpar={tabela.limpar} />
            ) : (
              tabela.visiveis.map((r) => (
                <tr key={r.reabertaEm} className="border-b border-gray-100 align-top">
                  <td className="px-4 py-2 whitespace-nowrap tabular-nums text-gray-700">{dataHora(r.reabertaEm)}</td>
                  <td className="px-4 py-2 text-gray-700">{r.reabertaPor}</td>
                  <td className="px-4 py-2 text-gray-900">{r.justificativa}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  );
}
