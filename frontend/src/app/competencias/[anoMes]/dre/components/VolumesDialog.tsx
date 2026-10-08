"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Carregando } from "@/components/shared/Estados";
import { SemResultado, useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import type { Coluna } from "@/lib/filtrosDeTabela";

import { inteiro } from "../../utils/formatacao";
import { dreService, mensagemDeErro, type LinhaVolume } from "../services/dreService";

type Props = {
  anoMes: string;
  /** Código da linha de volume da DRE (ex.: P.PRODUCAO_DO_PRE_FABRICADO_M). */
  linha: string;
  /** Sem unidade, o consolidado. */
  unidade?: number;
  /** "Consolidado", "Matriz"… para o título. */
  nomeVisao: string;
  /** O mês no título ("AGO/26"), quando a tela mostra vários meses (Resultados). */
  rotuloMes?: string;
  /** O valor apurado da linha, para avisar quando as listas mudaram depois da apuração. */
  valorApurado: string | null;
  onFechar: () => void;
};

const quantidade = (v: number | null, medida: string | null) =>
  v === null
    ? "—"
    : v.toLocaleString("pt-BR", medida === "d" || medida === "und" ? { maximumFractionDigits: 2 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * As listas operacionais que formam uma linha de volume da DRE (Produção,
 * Pistas, Metalurgia, Expedição, Montagem, Acompanhamento), somadas por obra,
 * pela mesma regra da aba Totais que a apuração usa.
 */
export function VolumesDialog({ anoMes, linha, unidade, nomeVisao, valorApurado, onFechar, rotuloMes }: Props) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["dre", anoMes, "volumes", linha, unidade ?? "consolidado"],
    queryFn: () => dreService.volumes(anoMes, linha, unidade),
  });
  const medida = data?.medida ?? null;
  const difere = data && valorApurado !== null && Math.abs(Number(data.total) - Number(valorApurado)) >= 0.005;

  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      {/* Posição em pixels inteiros e área de rolagem em camada própria, como os modais da Receita Prévia (a tela não pisca ao rolar). */}
      <DialogContent className="top-8 left-[round(down,calc((100%_-_min(72rem,calc(100%_-_2rem)))_/_2),1px)] flex max-h-[calc(100vh-4rem)] w-[min(72rem,calc(100%_-_2rem))] max-w-none translate-x-0 translate-y-0 flex-col gap-3 overflow-hidden rounded-sm sm:max-w-none">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {nomeVisao} · {data?.linha ?? "Volume"}
            {rotuloMes ? ` · ${rotuloMes}` : ""}
          </DialogTitle>
          <DialogDescription>
            {data ? `${inteiro(data.linhas.reduce((n, l) => n + l.registros, 0))} registro(s) das listas, ` : ""}somados por obra, pela regra da aba Totais
            {data && data.destinos.length > 0 ? ` (${data.destinos.join("; ")})` : ""}.
          </DialogDescription>
        </DialogHeader>
        {difere ? (
          <p className="shrink-0 rounded-sm border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
            As listas mudaram depois da apuração: somam {quantidade(Number(data.total), medida)}, e a DRE apurou {quantidade(Number(valorApurado), medida)}.
            Reapure a competência para atualizar a DRE.
          </p>
        ) : null}
        {isError ? <p className="text-sm text-red-700">{mensagemDeErro(error, "Erro ao carregar as listas.")}</p> : null}
        {isPending ? (
          <Carregando linhas={4} />
        ) : data && data.linhas.length > 0 ? (
          <Tabela linhas={data.linhas} medida={medida} />
        ) : data ? (
          <p className="text-sm text-gray-600">Nenhum registro nas listas para esta linha.</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Tabela({ linhas, medida }: { linhas: LinhaVolume[]; medida: string | null }) {
  const colunas = useMemo(() => {
    const algum = (f: (l: LinhaVolume) => unknown) => linhas.some((l) => f(l) !== null && f(l) !== undefined && f(l) !== "");
    const cs: Coluna<LinhaVolume>[] = [
      // A obra fica com a largura que sobra; as demais, na largura do conteúdo.
      { chave: "obra", rotulo: "Obra", classe: "w-full min-w-48", valor: (l) => l.obra, texto: (l) => (l.obra ? [l.obra, l.obraNome].filter(Boolean).join(" · ") : "sem obra") },
    ];
    if (new Set(linhas.map((l) => l.destino)).size > 1) cs.push({ chave: "destino", rotulo: "Destino", classe: "w-px", valor: (l) => l.destino });
    if (algum((l) => l.linha)) cs.push({ chave: "linha", rotulo: "Linha", classe: "w-px", valor: (l) => l.linha });
    cs.push({
      chave: "quantidade",
      rotulo: medida ? `Quantidade (${medida})` : "Quantidade",
      tipo: "numero",
      alinhamento: "direita",
      classe: "w-px",
      valor: (l) => Number(l.quantidade),
      texto: (l) => quantidade(Number(l.quantidade), medida),
    });
    cs.push({ chave: "registros", rotulo: "Registros", tipo: "numero", alinhamento: "direita", classe: "w-px", valor: (l) => l.registros, texto: (l) => inteiro(l.registros) });
    return cs;
  }, [linhas, medida]);
  const tabela = useTabelaFiltravel(linhas, colunas);
  const primeiraSomada = colunas.findIndex((c) => c.chave === "quantidade");
  const soma = (c: Coluna<LinhaVolume>) => tabela.filtradas.reduce((a, l) => a + (Number(c.valor?.(l)) || 0), 0);

  return (
    // Só esta área rola; os rótulos da tabela ficam presos no topo dela.
    <div className="min-h-0 flex-1 overflow-auto will-change-transform">
      <table className="tabela-sig w-full border-collapse text-sm">
        {tabela.cabecalho}
        <tbody>
          {tabela.visiveis.length === 0 ? (
            <SemResultado colunas={colunas.length} onLimpar={tabela.limpar} />
          ) : (
            tabela.visiveis.map((l) => (
              <tr key={`${l.obra}|${l.destino}|${l.linha}`} className="border-b border-gray-100 align-top">
                {colunas.map((c) => (
                  <td key={c.chave} className={`px-3 py-2 ${c.alinhamento === "direita" ? "text-right whitespace-nowrap" : "whitespace-nowrap"}`}>
                    {c.chave === "obra" ? (
                      l.obra ? (
                        <div title={l.obraNome ?? undefined}>
                          <span className="font-medium text-gray-900">{l.obra}</span>
                          {/* O nome não alarga a coluna: ocupa a largura que ela tiver e corta o resto. */}
                          {l.obraNome ? (
                            <div className="relative h-4">
                              <div className="absolute inset-x-0 truncate text-xs text-gray-500">{l.obraNome}</div>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-gray-400">sem obra</span>
                      )
                    ) : (
                      <span className="text-gray-700">{c.texto?.(l) ?? String(c.valor?.(l) ?? "—")}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {tabela.visiveis.length > 1 ? (
          <tfoot>
            <tr className="border-t border-gray-300 bg-gray-50 font-bold text-gray-900">
              <td className="px-3 py-2" colSpan={primeiraSomada}>
                {tabela.total !== tabela.totalGeral ? `Total filtrado (${tabela.total} de ${tabela.totalGeral})` : "Total"}
              </td>
              {colunas.slice(primeiraSomada).map((c) => (
                <td key={c.chave} className="px-3 py-2 text-right whitespace-nowrap">
                  {c.chave === "quantidade" ? quantidade(soma(c), medida) : inteiro(soma(c))}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
