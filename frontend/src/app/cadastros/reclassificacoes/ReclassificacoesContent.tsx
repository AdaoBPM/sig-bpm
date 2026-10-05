"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";

import { DataTable } from "@/components/shared/DataTable";
import { useDebounce } from "@/hooks/useDebounce";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { CadastroShell } from "../components/CadastroShell";
import { useEdicaoCadastro } from "../components/EdicaoCadastro";
import { Parametros } from "@/components/shared/Parametros";
import {
  cadastrosService,
  type Reclassificacao,
} from "../services/cadastrosService";

const POR_PAGINA_INICIAL = 50;

export function ReclassificacoesContent() {
  useRegistrarAcessoTela("/cadastros/reclassificacoes");

  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(POR_PAGINA_INICIAL);
  const buscaDebounced = useDebounce(busca, 300);
  const edicao = useEdicaoCadastro("reclassificacoes");

  const { data, isPending, isError } = useQuery({
    queryKey: ["cadastros", "reclassificacoes", buscaDebounced, pagina, porPagina],
    queryFn: () =>
      cadastrosService.reclassificacoes({
        busca: buscaDebounced || undefined,
        pagina,
        porPagina: porPagina,
      }),
    placeholderData: keepPreviousData,
  });

  return (
    <CadastroShell
      titulo="Reclassificações de conta"
      descricao="Para o centro de custo, a conta de origem vale como a de destino. Corrige lançamentos feitos em conta de outro departamento ou atribuição."
      acoes={edicao.botaoNovo}
      busca={busca}
      onBuscaChange={(v) => {
        setBusca(v);
        setPagina(1);
      }}
      placeholderBusca="Centro ou conta…"
      total={data?.total ?? 0}
      pagina={pagina}
      porPagina={porPagina}
      onPorPaginaChange={setPorPagina}
      onPaginaChange={setPagina}
      carregando={isPending}
    >
      <DataTable<Reclassificacao>
        data={data?.itens ?? []}
        isLoading={isPending}
        error={isError ? "Erro ao carregar as reclassificações." : null}
        emptyMessage="Nenhuma reclassificação encontrada"
        emptyHint="Ajuste a busca para ver outros registros."
        columns={["Centro de custo", "Conta de origem", "", "Conta adotada", "Origem do registro", ...edicao.colunaEditar]}
        renderRow={(r) => (
          <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
            <td className="px-4 py-3 text-sm">
              <div className="flex max-w-64 items-baseline gap-1.5">
                <span className="font-medium whitespace-nowrap text-gray-900 tabular-nums">{r.codigoCentroCusto}</span>
                <span className="truncate text-xs text-gray-600" title={r.centro?.nomeRM}>
                  {r.centro?.nomeRM ?? <span className="text-yellow-800">fora do cadastro</span>}
                </span>
              </div>
              {r.centro ? <Parametros departamento={r.centro.departamento} atribuicao={r.centro.atribuicao} /> : null}
            </td>
            <td className="px-4 py-3 text-sm">
              <div className="max-w-64 truncate text-gray-900" title={`${r.contaOrigem.reduzido} ${r.contaOrigem.descricao}`}>
                <span className="tabular-nums">{r.contaOrigem.reduzido}</span> {r.contaOrigem.descricao}
              </div>
              <Parametros
                departamento={r.contaOrigem.departamento}
                atribuicao={r.contaOrigem.atribuicao}
              />
            </td>
            <td className="px-2 py-3 text-gray-400">
              <ArrowRight className="size-4" />
            </td>
            <td className="px-4 py-3 text-sm">
              <div className="max-w-64 truncate font-medium text-gray-900" title={`${r.contaDestino.reduzido} ${r.contaDestino.descricao}`}>
                <span className="tabular-nums">{r.contaDestino.reduzido}</span> {r.contaDestino.descricao}
              </div>
              <Parametros
                departamento={r.contaDestino.departamento}
                atribuicao={r.contaDestino.atribuicao}
              />
            </td>
            <td className="px-4 py-3 text-xs text-gray-500">
              <div className="max-w-44" title={r.motivo ?? undefined}>
                {r.motivo ?? "—"}
              </div>
            </td>
            {edicao.pode ? <td className="px-2 py-3">{edicao.botaoEditar(r.id)}</td> : null}
          </tr>
        )}
      />
      {edicao.dialogo}
    </CadastroShell>
  );
}
