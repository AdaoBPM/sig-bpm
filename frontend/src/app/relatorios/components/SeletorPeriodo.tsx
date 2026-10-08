"use client";

import { useQuery } from "@tanstack/react-query";

import { competenciasService } from "@/app/competencias/services/competenciasService";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

/** Um seletor com o rótulo ao lado, compacto para a linha do título da tela. */
function Seletor({ rotulo, valor, opcoes, onMudar, largura }: { rotulo: string; valor: string; opcoes: Array<{ valor: string; rotulo: string }>; onMudar: (v: string) => void; largura: string }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-xs font-medium whitespace-nowrap text-gray-600">{rotulo}</span>
      <Select value={valor} onValueChange={(v) => v !== null && onMudar(String(v))}>
        <SelectTrigger className={`${largura} rounded-sm bg-white`} aria-label={rotulo}>
          <SelectValue>{(v: string | null) => opcoes.find((o) => o.valor === v)?.rotulo ?? v}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {opcoes.map((o) => (
            <SelectItem key={o.valor} value={o.valor}>
              {o.rotulo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

/** O exercício e o mês até onde ver, à direita da linha do título (Resultados e Indicadores). */
export function SeletorPeriodo({
  ano,
  ate,
  anos,
  meses,
  onAno,
  onAte,
}: {
  ano: number;
  ate: number;
  anos: number[];
  meses: number[];
  onAno: (ano: number) => void;
  onAte: (mes: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Seletor rotulo="Exercício" valor={String(ano)} onMudar={(v) => onAno(Number(v))} largura="w-28" opcoes={anos.map((a) => ({ valor: String(a), rotulo: String(a) }))} />
      <Seletor rotulo="Até o Mês" valor={String(ate)} onMudar={(v) => onAte(Number(v))} largura="w-36" opcoes={meses.map((m) => ({ valor: String(m), rotulo: MESES[m - 1] }))} />
    </div>
  );
}
