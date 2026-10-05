"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { DataTable } from "@/components/shared/DataTable";
import { useDebounce } from "@/hooks/useDebounce";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { dataHora, moeda } from "../../competencias/[anoMes]/utils/formatacao";
import { CadastroShell } from "../components/CadastroShell";
import { cadastrosService, type PrecoContrato } from "../services/cadastrosService";

const POR_PAGINA_INICIAL = 50;

const valor = (v: string | null) => (v === null ? "—" : moeda(v));

export function PrecosContratoContent() {
  useRegistrarAcessoTela("/cadastros/precos-contrato");

  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(POR_PAGINA_INICIAL);
  const [historico, setHistorico] = useState(false);
  const buscaDebounced = useDebounce(busca, 300);

  const { data, isPending, isError } = useQuery({
    queryKey: ["cadastros", "precos-contrato", buscaDebounced, pagina, porPagina, historico],
    queryFn: () =>
      cadastrosService.precosContrato({
        busca: buscaDebounced || undefined,
        pagina,
        porPagina,
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
      porPagina={porPagina}
      onPorPaginaChange={setPorPagina}
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
        columns={["Obra", "Versão", "Etapa · linha", "Conta · atribuição", "Unidade", "V. unit.", "V. total", "Vigência"]}
        renderRow={(p) => {
          const antigo = p.substituidoEm !== null;
          return (
            <tr
              key={p.id}
              className={`border-b border-gray-100 hover:bg-gray-50 ${antigo ? "bg-gray-50 text-gray-400" : ""}`}
            >
              <td className="px-3 py-3 text-sm">
                {/* A obra numa coluna só: código e nome na mesma linha, o nome cortado. */}
                <div className="flex max-w-48 items-baseline gap-1.5" title={p.obra.nome !== p.obra.codigo ? p.obra.nome : undefined}>
                  <span className={`font-medium whitespace-nowrap tabular-nums ${antigo ? "" : "text-gray-900"}`}>{p.obra.codigo}</span>
                  {p.obra.nome !== p.obra.codigo ? <span className="truncate text-xs">{p.obra.nome}</span> : null}
                </div>
              </td>
              <td className="px-3 py-3 text-sm tabular-nums">{p.versao}</td>
              <td className="px-3 py-3 text-sm whitespace-nowrap">
                {p.etapa ?? "—"} · {p.linhaTexto}
              </td>
              <td className="px-3 py-3 text-sm">
                {/* A conta e a atribuição numa linha; o departamento e a atribuição completos na dica. */}
                <div
                  className="max-w-56 truncate"
                  title={[p.contaResultado, p.departamento, p.atribuicao].filter(Boolean).join(" · ")}
                >
                  {p.contaResultado}
                </div>
              </td>
              <td className="px-3 py-3 text-sm">{p.unidade ?? "—"}</td>
              <td className="px-3 py-3 text-right text-sm tabular-nums">{valor(p.valorUnitario)}</td>
              <td className="px-3 py-3 text-right text-sm tabular-nums">{valor(p.valorTotal)}</td>
              <td className="px-3 py-3 text-xs whitespace-nowrap">
                <div title={dataHora(p.vigenteDesde)}>{new Date(p.vigenteDesde).toLocaleDateString("pt-BR")}</div>
                {antigo ? <div className="text-red-700" title={dataHora(p.substituidoEm!)}>substituído em {new Date(p.substituidoEm!).toLocaleDateString("pt-BR")}</div> : null}
              </td>
            </tr>
          );
        }}
      />
    </CadastroShell>
  );
}
