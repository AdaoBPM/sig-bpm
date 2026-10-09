"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Abas } from "@/components/shared/Abas";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { QuadroTabela } from "@/components/shared/QuadroTabela";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { AvisoCongelado } from "../../../components/AvisoCongelado";
import { dataHora, lerAnoMes } from "../../utils/formatacao";
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

      {d ? (
        d.importacao ? (
          <p className="text-xs text-gray-600">
            Importado de <span className="font-medium text-gray-900">{d.importacao.nomeArquivo}</span> em {dataHora(d.importacao.importadoEm)}.
          </p>
        ) : (
          <div className="rounded-sm border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
            A aba {aba} ainda não foi importada neste mês.{" "}
            <Link href={`/competencias/${anoMes}/importar`} className="font-medium underline underline-offset-2">
              Ir para Importações
            </Link>
          </div>
        )
      ) : null}

      <QuadroTabela>
        {dados.isError ? (
          <p className="p-4 text-sm text-red-700">{mensagemDeErro(dados.error, "Erro ao carregar a lista.")}</p>
        ) : !d ? (
          <div className="h-48 animate-pulse bg-gray-50" />
        ) : (
          <table className="tabela-sig w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="w-16 px-4 text-left text-xs font-bold text-gray-900">Nº</th>
                <th className="px-4 text-left text-xs font-bold text-gray-900">Indicador</th>
                <th className="px-4 text-left text-xs font-bold text-gray-900">Metodologia</th>
                <th className="w-24 px-4 text-left text-xs font-bold text-gray-900">Unidade</th>
                <th className="w-40 px-4 text-right text-xs font-bold text-gray-900">Valor do Mês</th>
              </tr>
            </thead>
            <tbody>
              {d.indicadores.map((i, k) => (
                <tr key={i.nome} className={k > 0 && d.indicadores[k - 1].numero !== i.numero ? "border-t border-gray-300" : "border-t border-gray-100"}>
                  <td className="px-4 py-2 text-gray-500">{i.numero}</td>
                  <td className="px-4 py-2 font-medium text-gray-900">{i.nome}</td>
                  <td className="px-4 py-2 text-gray-600">{i.metodologia}</td>
                  <td className="px-4 py-2 text-gray-600">{i.unidade}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap text-gray-900 tabular-nums">{valor(i)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </QuadroTabela>
    </div>
  );
}
