"use client";

import { useQuery } from "@tanstack/react-query";

import { competenciasService } from "@/app/competencias/services/competenciasService";
import { SeletorFiltro } from "@/components/shared/Filtros";

import { MESES } from "../../competencias/[anoMes]/utils/formatacao";

/**
 * O exercício e o último mês do relatório (como o mês escolhido no topo das
 * abas da planilha). Só os meses apurados; sem escolha, o último apurado.
 */
export function useExercicios() {
  const competencias = useQuery({ queryKey: ["competencias", "todos"], queryFn: () => competenciasService.listar() });
  const apuradas = (competencias.data?.itens ?? []).filter((c) => c.apuradaEm !== null);
  const anos = [...new Set(apuradas.map((c) => c.ano))].sort((a, b) => b - a);
  return { carregando: competencias.isPending, anos, mesesDe: (ano: number) => apuradas.filter((c) => c.ano === ano).map((c) => c.mes).sort((a, b) => a - b) };
}

export function SeletorPeriodo({
  ano,
  ate,
  anos,
  meses,
  onAno,
  onAte,
}: {
  ano: number;
  ate: number | undefined;
  anos: number[];
  meses: number[];
  onAno: (ano: number) => void;
  onAte: (mes: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <SeletorFiltro
        rotulo="Exercício"
        valor={String(ano)}
        onMudar={(v) => v && onAno(Number(v))}
        todos={null}
        largura="w-32"
        opcoes={anos.map((a) => ({ valor: String(a), rotulo: String(a) }))}
      />
      <SeletorFiltro
        rotulo="Até o Mês"
        valor={ate ? String(ate) : undefined}
        onMudar={(v) => v && onAte(Number(v))}
        todos={null}
        largura="w-40"
        opcoes={meses.map((m) => ({ valor: String(m), rotulo: MESES[m - 1] }))}
      />
    </div>
  );
}
