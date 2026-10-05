"use client";

import type { ReactNode } from "react";

import { Carregando, ErroCarga, Vazio } from "./Estados";

type DataTableProps<T> = {
  data: T[];
  isLoading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  /** Texto de apoio do estado vazio. Telas de consulta não pedem "crie o
   *  primeiro item" — ali o vazio costuma ser resultado de uma busca. */
  emptyHint?: string;
  renderRow: (item: T) => ReactNode;
  columns: string[];
};

export function DataTable<T>({
  data,
  isLoading = false,
  error = null,
  emptyMessage = "Nenhum item encontrado",
  emptyHint = "Crie o primeiro item para começar.",
  renderRow,
  columns,
}: DataTableProps<T>) {
  // Os estados padrão (G12 do levantamento de layout).
  if (isLoading) return <Carregando />;
  if (error) return <ErroCarga mensagem={error} />;
  if (data.length === 0) return <Vazio titulo={emptyMessage} dica={emptyHint} />;

  return (
    <table className="tabela-sig w-full border-collapse">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50">
          {columns.map((column, i) => (
            <th
              key={`${i}-${column}`}
              className="px-4 py-3 text-left text-xs font-bold tracking-wide text-gray-600 uppercase"
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{data.map((item) => renderRow(item))}</tbody>
    </table>
  );
}
