"use client";

import type { ReactNode } from "react";

import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { CampoBusca } from "@/components/shared/Filtros";
import { Paginacao } from "@/components/shared/Paginacao";
import { QuadroTabela } from "@/components/shared/QuadroTabela";

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
  /** Sem ele, a quantidade por página é fixa. */
  onPorPaginaChange?: (porPagina: number) => void;
  carregando: boolean;
  /** Com filtro nos rótulos: o total antes dos filtros e o "Limpar filtros". */
  filtros?: { totalGeral: number; ativos: boolean; onLimpar: () => void };
  /** Botões à direita do título, como o de recarga da planilha. */
  acoes?: ReactNode;
  children: ReactNode;
};

/**
 * Moldura comum das telas de cadastro: o cabeçalho único, a busca no topo da
 * tabela e a paginação no rodapé (G6, G7 e G10 do levantamento de layout).
 * Cada tela cuida só das colunas.
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
  onPorPaginaChange,
  carregando,
  filtros,
  acoes,
  children,
}: CadastroShellProps) {
  const contagem = filtros?.ativos && filtros.totalGeral !== total ? `${total.toLocaleString("pt-BR")} de ${filtros.totalGeral.toLocaleString("pt-BR")} registro(s)` : `${total.toLocaleString("pt-BR")} registro(s)`;
  return (
    <div className="space-y-4">
      <CabecalhoDaTela titulo={titulo} sobre={<p>{descricao}</p>} acoes={acoes} />
      <QuadroTabela
        barra={
          <>
            <CampoBusca valor={busca} onMudar={onBuscaChange} placeholder={placeholderBusca} />
            <div className="flex shrink-0 items-center gap-3">
              {filtros?.ativos ? (
                <button type="button" onClick={filtros.onLimpar} className="text-xs font-medium text-gray-900 underline underline-offset-2">
                  Limpar Filtros
                </button>
              ) : null}
              <p className="hidden text-xs text-gray-600 sm:block">{carregando ? "" : contagem}</p>
            </div>
          </>
        }
        rodape={<Paginacao total={total} pagina={pagina} porPagina={porPagina} onPagina={onPaginaChange} onPorPagina={onPorPaginaChange} carregando={carregando} />}
      >
        {children}
      </QuadroTabela>
    </div>
  );
}
