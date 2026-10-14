"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { DataTable } from "@/components/shared/DataTable";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import type { Coluna } from "@/lib/filtrosDeTabela";

import { dataHora, moeda } from "../../competencias/[anoMes]/utils/formatacao";
import { CadastroShell } from "../components/CadastroShell";
import { cadastrosService, type PrecoContrato } from "../services/cadastrosService";
import { plural } from "@/lib/texto";

const POR_PAGINA_INICIAL = 50;
/** O cadastro inteiro vem de uma vez: o filtro e a ordem das colunas valem para todos os preços. */
const TODOS = 5000;

const valor = (v: string | null) => (v === null ? "—" : moeda(v));
const obra = (p: PrecoContrato) => (p.obra.nome !== p.obra.codigo ? `${p.obra.codigo} · ${p.obra.nome}` : p.obra.codigo);

const COLUNAS: Coluna<PrecoContrato>[] = [
  { chave: "obra", rotulo: "Obra", valor: obra },
  { chave: "versao", rotulo: "Versão", valor: (p) => p.versao, tipo: "numero" },
  { chave: "linha", rotulo: "Etapa · linha", valor: (p) => `${p.etapa ?? "—"} · ${p.linhaTexto}` },
  { chave: "conta", rotulo: "Conta · atribuição", valor: (p) => p.contaResultado },
  { chave: "unidade", rotulo: "Unidade", valor: (p) => p.unidade },
  {
    chave: "unitario",
    rotulo: "V. unit.",
    valor: (p) => (p.valorUnitario === null ? null : Number(p.valorUnitario)),
    texto: (p) => (p.valorUnitario === null ? null : moeda(p.valorUnitario)),
    tipo: "numero",
    alinhamento: "direita",
  },
  {
    chave: "total",
    rotulo: "V. total",
    valor: (p) => (p.valorTotal === null ? null : Number(p.valorTotal)),
    texto: (p) => (p.valorTotal === null ? null : moeda(p.valorTotal)),
    tipo: "numero",
    alinhamento: "direita",
  },
  {
    chave: "vigencia",
    rotulo: "Vigência",
    valor: (p) => new Date(p.vigenteDesde).getTime(),
    texto: (p) => new Date(p.vigenteDesde).toLocaleDateString("pt-BR"),
    tipo: "data",
  },
];

export function PrecosContratoContent() {
  useRegistrarAcessoTela("/cadastros/precos-contrato");

  const [historico, setHistorico] = useState(false);

  const { data, isPending, isError } = useQuery({
    queryKey: ["cadastros", "precos-contrato", TODOS, historico],
    queryFn: () =>
      cadastrosService.precosContrato({
        pagina: 1,
        porPagina: TODOS,
        historico,
      }),
    placeholderData: keepPreviousData,
  });
  const tabela = useTabelaFiltravel(data?.itens, COLUNAS, { porPaginaInicial: POR_PAGINA_INICIAL });

  return (
    <CadastroShell
      titulo="Preços do Contrato"
      comoUsar={
        <ul>
          <li>Use os filtros nos rótulos das colunas.</li>
          <li>Marque “Mostrar Histórico” para ver também os preços substituídos por reimportações.</li>
          <li>Os preços não se editam aqui: para mudá-los, reimporte a DRE do Comercial em Importações.</li>
        </ul>
      }
      descricao="Da DRE de venda do Comercial, importada em Importações; o nome da obra vem da aba Pedidos do mesmo arquivo (Cliente | Nome da Obra), quando nenhuma lista o trouxe antes. Um preço alterado numa reimportação substitui o anterior, que fica no histórico. Somente leitura."
      total={tabela.total}
      pagina={tabela.pagina}
      porPagina={tabela.porPagina}
      onPorPaginaChange={tabela.setPorPagina}
      onPaginaChange={tabela.setPagina}
      carregando={isPending}
      filtros={{ totalGeral: tabela.totalGeral, ativos: tabela.ativos, onLimpar: tabela.limpar }}
      acoes={
        <label className="flex items-center gap-2 text-sm whitespace-nowrap text-gray-700">
          <input
            type="checkbox"
            checked={historico}
            onChange={(e) => {
              setHistorico(e.target.checked);
              tabela.setPagina(1);
            }}
            className="size-4 accent-black"
          />
          Mostrar Histórico{data ? ` (${data.substituidos} ${plural(data.substituidos, "substituído", "substituídos")})` : ""}
        </label>
      }
    >
      <DataTable<PrecoContrato>
        data={tabela.visiveis}
        cabecalho={tabela.cabecalho}
        filtrosAtivos={tabela.ativos}
        onLimparFiltros={tabela.limpar}
        isLoading={isPending}
        error={isError ? "Erro ao carregar os preços." : null}
        emptyMessage="Nenhum preço encontrado"
        emptyHint="Importe a DRE do Comercial ou ajuste os filtros."
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
                <div className="flex max-w-40 items-baseline gap-1.5" title={p.obra.nome !== p.obra.codigo ? p.obra.nome : undefined}>
                  <span className={`font-medium whitespace-nowrap ${antigo ? "" : "text-gray-900"}`}>{p.obra.codigo}</span>
                  {p.obra.nome !== p.obra.codigo ? <span className="truncate text-xs">{p.obra.nome}</span> : null}
                </div>
              </td>
              <td className="px-3 py-3 text-sm">{p.versao}</td>
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
              <td className="px-3 py-3 text-right text-sm">{valor(p.valorUnitario)}</td>
              <td className="px-3 py-3 text-right text-sm">{valor(p.valorTotal)}</td>
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
