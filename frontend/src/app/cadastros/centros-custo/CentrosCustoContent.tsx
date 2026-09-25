"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { DataTable } from "@/components/shared/DataTable";
import { useDebounce } from "@/hooks/useDebounce";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { BaldeBadge } from "@/components/shared/BaldeBadge";
import { CadastroShell } from "../components/CadastroShell";
import {
  cadastrosService,
  type CentroCusto,
} from "../services/cadastrosService";

const POR_PAGINA = 50;

export function CentrosCustoContent() {
  useRegistrarAcessoTela("/cadastros/centros-custo");

  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const buscaDebounced = useDebounce(busca, 300);

  const { data, isPending, isError } = useQuery({
    queryKey: ["cadastros", "centros-custo", buscaDebounced, pagina],
    queryFn: () =>
      cadastrosService.centrosCusto({
        busca: buscaDebounced || undefined,
        pagina,
        porPagina: POR_PAGINA,
      }),
    placeholderData: keepPreviousData,
  });

  function aoBuscar(valor: string) {
    setBusca(valor);
    setPagina(1);
  }

  return (
    <CadastroShell
      titulo="Centros de custo"
      descricao="Conferência da carga inicial. Somente leitura."
      busca={busca}
      onBuscaChange={aoBuscar}
      placeholderBusca="Código, nome ou departamento…"
      total={data?.total ?? 0}
      pagina={pagina}
      porPagina={POR_PAGINA}
      onPaginaChange={setPagina}
      carregando={isPending}
    >
      <DataTable<CentroCusto>
        data={data?.itens ?? []}
        isLoading={isPending}
        error={isError ? "Erro ao carregar os centros de custo." : null}
        emptyMessage="Nenhum centro de custo encontrado"
        emptyHint="Ajuste a busca para ver outros registros."
        columns={[
          "Código RM",
          "Nome",
          "Controladoria",
          "Departamento",
          "Atribuição",
          "Balde",
        ]}
        renderRow={(item) => (
          <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
            <td className="px-4 py-3 text-sm font-medium text-gray-900 tabular-nums">
              {item.codigoRM ?? (
                <span
                  className="text-gray-400"
                  title="Centro mantido só pela controladoria, sem correspondente no ERP"
                >
                  sem código
                </span>
              )}
            </td>
            <td className="px-4 py-3 text-sm text-gray-900">{item.nomeRM}</td>
            <td className="px-4 py-3 text-sm text-gray-600">
              {item.nomeControladoria ?? "—"}
            </td>
            <td className="px-4 py-3 text-sm text-gray-600">
              {item.departamento ?? "—"}
              {item.departamentoSigla ? (
                <span className="ml-1 text-xs text-gray-400">
                  ({item.departamentoSigla})
                </span>
              ) : null}
            </td>
            <td className="px-4 py-3 text-sm text-gray-600">
              {item.atribuicao ?? "—"}
            </td>
            <td className="px-4 py-3 text-sm">
              <BaldeBadge balde={item.balde} />
            </td>
          </tr>
        )}
      />
    </CadastroShell>
  );
}
