"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { DataTable } from "@/components/shared/DataTable";
import { useDebounce } from "@/hooks/useDebounce";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { BaldeBadge } from "@/components/shared/BaldeBadge";
import { CadastroShell } from "../components/CadastroShell";
import { useEdicaoCadastro } from "../components/EdicaoCadastro";
import { RecarregarPlanilha } from "../components/RecarregarPlanilha";
import {
  cadastrosService,
  type CentroCusto,
} from "../services/cadastrosService";

const POR_PAGINA_INICIAL = 50;

export function CentrosCustoContent() {
  useRegistrarAcessoTela("/cadastros/centros-custo");

  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(POR_PAGINA_INICIAL);
  const buscaDebounced = useDebounce(busca, 300);
  const edicao = useEdicaoCadastro("centros-custo");

  const { data, isPending, isError } = useQuery({
    queryKey: ["cadastros", "centros-custo", buscaDebounced, pagina, porPagina],
    queryFn: () =>
      cadastrosService.centrosCusto({
        busca: buscaDebounced || undefined,
        pagina,
        porPagina: porPagina,
      }),
    placeholderData: keepPreviousData,
  });

  function aoBuscar(valor: string) {
    setBusca(valor);
    setPagina(1);
  }

  return (
    <CadastroShell
      titulo="Centros de Custo"
      descricao="Carregados da planilha UNIDADES E CENTROS DE CUSTO e editáveis aqui. O departamento é o do cadastro; a sigla vem dele."
      acoes={
        <div className="flex items-center gap-2">
          <RecarregarPlanilha />
          {edicao.botaoNovo}
        </div>
      }
      busca={busca}
      onBuscaChange={aoBuscar}
      placeholderBusca="Código, nome ou departamento…"
      total={data?.total ?? 0}
      pagina={pagina}
      porPagina={porPagina}
      onPorPaginaChange={setPorPagina}
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
          ...edicao.colunaEditar,
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
            <td className="px-4 py-3 text-sm text-gray-900">
              <div className="max-w-56 truncate" title={item.nomeRM}>
                {item.nomeRM}
              </div>
            </td>
            <td className="px-4 py-3 text-sm text-gray-600">
              <div className="max-w-48 truncate" title={item.nomeControladoria ?? undefined}>
                {item.nomeControladoria ?? "—"}
              </div>
            </td>
            <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-600">
              {item.departamento ?? "—"}
              {/* A sigla só quando o nome não a traz ("DESPESAS ADMINISTRATIVAS (DA)" já traz). */}
              {item.departamentoSigla && !item.departamento?.includes(`(${item.departamentoSigla})`) ? (
                <span className="ml-1 text-xs text-gray-400">({item.departamentoSigla})</span>
              ) : null}
            </td>
            <td className="px-4 py-3 text-sm text-gray-600">
              {item.atribuicao ?? "—"}
            </td>
            <td className="px-4 py-3 text-sm">
              <BaldeBadge balde={item.balde} />
            </td>
            {edicao.pode ? <td className="px-2 py-3">{edicao.botaoEditar(item.id)}</td> : null}
          </tr>
        )}
      />
      {edicao.dialogo}
    </CadastroShell>
  );
}
