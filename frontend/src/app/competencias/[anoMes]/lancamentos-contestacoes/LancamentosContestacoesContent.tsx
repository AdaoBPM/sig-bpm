"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ExportarTabela } from "@/components/shared/ExportarTabela";
import { BaldeBadge } from "@/components/shared/BaldeBadge";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { DataTable } from "@/components/shared/DataTable";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { QuadroTabela } from "@/components/shared/QuadroTabela";
import { useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import { ConfirmacaoDialog } from "@/components/shared/ConfirmacaoDialog";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/context/PermissionContext";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { atualizarCompetencia } from "@/lib/atualizarCompetencia";
import type { Coluna } from "@/lib/filtrosDeTabela";

import { botaoPrimario } from "@/app/cenarios/components/CenarioDialog";
import { contestacoesService } from "@/app/contestacoes-de-gastos/services/contestacoesService";

import { AvisoCongelado } from "../../components/AvisoCongelado";
import { lancamentosManuaisService, mensagemDeErro, type LancamentoManual } from "../lancamentos-manuais/services/lancamentosManuaisService";
import { lerAnoMes, moeda } from "../utils/formatacao";
import { ImportarContestacoesDialog } from "./components/ImportarContestacoesDialog";

const COLUNAS: Coluna<LancamentoManual>[] = [
  { chave: "contestacao", rotulo: "Contestação", tipo: "numero", valor: (l) => l.contestacao?.numero ?? null, texto: (l) => (l.contestacao ? `Nº ${l.contestacao.numero}` : "—") },
  { chave: "filial", rotulo: "Filial", tipo: "numero", valor: (l) => l.filial, texto: (l) => String(l.filial) },
  { chave: "conta", rotulo: "Conta", valor: (l) => l.contaResultado?.reduzido },
  { chave: "descricao", rotulo: "Descrição", valor: (l) => l.descricao },
  { chave: "destino", rotulo: "Destino na DRE", valor: (l) => l.linhaDRE?.descricao ?? "sem destino" },
  { chave: "rateio", rotulo: "Rateio", valor: (l) => l.balde },
  { chave: "valor", rotulo: "Valor", tipo: "numero", alinhamento: "direita", valor: (l) => Number(l.valor), texto: (l) => moeda(l.valor) },
  { chave: "acoes", rotulo: "", semFiltro: true },
];

/**
 * A aba Contestações dos Lançamentos (27/10/2026, pedido do Adão): os lançamentos das contestações acatadas que não
 * puderam ser corrigidas no balancete (a competência do movimento estava fechada) — para cada uma, o estorno no centro e
 * na conta de antes e o lançamento no centro e na conta novos. Entram no resultado da competência, como os da
 * Controladoria. "Importar" traz as contestações que esperam; a lixeira desfaz a importação de uma (os dois lançamentos).
 */
export function LancamentosContestacoesContent() {
  const { anoMes } = useParams<{ anoMes: string }>();
  useRegistrarAcessoTela(`/competencias/${anoMes}/lancamentos-contestacoes`);
  const periodo = lerAnoMes(anoMes);
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [importando, setImportando] = useState(false);
  // A contestação cuja importação se exclui (a lixeira), à espera da confirmação no modal.
  const [excluindo, setExcluindo] = useState<NonNullable<LancamentoManual["contestacao"]> | null>(null);
  const lista = useQuery({ queryKey: ["lancamentos-manuais", anoMes, "contestacoes"], queryFn: () => lancamentosManuaisService.listarContestacoes(anoMes), enabled: periodo !== null });
  const pendentes = useQuery({
    queryKey: ["contestacoes", "para-lancamentos", anoMes],
    queryFn: () => contestacoesService.paraLancamentos(anoMes),
    enabled: periodo !== null && hasPermission("lancamentos_manuais.contestacoes:editar"),
  });
  const invalidar = () => {
    atualizarCompetencia(queryClient, anoMes);
    void queryClient.invalidateQueries({ queryKey: ["lancamentos-manuais", anoMes, "contestacoes"] });
    void queryClient.invalidateQueries({ queryKey: ["contestacoes"] });
  };
  const desfazer = useMutation({
    mutationFn: (id: string) => contestacoesService.desfazerImportacao(id),
    onSuccess: () => {
      toast.success("Importação excluída: os lançamentos saíram, e a contestação voltou à lista do Importar.");
      setExcluindo(null);
      invalidar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível desfazer a importação.")),
  });
  const tabela = useTabelaFiltravel(lista.data?.itens, COLUNAS);
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
  const rotuloMes = `${String(periodo.mes).padStart(2, "0")}/${periodo.ano}`;
  const esperando = pendentes.data?.length ?? 0;

  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Lançamentos"
        exportar={<ExportarTabela titulo={`Lançamentos · Contestações · ${rotuloMes}`} colunas={COLUNAS} linhas={tabela.filtradas} />}
        selo={fechada ? <AvisoCongelado anoMes={anoMes} fechada oQue="dos lançamentos" /> : null}
        sobre={
          <p>
            Os lançamentos das contestações de gastos com movimentos que não puderam ser corrigidos no balancete (a competência do movimento estava
            fechada): para cada contestação, o estorno no centro de custo e na conta de antes e o lançamento no centro e na conta novos. Entram no
            resultado da competência, como os da aba Controladoria.
          </p>
        }
        comoUsar={
          <ul>
            <li>
              “Importar” abre a lista das contestações acatadas com movimentos que esperam os lançamentos (de competências fechadas), com os filtros nos
              rótulos e as caixas (“Marcar Todos” marca as filtradas). “Importar Selecionadas” cria, para cada uma, os lançamentos nesta competência: com
              as anteriores e as posteriores, os movimentos somados pela filial, pelo centro e pela conta de antes (a descrição diz quantos e de que
              competências). A contestação com todos os movimentos corrigidos fica validada; as não marcadas continuam na lista, para as competências
              seguintes.
            </li>
            <li>
              Os valores ficam no sinal da DRE: o estorno tira o valor dos movimentos do centro e da conta de antes, e o lançamento novo o põe no centro e
              na conta novos (com a filial do movimento). Uma combinação que nenhuma aba de resultado soma é recusada, com o motivo, e a contestação fica
              na lista.
            </li>
            <li>
              A lixeira exclui a importação de uma contestação, depois da confirmação num modal: os lançamentos dela saem (o estorno e o novo), e ela volta à
              lista do Importar (acatada).
            </li>
            <li>Os lançamentos entram na DRE na próxima apuração. Use os filtros nos rótulos das colunas; o total no rodapé acompanha o filtro.</li>
          </ul>
        }
        acoes={
          !fechada && dados ? (
            <PermissionGuard permission="lancamentos_manuais.contestacoes:editar">
              <Button type="button" className={botaoPrimario} onClick={() => setImportando(true)} title="As contestações acatadas que esperam os lançamentos">
                <Download className="size-4" />
                Importar
                {esperando ? <span className="rounded-sm bg-black px-1.5 text-xs font-bold text-white">{esperando}</span> : null}
              </Button>
            </PermissionGuard>
          ) : null
        }
      />
      <QuadroTabela
        rodape={
          itens.length > 0 ? (
            <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-2.5 text-sm">
              {tabela.ativos ? (
                <button type="button" onClick={tabela.limpar} className="mr-auto text-xs font-medium text-gray-900 underline underline-offset-2">
                  Limpar Filtros
                </button>
              ) : null}
              <span className="text-gray-600">{tabela.total !== tabela.totalGeral ? `Total filtrado (${tabela.total} de ${tabela.totalGeral})` : "Total"}</span>
              <span className="font-bold text-gray-900">
                {moeda(tabela.total !== tabela.totalGeral ? (tabela.filtradas.reduce((s, l) => s + Math.round(Number(l.valor) * 100), 0) / 100).toFixed(2) : (dados?.total ?? "0"))}
              </span>
            </div>
          ) : null
        }
      >
        <DataTable<LancamentoManual>
          data={tabela.visiveis}
          cabecalho={tabela.cabecalho}
          filtrosAtivos={tabela.ativos}
          onLimparFiltros={tabela.limpar}
          isLoading={lista.isPending}
          error={lista.isError ? mensagemDeErro(lista.error, "Erro ao carregar os lançamentos.") : null}
          emptyMessage="Nenhum lançamento de contestação nesta competência"
          emptyHint={esperando ? `${esperando} ${esperando === 1 ? "contestação acatada espera" : "contestações acatadas esperam"} os lançamentos: use “Importar”.` : "As contestações acatadas de competências fechadas entram aqui, pelo Importar."}
          columns={COLUNAS.map((c) => c.rotulo)}
          renderRow={(l) => (
            <tr key={l.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 text-sm">
                <div className="font-medium text-gray-900">Nº {l.contestacao?.numero ?? "—"}</div>
                {l.contestacao ? (
                  <div className="max-w-56 truncate text-xs text-gray-500" title={`${l.contestacao.item ?? ""} · ${l.contestacao.competencia} · ${l.contestacao.solicitante}`}>
                    {l.contestacao.competencia} · {l.contestacao.solicitante}
                  </div>
                ) : null}
              </td>
              <td className="px-4 text-sm">{l.filial}</td>
              <td className="px-4 text-sm">
                <div className="font-medium text-gray-900">{l.contaResultado?.reduzido ?? "—"}</div>
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
                {l.linhaDRE ? (
                  <div className="max-w-56 truncate" title={`${l.linhaDRE.grupo} › ${l.linhaDRE.descricao}`}>
                    {l.linhaDRE.descricao}
                  </div>
                ) : (
                  <span className="text-red-700">sem destino</span>
                )}
              </td>
              <td className="px-4 text-sm">
                <BaldeBadge balde={l.balde} />
              </td>
              <td className="px-4 text-right text-sm whitespace-nowrap text-gray-900">{moeda(l.valor)}</td>
              <td className="px-4 py-0 text-right whitespace-nowrap">
                {!fechada && l.contestacao ? (
                  <PermissionGuard permission="lancamentos_manuais.contestacoes:editar">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir a contestação importada"
                      title="Excluir a contestação importada (os lançamentos dela; ela volta ao Importar)"
                      disabled={desfazer.isPending}
                      onClick={() => setExcluindo(l.contestacao)}
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
      {importando ? (
        <ImportarContestacoesDialog
          anoMes={anoMes}
          rotuloMes={rotuloMes}
          onFechar={() => setImportando(false)}
          onImportadas={() => {
            setImportando(false);
            invalidar();
          }}
        />
      ) : null}
      {excluindo ? (
        <ConfirmacaoDialog
          titulo={`Excluir a Contestação Importada nº ${excluindo.numero}`}
          descricao={`Os lançamentos dela em ${rotuloMes} saem (o estorno e o lançamento novo), e a contestação volta à lista do Importar, acatada, para ser importada de novo. A exclusão fica no log de auditoria.`}
          pendente={desfazer.isPending}
          onConfirmar={() => desfazer.mutate(excluindo.id)}
          onFechar={() => setExcluindo(null)}
        >
          <ul className="min-w-0 space-y-1 overflow-hidden rounded-sm border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            {itens
              .filter((l) => l.contestacao?.id === excluindo.id)
              .map((l) => (
                <li key={l.id} className="flex justify-between gap-4">
                  <span className="min-w-0 truncate text-gray-700" title={l.descricao}>
                    {l.contaResultado?.reduzido ?? "—"} · {l.descricao}
                  </span>
                  <span className="whitespace-nowrap text-gray-900">{moeda(l.valor)}</span>
                </li>
              ))}
          </ul>
        </ConfirmacaoDialog>
      ) : null}
    </div>
  );
}
