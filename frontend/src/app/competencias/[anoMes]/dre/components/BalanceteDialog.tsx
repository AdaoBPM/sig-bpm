"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { SemResultado, useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Coluna } from "@/lib/filtrosDeTabela";

import { moeda } from "../../utils/formatacao";
import { dreService, mensagemDeErro, type LancamentoDetalhe, type MovimentoDoBalancete, type VisaoDetalhe } from "../services/dreService";
import { ExportarExtrato } from "./ExportarExtrato";

const dataCurta = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : null);
const centroTexto = (d: MovimentoDoBalancete) => (d.codigoCentroCusto ? `${d.codigoCentroCusto}${d.nomeCentroCusto ? ` · ${d.nomeCentroCusto}` : ""}` : null);

const COLUNAS: Coluna<MovimentoDoBalancete>[] = [
  { chave: "emissao", rotulo: "Emissão", tipo: "data", valor: (d) => (d.emissao ? new Date(d.emissao).getTime() : null), texto: (d) => dataCurta(d.emissao) },
  { chave: "cliForn", rotulo: "Cliente/Fornecedor", valor: (d) => d.cliForn },
  { chave: "historico", rotulo: "Histórico", valor: (d) => d.historico },
  { chave: "filial", rotulo: "Filial", tipo: "numero", valor: (d) => d.filial },
  { chave: "centro", rotulo: "Centro de Custo", valor: centroTexto },
  { chave: "valor", rotulo: "Valor", tipo: "numero", alinhamento: "direita", valor: (d) => Number(d.valor), texto: (d) => moeda(d.valor) },
];

/**
 * O balancete de uma conta no mês (15/10/2026; antes, o modal Requisições e Notas Fiscais, com as abas Requisições (Lista)
 * e Notas Fiscais (Lista), que saíram do LISTAS REALIZADO (RESULTADOS)), a partir de um lançamento do extrato: os
 * movimentos do balancete detalhado — a emissão, o cliente ou fornecedor e o histórico de cada um. Abre recortado no
 * centro de custo e na filial do lançamento, para comparar com o valor dele; a caixa mostra a conta inteira. A conta é
 * a do balancete (antes da reclassificação).
 */
