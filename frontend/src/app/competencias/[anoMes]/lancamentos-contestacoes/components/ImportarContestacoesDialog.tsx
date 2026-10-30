"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { SemResultado, useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Coluna } from "@/lib/filtrosDeTabela";
import { plural } from "@/lib/texto";

import { botaoPrimario } from "@/app/cenarios/components/CenarioDialog";
import { contestacoesService, mensagemDeErro, type Contestacao } from "@/app/contestacoes-de-gastos/services/contestacoesService";

import { moeda } from "../../utils/formatacao";

const dataCurta = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : null);
const movimento = (c: Contestacao) => [dataCurta(c.emissao), c.cliForn, c.historico].filter(Boolean).join(" · ") || "—";
/** As competências dos movimentos que esperam os lançamentos: a única ou da primeira à última. */
const competencias = (c: Contestacao) => {
  const cs = c.correcao.competenciasParaLancamentos;
  return cs.length > 1 ? `${cs[0]} a ${cs[cs.length - 1]}` : (cs[0] ?? c.competencia);
};

/**
 * O modal Importar (27/10/2026, a aba Contestações dos Lançamentos): as contestações acatadas com movimentos que não
 * puderam ser corrigidos no balancete (a competência do movimento fechada, ou o movimento fora do balancete reimportado),
 * com os filtros nos rótulos e as caixas (e o Marcar Todos, nas filtradas). Os movimentos das selecionadas viram, somados
 * pela filial, pelo centro e pela conta de antes, o estorno e o lançamento novo desta competência; as outras continuam na
 * lista, para as competências seguintes.
 */
