"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { CampoBusca } from "@/components/shared/Filtros";

import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

import { cenariosService, type CentrosDoCenario as Lista, type LinhaDaPremissa } from "../services/cenariosService";
import { Erro } from "./CenarioDialog";
import { TabelaEditavel } from "./TabelaPremissas";

const Carregando = () => <div className="h-64 animate-pulse rounded-sm bg-gray-100" />;
const reais = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

/**
 * A aba Centros de Custo das premissas de um cenário analítico (13/10/2026), como a de Resultados Realizados: a lista
 * dos centros à esquerda (agrupados pelo nome da Controladoria, com a busca e o total do exercício) e, à direita, as
 * contas do centro escolhido (mão de obra e gastos gerais, por atribuição) mês a mês, para digitar. Embaixo, os
 * percentuais de rateio de cada mês, que levam o valor dos centros de rateio às unidades.
 */
export function CentrosDoCenario({ id, editavel }: { id: string; editavel: boolean }) {
  const [busca, setBusca] = useState("");
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const lista = useQuery({ queryKey: ["cenarios", id, "centros"], queryFn: () => cenariosService.centros(id) });
  const centros = lista.data?.centros ?? [];
  // Sem escolha, o primeiro da lista (os sem grupo ficam no fim).
  const primeiro = centros.find((c) => c.grupo !== "Sem Grupo") ?? centros[0];
  const centroId = (escolhido && centros.some((c) => c.id === escolhido) ? escolhido : primeiro?.id) ?? null;
  const contas = useQuery({ queryKey: ["cenarios", id, "centros", centroId], queryFn: () => cenariosService.centro(id, centroId!), enabled: centroId !== null });
  if (lista.isError) return <Erro erro={mensagemDeErro(lista.error, "Erro ao carregar os centros de custo.")} />;
  if (lista.isPending) return <Carregando />;
  const dados = lista.data;
  const pode = editavel && dados.editavel;
  const t = busca.trim().toLowerCase();
  const filtrados = centros.filter((c) => !t || `${c.codigo ?? ""} ${c.nome} ${c.grupo}`.toLowerCase().includes(t));
  // Agrupados como em Resultados Realizados (o nome da Controladoria); os sem grupo no fim.
  const grupos = [...new Set(filtrados.map((c) => c.grupo))].sort((x, y) => (x === "Sem Grupo" ? 1 : y === "Sem Grupo" ? -1 : 0));
  return (
    <div className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
        <div className="rounded-sm border border-gray-200 bg-white">
          <div className="border-b border-gray-200 p-2">
            <CampoBusca rotulo="Buscar centro de custo" valor={busca} onMudar={setBusca} placeholder="Centro de Custo ou código…" largura="w-full" />
          </div>
          <ul className="max-h-[70vh] overflow-y-auto py-1" aria-label="Centros de custo">
            {grupos.map((g) => (
              <li key={g}>
                <p className="px-3 pt-2 pb-1 text-xs font-bold tracking-wide text-gray-500 uppercase">{g}</p>
                <ul>
                  {filtrados
                    .filter((c) => c.grupo === g)
                    .map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setEscolhido(c.id)}
                          aria-current={c.id === centroId ? "true" : undefined}
                          title={`${c.codigo ?? ""} ${c.nome} · ${c.destino}`}
                          className={`flex w-full items-baseline justify-between gap-3 px-3 py-1.5 pl-5 text-left text-sm ${c.id === centroId ? "bg-black text-white" : "text-gray-800 hover:bg-gray-100"}`}
                        >
                          <span className="min-w-0 truncate">{c.nome}</span>
                          {c.total ? <span className={`shrink-0 text-xs ${c.id === centroId ? "text-white/80" : "text-gray-500"}`}>{reais(c.total)}</span> : null}
                        </button>
                      </li>
                    ))}
                </ul>
              </li>
            ))}
            {filtrados.length === 0 ? <li className="px-3 py-2 text-sm text-gray-500">Nenhum centro com esse nome.</li> : null}
          </ul>
        </div>
        <div className="min-w-0">
          {contas.isError ? (
            <Erro erro={mensagemDeErro(contas.error, "Erro ao carregar o centro de custo.")} />
          ) : contas.isPending || !contas.data ? (
            <Carregando />
          ) : (
            <TabelaEditavel
              key={centroId ?? ""}
              titulo={`${contas.data.centro.codigo ?? ""} ${contas.data.centro.nome}`.trim()}
              subtitulo={`${contas.data.centro.grupo} · Balde ${contas.data.centro.balde ?? "—"} · Vai para: ${contas.data.centro.destino}`}
              meses={dados.meses}
              linhas={linhasDoCentro(contas.data.contas)}
              editavel={pode}
              comReferencia={false}
              item="conta(s)"
              cabecalho="CONTA"
              aoGravar={(alteracoes, origem) => cenariosService.gravarCentro(id, centroId!, alteracoes, origem)}
              mensagem={(n) => `${n} valor(es) do centro gravado(s); a DRE do cenário foi recalculada.`}
            />
          )}
        </div>
      </div>
      <TabelaEditavel
        titulo="Rateios (%)"
        subtitulo={`Produção pelo m³ produzido do cenário na Matriz e na Filial; as demais chaves pela média do realizado${dados.periodoRealizado ? ` (${dados.periodoRealizado})` : ""}.`}
        meses={dados.meses}
        linhas={linhasDosRateios(dados.rateios)}
        editavel={false}
        comReferencia={false}
        cabecalho="CHAVE E DESTINO"
      />
    </div>
  );
}

/** As contas do centro como linhas da tabela: por atribuição, com o total do centro no fim. */
function linhasDoCentro(contas: Array<{ codigo: string; descricao: string; atribuicao: string; valores: number[]; gravados: boolean[] }>): LinhaDaPremissa[] {
  const linhas: LinhaDaPremissa[] = contas.map((c) => ({
    chave: c.codigo,
    secao: c.atribuicao.toUpperCase(),
    grupo: null,
    rotulo: c.descricao,
    und: "R$",
    tipo: "PREMISSA",
    casas: 2,
    referencia: null,
    valores: c.valores,
    gravados: c.gravados,
  }));
  const total = Array.from({ length: 12 }, (_, k) => contas.reduce((s, c) => s + (c.valores[k] ?? 0), 0));
  return [...linhas, { chave: "TOTAL", secao: "TOTAL DO CENTRO", grupo: null, rotulo: "Total do Centro", und: "R$", tipo: "CALCULO", casas: 2, referencia: null, valores: total, gravados: total.map(() => false) }];
}

/** Os percentuais de rateio como linhas da tabela (só leitura), por chave. */
function linhasDosRateios(rateios: Lista["rateios"]): LinhaDaPremissa[] {
  return rateios.map((r) => ({
    chave: `${r.chave}|${r.destino}`,
    secao: r.rotulo.split(":")[0].toUpperCase(),
    grupo: null,
    rotulo: r.rotulo.split(": ")[1] ?? r.rotulo,
    und: "%",
    tipo: "CALCULO",
    casas: 2,
    referencia: null,
    valores: r.valores.map((v) => v * 100),
    gravados: r.valores.map(() => false),
  }));
}
