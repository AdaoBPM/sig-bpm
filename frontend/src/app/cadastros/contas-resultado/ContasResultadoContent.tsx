"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { DataTable } from "@/components/shared/DataTable";
import { useDebounce } from "@/hooks/useDebounce";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import type { Coluna } from "@/lib/filtrosDeTabela";

import { BaldeBadge } from "@/components/shared/BaldeBadge";
import { CadastroShell } from "../components/CadastroShell";
import { useEdicaoCadastro } from "../components/EdicaoCadastro";
import { RecarregarPlanilha } from "../components/RecarregarPlanilha";
import {
  cadastrosService,
  type ContaResultado,
} from "../services/cadastrosService";

const POR_PAGINA_INICIAL = 50;
/** O cadastro inteiro vem de uma vez: o filtro e a ordem das colunas valem para todas as contas. */
const TODOS = 5000;

const COLUNAS: Coluna<ContaResultado>[] = [
  { chave: "reduzido", rotulo: "Reduzido", valor: (c) => c.reduzido },
  { chave: "conta", rotulo: "Conta", valor: (c) => c.conta },
  { chave: "descricao", rotulo: "Descrição", valor: (c) => c.descricao },
  { chave: "tipo", rotulo: "Tipo", valor: (c) => (c.tipoConta === "ANALITICA" ? "Analítica" : "Sintética") },
  {
    chave: "destino",
    rotulo: "Destino na DRE",
    // A analítica sem destino aparece como "sem destino", para achar as pendências pelo filtro.
    valor: (c) => c.linhaDRE?.descricao ?? (c.tipoConta === "ANALITICA" ? "sem destino" : null),
  },
  { chave: "balde", rotulo: "Balde", valor: (c) => c.balde },
];
const EDITAR: Coluna<ContaResultado> = { chave: "editar", rotulo: "", semFiltro: true };

export function ContasResultadoContent() {
  useRegistrarAcessoTela("/cadastros/contas-resultado");

  const [busca, setBusca] = useState("");
  const buscaDebounced = useDebounce(busca, 300);
  const edicao = useEdicaoCadastro("contas-resultado");

  const { data, isPending, isError } = useQuery({
    queryKey: ["cadastros", "contas-resultado", buscaDebounced, TODOS],
    queryFn: () =>
      cadastrosService.contasResultado({
        busca: buscaDebounced || undefined,
        pagina: 1,
        porPagina: TODOS,
      }),
    placeholderData: keepPreviousData,
  });
  const colunas = useMemo(() => (edicao.pode ? [...COLUNAS, EDITAR] : COLUNAS), [edicao.pode]);
  const tabela = useTabelaFiltravel(data?.itens, colunas, { porPaginaInicial: POR_PAGINA_INICIAL });

  function aoBuscar(valor: string) {
    setBusca(valor);
    tabela.setPagina(1);
  }

  return (
    <CadastroShell
      titulo="Contas de Resultado"
      comoUsar={
        <ul>
          <li>Use a busca e os filtros nos rótulos das colunas.</li>
          <li>Use “Novo” para incluir; o lápis edita, e a exclusão fica dentro da edição.</li>
          <li>Ao gravar, as competências ainda não apuradas são reclassificadas; as apuradas só mudam se forem reapuradas.</li>
          <li>“Recarregar da Planilha” mostra o que muda em relação à planilha UNIDADES E CENTROS DE CUSTO antes de gravar.</li>
        </ul>
      }
      descricao="Carregadas da planilha UNIDADES E CENTROS DE CUSTO e editáveis aqui. O departamento e a atribuição vêm do destino na DRE."
      acoes={
        <div className="flex items-center gap-2">
          <RecarregarPlanilha />
          {edicao.botaoNovo}
        </div>
      }
      busca={busca}
      onBuscaChange={aoBuscar}
      placeholderBusca="Reduzido, conta ou descrição…"
      total={tabela.total}
      pagina={tabela.pagina}
      porPagina={tabela.porPagina}
      onPorPaginaChange={tabela.setPorPagina}
      onPaginaChange={tabela.setPagina}
      carregando={isPending}
      filtros={{ totalGeral: tabela.totalGeral, ativos: tabela.ativos, onLimpar: tabela.limpar }}
    >
      <DataTable<ContaResultado>
        data={tabela.visiveis}
        cabecalho={tabela.cabecalho}
        filtrosAtivos={tabela.ativos}
        onLimparFiltros={tabela.limpar}
        isLoading={isPending}
        error={isError ? "Erro ao carregar as contas de resultado." : null}
        emptyMessage="Nenhuma conta encontrada"
        emptyHint="Ajuste a busca para ver outros registros."
        columns={[
          "Reduzido",
          "Conta",
          "Descrição",
          "Tipo",
          "Destino na DRE",
          "Balde",
          ...edicao.colunaEditar,
        ]}
        renderRow={(item) => {
          // Conta analítica sem destino na DRE não entra na apuração — é a
          // pendência que impede o fechamento da competência (RF006).
          const pendente = item.tipoConta === "ANALITICA" && !item.linhaDRE;

          return (
            <tr
              key={item.id}
              className="border-b border-gray-100 hover:bg-gray-50"
            >
              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                {item.reduzido}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {item.conta}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900">
                {item.descricao}
              </td>
              <td className="px-4 py-3 text-xs text-gray-600">
                {item.tipoConta === "ANALITICA" ? "Analítica" : "Sintética"}
              </td>
              <td className="px-4 py-3 text-sm">
                {item.linhaDRE ? (
                  <span className="text-gray-900">{item.linhaDRE.descricao}</span>
                ) : pendente ? (
                  <span className="inline-flex items-center gap-1 text-yellow-800">
                    <AlertTriangle className="size-3.5" />
                    sem destino
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-sm">
                <BaldeBadge balde={item.balde} />
              </td>
              {edicao.pode ? <td className="px-2 py-3">{edicao.botaoEditar(item.id)}</td> : null}
            </tr>
          );
        }}
      />
      {edicao.dialogo}
    </CadastroShell>
  );
}
