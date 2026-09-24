"use client";

import type { ReactNode } from "react";

type DataTableProps<T> = {
  data: T[];
  isLoading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  renderRow: (item: T) => ReactNode;
  columns: string[];
};

export function DataTable<T>({
  data,
  isLoading = false,
  error = null,
  emptyMessage = "Nenhum item encontrado",
  renderRow,
  columns,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-sm bg-gray-100" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-sm border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm font-medium text-gray-900">{emptyMessage}</p>
        <p className="mt-1 text-sm text-gray-600">
          Crie o primeiro item para começar.
        </p>
      </div>
    );
  }

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50">
          {columns.map((column) => (
            <th
              key={column}
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
