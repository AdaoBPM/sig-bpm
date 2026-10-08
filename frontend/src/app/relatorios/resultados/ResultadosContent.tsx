"use client";

import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Abas } from "@/components/shared/Abas";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { CampoBusca } from "@/components/shared/Filtros";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { Agrupador, SeletorNivel, useNiveisDRE } from "../../competencias/[anoMes]/dre/components/NiveisDRE";
import { ExportarRelatorio } from "../components/ExportarRelatorio";
import { SeletorPeriodo, useExercicios } from "../components/SeletorPeriodo";
import { formato, mensagemDeErro, relatoriosService, type Celula, type LinhaResultado, type Resultados } from "../services/relatoriosService";

/** As visões da DRE, como as abas Resultados (…) da planilha, e os centros de custo. */
const VISOES = [
  { chave: "0", nome: "Consolidado" },
  { chave: "1", nome: "Matriz" },
  { chave: "2", nome: "Filial" },
  { chave: "3", nome: "Serviços" },
  { chave: "4", nome: "Despesas e Extra" },
  { chave: "5", nome: "RN" },
  { chave: "centros", nome: "Centros de Custo" },
];

const Carregando = () => <div className="h-64 animate-pulse rounded-sm bg-gray-100" />;
const Erro = ({ erro, padrao }: { erro: unknown; padrao: string }) => (
  <div className="rounded-sm border border-red-200 bg-red-50 p-4">
    <p className="text-sm text-red-700">{mensagemDeErro(erro, padrao)}</p>
  </div>
);

const valorDa = (l: LinhaResultado, c: Celula) => (l.tipo === "SECAO" ? "" : c.valor === null ? "—" : formato.valor(c.valor));
/** Sem base (linhas de volume, contas sem R$/m³): em branco; base zerada: traço. */
const fracao = (l: LinhaResultado, v: number | null, temBase: boolean) => (l.tipo === "SECAO" || l.volume || !temBase ? "" : v === null ? "—" : formato.pct(v));
const unitario = (l: LinhaResultado, v: number | null) => (l.tipo === "SECAO" || l.volume || v === null ? "" : formato.valor(v));

/**
 * A tabela de uma visão: a descrição presa à esquerda e os rótulos presos no
 * topo, com rolagem própria nos dois sentidos (a tabela é larga). As colunas
 * seguem a aba da planilha: cada mês (valor e %), o mês escolhido (valor, % e
 * R$/m³) e o total do exercício (valor, % e R$/m³).
 */
