"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";

import { DataTable } from "@/components/shared/DataTable";
import { useDebounce } from "@/hooks/useDebounce";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { CadastroShell } from "../components/CadastroShell";
import { Parametros } from "@/components/shared/Parametros";
import {
  cadastrosService,
  type Reclassificacao,
} from "../services/cadastrosService";

const POR_PAGINA = 50;

export function ReclassificacoesContent() {
  useRegistrarAcessoTela("/cadastros/reclassificacoes");

  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const buscaDebounced = useDebounce(busca, 300);

  const { data, isPending, isError } = useQuery({
    queryKey: ["cadastros", "reclassificacoes", buscaDebounced, pagina],
    queryFn: () =>
      cadastrosService.reclassificacoes({
        busca: buscaDebounced || undefined,
        pagina,
        porPagina: POR_PAGINA,
      }),
    placeholderData: keepPreviousData,
  });

  return (
    <CadastroShell
      titulo="Reclassificações de conta"
      descricao="Para o centro de custo, a conta de origem vale como a de destino. Corrige lançamentos feitos em conta de outro departamento ou atribuição. Somente leitura."
      busca={busca}
      onBuscaChange={(v) => {
        setBusca(v);
        setPagina(1);
      }}
      placeholderBusca="Centro ou conta…"
      total={data?.total ?? 0}
      pagina={pagina}
      porPagina={POR_PAGINA}
      onPaginaChange={setPagina}
      carregando={isPending}
    >
      <DataTable<Reclassificacao>
        data={data?.itens ?? []}
        isLoading={isPending}
        error={isError ? "Erro ao carregar as reclassificações." : null}
        emptyMessage="Nenhuma reclassificação encontrada"
        emptyHint="Ajuste a busca para ver outros registros."
        columns={["Centro de custo", "Conta de origem", "", "Conta adotada", "Origem do registro"]}
        renderRow={(r) => (
          <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
            <td className="px-4 py-3 text-sm">
              <div className="font-medium text-gray-900 tabular-nums">{r.codigoCentroCusto}</div>
              <div className="text-xs text-gray-600">
                {r.centro?.nomeRM ?? <span className="text-yellow-800">fora do cadastro</span>}
                {r.centro ? (
                  <span className="ml-1">
                    <Parametros
                      departamento={r.centro.departamento}
                      atribuicao={r.centro.atribuicao}
                    />
                  </span>
                ) : null}
              </div>
            </td>
            <td className="px-4 py-3 text-sm">
              <div className="text-gray-900">
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
              <div className="font-medium text-gray-900">
                <span className="tabular-nums">{r.contaDestino.reduzido}</span> {r.contaDestino.descricao}
              </div>
              <Parametros
                departamento={r.contaDestino.departamento}
                atribuicao={r.contaDestino.atribuicao}
              />
            </td>
            <td className="px-4 py-3 text-xs text-gray-500">{r.motivo ?? "—"}</td>
          </tr>
        )}
      />
    </CadastroShell>
  );
}
