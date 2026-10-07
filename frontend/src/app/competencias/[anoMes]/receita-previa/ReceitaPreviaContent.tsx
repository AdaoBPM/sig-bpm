"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Calculator, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/DataTable";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { Button } from "@/components/ui/button";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { atualizarCompetencia } from "@/lib/atualizarCompetencia";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { QuadroTabela } from "@/components/shared/QuadroTabela";
import { useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import type { Coluna } from "@/lib/filtrosDeTabela";

import { AvisoCongelado } from "../../components/AvisoCongelado";
import { dataHora, lerAnoMes, moeda } from "../utils/formatacao";
import { LancamentoReceitaDialog } from "./components/LancamentoReceitaDialog";
import { MemoriaCalculoDialog } from "./components/MemoriaCalculoDialog";
import { QuadroReceita } from "./components/QuadroReceita";
import {
  mensagemDeErro,
  receitaPreviaService,
  rotuloLancamento,
  ROTULO_UNIDADE,
  ROTULO_VENDA,
  type LancamentoReceita,
  type Natureza,
} from "./services/receitaPreviaService";

const COLUNAS: Coluna<LancamentoReceita>[] = [
  { chave: "unidade", rotulo: "Unidade", valor: (l) => ROTULO_UNIDADE[l.unidade] },
  { chave: "linha", rotulo: "Linha da receita", valor: (l) => rotuloLancamento(l.natureza, l.componente) },
  { chave: "venda", rotulo: "Venda", valor: (l) => (l.venda ? ROTULO_VENDA[l.venda] : null) },
  { chave: "observacao", rotulo: "Observação", valor: (l) => l.observacao },
  { chave: "valor", rotulo: "Valor", tipo: "numero", alinhamento: "direita", valor: (l) => Number(l.valor), texto: (l) => moeda(l.valor) },
  { chave: "acoes", rotulo: "", semFiltro: true },
];

export function ReceitaPreviaContent() {
  const { anoMes } = useParams<{ anoMes: string }>();
  useRegistrarAcessoTela(`/competencias/${anoMes}/receita-previa`);
  const periodo = lerAnoMes(anoMes);
  const queryClient = useQueryClient();
  const [memoria, setMemoria] = useState<{ unidade: number; natureza: Natureza; variacao?: boolean } | null>(null);
  // undefined: diálogo fechado; null: novo; lançamento: edição.
  const [editando, setEditando] = useState<LancamentoReceita | null | undefined>(undefined);
  const [avisos, setAvisos] = useState<string[]>([]);

  const receita = useQuery({
    queryKey: ["receita-previa", anoMes],
    queryFn: () => receitaPreviaService.consultar(anoMes),
    enabled: periodo !== null,
  });
  const lancamentos = useQuery({
    queryKey: ["receita-previa", anoMes, "lancamentos"],
    queryFn: () => receitaPreviaService.lancamentos(anoMes),
    enabled: periodo !== null,
  });
  const opcoes = useQuery({
    queryKey: ["lancamentos-receita", "opcoes"],
    queryFn: receitaPreviaService.opcoes,
    staleTime: 5 * 60_000,
  });

  const apurar = useMutation({
    mutationFn: () => receitaPreviaService.apurar(anoMes),
    onSuccess: (r) => {
      setAvisos(r.avisos ?? []);
      toast.success("Receita prévia apurada.");
      queryClient.setQueryData(["receita-previa", anoMes], r);
      queryClient.invalidateQueries({ queryKey: ["receita-previa", anoMes, "itens"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível apurar.")),
  });
  const excluir = useMutation({
    mutationFn: (id: string) => receitaPreviaService.excluirLancamento(id),
    onSuccess: () => {
      toast.success("Lançamento excluído. Apure de novo para refletir na receita.");
      atualizarCompetencia(queryClient, anoMes);
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível excluir.")),
  });
  const tabela = useTabelaFiltravel(lancamentos.data?.itens, COLUNAS);

  if (!periodo) {
    return (
      <div className="rounded-sm border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">Competência inválida na URL: {anoMes}.</p>
      </div>
    );
  }

  const dados = receita.data;
  const fechada = dados?.competencia.status === "FECHADA";
  const bloqueada = fechada || dados?.congelado;

  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Receita Prévia"
        selo={bloqueada ? <AvisoCongelado anoMes={anoMes} fechada={fechada} oQue="da receita prévia" /> : null}
        comoUsar={
          <ul>
            <li>Cada quadro (Matriz, Filial e Serviços) mostra a receita bruta, os impostos e a receita líquida, com a abertura em venda global e mercantil.</li>
            <li>Clique numa linha com lupa para abrir a memória de cálculo, com uma aba por origem (Produção, Expedição, Saídas, Devoluções, Serviços e Lanç. Manuais). Filtre e ordene pelos rótulos das colunas; o total acompanha o filtro.</li>
            <li>A linha Variação do Estoque abre só as estacas que a movimentam.</li>
            <li>Em Lançamentos Manuais de Receita, “Novo Lançamento” inclui ajustes, que entram na próxima apuração.</li>
            <li>Depois da apuração da DRE, a tela fica congelada: o que mudar só entra ao reapurar a competência na DRE.</li>
          </ul>
        }
        sobre={
          <p>
            As listas do mês valoradas pelos preços da DRE do Comercial, mais os lançamentos de receita. É a versão sistêmica da aba
            Receitas (Prévia). {dados?.apuradoEm ? `Apurada em ${dataHora(dados.apuradoEm)}.` : "Ainda não apurada."}
          </p>
        }
        acoes={
          !bloqueada && dados ? (
            <PermissionGuard permission="apuracao:editar">
              <Button
                type="button"
                onClick={() => apurar.mutate()}
                disabled={apurar.isPending}
                className="bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm"
              >
                <Calculator className="size-4" />
                {apurar.isPending ? "Apurando…" : dados.apuradoEm ? "Apurar de novo" : "Apurar receita prévia"}
              </Button>
            </PermissionGuard>
          ) : null
        }
      />

      {avisos.length > 0 || (dados?.observacoes.length ?? 0) > 0 ? (
        <div className="rounded-sm border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-start gap-2 text-sm text-yellow-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <ul className="space-y-1">
              {avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
              {avisos.length === 0
                ? dados?.observacoes.map((o) => (
                    <li key={o.observacao}>
                      {o.observacao} ({o.itens} item(ns))
                    </li>
                  ))
                : null}
            </ul>
          </div>
        </div>
      ) : null}

      {receita.isError ? (
        <div className="rounded-sm border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{mensagemDeErro(receita.error, "Erro ao carregar a receita prévia.")}</p>
        </div>
      ) : receita.isPending ? (
        <div className="h-64 animate-pulse rounded-sm bg-gray-100" />
      ) : dados && dados.receitas.length > 0 ? (
        <div className="space-y-4">
          {[1, 2, 3].map((u) => (
            <QuadroReceita key={u} unidade={u} receitas={dados.receitas} porVenda={dados.porVenda ?? []} impostos={dados.impostos ?? []} onAbrir={(unidade, natureza, variacao) => setMemoria({ unidade, natureza, variacao })} />
          ))}
        </div>
      ) : (
        <div className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">
          Nenhuma apuração ainda. Importe as listas do mês (produção, expedição, saídas, devoluções e medições) e apure.
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Lançamentos Manuais de Receita</h2>
            <p className="text-sm text-gray-600">Entram na receita na próxima apuração.</p>
          </div>
          {!fechada ? (
            <PermissionGuard permission="lancamentos_manuais:editar">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditando(null)}
                className="rounded-sm border border-black text-black hover:bg-gray-100"
              >
                <Plus className="size-4" />
                Novo lançamento
              </Button>
            </PermissionGuard>
          ) : null}
        </div>
        <QuadroTabela
          barra={
            tabela.ativos ? (
              <button type="button" onClick={tabela.limpar} className="ml-auto text-xs font-medium text-gray-900 underline underline-offset-2">
                Limpar Filtros
              </button>
            ) : null
          }
        >
          <DataTable<LancamentoReceita>
            data={tabela.visiveis}
            cabecalho={tabela.cabecalho}
            filtrosAtivos={tabela.ativos}
            onLimparFiltros={tabela.limpar}
            isLoading={lancamentos.isPending}
            error={lancamentos.isError ? mensagemDeErro(lancamentos.error, "Erro ao carregar os lançamentos.") : null}
            emptyMessage="Nenhum lançamento de receita nesta competência"
            emptyHint="Correções da prévia contra o contábil, redistribuições e inventário."
            columns={["Unidade", "Linha da receita", "Observação", "Valor", ""]}
            renderRow={(l) => (
              <tr key={l.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 text-sm whitespace-nowrap">{ROTULO_UNIDADE[l.unidade]}</td>
                <td className="px-4 text-sm text-gray-900">{rotuloLancamento(l.natureza, l.componente)}</td>
                <td className="px-4 text-sm whitespace-nowrap text-gray-700">{l.venda ? ROTULO_VENDA[l.venda] : "—"}</td>
                <td className="px-4 text-sm text-gray-600">
                  <div className="max-w-md truncate" title={l.observacao}>
                    {l.observacao}
                  </div>
                </td>
                <td className="px-4 text-right text-sm whitespace-nowrap">{moeda(l.valor)}</td>
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
                          if (window.confirm(`Excluir o lançamento "${l.observacao}"?`)) excluir.mutate(l.id);
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
      </div>

      {memoria ? <MemoriaCalculoDialog anoMes={anoMes} {...memoria} onFechar={() => setMemoria(null)} /> : null}
      {editando !== undefined ? (
        <LancamentoReceitaDialog key={editando?.id ?? "novo"} anoMes={anoMes} opcoes={opcoes.data} editando={editando} onFechar={() => setEditando(undefined)} />
      ) : null}
    </div>
  );
}
