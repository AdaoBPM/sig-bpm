"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { BaldeBadge } from "@/components/shared/BaldeBadge";
import { DataTable } from "@/components/shared/DataTable";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { Button } from "@/components/ui/button";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { atualizarCompetencia } from "@/lib/atualizarCompetencia";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { FaixaIndicadores, type Indicador } from "@/components/shared/FaixaIndicadores";
import { QuadroTabela } from "@/components/shared/QuadroTabela";

import { AvisoCongelado } from "../../components/AvisoCongelado";
import { lerAnoMes, moeda } from "../utils/formatacao";
import { LancamentoManualDialog } from "./components/LancamentoManualDialog";
import {
  lancamentosManuaisService,
  mensagemDeErro,
  type LancamentoManual,
} from "./services/lancamentosManuaisService";

/** Soma os valores em centavos, para não acumular erro de ponto flutuante. */
function somaPor(itens: LancamentoManual[], chave: (l: LancamentoManual) => string) {
  const m = new Map<string, number>();
  for (const l of itens) m.set(chave(l), (m.get(chave(l)) ?? 0) + Math.round(Number(l.valor) * 100));
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, c]) => ({ chave: k, valor: (c / 100).toFixed(2) }));
}

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
  // Os totais por motivo e por filial (E5 do levantamento de layout); com um só, ele é o próprio total.
  const porMotivo = somaPor(itens, (l) => l.motivo);
  const porFilial = somaPor(itens, (l) => String(l.filial));
  const indicadores: Indicador[] = [
    { rotulo: itens.length === 1 ? "lançamento" : "lançamentos", valor: itens.length },
    { rotulo: "total", rotuloAntes: true, valor: moeda(dados?.total ?? "0") },
    ...(porMotivo.length > 1 ? porMotivo.map((m) => ({ rotulo: m.chave, rotuloAntes: true, valor: moeda(m.valor) })) : []),
    ...(porFilial.length > 1 ? porFilial.map((p) => ({ rotulo: `filial ${p.chave}`, rotuloAntes: true, valor: moeda(p.valor) })) : []),
  ];
  if (porMotivo.length === 1) indicadores.push({ rotulo: "motivo", rotuloAntes: true, valor: <span className="text-sm font-bold">{porMotivo[0].chave}</span> });
  if (porFilial.length === 1) indicadores.push({ rotulo: "filial", rotuloAntes: true, valor: porFilial[0].chave });

  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Lançamentos manuais"
        selo={fechada ? <AvisoCongelado anoMes={anoMes} fechada oQue="dos lançamentos" /> : null}
        sobre={<p>O que não vem do balancete do RM — a RN e outros ajustes. É a versão sistêmica da aba Gastos (Lanç. Manuais).</p>}
        acoes={
          !fechada && dados ? (
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
          ) : null
        }
      />

      {itens.length > 0 ? <FaixaIndicadores itens={indicadores} /> : null}

      <QuadroTabela
        rodape={
          itens.length > 0 ? (
            <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-2.5 text-sm">
              <span className="text-gray-600">Total</span>
              <span className="font-bold tabular-nums text-gray-900">{moeda(dados?.total ?? "0")}</span>
            </div>
          ) : null
        }
      >
          <DataTable<LancamentoManual>
            data={itens}
            isLoading={lista.isPending}
            error={lista.isError ? mensagemDeErro(lista.error, "Erro ao carregar os lançamentos.") : null}
            emptyMessage="Nenhum lançamento manual nesta competência"
            emptyHint="Inclua os lançamentos da RN, ou copie os do mês anterior e ajuste os valores."
            columns={["Motivo", "Filial", "Conta", "Descrição", "Destino na DRE", "Rateio", "Valor", ""]}
            renderRow={(l) => (
              <tr key={l.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 text-sm whitespace-nowrap text-gray-900">{l.motivo}</td>
                <td className="px-4 text-sm tabular-nums">{l.filial}</td>
                <td className="px-4 text-sm">
                  <div className="font-medium tabular-nums text-gray-900">{l.contaResultado?.reduzido ?? "—"}</div>
                  {l.centroCusto ? (
                    <div className="max-w-56 truncate text-xs text-gray-500" title={`${l.centroCusto.codigoRM} ${l.centroCusto.nomeRM}`}>
                      centro {l.centroCusto.codigoRM} {l.centroCusto.nomeRM}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 text-sm text-gray-600">
                  <div className="max-w-72 truncate" title={l.descricao}>
                    {l.descricao}
                  </div>
                </td>
                <td className="px-4 text-sm text-gray-600">
                  {/* A linha numa linha só; o grupo vai na dica. */}
                  {l.linhaDRE ? (
                    <div className="max-w-56 truncate" title={`${l.linhaDRE.grupo} › ${l.linhaDRE.descricao}`}>
                      {l.linhaDRE.descricao}
                    </div>
                  ) : (
                    <span className="text-red-700">sem destino — corrija a conta</span>
                  )}
                </td>
                <td className="px-4 text-sm">
                  <BaldeBadge balde={l.balde} />
                </td>
                <td className="px-4 text-right text-sm tabular-nums whitespace-nowrap text-gray-900">
                  {moeda(l.valor)}
                </td>
                <td className="px-4 py-0 text-right whitespace-nowrap">
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
      </QuadroTabela>

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