function TabelaResultados({ dados, titulo }: { dados: Resultados; titulo: string }) {
  const niveis = useNiveisDRE(dados.linhas, "sig.resultados.nivel");
  const mesAte = dados.meses[dados.meses.length - 1];
  const temPct = (l: LinhaResultado) => !l.volume && (l.meses.some((c) => c.pct !== null) || l.total.pct !== null);
  const ano = String(dados.ano).slice(2);
  const th = "px-2 py-2 text-right text-xs font-bold whitespace-nowrap text-gray-900";
  return (
    // Destaque amarelo-ouro à esquerda, como na DRE. O --topo-tabela zerado prende os rótulos no topo da própria rolagem.
    <div className="max-h-[calc(100vh-14rem)] overflow-auto rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white [--topo-tabela:0px]">
      <table className="tabela-sig w-max min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-300">
            <th className="left-0 !z-20 min-w-80 px-3 py-2 text-left">
              <span className="flex items-center gap-3">
                <SeletorNivel nivel={niveis.nivelGeral} onEscolher={niveis.escolherNivel} />
                <span className="text-sm font-bold tracking-wide text-gray-900 uppercase">{titulo}</span>
              </span>
            </th>
            {dados.meses.map((m) => (
              <Fragment key={m.mes}>
                <th className={`${th} border-l border-gray-300`}>{m.rotulo}</th>
                <th className={th}>%</th>
              </Fragment>
            ))}
            <th className={`${th} border-l border-gray-300`}>{mesAte.rotulo}</th>
            <th className={th}>%</th>
            <th className={th}>R$/m³</th>
            <th className={`${th} border-l border-gray-300`}>TOTAL/{ano}</th>
            <th className={th}>%</th>
            <th className={th}>R$/m³</th>
          </tr>
        </thead>
        <tbody>
          {niveis.linhas.filter(niveis.visivel).map((l) => {
            const destaque = l.tipo !== "ITEM";
            const fundo = destaque ? "bg-gray-50" : "bg-white";
            const ultimo = l.meses[l.meses.length - 1];
            const td = "px-2 py-1.5 text-right whitespace-nowrap";
            const pct = `${td} text-xs ${destaque ? "text-gray-700" : "text-gray-500"}`;
            return (
              <tr key={l.codigo} className={destaque ? "border-y border-gray-300 font-bold" : "border-t border-gray-100"}>
                <td className={`sticky left-0 z-10 min-w-80 py-1.5 pr-3 ${fundo} ${niveis.recuo(l)} ${destaque ? "text-gray-900" : "text-gray-700"}`}>
                  <span className="inline-flex items-center gap-1">
                    <Agrupador grupo={niveis.grupo(l)} fechado={niveis.fechado(l)} onAlternar={() => niveis.alternar(l.codigo)} />
                    {l.descricao}
                  </span>
                </td>
                {l.meses.map((c, i) => (
                  <Fragment key={i}>
                    <td className={`${td} border-l border-gray-100 ${fundo}`}>{valorDa(l, c)}</td>
                    <td className={`${pct} ${fundo}`}>{fracao(l, c.pct, temPct(l))}</td>
                  </Fragment>
                ))}
                <td className={`${td} border-l border-gray-300 ${fundo}`}>{valorDa(l, ultimo)}</td>
                <td className={`${pct} ${fundo}`}>{fracao(l, ultimo.pct, temPct(l))}</td>
                <td className={`${pct} ${fundo}`}>{unitario(l, ultimo.unitario)}</td>
                <td className={`${td} border-l border-gray-300 ${fundo}`}>{valorDa(l, l.total)}</td>
                <td className={`${pct} ${fundo}`}>{fracao(l, l.total.pct, temPct(l))}</td>
                <td className={`${pct} ${fundo}`}>{unitario(l, l.total.unitario)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Os centros de custo: a lista dos agrupamentos à esquerda, como na DRE, e a tabela do escolhido. */
const chaveCentros = (ano: number, ate: number) => ["relatorios", "resultados", ano, ate, "centros"];

/** O centro escolhido vale enquanto existir no período; senão, o primeiro da lista. */
function useCentroEscolhido(ano: number, ate: number, ativo: boolean, escolhido: string | null) {
  const grupos = useQuery({ queryKey: chaveCentros(ano, ate), queryFn: () => relatoriosService.centros(ano, ate), enabled: ativo });
  const lista = grupos.data?.grupos ?? [];
  return { grupos, lista, grupo: (escolhido && lista.some((g) => g.grupo === escolhido) ? escolhido : lista[0]?.grupo) ?? null };
}

function VisaoCentros({ ano, ate, escolhido, onEscolher }: { ano: number; ate: number; escolhido: string | null; onEscolher: (g: string) => void }) {
  const [busca, setBusca] = useState("");
  const { grupos, lista, grupo } = useCentroEscolhido(ano, ate, true, escolhido);
  const centro = useQuery({
    queryKey: ["relatorios", "resultados", ano, ate, "centros", grupo],
    queryFn: () => relatoriosService.centro(ano, ate, grupo!),
    enabled: grupo !== null,
  });
  if (grupos.isError) return <Erro erro={grupos.error} padrao="Erro ao carregar os centros de custo." />;
  if (grupos.isPending) return <Carregando />;
  if (lista.length === 0) return <p className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">Nenhum centro de custo com valor no período.</p>;
  const t = busca.trim().toLowerCase();
  const filtrados = lista.filter((g) => !t || g.grupo.toLowerCase().includes(t));
  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
      <div className="rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white">
        <div className="border-b border-gray-200 p-2">
          <CampoBusca rotulo="Buscar centro de custo" valor={busca} onMudar={setBusca} placeholder="Centro de Custo…" largura="w-full" />
        </div>
        <ul className="max-h-[60vh] overflow-y-auto py-1" aria-label="Centros de custo">
          {filtrados.map((g) => (
            <li key={g.grupo}>
              <button
                type="button"
                onClick={() => onEscolher(g.grupo)}
                aria-current={g.grupo === grupo ? "true" : undefined}
                className={`flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left text-sm ${g.grupo === grupo ? "bg-black text-white" : "text-gray-800 hover:bg-gray-100"}`}
              >
                <span className="min-w-0 truncate" title={g.grupo}>
                  {g.grupo}
                </span>
                <span className="shrink-0 text-xs">{formato.valor(Number(g.total))}</span>
              </button>
            </li>
          ))}
          {filtrados.length === 0 ? <li className="px-3 py-2 text-sm text-gray-500">Nenhum centro com esse nome.</li> : null}
        </ul>
      </div>
      <div className="min-w-0">
        {centro.isError ? (
          <Erro erro={centro.error} padrao="Erro ao carregar o centro de custo." />
        ) : centro.isPending ? (
          <Carregando />
        ) : (
          <TabelaResultados key={grupo ?? ""} dados={centro.data} titulo={grupo ?? ""} />
        )}
      </div>
    </div>
  );
}

function VisaoUnidade({ ano, ate, visao, nome }: { ano: number; ate: number; visao: number; nome: string }) {
  const consulta = useQuery({ queryKey: ["relatorios", "resultados", ano, ate, "visao", visao], queryFn: () => relatoriosService.resultados(ano, ate, visao) });
  if (consulta.isError) return <Erro erro={consulta.error} padrao="Erro ao carregar os resultados." />;
  if (consulta.isPending) return <Carregando />;
  return <TabelaResultados key={visao} dados={consulta.data} titulo={`Resultados · ${nome}`} />;
}

export function ResultadosContent() {
  useRegistrarAcessoTela("/relatorios/resultados");
  const exercicios = useExercicios();
  const [anoEscolhido, setAno] = useState<number | null>(null);
  const [ateEscolhido, setAte] = useState<number | null>(null);
  const [visao, setVisao] = useState("0");
  // O centro escolhido fica aqui: o Exportar dele vai para a linha das abas, como nas demais visões.
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const ano = anoEscolhido ?? exercicios.anos[0];
  const meses = ano ? exercicios.mesesDe(ano) : [];
  // O mês escolhido vale se foi apurado no exercício; senão, o último apurado.
  const ate = ateEscolhido && meses.includes(ateEscolhido) ? ateEscolhido : meses[meses.length - 1];
  const { grupo } = useCentroEscolhido(ano ?? 0, ate ?? 0, visao === "centros" && !!ano && !!ate, escolhido);
  const periodo = { ano, ate };
  const opcoesExportar = [
    {
      chave: "atual",
      excel: "Visão Atual",
      pdf: "Visão Atual",
      params: visao === "centros" ? { ...periodo, grupo: grupo ?? "" } : { ...periodo, visao },
    },
    { chave: "unidades", excel: "Todas as Unidades (uma por aba)", pdf: "Todas as Unidades (uma por página)", params: { ...periodo, escopo: "unidades" } },
    { chave: "centros", excel: "Todos os Centros de Custo (um por aba)", pdf: "Todos os Centros de Custo (um por página)", params: { ...periodo, escopo: "centros" } },
  ];

  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Resultados"
        comoUsar={
          <ul>
            <li>Escolha o exercício e o mês até onde ver; os meses seguintes e os não apurados ficam de fora.</li>
            <li>Escolha a visão nas abas: Consolidado, cada unidade ou Centros de Custo (com a lista dos centros à esquerda).</li>
            <li>No menu de níveis (a seta antes do título da tabela), escolha Totais, Atribuições ou Contas; a seta de cada total ou atribuição abre e fecha só aquele grupo.</li>
            <li>A tabela rola para os lados: a descrição e os rótulos ficam presos. No fim, o mês escolhido e o total do exercício, com o valor por m³.</li>
            <li>Use “Exportar” para baixar em Excel (todas as colunas) ou PDF (A4 deitada: cada mês com a participação embaixo, e o total com o % e o R$/m³): a visão atual, todas as unidades ou todos os centros de custo.</li>
          </ul>
        }
        sobre={
          <>
            <p>
              As visões da DRE mês a mês no exercício, como as abas Resultados do BASE REALIZADO (RESULTADOS): o valor e a participação (%) de
              cada mês, o mês escolhido e o total do exercício com o valor unitário (R$/m³). Os valores são os apurados (congelados) de cada
              competência.
            </p>
            <p>
              A participação é sobre a ROB nas receitas e nos impostos; sobre a Receita Líquida do Pré-Fabricado nos custos de produção (na
              Filial, sobre a ROL); sobre a Receita Líquida de Montagem e a Complementar nos custos de serviços; sobre a Receita Líquida de Frete
              no Frete e Descarga; e sobre a ROL no resto. O valor unitário divide a receita e os custos do pré-fabricado pela produção (m³) e os
              de montagem pela montagem (m³). Em Despesas e Extra, no RN e nos centros de custo, as bases são as do Consolidado.
            </p>
            <p>Nos centros de custo, cada mês mostra o mesmo recorte da DRE: os custos e despesas de mão de obra, gastos gerais e depreciação.</p>
          </>
        }
      />

      {exercicios.carregando ? (
        <Carregando />
      ) : !ano || !ate ? (
        <p className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">Nenhuma competência apurada ainda.</p>
      ) : (
        <>
          <SeletorPeriodo
            ano={ano}
            ate={ate}
            anos={exercicios.anos}
            meses={meses}
            onAno={(a) => {
              setAno(a);
              setAte(null);
            }}
            onAte={setAte}
          />
          <div className="flex items-end gap-3">
            <div className="min-w-0 flex-1">
              <Abas rotulo="Visão dos resultados" ativa={visao} onMudar={setVisao} abas={VISOES.map((v) => ({ chave: v.chave, rotulo: v.nome }))} />
            </div>
            {visao !== "centros" || grupo ? <ExportarRelatorio caminho="resultados" opcoes={opcoesExportar} padrao={`Resultados ${ano}`} /> : null}
          </div>
          {visao === "centros" ? (
            <VisaoCentros ano={ano} ate={ate} escolhido={escolhido} onEscolher={setEscolhido} />
          ) : (
            <VisaoUnidade ano={ano} ate={ate} visao={Number(visao)} nome={VISOES.find((v) => v.chave === visao)!.nome} />
          )}
        </>
      )}
    </div>
  );
}
