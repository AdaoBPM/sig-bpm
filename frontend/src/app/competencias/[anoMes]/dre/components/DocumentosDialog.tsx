"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { Abas } from "@/components/shared/Abas";
import { SemResultado, useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Coluna } from "@/lib/filtrosDeTabela";

import { moeda } from "../../utils/formatacao";
import { dreService, mensagemDeErro, type LancamentoDetalhe, type NotaFiscalDocumento, type RequisicaoDocumento } from "../services/dreService";

const dataCurta = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : null);
const quantidade = (q: string | null) => (q === null ? null : Number(q).toLocaleString("pt-BR", { maximumFractionDigits: 4 }));
const centroTexto = (d: { codigoCentroCusto: string | null; nomeCentroCusto: string | null }) =>
  d.codigoCentroCusto ? `${d.codigoCentroCusto}${d.nomeCentroCusto ? ` · ${d.nomeCentroCusto}` : ""}` : null;
const produtoTexto = (d: { codigoProduto: string | null; descricaoItem: string | null }) => d.descricaoItem ?? d.codigoProduto;

const COLUNAS_REQUISICOES: Coluna<RequisicaoDocumento>[] = [
  { chave: "data", rotulo: "Data da Baixa", tipo: "data", valor: (d) => (d.dataBaixa ? new Date(d.dataBaixa).getTime() : null), texto: (d) => dataCurta(d.dataBaixa) },
  { chave: "id", rotulo: "Requisição", valor: (d) => d.identificador },
  { chave: "tipo", rotulo: "Tipo", valor: (d) => d.nomeTipoMovimento ?? d.tipoMovimento },
  { chave: "filial", rotulo: "Filial", tipo: "numero", valor: (d) => d.filial },
  { chave: "centro", rotulo: "Centro de Custo", valor: centroTexto },
  { chave: "produto", rotulo: "Item", valor: produtoTexto },
  { chave: "qtd", rotulo: "Qtd.", tipo: "numero", alinhamento: "direita", valor: (d) => (d.quantidade === null ? null : Number(d.quantidade)), texto: (d) => quantidade(d.quantidade) },
  { chave: "unit", rotulo: "Valor Unit.", tipo: "numero", alinhamento: "direita", valor: (d) => (d.valorUnitario === null ? null : Number(d.valorUnitario)), texto: (d) => (d.valorUnitario === null ? null : moeda(d.valorUnitario)) },
  { chave: "valor", rotulo: "Valor Total", tipo: "numero", alinhamento: "direita", valor: (d) => Number(d.valorTotal), texto: (d) => moeda(d.valorTotal) },
];

const COLUNAS_NOTAS: Coluna<NotaFiscalDocumento>[] = [
  { chave: "data", rotulo: "Emissão", tipo: "data", valor: (d) => (d.dataEmissao ? new Date(d.dataEmissao).getTime() : null), texto: (d) => dataCurta(d.dataEmissao) },
  { chave: "nf", rotulo: "NF", valor: (d) => d.numero },
  { chave: "fornecedor", rotulo: "Fornecedor", valor: (d) => d.fornecedor },
  { chave: "filial", rotulo: "Filial", tipo: "numero", valor: (d) => d.filial },
  { chave: "centro", rotulo: "Centro de Custo", valor: centroTexto },
  { chave: "produto", rotulo: "Item", valor: produtoTexto },
  { chave: "tipo", rotulo: "Tipo", valor: (d) => d.nomeTipoMovimento ?? d.tipoMovimento },
  { chave: "qtd", rotulo: "Qtd.", tipo: "numero", alinhamento: "direita", valor: (d) => (d.quantidade === null ? null : Number(d.quantidade)), texto: (d) => quantidade(d.quantidade) },
  { chave: "valor", rotulo: "Valor Total", tipo: "numero", alinhamento: "direita", valor: (d) => Number(d.valorTotal), texto: (d) => moeda(d.valorTotal) },
];

