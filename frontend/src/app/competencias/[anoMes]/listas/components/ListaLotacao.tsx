"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Abas } from "@/components/shared/Abas";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { DataTable } from "@/components/shared/DataTable";
import { FaixaIndicadores } from "@/components/shared/FaixaIndicadores";
import { QuadroTabela } from "@/components/shared/QuadroTabela";
import { useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import type { Coluna } from "@/lib/filtrosDeTabela";

import { AvisoCongelado } from "../../../components/AvisoCongelado";
import { inteiro, lerAnoMes } from "../../utils/formatacao";
import { LISTA_LOTACAO, listasService, mensagemDeErro, type CentroDaLotacao } from "../services/listasService";
import { useAbasDasListas } from "./useAbasDasListas";

const ABA = "Quadro de Lotação do SIG BPM 2026 - LISTAS REALIZADO (OPERAÇÃO)";

/** As colunas, com os filtros e a ordem nos rótulos, como nas demais listas. */
const COLUNAS: Coluna<CentroDaLotacao>[] = [
  { chave: "centroCusto", rotulo: "Centro de Custo", valor: (c) => c.centroCusto },
  { chave: "grupo", rotulo: "Grupo no Cadastro", valor: (c) => c.grupo ?? "Sem grupo" },
  { chave: "unidade", rotulo: "Unidade", valor: (c) => c.unidade, classe: "w-px" },
  { chave: "departamento", rotulo: "Departamento", valor: (c) => c.departamento, classe: "w-px" },
  { chave: "atribuicao", rotulo: "Atribuição", valor: (c) => c.atribuicao, classe: "w-px" },
  { chave: "clt", rotulo: "CLT", tipo: "numero", alinhamento: "direita", valor: (c) => c.clt, texto: (c) => inteiro(c.clt), classe: "w-24" },
  { chave: "pj", rotulo: "PJ", tipo: "numero", alinhamento: "direita", valor: (c) => c.pj, texto: (c) => inteiro(c.pj), classe: "w-24" },
  { chave: "total", rotulo: "Total", tipo: "numero", alinhamento: "direita", valor: (c) => c.total, texto: (c) => inteiro(c.total), classe: "w-24" },
];

/**
 * A aba Quadro de Lotação das Listas (19/10/2026): os colaboradores do mês por centro de custo (CLT e PJ), importados da
 * aba de mesmo nome do LISTAS REALIZADO (OPERAÇÃO). É a referência do quadro de lotação realizado dos grupos de centros
 * nos Cenários Analíticos; não entra na apuração nem nos indicadores de quadro de lotação do mês (aba Administrativo).
 * Só leitura: corrige-se no arquivo, reimportado em Importações.
 */
export function ListaLotacao() {
  const { anoMes } = useParams<{ anoMes: string }>();
  useRegistrarAcessoTela(`/competencias/${anoMes}/listas/${LISTA_LOTACAO.slug}`);
  const periodo = lerAnoMes(anoMes);
  const abas = useAbasDasListas(anoMes);
  const dados = useQuery({ queryKey: ["listas", anoMes, LISTA_LOTACAO.slug], queryFn: () => listasService.lotacao(anoMes), enabled: periodo !== null });
  const d = dados.data;
  const tabela = useTabelaFiltravel(d?.itens, COLUNAS);
  const fechada = d?.competencia.status === "FECHADA";
  const semGrupo = d?.itens.filter((c) => !c.grupo) ?? [];

  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Listas Operacionais"
        selo={fechada ? <AvisoCongelado anoMes={anoMes} fechada oQue="das listas" /> : null}
        comoUsar={
          <ul>
            <li>Escolha a lista nas abas e use os filtros nos rótulos das colunas.</li>
            <li>A faixa acima da tabela traz os colaboradores do mês: o Total, CLT e PJ, e quantos centros de custo.</li>
            <li>A lista vem da importação do mês e não se digita: corrija o arquivo e reimporte em Importações.</li>
            <li>
              O Grupo no Cadastro é o grupo de centros de custo (o nome da Controladoria) que recebe os colaboradores nos Cenários Analíticos; “Sem grupo”
              fica fora do cenário até o nome ganhar par no cadastro Centros de Custo.
            </li>
          </ul>
        }
        sobre={
          <p>
            Os colaboradores do mês por centro de custo, CLT e PJ, importados da aba {ABA}. São a referência do quadro de lotação realizado dos grupos de
            centros de custo nos Cenários Analíticos (os totais e as Médias de Referência saem desta lista). Não entram na apuração e não mudam os
            indicadores de quadro de lotação do mês, que seguem a aba Indicadores (Admin.) (aba Administrativo). De 01 a 08/2026, a lista entrou por uma
            carga retroativa (19/10/2026), sem reabrir as competências.
          </p>
        }
      />

      <Abas rotulo="Listas" ativa={LISTA_LOTACAO.slug} abas={abas} />

      {d && !d.importacao ? (
        <div className="rounded-sm border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
          A aba {ABA} ainda não foi importada neste mês.{" "}
          <Link href={`/competencias/${anoMes}/importar`} className="font-medium underline underline-offset-2">
            Ir para Importações
          </Link>
        </div>
      ) : null}

      {d && semGrupo.length > 0 ? (
        <p className="rounded-sm border border-l-4 border-gray-200 border-l-red-600 bg-white px-4 py-2 text-sm text-gray-700">
          Sem grupo no cadastro Centros de Custo: {semGrupo.map((c) => c.centroCusto).join(", ")}. Esses colaboradores ficam fora do quadro de lotação dos
          Cenários Analíticos.
        </p>
      ) : null}

      {d && d.itens.length > 0 ? (
        <FaixaIndicadores
          itens={[
            { rotulo: "Colaboradores: Total", rotuloAntes: true, valor: inteiro(d.totais.total) },
            { rotulo: "CLT", rotuloAntes: true, valor: inteiro(d.totais.clt) },
            { rotulo: "PJ", rotuloAntes: true, valor: inteiro(d.totais.pj) },
            { rotulo: "Centros de Custo", rotuloAntes: true, valor: inteiro(d.itens.length) },
          ]}
        />
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
        <DataTable<CentroDaLotacao>
          data={tabela.visiveis}
          cabecalho={tabela.cabecalho}
          filtrosAtivos={tabela.ativos}
          onLimparFiltros={tabela.limpar}
          isLoading={dados.isPending}
          error={dados.isError ? mensagemDeErro(dados.error, "Erro ao carregar a lista.") : null}
          emptyMessage="Nenhum centro de custo nesta competência"
          emptyHint="Importe a aba Quadro de Lotação em Importações."
          columns={COLUNAS.map((c) => c.rotulo)}
          renderRow={(c) => (
            <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50" title={`Linha ${c.linhaArquivo} do arquivo importado`}>
              <td className="px-4 py-2 text-sm font-medium text-gray-900">{c.centroCusto}</td>
              <td className="px-4 py-2 text-sm text-gray-600">{c.grupo ?? <span className="text-red-700">Sem grupo</span>}</td>
              <td className="px-4 py-2 text-sm whitespace-nowrap text-gray-600">{c.unidade ?? "—"}</td>
              <td className="px-4 py-2 text-sm whitespace-nowrap text-gray-600">{c.departamento ?? "—"}</td>
              <td className="px-4 py-2 text-sm whitespace-nowrap text-gray-600">{c.atribuicao ?? "—"}</td>
              <td className="px-4 py-2 text-right text-sm whitespace-nowrap text-gray-600">{inteiro(c.clt)}</td>
              <td className="px-4 py-2 text-right text-sm whitespace-nowrap text-gray-600">{inteiro(c.pj)}</td>
              <td className="px-4 py-2 text-right text-sm whitespace-nowrap text-gray-600">{inteiro(c.total)}</td>
            </tr>
          )}
        />
      </QuadroTabela>
    </div>
  );
}
