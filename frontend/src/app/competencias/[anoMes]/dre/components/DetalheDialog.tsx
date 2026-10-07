"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SemResultado, useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import type { Coluna } from "@/lib/filtrosDeTabela";

import { MemoriaCalculoDialog } from "../../receita-previa/components/MemoriaCalculoDialog";
import type { Natureza } from "../../receita-previa/services/receitaPreviaService";
import { moeda } from "../../utils/formatacao";
import { dreService, mensagemDeErro, UNIDADES, type BlocoDetalhe, type LancamentoDetalhe, type VisaoDetalhe } from "../services/dreService";

type Props = { anoMes: string; linha: string; visao: VisaoDetalhe; onFechar: () => void };

const nomeUnidade = (u?: number) => UNIDADES.find((x) => x.codigo === u)?.nome;
const percentual = (p: string) => `${(Number(p) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%`;
const fatorTexto = (f: string) => (f === "-1" ? "sinal trocado" : `× ${Number(f).toLocaleString("pt-BR", { maximumFractionDigits: 8 })}`);

function Bloco({ b, consolidado, onMemoria }: { b: BlocoDetalhe; consolidado: boolean; onMemoria: (u: number, n: Natureza) => void }) {
  const cabecalho = (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <p className="text-sm font-bold text-gray-900">
          {consolidado && b.unidade ? `${nomeUnidade(b.unidade)} · ` : ""}
          {b.titulo}
        </p>
        {b.tipo !== "PREVIA" ? (
          <p className="text-xs text-gray-500">
            {b.filtro}
            {b.fator ? ` · ${fatorTexto(b.fator)}` : ""}
            {b.percentual ? ` · × ${percentual(b.percentual)}` : ""}
            {` · ${b.lancamentos.length} lançamento(s)`}
          </p>
        ) : null}
      </div>
      <p className="text-sm font-bold tabular-nums">{moeda(b.total)}</p>
    </div>
  );
  if (b.tipo === "PREVIA") {
    return (
      <div className="space-y-2 rounded-sm border border-gray-200 p-3">
        {cabecalho}
        <Button type="button" variant="outline" size="sm" className="rounded-sm" onClick={() => onMemoria(b.unidade, b.natureza as Natureza)}>
          Abrir a memória de cálculo da receita prévia
        </Button>
      </div>
    );
  }
  const multiplica = !!(b.fator || b.percentual);
  return (
    <div className="space-y-2 rounded-sm border border-gray-200 p-3">
      {cabecalho}
      {b.lancamentos.length > 0 ? (
        <TabelaLancamentos lancamentos={b.lancamentos} multiplica={multiplica} />
      ) : (
        <p className="text-xs text-gray-500">Nenhum lançamento.</p>
      )}
    </div>
  );
}

type Lancamento = LancamentoDetalhe;

const centroTexto = (l: Lancamento) => (l.centro ? `${l.centro.codigoRM ?? "sem código"} · ${l.centro.nome}` : null);
const contaTexto = (l: Lancamento) => `${l.conta.reduzido} · ${l.conta.descricao}`;

