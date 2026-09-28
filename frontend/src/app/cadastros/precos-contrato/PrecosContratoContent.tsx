"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { DataTable } from "@/components/shared/DataTable";
import { useDebounce } from "@/hooks/useDebounce";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { dataHora, moeda } from "../../competencias/[anoMes]/utils/formatacao";
import { CadastroShell } from "../components/CadastroShell";
import { cadastrosService, type PrecoContrato } from "../services/cadastrosService";

const POR_PAGINA = 50;

const valor = (v: string | null) => (v === null ? "—" : moeda(v));

export function PrecosContratoContent() {
  useRegistrarAcessoTela("/cadastros/precos-contrato");

  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [historico, setHistorico] = useState(false);
  const buscaDebounced = useDebounce(busca, 300);

  const { data, isPending, isError } = useQuery({
    queryKey: ["cadastros", "precos-contrato", buscaDebounced, pagina, historico],
    queryFn: () =>
      cadastrosService.precosContrato({
        busca: buscaDebounced || undefined,
        pagina,
        porPagina: POR_PAGINA,
        historico,
      }),
    placeholderData: keepPreviousData,
  });

  return (
    <CadastroShell
      titulo="Preços do contrato"
      descricao="Da DRE de venda do Comercial, importada em Importações. Um preço alterado numa reimportação substitui o anterior, que fica no histórico. Somente leitura."
      busca={busca}
      onBuscaChange={(v) => {
        setBusca(v);
        setPagina(1);
      }}
      placeholderBusca="Obra, conta ou linha…"
      total={data?.total ?? 0}
      pagina={pagina}
      porPagina={POR_PAGINA}
      onPaginaChange={setPagina}
      carregando={isPending}
      acoes={
        <label className="flex items-center gap-2 text-sm whitespace-nowrap text-gray-700">
          <input
            type="checkbox"
            checked={historico}
            onChange={(e) => {
              setHistorico(e.target.checked);
              setPagina(1);
            }}
            className="size-4 accent-black"
          />
          Mostrar histórico{data ? ` (${data.substituidos} substituído(s))` : ""}
        </label>
      }
    >
      <DataTable<PrecoContrato>
        data={data?.itens ?? []}
        isLoading={isPending}
        error={isError ? "Erro ao carregar os preços." : null}
        emptyMessage="Nenhum preço encontrado"
        emptyHint="Importe a DRE do Comercial ou ajuste a busca."
        columns={["Obra", "Versão", "Etapa · linha", "Conta · atribuição", "Unidade de negócio", "V. unit.", "V. total", "Vigência"]}
        renderRow={(p) => {
          const antigo = p.substituidoEm !== null;
          return (
            <tr
              key={p.id}
              className={`border-b border-gray-100 hover:bg-gray-50 ${antigo ? "bg-gray-50 text-gray-400" : ""}`}
            >
              <td className="px-4 py-3 text-sm">
                <div className={`font-medium tabular-nums ${antigo ? "" : "text-gray-900"}`}>{p.obra.codigo}</div>
                {p.obra.nome !== p.obra.codigo ? <div className="text-xs">{p.obra.nome}</div> : null}
              </td>
              <td className="px-4 py-3 text-sm tabular-nums">{p.versao}</td>
              <td className="px-4 py-3 text-sm">
                {p.etapa ?? "—"} · {p.linhaTexto}
              </td>
              <td className="px-4 py-3 text-sm">
                <div>{p.contaResultado}</div>
                <div className="text-xs text-gray-500">
                  {[p.departamento, p.atribuicao].filter(Boolean).join(" · ") || "—"}
                </div>
              </td>
              <td className="px-4 py-3 text-sm">{p.unidade ?? "—"}</td>
              <td className="px-4 py-3 text-right text-sm tabular-nums">{valor(p.valorUnitario)}</td>
              <td className="px-4 py-3 text-right text-sm tabular-nums">{valor(p.valorTotal)}</td>
              <td className="px-4 py-3 text-xs">
                <div>desde {dataHora(p.vigenteDesde)}</div>
                {antigo ? <div className="text-red-700">substituído em {dataHora(p.substituidoEm!)}</div> : null}
              </td>
            </tr>
          );
        }}
      />
    </CadastroShell>
  );
}
