"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { CampoBusca } from "@/components/shared/Filtros";
import { ExportarRelatorio } from "@/app/relatorios/components/ExportarRelatorio";

import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

import { cenariosService, type LinhaDaPremissa, type RateiosDoCenario as Rateios } from "../services/cenariosService";
import { Erro } from "./CenarioDialog";
import { TabelaEditavel } from "./TabelaPremissas";
import { plural } from "@/lib/texto";

const Carregando = () => <div className="h-64 animate-pulse rounded-sm bg-gray-100" />;
const reais = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

/**
 * A aba Centros de Custo das premissas de um cenário analítico (13/10/2026), como a de Resultados Empresariais: os grupos
 * da Controladoria à esquerda (com a busca e o total do exercício; sem os centros de estoque e de investimento) e, à
 * direita, o Quadro de Lotação do grupo (14/10/2026: os colaboradores de cada mês, de onde saem os quadros de lotação
 * dos indicadores) e as contas dele (mão de obra e gastos gerais, por atribuição) mês a mês, para digitar. O grupo
 * com centros de baldes diferentes traz o aviso: o valor vai pelo balde mais comum.
 */
export function CentrosDoCenario({ id, editavel }: { id: string; editavel: boolean }) {
  const [busca, setBusca] = useState("");
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const lista = useQuery({ queryKey: ["cenarios", id, "centros"], queryFn: () => cenariosService.centros(id) });
  const grupos = [...(lista.data?.grupos ?? [])].sort((a, b) => a.grupo.localeCompare(b.grupo, "pt-BR"));
  const grupo = (escolhido && grupos.some((g) => g.grupo === escolhido) ? escolhido : grupos[0]?.grupo) ?? null;
  const contas = useQuery({ queryKey: ["cenarios", id, "centros", grupo], queryFn: () => cenariosService.centro(id, grupo!), enabled: grupo !== null });
  if (lista.isError) return <Erro erro={mensagemDeErro(lista.error, "Erro ao carregar os centros de custo.")} />;
  if (lista.isPending) return <Carregando />;
  const dados = lista.data;
  const t = busca.trim().toLowerCase();
  const filtrados = grupos.filter((g) => !t || `${g.grupo} ${g.centros.map((c) => `${c.codigo ?? ""} ${c.nome}`).join(" ")}`.toLowerCase().includes(t));
  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
      <div className="rounded-sm border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-2">
          <CampoBusca rotulo="Buscar centro de custo" valor={busca} onMudar={setBusca} placeholder="Centro de Custo ou código…" largura="w-full" />
        </div>
        <ul className="max-h-[70vh] overflow-y-auto py-1" aria-label="Centros de custo">
          {filtrados.map((g) => (
            <li key={g.grupo}>
              <button
                type="button"
                onClick={() => setEscolhido(g.grupo)}
                aria-current={g.grupo === grupo ? "true" : undefined}
                title={`${g.grupo} · ${g.destino}${g.baldes.length > 1 ? " · centros de baldes diferentes" : ""}`}
                className={`flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left text-sm ${g.grupo === grupo ? "bg-black text-white" : "text-gray-800 hover:bg-gray-100"}`}
              >
                <span className="min-w-0 truncate">
                  {g.grupo}
                  {g.baldes.length > 1 ? <span className={g.grupo === grupo ? "text-yellow-300" : "text-red-700"}> *</span> : null}
                </span>
                {g.total ? <span className={`shrink-0 text-xs ${g.grupo === grupo ? "text-white/80" : "text-gray-500"}`}>{reais(g.total)}</span> : null}
              </button>
            </li>
          ))}
          {filtrados.length === 0 ? <li className="px-3 py-2 text-sm text-gray-500">Nenhum centro com esse nome.</li> : null}
        </ul>
      </div>
      <div className="min-w-0 space-y-3">
        {/* Os centros em Excel (14/10/2026): o grupo na tela, todos numa planilha ou um arquivo por centro. */}
        {grupo ? (
          <div className="flex justify-end">
            <ExportarRelatorio
              endereco={`/proxy/cenarios/${id}/centros/exportar`}
              padrao="Centros de Custo"
              opcoes={[
                { chave: "atual", excel: "Centro de Custo Atual", pdf: null, params: { escopo: "atual", grupo } },
                { chave: "centros", excel: "Todos os Centros de Custo (um por aba)", pdf: null, params: { escopo: "centros" } },
                { chave: "arquivos", excel: "Todos os Centros de Custo (um arquivo por centro)", pdf: null, params: { escopo: "centros_arquivos" } },
              ]}
            />
          </div>
        ) : null}
        {contas.isError ? (
          <Erro erro={mensagemDeErro(contas.error, "Erro ao carregar o centro de custo.")} />
        ) : contas.isPending || !contas.data ? (
          <Carregando />
        ) : (
          <>
            {contas.data.grupo.baldes.length > 1 ? (
              <p className="rounded-sm border border-l-4 border-gray-200 border-l-red-600 bg-white px-4 py-2 text-sm text-gray-700">
                Os centros deste grupo têm baldes diferentes ({contas.data.grupo.baldes.join(", ")}): o valor vai pelo balde mais comum,{" "}
                {contas.data.grupo.balde ?? "—"}. Revise o agrupamento no cadastro Centros de Custo para que o grupo tenha um balde só.
              </p>
            ) : null}
            <TabelaEditavel
              key={`lotacao-${grupo ?? ""}`}
              titulo="Quadro de Lotação"
              subtitulo={`Os colaboradores do grupo ${contas.data.grupo.grupo} em cada mês. Entra em: ${contas.data.lotacao.quadro}.`}
              meses={dados.meses}
              linhas={[
                {
                  chave: "LOTACAO",
                  secao: "QUADRO DE LOTAÇÃO",
                  grupo: null,
                  rotulo: "Colaboradores",
                  und: "colab.",
                  tipo: "PREMISSA",
                  casas: 0,
                  referencia: null,
                  valores: contas.data.lotacao.valores,
                  gravados: contas.data.lotacao.gravados,
                },
              ]}
              editavel={editavel && dados.editavel}
              comReferencia={false}
              item={["linha", "linhas"]}
              cabecalho="QUADRO"
              aoGravar={(alteracoes, origem) => cenariosService.gravarLotacao(id, grupo!, alteracoes.map((a) => ({ mes: a.mes, valor: a.valor })), origem)}
              mensagem={(n) => `${n} ${plural(n, "mês", "meses")} do quadro de lotação ${plural(n, "gravado", "gravados")}; os quadros de lotação dos indicadores foram recalculados.`}
            />
            <TabelaEditavel
              key={grupo ?? ""}
              titulo={contas.data.grupo.grupo}
              subtitulo={`${contas.data.grupo.centros.map((c) => c.codigo ?? c.nome).join(", ")} · Balde ${contas.data.grupo.balde ?? "—"} · Vai para: ${contas.data.grupo.destino}`}
              meses={dados.meses}
              linhas={linhasDoCentro(contas.data.contas)}
              editavel={editavel && dados.editavel}
              comReferencia={false}
              item={["conta", "contas"]}
              cabecalho="CONTA"
              aoGravar={(alteracoes, origem) => cenariosService.gravarCentro(id, grupo!, alteracoes, origem)}
              mensagem={(n) => `${n} ${plural(n, "valor", "valores")} do centro ${plural(n, "gravado", "gravados")}; a DRE do cenário foi recalculada.`}
            />
          </>
        )}
      </div>
    </div>
  );
}

