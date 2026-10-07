"use client";

import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { DataTable } from "@/components/shared/DataTable";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import type { Coluna } from "@/lib/filtrosDeTabela";

import { BaldeBadge } from "@/components/shared/BaldeBadge";
import { CadastroShell } from "../components/CadastroShell";
import { useEdicaoCadastro } from "../components/EdicaoCadastro";
import { RecarregarPlanilha } from "../components/RecarregarPlanilha";
import {
  cadastrosService,
  type CentroCusto,
} from "../services/cadastrosService";

const POR_PAGINA_INICIAL = 50;
/** O cadastro inteiro vem de uma vez: o filtro e a ordem das colunas valem para todos os centros. */
const TODOS = 5000;

const COLUNAS: Coluna<CentroCusto>[] = [
  { chave: "codigo", rotulo: "Código RM", valor: (c) => c.codigoRM },
  { chave: "nome", rotulo: "Nome", valor: (c) => c.nomeRM },
  { chave: "controladoria", rotulo: "Controladoria", valor: (c) => c.nomeControladoria },
  { chave: "departamento", rotulo: "Departamento", valor: (c) => c.departamento },
  { chave: "atribuicao", rotulo: "Atribuição", valor: (c) => c.atribuicao },
  { chave: "balde", rotulo: "Balde", valor: (c) => c.balde },
];
const EDITAR: Coluna<CentroCusto> = { chave: "editar", rotulo: "", semFiltro: true };

export function CentrosCustoContent() {
  useRegistrarAcessoTela("/cadastros/centros-custo");

  const edicao = useEdicaoCadastro("centros-custo");

  const { data, isPending, isError } = useQuery({
    queryKey: ["cadastros", "centros-custo", TODOS],
    queryFn: () => cadastrosService.centrosCusto({ pagina: 1, porPagina: TODOS }),
    placeholderData: keepPreviousData,
  });
  const colunas = useMemo(() => (edicao.pode ? [...COLUNAS, EDITAR] : COLUNAS), [edicao.pode]);
  const tabela = useTabelaFiltravel(data?.itens, colunas, { porPaginaInicial: POR_PAGINA_INICIAL });

  return (
    <CadastroShell
      titulo="Centros de Custo"
      comoUsar={
        <ul>
          <li>Use os filtros nos rótulos das colunas.</li>
          <li>Use “Novo” para incluir; o lápis edita, e a exclusão fica dentro da edição.</li>
          <li>Ao gravar, as competências ainda não apuradas são reclassificadas; as apuradas só mudam se forem reapuradas.</li>
          <li>“Recarregar da Planilha” mostra o que muda em relação à planilha UNIDADES E CENTROS DE CUSTO antes de gravar.</li>
        </ul>
      }
      descricao="Carregados da planilha UNIDADES E CENTROS DE CUSTO e editáveis aqui. O departamento é o do cadastro; a sigla vem dele."
      acoes={
        <div className="flex items-center gap-2">
          <RecarregarPlanilha />
          {edicao.botaoNovo}
        </div>
      }
      total={tabela.total}
      pagina={tabela.pagina}
      porPagina={tabela.porPagina}
      onPorPaginaChange={tabela.setPorPagina}
      onPaginaChange={tabela.setPagina}
      carregando={isPending}
      filtros={{ totalGeral: tabela.totalGeral, ativos: tabela.ativos, onLimpar: tabela.limpar }}
    >
      <DataTable<CentroCusto>
        data={tabela.visiveis}
        cabecalho={tabela.cabecalho}
        filtrosAtivos={tabela.ativos}
        onLimparFiltros={tabela.limpar}
        isLoading={isPending}
        error={isError ? "Erro ao carregar os centros de custo." : null}
        emptyMessage="Nenhum centro de custo encontrado"
        emptyHint="Ajuste os filtros para ver outros registros."
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
            <td className="px-4 py-3 text-sm font-medium text-gray-900">
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
            <td className="px-4 py-3 text-sm text-gray-600">
              <div className="max-w-64 truncate" title={item.departamento ?? undefined}>
              {item.departamento ?? "—"}
              {/* A sigla só quando o nome não a traz ("DESPESAS ADMINISTRATIVAS (DA)" já traz). */}
              {item.departamentoSigla && !item.departamento?.includes(`(${item.departamentoSigla})`) ? (
                <span className="ml-1 text-xs text-gray-400">({item.departamentoSigla})</span>
              ) : null}
              </div>
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
