"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Abas } from "@/components/shared/Abas";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { DataTable } from "@/components/shared/DataTable";
import { QuadroTabela } from "@/components/shared/QuadroTabela";
import { useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import type { Coluna } from "@/lib/filtrosDeTabela";

import { AvisoCongelado } from "../../../components/AvisoCongelado";
import { lerAnoMes } from "../../utils/formatacao";
import { LISTAS_INDICADORES, listasService, mensagemDeErro, type IndicadoresDaLista } from "../services/listasService";
import { useAbasDasListas } from "./useAbasDasListas";

type Indicador = IndicadoresDaLista["indicadores"][number];

/** O valor na unidade do indicador, como na tela Indicadores. */
function valor(i: Indicador) {
  if (i.valor === null) return "—";
  const n = (casas: number) => i.valor!.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  switch (i.unidade) {
    case "%":
      return `${(i.valor * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
    case "R$":
      return `${i.valor < 0 ? "-" : ""}R$ ${Math.abs(i.valor).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
    case "colab.":
    case "ocorr.":
    case "pistas":
      return n(0);
    default:
      return n(2);
  }
}

/** As colunas, com os filtros e a ordem nos rótulos, como nas demais listas. */
const COLUNAS: Coluna<Indicador>[] = [
  { chave: "numero", rotulo: "Nº", tipo: "numero", valor: (i) => Number(i.numero), texto: (i) => i.numero, classe: "w-20" },
  { chave: "nome", rotulo: "Indicador", valor: (i) => i.nome },
  { chave: "metodologia", rotulo: "Metodologia", valor: (i) => i.metodologia },
  { chave: "unidade", rotulo: "Unidade", valor: (i) => i.unidade, classe: "w-28" },
  { chave: "valor", rotulo: "Valor do Mês", tipo: "numero", alinhamento: "direita", valor: (i) => i.valor, texto: (i) => valor(i), classe: "w-44" },
];

/**
 * As abas Comercial e Administrativo das Listas: os indicadores numerados do
 * setor (aba Realizado (SIG) do INDICADORES DE RESULTADO) com o valor do mês
 * importado das abas Indicadores (Comercial) e Indicadores (Admin.). Só
 * leitura: os valores se corrigem no arquivo, reimportado em Importações.
 */
export function ListaIndicadores() {
  const { anoMes, tipo: slug } = useParams<{ anoMes: string; tipo: string }>();
  useRegistrarAcessoTela(`/competencias/${anoMes}/listas/${slug}`);
  const periodo = lerAnoMes(anoMes);
  const lista = LISTAS_INDICADORES.find((l) => l.slug === slug)!;
  const abas = useAbasDasListas(anoMes);
  const dados = useQuery({
    queryKey: ["listas", anoMes, slug],
    queryFn: () => listasService.indicadores(anoMes, slug),
    enabled: periodo !== null,
  });
  const d = dados.data;
  const tabela = useTabelaFiltravel(d?.indicadores, COLUNAS);
  const fechada = d?.competencia.status === "FECHADA";
  const aba = lista.tipo === "INDICADORES_COMERCIAL" ? "Indicadores (Comercial) do CONTROLE DAS VENDAS - COMERCIAL" : "Indicadores (Admin.) do SIG BPM 2026 - LISTAS REALIZADO (OPERAÇÃO)";

  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Listas Operacionais"
        selo={fechada ? <AvisoCongelado anoMes={anoMes} fechada oQue="das listas" /> : null}
        comoUsar={
          <ul>
            <li>Escolha a lista nas abas.</li>
            <li>Os valores das abas Comercial e Administrativo vêm da importação do mês; corrija no arquivo e reimporte em Importações.</li>
          </ul>
        }
        sobre={
          <p>
            Os indicadores numerados do {lista.rotulo}, como na aba Realizado (SIG) do INDICADORES DE RESULTADO, com o valor do mês importado
            da aba {aba}. São os mesmos valores da tela Indicadores; não entram na apuração.
          </p>
        }
      />

      <Abas rotulo="Listas" ativa={slug} abas={abas} />

      {d && !d.importacao ? (
        <div className="rounded-sm border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
          A aba {aba} ainda não foi importada neste mês.{" "}
          <Link href={`/competencias/${anoMes}/importar`} className="font-medium underline underline-offset-2">
            Ir para Importações
          </Link>
        </div>
      ) : null}

      <QuadroTabela
        barra={
          tabela.ativos ? (
            <button type="button" onClick={tabela.limpar} className="ml-auto text-xs font-medium text-gray-900 underline underline-offset-2">
              Limpar Filtros
            </button>
          ) : undefined
        }
      >
        <DataTable<Indicador>
          data={tabela.visiveis}
          cabecalho={tabela.cabecalho}
          filtrosAtivos={tabela.ativos}
          onLimparFiltros={tabela.limpar}
          isLoading={dados.isPending}
          error={dados.isError ? mensagemDeErro(dados.error, "Erro ao carregar a lista.") : null}
          emptyMessage="Nenhum indicador nesta lista"
          columns={COLUNAS.map((c) => c.rotulo)}
          renderRow={(i) => {
            const proxima = tabela.visiveis[tabela.visiveis.indexOf(i) + 1];
            return (
            // Uma linha mais forte entre os números (1, 2, 3…), como na aba Realizado (SIG).
            <tr key={i.nome} className={`border-b ${proxima && proxima.numero !== i.numero ? "border-gray-300" : "border-gray-100"} hover:bg-gray-50`}>
              <td className="px-4 py-2 text-sm text-gray-500">{i.numero}</td>
              <td className="px-4 py-2 text-sm font-medium text-gray-900">{i.nome}</td>
              <td className="px-4 py-2 text-sm text-gray-600">{i.metodologia}</td>
              <td className="px-4 py-2 text-sm text-gray-600">{i.unidade}</td>
              <td className="px-4 py-2 text-right text-sm whitespace-nowrap text-gray-900 tabular-nums">{valor(i)}</td>
            </tr>
            );
          }}
        />
      </QuadroTabela>
    </div>
  );
}