/** Os lançamentos de um bloco, com filtro e ordem nos rótulos das colunas. */
function TabelaLancamentos({ lancamentos, multiplica }: { lancamentos: Lancamento[]; multiplica: boolean }) {
  const colunas = useMemo<Coluna<Lancamento>[]>(
    () => [
      { chave: "filial", rotulo: "Filial", tipo: "numero", valor: (l) => l.filial },
      { chave: "centro", rotulo: "Centro de Custo", valor: centroTexto },
      { chave: "conta", rotulo: "Conta", valor: contaTexto },
      { chave: "balde", rotulo: "Balde", valor: (l) => l.balde },
      { chave: "valor", rotulo: "Valor", tipo: "numero", alinhamento: "direita", valor: (l) => Number(l.valor), texto: (l) => moeda(l.valor) },
      ...(multiplica
        ? [{ chave: "parcela", rotulo: "Na Linha", tipo: "numero", alinhamento: "direita", valor: (l) => Number(l.parcela), texto: (l) => moeda(l.parcela) } as Coluna<Lancamento>]
        : []),
    ],
    [multiplica],
  );
  const tabela = useTabelaFiltravel(lancamentos, colunas);
  return (
    <div className="max-h-96 overflow-auto">
      <table className="tabela-sig w-full border-collapse text-xs">
        {tabela.cabecalho}
        <tbody>
          {tabela.visiveis.length === 0 ? (
            <SemResultado colunas={colunas.length} onLimpar={tabela.limpar} />
          ) : (
            tabela.visiveis.map((l) => (
              <tr key={l.id} className="border-b border-gray-100 align-top">
                <td className="px-4 py-1.5 tabular-nums">{l.filial}</td>
                <td className="px-4 py-1.5">
                  {l.centro ? (
                    <>
                      <span className="tabular-nums">{l.centro.codigoRM ?? "sem código"}</span>
                      <span className="text-gray-500"> · {l.centro.nome}</span>
                    </>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-1.5">
                  <span className="tabular-nums">{l.conta.reduzido}</span>
                  <span className="text-gray-500"> · {l.conta.descricao}</span>
                  {l.contaAdotada ? (
                    <div className="text-yellow-800">
                      reclassificada para {l.contaAdotada.reduzido} · {l.contaAdotada.descricao}
                    </div>
                  ) : null}
                  {l.descricao ? <div className="text-gray-500">{l.descricao}</div> : null}
                </td>
                <td className="px-4 py-1.5 text-gray-600">{l.balde ?? "—"}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{moeda(l.valor)}</td>
                {multiplica ? <td className="px-4 py-1.5 text-right tabular-nums">{moeda(l.parcela)}</td> : null}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {tabela.total !== tabela.totalGeral ? (
        <p className="px-4 py-1.5 text-right text-xs text-gray-600">
          Total filtrado ({tabela.total} de {tabela.totalGeral}): <span className="font-bold tabular-nums">{moeda(tabela.filtradas.reduce((a, l) => a + Number(l.valor), 0))}</span>
        </p>
      ) : null}
    </div>
  );
}

/** Detalhamento de um valor da DRE até os lançamentos de origem. */
export function DetalheDialog({ anoMes, linha, visao, onFechar }: Props) {
  const [memoria, setMemoria] = useState<{ unidade: number; natureza: Natureza } | null>(null);
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["dre", anoMes, "detalhe", linha, visao],
    queryFn: () => dreService.detalhe(anoMes, linha, visao),
  });
  const fecha = data?.somaOrigens !== null && data?.somaOrigens !== undefined && Math.abs(Number(data.somaOrigens) - Number(data.valor ?? 0)) <= 0.05;

  if (memoria) {
    return <MemoriaCalculoDialog anoMes={anoMes} unidade={memoria.unidade} natureza={memoria.natureza} onFechar={() => setMemoria(null)} />;
  }
  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-sm sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            {data ? `${data.visao} · ${data.linha.descricao}` : "Detalhamento"}
            {data?.valor ? <span className="ml-2 tabular-nums text-gray-600">{moeda(data.valor)}</span> : null}
          </DialogTitle>
          <DialogDescription>{data?.regra ?? "Os lançamentos que formaram o valor, como foram apurados."}</DialogDescription>
        </DialogHeader>
        {isError ? <p className="text-sm text-red-700">{mensagemDeErro(error, "Erro ao carregar o detalhamento.")}</p> : null}
        {isPending ? <div className="h-40 animate-pulse rounded-sm bg-gray-100" /> : null}
        {data ? (
          <div className="space-y-3">
            {data.observacao ? <p className="rounded-sm border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">{data.observacao}</p> : null}
            {data.blocos.map((b, i) => (
              <Bloco key={i} b={b} consolidado={data.visao === "Consolidado"} onMemoria={(u, n) => setMemoria({ unidade: u, natureza: n })} />
            ))}
            {data.somaOrigens !== null ? (
              <div className={`flex items-center gap-2 rounded-sm border p-3 text-sm ${fecha ? "border-green-200 bg-green-50 text-green-800" : "border-yellow-200 bg-yellow-50 text-yellow-800"}`}>
                {fecha ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertTriangle className="size-4 shrink-0" />}
                Soma das origens: {moeda(data.somaOrigens)} · valor da linha: {moeda(data.valor ?? "0")}
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