export function BalanceteDialog({
  anoMes,
  linha,
  visao,
  lancamento,
  rotuloMes,
  onVoltar,
}: {
  anoMes: string;
  linha: string;
  /** A visão do extrato (o Exportar traz os lançamentos da conta nela). */
  visao: VisaoDetalhe;
  lancamento: LancamentoDetalhe;
  rotuloMes?: string;
  onVoltar: () => void;
}) {
  const temCentro = !!lancamento.centro?.codigoRM;
  const [soDoLancamento, setSoDoLancamento] = useState(true);
  const filtro = { linha, conta: lancamento.conta.reduzido, ...(soDoLancamento ? { centro: lancamento.centro?.codigoRM ?? null, filial: lancamento.filial } : {}) };
  const consulta = useQuery({ queryKey: ["dre", anoMes, "balancete", filtro], queryFn: () => dreService.balancete(anoMes, filtro) });
  const d = consulta.data;
  const tabela = useTabelaFiltravel(d?.linhas, COLUNAS);
  const soma = useMemo(() => (d ? d.linhas.reduce((s, x) => s + Number(x.valor), 0) : 0), [d]);

  return (
    <Dialog open onOpenChange={(o) => (!o ? onVoltar() : undefined)}>
      <DialogContent className="flex max-h-[90vh] w-[min(80rem,calc(100%_-_2rem))] max-w-none flex-col overflow-hidden rounded-sm sm:max-w-none">
        <DialogHeader>
          <DialogTitle>
            {/* A conta como veio do cadastro (em <span>, para o título não mudar a caixa dela). */}
            Balancete ·{" "}
            <span>
              {lancamento.conta.reduzido} · {d?.conta.descricao || lancamento.conta.descricao}
            </span>
          </DialogTitle>
          <DialogDescription>
            {rotuloMes ?? anoMes}
            {soDoLancamento ? ` · Filial ${lancamento.filial}${temCentro ? ` · ${lancamento.centro!.codigoRM} · ${lancamento.centro!.nome ?? ""}` : ""}` : " · todas as filiais e centros de custo"}. Os
            movimentos da conta no balancete do mês (aba Balancete (Lista) do LISTAS REALIZADO (RESULTADOS)): a emissão, o cliente ou fornecedor e o histórico de
            cada um.
            {lancamento.contaAdotada ? ` Na DRE, a conta é a ${lancamento.contaAdotada.reduzido} (reclassificada).` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" className="accent-black" checked={soDoLancamento} onChange={(e) => setSoDoLancamento(e.target.checked)} />
            Só do Centro de Custo e da Filial do Lançamento
          </label>
          {d ? (
            <p className="text-sm text-gray-700">
              {d.linhas.length.toLocaleString("pt-BR")} {d.linhas.length === 1 ? "movimento" : "movimentos"} · Soma <span className="font-bold text-gray-900">{moeda(soma)}</span>
              {soDoLancamento ? (
                <>
                  {" "}
                  · Lançamento <span className="font-bold text-gray-900">{moeda(Number(lancamento.valor))}</span>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        {d && !d.detalhado ? (
          <p className="shrink-0 rounded-sm border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
            O balancete deste mês foi importado sem o detalhe dos movimentos (as colunas CLI_FORN, EMISSAO e HISTORICO): cada linha é a soma da filial, do centro de
            custo e da conta. Importe o LISTAS REALIZADO (RESULTADOS) atualizado em Importações.
          </p>
        ) : null}

        {consulta.isError ? (
          <p className="text-sm text-red-700">{mensagemDeErro(consulta.error, "Erro ao carregar o balancete da conta.")}</p>
        ) : !d ? (
          <div className="h-40 animate-pulse rounded-sm bg-gray-100" />
        ) : d.linhas.length === 0 ? (
          <p className="rounded-sm border border-gray-200 bg-white p-4 text-sm text-gray-600">Nenhum movimento da conta no mês.</p>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto rounded-sm border border-gray-200 [--topo-tabela:0px]">
            <table className="tabela-sig w-full border-collapse text-xs">
              {tabela.cabecalho}
              <tbody>
                {tabela.visiveis.length === 0 ? (
                  <SemResultado colunas={COLUNAS.length} onLimpar={tabela.limpar} />
                ) : (
                  tabela.visiveis.map((m) => (
                    <tr key={m.id} className="border-b border-gray-100 align-top">
                      {COLUNAS.map((c) => (
                        <td key={c.chave} className={`px-3 py-1.5 ${c.alinhamento === "direita" || c.chave === "emissao" ? "whitespace-nowrap" : ""} ${c.alinhamento === "direita" ? "text-right" : ""}`}>
                          {(c.texto ? c.texto(m) : c.valor?.(m)) ?? <span className="text-gray-400">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {tabela.total !== tabela.totalGeral ? (
              <p className="px-3 py-1.5 text-right text-xs text-gray-600">
                Total filtrado ({tabela.total} de {tabela.totalGeral}): <span className="font-bold">{moeda(tabela.filtradas.reduce((a, m) => a + Number(m.valor), 0))}</span>
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter className="shrink-0 sm:justify-between">
          <Button type="button" variant="outline" className="rounded-sm" onClick={onVoltar}>
            <ArrowLeft className="size-4" />
            Voltar ao Extrato
          </Button>
          {/* O balancete da conta em Excel (24/10/2026): o lançamento numa aba e os movimentos, no recorte da caixa, em outra. */}
          <ExportarExtrato anoMes={anoMes} linha={linha} visao={visao} recorte={{ conta: lancamento.conta.reduzido, ...(soDoLancamento ? { centro: lancamento.centro?.codigoRM ?? null, filial: lancamento.filial } : {}) }} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