/** Uma tabela de documentos, com os filtros nos rótulos e o total do que está à mostra. */
function TabelaDocumentos<T extends { id: string; valorTotal: string }>({ itens, colunas, vazio }: { itens: T[]; colunas: Coluna<T>[]; vazio: string }) {
  const tabela = useTabelaFiltravel(itens, colunas);
  if (itens.length === 0) return <p className="rounded-sm border border-gray-200 bg-white p-4 text-sm text-gray-600">{vazio}</p>;
  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-sm border border-gray-200 [--topo-tabela:0px]">
      <table className="tabela-sig w-full border-collapse text-xs">
        {tabela.cabecalho}
        <tbody>
          {tabela.visiveis.length === 0 ? (
            <SemResultado colunas={colunas.length} onLimpar={tabela.limpar} />
          ) : (
            tabela.visiveis.map((d) => (
              <tr key={d.id} className="border-b border-gray-100 align-top">
                {colunas.map((c) => (
                  <td key={c.chave} className={`px-3 py-1.5 ${c.alinhamento === "direita" ? "text-right whitespace-nowrap" : ""} ${c.chave === "data" ? "whitespace-nowrap" : ""}`}>
                    {(c.texto ? c.texto(d) : c.valor?.(d)) ?? <span className="text-gray-400">—</span>}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {tabela.total !== tabela.totalGeral ? (
        <p className="px-3 py-1.5 text-right text-xs text-gray-600">
          Total filtrado ({tabela.total} de {tabela.totalGeral}): <span className="font-bold">{moeda(tabela.filtradas.reduce((a, d) => a + Number(d.valorTotal), 0))}</span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * As requisições e as notas fiscais de uma conta no mês (11/10/2026), a partir de um lançamento do extrato: das abas
 * Requisições (Lista) e Notas Fiscais (Lista) importadas no mês. Abre recortada no centro de custo e na filial do
 * lançamento, para comparar com o valor dele; a caixa mostra a conta inteira.
 */
export function DocumentosDialog({
  anoMes,
  linha,
  lancamento,
  rotuloMes,
  onVoltar,
}: {
  anoMes: string;
  linha: string;
  lancamento: LancamentoDetalhe;
  rotuloMes?: string;
  onVoltar: () => void;
}) {
  const temCentro = !!lancamento.centro?.codigoRM;
  const [soDoLancamento, setSoDoLancamento] = useState(true);
  const filtro = { linha, conta: lancamento.conta.reduzido, ...(soDoLancamento ? { centro: lancamento.centro?.codigoRM ?? null, filial: lancamento.filial } : {}) };
  const consulta = useQuery({ queryKey: ["dre", anoMes, "documentos", filtro], queryFn: () => dreService.documentos(anoMes, filtro) });
  const [aba, setAba] = useState("requisicoes");
  const d = consulta.data;
  const somaReq = useMemo(() => (d ? d.requisicoes.reduce((s, x) => s + Number(x.valorTotal), 0) : 0), [d]);
  const somaNf = useMemo(() => (d ? d.notas.reduce((s, x) => s + Number(x.valorTotal), 0) : 0), [d]);
  const valorLancamento = Number(lancamento.valor);
  const naoImportadas = d ? [!d.importadas.requisicoes ? "Requisições (Lista)" : null, !d.importadas.notas ? "Notas Fiscais (Lista)" : null].filter(Boolean) : [];

  return (
    <Dialog open onOpenChange={(o) => (!o ? onVoltar() : undefined)}>
      <DialogContent className="flex max-h-[90vh] w-[min(80rem,calc(100%_-_2rem))] max-w-none flex-col overflow-hidden rounded-sm sm:max-w-none">
        <DialogHeader>
          <DialogTitle>
            {/* A conta como veio do cadastro (em <span>, para o título não mudar a caixa dela). */}
            Requisições e Notas Fiscais ·{" "}
            <span>
              {lancamento.conta.reduzido} · {d?.conta.descricao || lancamento.conta.descricao}
            </span>
          </DialogTitle>
          <DialogDescription>
            {rotuloMes ?? anoMes}
            {soDoLancamento ? ` · Filial ${lancamento.filial}${temCentro ? ` · ${lancamento.centro!.codigoRM} · ${lancamento.centro!.nome ?? ""}` : ""}` : " · todas as filiais e centros de custo"}. Os itens das abas Requisições
            (Lista) e Notas Fiscais (Lista) do LISTAS REALIZADO (RESULTADOS) importadas no mês, na conta.
          </DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" className="accent-black" checked={soDoLancamento} onChange={(e) => setSoDoLancamento(e.target.checked)} />
            Só do Centro de Custo e da Filial do Lançamento
          </label>
          {d ? (
            <p className="text-sm text-gray-700">
              Requisições <span className="font-bold text-gray-900">{moeda(somaReq)}</span> · Notas <span className="font-bold text-gray-900">{moeda(somaNf)}</span> ·
              Soma <span className="font-bold text-gray-900">{moeda(somaReq + somaNf)}</span>
              {soDoLancamento ? (
                <>
                  {" "}
                  · Lançamento <span className="font-bold text-gray-900">{moeda(valorLancamento)}</span>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        {d && soDoLancamento && Math.abs(somaReq + somaNf - valorLancamento) > 0.05 ? (
          <p className="shrink-0 text-xs text-gray-600">
            A soma difere do lançamento em {moeda(somaReq + somaNf - valorLancamento)}: o balancete tem também lançamentos que não são requisições nem notas
            (folha, provisões, ajustes, devoluções) e itens lançados em outro mês.
          </p>
        ) : null}
        {naoImportadas.length ? (
          <p className="shrink-0 rounded-sm border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
            {naoImportadas.join(" e ")} {naoImportadas.length > 1 ? "não foram importadas" : "não foi importada"} neste mês: importe o LISTAS REALIZADO (RESULTADOS) em
            Importações.
          </p>
        ) : null}

        {consulta.isError ? (
          <p className="text-sm text-red-700">{mensagemDeErro(consulta.error, "Erro ao carregar as requisições e as notas fiscais.")}</p>
        ) : !d ? (
          <div className="h-40 animate-pulse rounded-sm bg-gray-100" />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="shrink-0">
            <Abas
              rotulo="Documentos da conta"
              ativa={aba}
              onMudar={setAba}
              abas={[
                { chave: "requisicoes", rotulo: "Requisições" },
                { chave: "notas", rotulo: "Notas Fiscais" },
              ]}
            />
            </div>
            {aba === "requisicoes" ? (
              <TabelaDocumentos key="r" itens={d.requisicoes} colunas={COLUNAS_REQUISICOES} vazio="Nenhuma requisição da conta no mês." />
            ) : (
              <TabelaDocumentos key="n" itens={d.notas} colunas={COLUNAS_NOTAS} vazio="Nenhuma nota fiscal da conta no mês." />
            )}
          </div>
        )}

        <DialogFooter className="shrink-0">
          <Button type="button" variant="outline" className="rounded-sm" onClick={onVoltar}>
            <ArrowLeft className="size-4" />
            Voltar ao Extrato
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
