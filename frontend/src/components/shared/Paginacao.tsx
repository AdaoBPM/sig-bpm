"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  total: number;
  pagina: number;
  porPagina: number;
  onPagina: (pagina: number) => void;
  /** Sem ele, a quantidade por página é fixa. */
  onPorPagina?: (porPagina: number) => void;
  opcoesPorPagina?: number[];
  carregando?: boolean;
};

const n = (v: number) => v.toLocaleString("pt-BR");

/**
 * A paginação de todas as tabelas, no rodapé (G7 do levantamento de layout):
 * o que está à vista e o total, a página e a quantidade por página.
 */
export function Paginacao({ total, pagina, porPagina, onPagina, onPorPagina, opcoesPorPagina = [25, 50, 100], carregando = false }: Props) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const primeiro = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const ultimo = Math.min(pagina * porPagina, total);
  return (
    <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-gray-600" aria-live="polite">
        {carregando ? " " : total === 0 ? "Nenhum registro" : `Mostrando ${n(primeiro)}–${n(ultimo)} de ${n(total)}`}
      </p>
      <div className="flex items-center gap-3">
        {onPorPagina ? (
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            Por Página
            <select
              value={porPagina}
              onChange={(e) => {
                onPorPagina(Number(e.target.value));
                onPagina(1);
              }}
              className="h-7 rounded-sm border border-gray-300 bg-white px-1.5 text-xs"
            >
              {opcoesPorPagina.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm" onClick={() => onPagina(pagina - 1)} disabled={pagina <= 1 || carregando} aria-label="Página anterior">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-12 text-center text-xs text-gray-600 tabular-nums">
            {pagina} / {paginas}
          </span>
          <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm" onClick={() => onPagina(pagina + 1)} disabled={pagina >= paginas || carregando} aria-label="Próxima página">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
