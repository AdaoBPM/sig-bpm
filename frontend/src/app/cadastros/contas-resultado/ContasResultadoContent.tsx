"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { DataTable } from "@/components/shared/DataTable";
import { useDebounce } from "@/hooks/useDebounce";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { BaldeBadge } from "@/components/shared/BaldeBadge";
import { CadastroShell } from "../components/CadastroShell";
import { useEdicaoCadastro } from "../components/EdicaoCadastro";
import { RecarregarPlanilha } from "../components/RecarregarPlanilha";
import {
  cadastrosService,
  type ContaResultado,
} from "../services/cadastrosService";

const POR_PAGINA_INICIAL = 50;

export function ContasResultadoContent() {
  useRegistrarAcessoTela("/cadastros/contas-resultado");

  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(POR_PAGINA_INICIAL);
  const buscaDebounced = useDebounce(busca, 300);
  const edicao = useEdicaoCadastro("contas-resultado");

  const { data, isPending, isError } = useQuery({
    queryKey: ["cadastros", "contas-resultado", buscaDebounced, pagina, porPagina],
    queryFn: () =>
      cadastrosService.contasResultado({
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
      titulo="Contas de Resultado"
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
      total={data?.total ?? 0}
      pagina={pagina}
      porPagina={porPagina}
      onPorPaginaChange={setPorPagina}
      onPaginaChange={setPagina}
      carregando={isPending}
    >
      <DataTable<ContaResultado>
        data={data?.itens ?? []}
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
              <td className="px-4 py-3 text-sm font-medium text-gray-900 tabular-nums">
                {item.reduzido}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">
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
