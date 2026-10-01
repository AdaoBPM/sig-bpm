"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { BaldeBadge } from "@/components/shared/BaldeBadge";
import { DataTable } from "@/components/shared/DataTable";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { Button } from "@/components/ui/button";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { atualizarCompetencia } from "@/lib/atualizarCompetencia";

import { StatusCompetenciaBadge } from "../../components/StatusCompetenciaBadge";
import { lerAnoMes, MESES, moeda, rotuloCompetencia } from "../utils/formatacao";
import { LancamentoManualDialog } from "./components/LancamentoManualDialog";
import {
  lancamentosManuaisService,
  mensagemDeErro,
  type LancamentoManual,
} from "./services/lancamentosManuaisService";

export function LancamentosManuaisContent() {
  const { anoMes } = useParams<{ anoMes: string }>();
  useRegistrarAcessoTela(`/competencias/${anoMes}/lancamentos-manuais`);
  const periodo = lerAnoMes(anoMes);
  const queryClient = useQueryClient();
  // undefined: diálogo fechado; null: novo; lançamento: edição.
  const [editando, setEditando] = useState<LancamentoManual | null | undefined>(undefined);

  const lista = useQuery({
    queryKey: ["lancamentos-manuais", anoMes],
    queryFn: () => lancamentosManuaisService.listar(anoMes),
    enabled: periodo !== null,
  });
  const opcoes = useQuery({
    queryKey: ["lancamentos-manuais", "opcoes"],
    queryFn: lancamentosManuaisService.opcoes,
    staleTime: 5 * 60_000,
  });

  const invalidar = () => atualizarCompetencia(queryClient, anoMes);
  const excluir = useMutation({
    mutationFn: (id: string) => lancamentosManuaisService.excluir(id),
    onSuccess: () => {
      toast.success("Lançamento excluído.");
      invalidar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível excluir.")),
  });
  const copiar = useMutation({
    mutationFn: () => lancamentosManuaisService.copiarAnterior(anoMes),
    onSuccess: (r) => {
      toast.success(`${r.copiados} lançamento(s) copiados do mês anterior. Confira os valores.`);
      invalidar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível copiar.")),
  });

  if (!periodo) {
    return (
      <div className="rounded-sm border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">Competência inválida na URL: {anoMes}.</p>
      </div>
    );
  }

  const dados = lista.data;
  const fechada = dados?.competencia.status === "FECHADA";
  const itens = dados?.itens ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/competencias" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="size-4" />
          Competências
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
                Lançamentos manuais · {rotuloCompetencia(periodo.ano, periodo.mes)}
              </h1>
              <span className="text-sm text-gray-400">{MESES[periodo.mes - 1]}</span>
              {dados ? <StatusCompetenciaBadge status={dados.competencia.status} /> : null}
            </div>
            <p className="text-sm text-gray-600">
              O que não vem do balancete do RM — a RN e outros ajustes. É a versão
              sistêmica da aba Gastos (Lanç. Manuais).
            </p>
          </div>
          {!fechada && dados ? (
            <PermissionGuard permission="lancamentos_manuais:editar">
              <div className="flex gap-2">
                {itens.length === 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => copiar.mutate()}
                    disabled={copiar.isPending}
                    className="rounded-sm border border-black text-black hover:bg-gray-100"
                  >
                    <Copy className="size-4" />
                    Copiar do mês anterior
                  </Button>
                ) : null}
                <Button
                  type="button"
                  onClick={() => setEditando(null)}
                  className="bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm"
                >
                  <Plus className="size-4" />
                  Novo lançamento
                </Button>
              </div>
            </PermissionGuard>
          ) : null}
        </div>
      </div>

      {fechada ? (
        <div className="flex items-center gap-2 rounded-sm border border-gray-200 bg-gray-50 p-4">
          <Lock className="size-4 shrink-0 text-gray-500" />
          <p className="text-sm text-gray-600">Competência fechada: os lançamentos não podem ser alterados.</p>
        </div>
      ) : null}

      <div className="border border-gray-200 bg-white rounded-sm">
        <div className="overflow-x-auto">
          <DataTable<LancamentoManual>
            data={itens}
            isLoading={lista.isPending}
            error={lista.isError ? mensagemDeErro(lista.error, "Erro ao carregar os lançamentos.") : null}
            emptyMessage="Nenhum lançamento manual nesta competência"
            emptyHint="Inclua os lançamentos da RN, ou copie os do mês anterior e ajuste os valores."
            columns={["Motivo", "Filial", "Conta", "Descrição", "Destino na DRE", "Rateio", "Valor", ""]}
            renderRow={(l) => (
              <tr key={l.id} className="border-b border-gray-100 align-top hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">{l.motivo}</td>
                <td className="px-4 py-3 text-sm tabular-nums">{l.filial}</td>
                <td className="px-4 py-3 text-sm">
                  <div className="font-medium tabular-nums text-gray-900">{l.contaResultado?.reduzido ?? "—"}</div>
                  {l.centroCusto ? (
                    <div className="text-xs text-gray-500">centro {l.centroCusto.codigoRM} {l.centroCusto.nomeRM}</div>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{l.descricao}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {l.linhaDRE ? (
                    <>
                      <div>{l.linhaDRE.descricao}</div>
                      <div className="text-xs text-gray-400">{l.linhaDRE.grupo}</div>
                    </>
                  ) : (
                    <span className="text-red-700">sem destino — corrija a conta</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  <BaldeBadge balde={l.balde} />
                </td>
                <td className="px-4 py-3 text-right text-sm tabular-nums whitespace-nowrap text-gray-900">
                  {moeda(l.valor)}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {!fechada ? (
                    <PermissionGuard permission="lancamentos_manuais:editar">
                      <Button type="button" variant="ghost" size="icon" onClick={() => setEditando(l)} aria-label="Editar">
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Excluir"
                        onClick={() => {
                          if (window.confirm(`Excluir o lançamento "${l.descricao}"?`)) excluir.mutate(l.id);
                        }}
                      >
                        <Trash2 className="size-4 text-red-700" />
                      </Button>
                    </PermissionGuard>
                  ) : null}
                </td>
              </tr>
            )}
          />
        </div>
        {itens.length > 0 ? (
          <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3 text-sm">
            <span className="text-gray-600">Total</span>
            <span className="font-bold tabular-nums text-gray-900">{moeda(dados?.total ?? "0")}</span>
          </div>
        ) : null}
      </div>

      {editando !== undefined ? (
        <LancamentoManualDialog
          key={editando?.id ?? "novo"}
          anoMes={anoMes}
          opcoes={opcoes.data}
          editando={editando}
          aberto
          onFechar={() => setEditando(undefined)}
        />
      ) : null}
    </div>
  );
}