export function ImportarContestacoesDialog({ anoMes, rotuloMes, onFechar, onImportadas }: { anoMes: string; rotuloMes: string; onFechar: () => void; onImportadas: () => void }) {
  const consulta = useQuery({ queryKey: ["contestacoes", "para-lancamentos", anoMes], queryFn: () => contestacoesService.paraLancamentos(anoMes) });
  const [marcadas, setMarcadas] = useState<Set<string>>(() => new Set());
  const colunas = useMemo<Coluna<Contestacao>[]>(
    () => [
      { chave: "marcar", rotulo: "", semFiltro: true },
      { chave: "numero", rotulo: "Nº", tipo: "numero", valor: (c) => c.numero },
      { chave: "competencia", rotulo: "Competência", valor: (c) => c.correcao.competenciasParaLancamentos.join(", "), texto: competencias },
      { chave: "movimento", rotulo: "Movimento", valor: movimento },
      {
        chave: "valor",
        rotulo: "Valor",
        tipo: "numero",
        alinhamento: "direita",
        valor: (c) => Number(c.correcao.valorParaLancamentos),
        texto: (c) => moeda(c.correcao.valorParaLancamentos),
      },
      { chave: "de", rotulo: "De", valor: (c) => [c.centroNovo ? c.centroAntes : null, c.contaNova ? c.contaAntes : null].filter(Boolean).join(" / ") },
      { chave: "para", rotulo: "Para", valor: (c) => [c.centroNovo, c.contaNova].filter(Boolean).join(" / ") },
      { chave: "solicitante", rotulo: "Solicitante", valor: (c) => c.solicitante },
      { chave: "acatadaPor", rotulo: "Acatada Por", valor: (c) => c.respondidaPor ?? c.justificadaPor },
    ],
    [],
  );
  const tabela = useTabelaFiltravel(consulta.data, colunas);
  const filtradas = tabela.filtradas;
  const todas = filtradas.length > 0 && filtradas.every((c) => marcadas.has(c.id));
  const alternar = (id: string) =>
    setMarcadas((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const importar = useMutation({
    mutationFn: () => contestacoesService.importar(anoMes, [...marcadas]),
    onSuccess: (r) => {
      if (r.importadas) toast.success(`${r.importadas} ${plural(r.importadas, "contestação importada", "contestações importadas")} em ${rotuloMes}.`);
      for (const x of r.recusadas) toast.error(`Contestação nº ${x.numero}: ${x.motivo}`, { duration: 12_000 });
      onImportadas();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível importar as contestações.")),
  });
  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent className="flex max-h-[90vh] w-[min(80rem,calc(100%_-_2rem))] max-w-none flex-col overflow-hidden rounded-sm sm:max-w-none">
        <DialogHeader>
          <DialogTitle>Importar Contestações</DialogTitle>
          <DialogDescription>
            As contestações acatadas com movimentos que não puderam ser corrigidos no balancete (a competência do movimento está fechada). Os movimentos das
            marcadas viram lançamentos em {rotuloMes} — somados pela filial, pelo centro de custo e pela conta de antes, o estorno no centro e na conta de
            antes e o lançamento no centro e na conta novos; com rateio, um par por competência, dividido pelos percentuais dela — e a contestação com
            todos os movimentos corrigidos fica validada; as outras continuam na lista, para as competências seguintes.
          </DialogDescription>
        </DialogHeader>
        {consulta.isError ? (
          <p className="text-sm text-red-700">{mensagemDeErro(consulta.error, "Erro ao carregar as contestações.")}</p>
        ) : !consulta.data ? (
          <div className="h-40 animate-pulse rounded-sm bg-gray-100" />
        ) : consulta.data.length === 0 ? (
          <p className="rounded-sm border border-gray-200 bg-white p-4 text-sm text-gray-600">Nenhuma contestação acatada espera os lançamentos.</p>
        ) : (
          <>
            <label className="inline-flex shrink-0 items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                className="accent-black"
                checked={todas}
                onChange={() =>
                  setMarcadas((m) => {
                    const n = new Set(m);
                    for (const c of filtradas) {
                      if (todas) n.delete(c.id);
                      else n.add(c.id);
                    }
                    return n;
                  })
                }
              />
              Marcar Todos{tabela.ativos ? " (os filtrados)" : ""}
              <span className="text-gray-500">
                · {marcadas.size} de {consulta.data.length} {plural(consulta.data.length, "marcada", "marcadas")}
              </span>
            </label>
            <div className="min-h-0 flex-1 overflow-auto rounded-sm border border-gray-200 [--topo-tabela:0px]">
              <table className="tabela-sig w-full border-collapse text-xs">
                {tabela.cabecalho}
                <tbody>
                  {tabela.visiveis.length === 0 ? (
                    <SemResultado colunas={colunas.length} onLimpar={tabela.limpar} />
                  ) : (
                    tabela.visiveis.map((c) => (
                      <tr key={c.id} className={`border-b border-gray-100 align-top ${marcadas.has(c.id) ? "bg-yellow-50" : ""}`} onClick={() => alternar(c.id)}>
                        <td className="px-3 py-1.5">
                          <input type="checkbox" className="accent-black" checked={marcadas.has(c.id)} onChange={() => alternar(c.id)} onClick={(e) => e.stopPropagation()} aria-label={`Marcar a contestação nº ${c.numero}`} />
                        </td>
                        <td className="px-3 py-1.5 font-medium">{c.numero}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{competencias(c)}</td>
                        <td className="px-3 py-1.5">
                          {movimento(c)}
                          {c.correcao.paraLancamentos > 1 ? (
                            <div className="text-gray-500">
                              {c.correcao.paraLancamentos} movimentos (com as {[c.anteriores ? "anteriores" : null, c.posteriores ? "posteriores" : null].filter(Boolean).join(" e ")})
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap">{moeda(c.correcao.valorParaLancamentos)}</td>
                        <td className="px-3 py-1.5">
                          {c.centroNovo ? <div>{c.centroAntes ?? "—"}</div> : null}
                          {c.contaNova ? <div>{c.contaAntes ?? "—"}</div> : null}
                        </td>
                        <td className="px-3 py-1.5 font-medium">
                          {c.centroNovo ? <div>{c.centroNovo}</div> : null}
                          {c.contaNova ? <div>{c.contaNova}</div> : null}
                        </td>
                        <td className="px-3 py-1.5">{c.solicitante}</td>
                        <td className="px-3 py-1.5">{c.respondidaPor ?? c.justificadaPor ?? "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
        <DialogFooter className="shrink-0">
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" className={botaoPrimario} disabled={!marcadas.size || importar.isPending} onClick={() => importar.mutate()}>
            {importar.isPending ? "Importando…" : "Importar Selecionadas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
