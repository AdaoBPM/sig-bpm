"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { DataTable } from "@/components/shared/DataTable";
import { useDebounce } from "@/hooks/useDebounce";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { CadastroShell } from "../components/CadastroShell";
import { useEdicaoCadastro } from "../components/EdicaoCadastro";
import { RecarregarPlanilha } from "../components/RecarregarPlanilha";
import { cadastrosService, type LinhaDRE } from "../services/cadastrosService";

const POR_PAGINA_INICIAL = 100;

const ROTULO_TIPO: Record<LinhaDRE["tipo"], string> = {
  SECAO: "Seção",
  ITEM: "Item",
  SUBTOTAL: "Subtotal",
  TOTAL: "Total",
};

/** A DRE é hierárquica; a indentação é o que torna a estrutura legível. */
const RECUO_TIPO: Record<LinhaDRE["tipo"], string> = {
  SECAO: "",
  ITEM: "pl-8",
  SUBTOTAL: "pl-4",
  TOTAL: "",
};

export function EstruturaDreContent() {
  useRegistrarAcessoTela("/cadastros/estrutura-dre");

  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(POR_PAGINA_INICIAL);
  const buscaDebounced = useDebounce(busca, 300);
  const edicao = useEdicaoCadastro("estrutura-dre");
  const [aberta, setAberta] = useState<string | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ["cadastros", "linhas-dre", buscaDebounced, pagina, porPagina],
    queryFn: () =>
      cadastrosService.linhasDRE({
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
      titulo="Estrutura da DRE"
      descricao="A DRE é cadastro, não código. Carregada da aba Realizado (Consolidado) e editável aqui; a composição é validada antes de gravar."
      acoes={
        <div className="flex items-center gap-2">
          <RecarregarPlanilha />
          {edicao.botaoNovo}
        </div>
      }
      busca={busca}
      onBuscaChange={aoBuscar}
      placeholderBusca="Código, descrição ou grupo…"
      total={data?.total ?? 0}
      pagina={pagina}
      porPagina={porPagina}
      onPorPaginaChange={setPorPagina}
      onPaginaChange={setPagina}
      carregando={isPending}
    >
      <DataTable<LinhaDRE>
        data={data?.itens ?? []}
        isLoading={isPending}
        error={isError ? "Erro ao carregar a estrutura da DRE." : null}
        emptyMessage="Nenhuma linha encontrada"
        emptyHint="Ajuste a busca para ver outras linhas."
        columns={["#", "Linha", "Tipo", "Grupo", "Composição", "Unidades", "Contas", ...edicao.colunaEditar]}
        renderRow={(item) => {
          const abre = !!item.expressao || !!item.definicao;
          const aberto = aberta === item.id;
          return (
          <Fragment key={item.id}>
          <tr
            className={`border-b border-gray-100 hover:bg-gray-50 ${abre ? "cursor-pointer" : ""}`}
            onClick={abre ? () => setAberta(aberto ? null : item.id) : undefined}
          >
            <td className="px-4 py-3 text-xs text-gray-400 tabular-nums">
              {item.ordem}
            </td>
            <td className={`px-4 py-3 text-sm text-gray-900 ${RECUO_TIPO[item.tipo]}`}>
              <div className="flex max-w-sm items-baseline gap-2" title={item.codigo}>
                {abre ? (
                  aberto ? <ChevronDown className="size-3.5 shrink-0 self-center text-gray-400" /> : <ChevronRight className="size-3.5 shrink-0 self-center text-gray-400" />
                ) : null}
                <span className={`whitespace-nowrap ${item.tipo === "ITEM" ? "font-normal" : "font-bold"}`}>{item.descricao}</span>
                <span className="truncate text-xs text-gray-400">{item.codigo}</span>
              </div>
            </td>
            <td className="px-4 py-3 text-xs text-gray-600">
              {ROTULO_TIPO[item.tipo]}
            </td>
            <td className="px-4 py-3 text-xs whitespace-nowrap text-gray-600">
              {item.grupoSigla}
              {item.atribuicaoSigla ? ` · ${item.atribuicaoSigla}` : ""}
            </td>
            <td className="px-4 py-3 text-xs text-gray-600">
              {item.expressao ? (
                <code className="block max-w-48 truncate">{item.expressao}</code>
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </td>
            <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
              {item.unidades.length === 0
                ? "—"
                : item.unidades
                    .map((u) => u.unidadeNegocio.nome)
                    .sort()
                    .join(", ")}
            </td>
            <td className="px-4 py-3 text-xs text-gray-600 tabular-nums">
              {item._count.contas > 0 ? item._count.contas : "—"}
            </td>
            {edicao.pode ? (
              <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                {edicao.botaoEditar(item.id)}
              </td>
            ) : null}
          </tr>
          {aberto ? (
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <td />
              <td colSpan={6 + (edicao.pode ? 1 : 0)} className="space-y-1.5 px-4 py-2.5 text-xs text-gray-700">
                <p>
                  <span className="text-gray-500">Código:</span> <code>{item.codigo}</code>
                </p>
                {item.expressao ? (
                  <p>
                    <span className="text-gray-500">Composição:</span> <code className="break-all">{item.expressao}</code>
                  </p>
                ) : null}
                {item.definicao ? (
                  <p>
                    <span className="text-gray-500">Definição:</span> {item.definicao}
                  </p>
                ) : null}
              </td>
            </tr>
          ) : null}
          </Fragment>
          );
        }}
      />
      {edicao.dialogo}
    </CadastroShell>
  );
}
