"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CadastroShellProps = {
  titulo: string;
  descricao: string;
  busca: string;
  onBuscaChange: (valor: string) => void;
  placeholderBusca: string;
  total: number;
  pagina: number;
  porPagina: number;
  onPaginaChange: (pagina: number) => void;
  carregando: boolean;
  children: ReactNode;
};

/**
 * Moldura comum das telas de consulta: título, busca, contagem e paginação.
 *
 * As três telas de cadastro têm exatamente a mesma estrutura e só diferem nas
 * colunas, então a moldura vive aqui e cada tela cuida da sua tabela.
 */
export function CadastroShell({
  titulo,
  descricao,
  busca,
  onBuscaChange,
  placeholderBusca,
  total,
  pagina,
  porPagina,
  onPaginaChange,
  carregando,
  children,
}: CadastroShellProps) {
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const primeiro = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const ultimo = Math.min(pagina * porPagina, total);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
            {titulo}
          </h1>
          <p className="text-sm text-gray-600">{descricao}</p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={busca}
            onChange={(e) => onBuscaChange(e.target.value)}
            placeholder={placeholderBusca}
            className="rounded-sm border-gray-300 pl-9 focus:border-black focus:ring-1 focus:ring-black"
          />
        </div>
      </div>

      <div className="border border-gray-200 bg-white rounded-sm">
        <div className="overflow-x-auto">{children}</div>

        <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-600" aria-live="polite">
            {carregando
              ? "Carregando…"
              : total === 0
                ? "Nenhum registro"
                : `Mostrando ${primeiro}–${ultimo} de ${total} registro(s)`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-sm border border-black text-black hover:bg-gray-100"
              onClick={() => onPaginaChange(pagina - 1)}
              disabled={pagina <= 1 || carregando}
            >
              <ChevronLeft className="size-4" />
              Anterior
            </Button>
            <span className="text-xs text-gray-600 tabular-nums">
              {pagina} / {totalPaginas}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-sm border border-black text-black hover:bg-gray-100"
              onClick={() => onPaginaChange(pagina + 1)}
              disabled={pagina >= totalPaginas || carregando}
            >
              Próxima
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