/** As contas do grupo como linhas da tabela: por atribuição, com o total do centro no fim. */
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

/**
 * O aviso dos rateios sem base (13/10/2026): os grupos de rateio com valor num mês em que a chave não tem base nas
 * premissas — todo custo e despesa deve ir para algum lugar, e esses ficam fora da DRE do cenário. Some quando não há.
 */
export function AvisoRateiosSemBase({ id }: { id: string }) {
  const consulta = useQuery({ queryKey: ["cenarios", id, "rateios"], queryFn: () => cenariosService.rateios(id) });
  const sem = consulta.data?.semBase ?? [];
  if (!sem.length) return null;
  const porChave = new Map<string, typeof sem>();
  for (const x of sem) porChave.set(x.nome, [...(porChave.get(x.nome) ?? []), x]);
  return (
    <div className="rounded-sm border border-l-4 border-gray-200 border-l-red-600 bg-white px-4 py-3 text-sm text-gray-700">
      <p className="font-medium text-gray-900">Rateio sem base nas premissas</p>
      <ul className="mt-1 list-disc pl-5">
        {[...porChave].map(([nome, xs]) => (
          <li key={nome}>
            {nome}: {xs.map((x) => `${x.rotuloMes} (${reais(x.valor)})`).join(", ")} — o valor dos centros de custo desse rateio não vai para nenhuma unidade.
            Preencha nas premissas a base da chave nesses meses (aba Rateios) ou revise o balde do grupo.
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A aba Rateios das premissas de um cenário analítico (13/10/2026): por chave e destino, a base de cada mês (das
 * premissas) e o percentual, que leva o valor dos grupos de rateio às unidades. Só leitura: muda com as premissas.
 */
export function RateiosDoCenario({ id }: { id: string }) {
  const consulta = useQuery({ queryKey: ["cenarios", id, "rateios"], queryFn: () => cenariosService.rateios(id) });
  if (consulta.isError) return <Erro erro={mensagemDeErro(consulta.error, "Erro ao carregar os rateios.")} />;
  if (consulta.isPending) return <Carregando />;
  return (
    <TabelaEditavel
      titulo="Rateios"
      subtitulo="Bases das premissas: Produção pelo m³ produzido; Projeto pelo m³ produzido da venda Global; Metalurgia e Armadura pelo kg das linhas (o volume × a Metalúrgica (Interno) ou a Armadura (Interno) por Unidade); Acompanhamento pelos Acompanhamentos por Dia de Serviços. Sem base no mês, o percentual é zero."
      meses={consulta.data.meses}
      linhas={linhasDosRateios(consulta.data.rateios)}
      editavel={false}
      comReferencia={false}
      cabecalho="CHAVE E DESTINO"
    />
  );
}

/** Os rateios como linhas da tabela: por chave, o destino com a base e o percentual. */
function linhasDosRateios(rateios: Rateios["rateios"]): LinhaDaPremissa[] {
  return rateios.flatMap((r) => {
    const secao = r.rotulo.split(":")[0].toUpperCase();
    const grupo = r.rotulo.split(": ")[1] ?? r.rotulo;
    const linha = (chave: string, rotulo: string, und: string, valores: number[]): LinhaDaPremissa => ({
      chave,
      secao,
      grupo,
      rotulo,
      und,
      tipo: "CALCULO",
      casas: 2,
      referencia: null,
      valores,
      gravados: valores.map(() => false),
    });
    return [linha(`${r.chave}|${r.destino}|BASE`, "Base", r.base, r.bases), linha(`${r.chave}|${r.destino}`, "Percentual", "%", r.percentuais.map((p) => p * 100))];
  });
}
