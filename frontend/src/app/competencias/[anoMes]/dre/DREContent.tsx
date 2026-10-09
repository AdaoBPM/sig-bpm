"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Search, Sigma } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { Abas } from "@/components/shared/Abas";
import { CampoBusca } from "@/components/shared/Filtros";

import { lerAnoMes, moeda, moedaInteira } from "../utils/formatacao";
import { DetalheDialog } from "./components/DetalheDialog";
import { ExportarDRE } from "./components/ExportarDRE";
import { AcoesApuracao, SituacaoApuracao, TextoApuracao } from "./components/PainelApuracao";
import { InfoAgrupamento } from "./components/InfoAgrupamento";
import { VolumesDialog } from "./components/VolumesDialog";
import { Agrupador, fundoDaLinha, SeletorNivel, useNiveisDRE } from "./components/NiveisDRE";
import { dreService, mensagemDeErro, ROTULO_CHAVE, UNIDADES, type LinhaDRE, type VisaoDetalhe } from "./services/dreService";

const ehVolume = (l: LinhaDRE) => l.grupoSigla === "P" || l.grupoSigla === "S";
const volume = (v: string) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

/** Consolidado, uma das unidades (1 a 5) ou a visão por centro de custo. */
type Visao = "consolidado" | "centros" | number;
const VISOES: Array<{ visao: Visao; nome: string }> = [
  { visao: "consolidado", nome: "Consolidado" },
  ...UNIDADES.map((u) => ({ visao: u.codigo as Visao, nome: u.nome })),
  { visao: "centros", nome: "Centros de custo" },
];

/**
 * Linhas que abrem o detalhamento até os lançamentos: os itens e os impostos
 * das unidades, desde que o usuário alcance as movimentações delas (o recorte
 * do Gestor por departamento, Passo 22, que o backend informa em podeDetalhar).
 */
const detalhavel = (l: LinhaDRE) => !ehVolume(l) && (l.tipo === "ITEM" || l.descricao === "Impostos Operacionais") && l.podeDetalhar !== false;

/** Linhas de volume (Produção, Expedição, Montagem, Acompanhamento): abrem as listas por obra, no consolidado e nas unidades. */
const listavel = (l: LinhaDRE, visao: VisaoDetalhe) => ehVolume(l) && l.tipo === "ITEM" && !("grupo" in visao);

function Composicao({ l }: { l: LinhaDRE }) {
  const c = l.composicao;
  if (!c) return null;
  return (
    <div className="space-y-1 text-xs text-gray-600">
      <p>{c.regra}</p>
      {c.direto !== undefined ? <p>Diretos: {moeda(c.direto)}</p> : null}
      {c.rateios?.map((r) => (
        <p key={`${r.chave}|${r.destino}`}>
          Rateio {ROTULO_CHAVE[r.chave] ?? r.chave}: {r.base.split(": ")[1] ? moeda(r.base.split(": ")[1]) : r.base} ×{" "}
          {(Number(r.percentual) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}% = {moeda(r.valor)}
        </p>
      ))}
      {c.unidades?.map((u) => (
        <p key={u.unidade}>
          {u.nome}: {ehVolume(l) ? volume(u.valor) : moeda(u.valor)}
        </p>
      ))}
      {c.centros?.map((cc) => (
        <p key={`${cc.codigoRM}|${cc.nome}`}>
          {cc.codigoRM ?? "sem código"} · {cc.nome}: {moeda(cc.valor)}
        </p>
      ))}
      {c.observacao ? <p className="text-gray-500">{c.observacao}</p> : null}
    </div>
  );
}


function TabelaDRE({
  linhas: todas,
  anoMes,
  visao,
  titulo,
  aoLadoDoTitulo,
}: {
  linhas: LinhaDRE[];
  anoMes: string;
  visao: VisaoDetalhe;
  titulo: string;
  /** Conteúdo logo depois do título (o botão de informação do centro de custo). */
  aoLadoDoTitulo?: ReactNode;
}) {
  // Os níveis (Totais, Atribuições, Contas) e os agrupadores, como no contorno da planilha.
  const niveis = useNiveisDRE(todas, "sig.dre.nivel");

  const [aberta, setAberta] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const [listasDe, setListasDe] = useState<LinhaDRE | null>(null);
  // As linhas que chegam aos lançamentos abrem o detalhamento; as de volume, as listas; as demais (totais) abrem a composição.
  const comLupa = (l: LinhaDRE) => detalhavel(l) || listavel(l, visao);
  const abre = (l: LinhaDRE) => !!l.composicao && !comLupa(l);
  const clica = (l: LinhaDRE) => comLupa(l) || abre(l);
  const nomeVisao = titulo.replace(/^DRE · /, "");
  return (
    // Destaque amarelo-ouro à esquerda, como nos quadros da Receita Prévia.
    <div className="rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white">
      {/* Título como nos quadros da Receita Prévia e de Rateios; fica preso no topo ao rolar a DRE (E10 do levantamento de layout). */}
      <div className="sticky top-[var(--topo-tabela,0px)] z-10 flex items-center gap-4 border-b border-gray-200 bg-bpm-primary px-4 py-3">
        {/* Os níveis da planilha (1, 2 e 3 do contorno do Excel), num menu. */}
        <SeletorNivel nivel={niveis.nivelGeral} onEscolher={niveis.escolherNivel} />
        <h2 className="text-base font-bold tracking-wide text-gray-900 uppercase">{titulo}</h2>
        {aoLadoDoTitulo}
        {/* Sobre a coluna dos valores (o px-4 é o mesmo das células). */}
        <span className="ml-auto text-base font-bold tracking-wide text-gray-900 uppercase">Valor</span>
      </div>
      <table className="tabela-sig w-full border-collapse text-sm">
        <tbody>
          {niveis.linhas
            .filter(niveis.visivel)
            .map((l) => {
              const destaque = l.tipo !== "ITEM";
              const aberto = aberta === l.codigo;
              return (
                <Fragment key={l.codigo}>
                  <tr
                    className={`${destaque ? "border-y border-gray-300 font-bold" : "border-t border-gray-100"} ${fundoDaLinha(l)} ${clica(l) ? "cursor-pointer hover:bg-gray-100" : ""}`}
                    onClick={() =>
                      detalhavel(l) ? setDetalhe(l.codigo) : listavel(l, visao) ? setListasDe(l) : abre(l) ? setAberta(aberto ? null : l.codigo) : undefined
                    }
                    title={detalhavel(l) ? "Ver os lançamentos de origem" : listavel(l, visao) ? "Ver as listas por obra" : abre(l) ? "Ver a composição" : undefined}
                  >
                    <td className={`py-1.5 pr-4 whitespace-nowrap ${niveis.recuo(l)} ${destaque ? "text-gray-900" : "text-gray-700"}`}>
                      <span className="inline-flex items-center gap-1">
                        {/* O agrupador da linha: abre e fecha o que está abaixo dela. */}
                        <Agrupador grupo={niveis.grupo(l)} fechado={niveis.fechado(l)} onAlternar={() => niveis.alternar(l.codigo)} />
                        {comLupa(l) ? <Search className="size-3.5 text-gray-400" /> : abre(l) ? <Sigma className="size-3.5 text-gray-400" /> : null}
                        {l.descricao}
                      </span>
                    </td>
                    <td className="px-4 py-1.5 text-right">
                      {/* Os valores sem os centavos; os volumes com as casas da lista. */}
                      {l.tipo === "SECAO" ? "" : l.valor === null ? "—" : ehVolume(l) ? volume(l.valor) : moedaInteira(l.valor)}
                    </td>
                  </tr>
                  {aberto && abre(l) ? (
                    <tr className="border-t border-gray-100 bg-gray-50/50">
                      <td colSpan={2} className="px-8 py-2">
                        <Composicao l={l} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
        </tbody>
      </table>
      {detalhe ? <DetalheDialog anoMes={anoMes} linha={detalhe} visao={visao} onFechar={() => setDetalhe(null)} /> : null}
      {listasDe ? (
        <VolumesDialog
          anoMes={anoMes}
          linha={listasDe.codigo}
          unidade={"unidade" in visao ? visao.unidade : undefined}
          nomeVisao={nomeVisao}
          valorApurado={listasDe.valor}
          onFechar={() => setListasDe(null)}
        />
      ) : null}
    </div>
  );
}

const Carregando = () => <div className="h-64 animate-pulse rounded-sm bg-gray-100" />;
const Erro = ({ erro, padrao }: { erro: unknown; padrao: string }) => (
  <div className="rounded-sm border border-red-200 bg-red-50 p-4">
    <p className="text-sm text-red-700">{mensagemDeErro(erro, padrao)}</p>
  </div>
);
const SemApuracao = () => (
  <div className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">
    Nenhuma apuração ainda. Apure os rateios e a receita prévia do mês e, depois, a DRE.
  </div>
);

/**
 * Na DRE de um centro de custo, só os custos de produção e de serviços e as
 * despesas de logística, técnicas, comerciais e administrativas, nas
 * atribuições de mão de obra (direta e indireta), de gastos gerais (variáveis,
 * diretos, indiretos e comerciais) e de depreciação que têm valor. Cada total
 * soma só as atribuições que aparecem.
 */
const TOTAIS_DO_CENTRO = new Set(["CPP", "CSM", "CSC", "DL", "DT", "DC", "DA"]);
const ATRIBUICOES_DO_CENTRO = new Set([
  "MÃO DE OBRA DIRETA",
  "MÃO DE OBRA INDIRETA",
  "GASTOS GERAIS VARIÁVEIS",
  "GASTOS GERAIS DIRETOS",
  "GASTOS GERAIS INDIRETOS",
  "GASTOS GERAIS COMERCIAIS",
  "DEPRECIAÇÃO",
]);
function linhasDoCentro(linhas: LinhaDRE[]) {
  const partes = (c: string) => c.split(".");
  const prefixo = (c: string) => partes(c).slice(0, 2).join(".");
  const mostradas = linhas.filter(
    (l) =>
      l.tipo !== "ITEM" &&
      partes(l.codigo).length === 3 &&
      TOTAIS_DO_CENTRO.has(partes(l.codigo)[0]) &&
      ATRIBUICOES_DO_CENTRO.has(l.descricao.trim().toUpperCase()) &&
      Number(l.valor ?? 0) !== 0,
  );
  const atribuicoes = new Set(mostradas.map((l) => prefixo(l.codigo)));
  // O total de cada grupo passa a ser a soma das atribuições mostradas, em centavos para não acumular erro.
  const soma = new Map<string, number>();
  for (const a of mostradas) {
    const g = partes(a.codigo)[0];
    soma.set(g, (soma.get(g) ?? 0) + Math.round(Number(a.valor) * 100));
  }
  return linhas
    .filter((l) => {
      if (l.tipo === "SECAO") return false;
      const p = partes(l.codigo);
      return p.length === 2 ? l.tipo !== "ITEM" && soma.has(p[0]) : atribuicoes.has(prefixo(l.codigo));
    })
    // Sem a composição (Σ): nos centros, os totais são a soma do que a tabela mostra.
    .map((l) => {
      const p = partes(l.codigo);
      return p.length === 2 ? { ...l, valor: (soma.get(p[0])! / 100).toFixed(2), composicao: null } : { ...l, composicao: null };
    });
}

function VisaoCentros({ anoMes, escolhido, onEscolher }: { anoMes: string; escolhido: string | null; onEscolher: (grupo: string) => void }) {
  const { user } = useAuth();
  const [busca, setBusca] = useState("");
  const grupos = useQuery({ queryKey: ["dre", anoMes, "grupos"], queryFn: () => dreService.grupos(anoMes) });
  const lista = grupos.data?.grupos ?? [];
  const centros = useQuery({
    queryKey: ["dre", anoMes, "centros", escolhido],
    queryFn: () => dreService.centros(anoMes, escolhido!),
    enabled: escolhido !== null,
  });
  const linhas = useMemo(() => linhasDoCentro(centros.data?.linhas ?? []), [centros.data]);

  if (grupos.isError) return <Erro erro={grupos.error} padrao="Erro ao carregar os centros de custo." />;
  if (grupos.isPending) return <Carregando />;
  if (lista.length === 0) {
    return user?.acesso.recorteDepartamento ? (
      <div className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">
        Nenhum centro de custo dos seus departamentos tem lançamento neste mês.
      </div>
    ) : (
      <SemApuracao />
    );
  }
  const t = busca.trim().toLowerCase();
  const filtrados = lista.filter((g) => !t || g.grupo.toLowerCase().includes(t));
  return (
    // A lista dos centros, com busca e o total de cada um, à esquerda da DRE do centro (E11 do levantamento de layout).
    <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
      <div className="rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white lg:sticky lg:top-[calc(var(--topo-tabela,0px)+1rem)]">
        <div className="border-b border-gray-200 p-2">
          <CampoBusca rotulo="Buscar centro de custo" valor={busca} onMudar={setBusca} placeholder="Centro de Custo…" largura="w-full" />
        </div>
        <ul className="max-h-[60vh] overflow-y-auto py-1" aria-label="Centros de custo">
          {filtrados.map((g) => (
            <li key={g.grupo}>
              <button
                type="button"
                onClick={() => onEscolher(g.grupo)}
                aria-current={g.grupo === escolhido ? "true" : undefined}
                className={`flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left text-sm ${g.grupo === escolhido ? "bg-black text-white" : "text-gray-800 hover:bg-gray-100"}`}
              >
                <span className="min-w-0 truncate" title={g.grupo}>
                  {g.grupo}
                </span>
                <span className="shrink-0 text-xs">{moeda(g.total)}</span>
              </button>
            </li>
          ))}
          {filtrados.length === 0 ? <li className="px-3 py-2 text-sm text-gray-500">Nenhum centro com esse nome.</li> : null}
        </ul>
      </div>

      <div className="min-w-0">
        {centros.isError ? (
          <Erro erro={centros.error} padrao="Erro ao carregar o centro de custo." />
        ) : centros.isPending ? (
          <Carregando />
        ) : (
          <>
            <TabelaDRE
              key={escolhido ?? ""}
              linhas={linhas}
              anoMes={anoMes}
              visao={{ grupo: escolhido! }}
              titulo={escolhido ?? ""}
              aoLadoDoTitulo={<InfoAgrupamento grupo={escolhido ?? ""} centros={centros.data?.centros ?? []} />}
            />
            {linhas.length === 0 ? (
              <p className="mt-3 text-sm text-gray-600">Este centro não tem custos nem despesas de mão de obra ou de gastos gerais neste mês.</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export function DREContent() {
  const { anoMes } = useParams<{ anoMes: string }>();
  useRegistrarAcessoTela(`/competencias/${anoMes}/dre`);
  const periodo = lerAnoMes(anoMes);
  const [visao, setVisao] = useState<Visao>("consolidado");
  const [avisos, setAvisos] = useState<string[]>([]);
  // O centro de custo escolhido fica aqui: o Exportar dele vai para a linha das abas, como nas demais visões.
  const [grupo, setGrupo] = useState<string | null>(null);
  const grupos = useQuery({ queryKey: ["dre", anoMes, "grupos"], queryFn: () => dreService.grupos(anoMes), enabled: periodo !== null && visao === "centros" });
  // O escolhido vale enquanto existir no mês; senão, o primeiro da lista.
  const listaGrupos = grupos.data?.grupos ?? [];
  const grupoEscolhido = (grupo && listaGrupos.some((g) => g.grupo === grupo) ? grupo : listaGrupos[0]?.grupo) ?? null;

  // A consolidada também traz o estado da competência e da apuração para o cabeçalho.
  const consolidado = useQuery({
    queryKey: ["dre", anoMes, "consolidado"],
    queryFn: () => dreService.consolidado(anoMes),
    enabled: periodo !== null,
  });
  const unidade = useQuery({
    // Chave própria ("unidade"): com a aba Consolidado aberta, ["dre", anoMes, visao] seria a mesma chave da consulta
    // consolidada, e a recarga depois da reapuração usava esta função, pedindo a "unidade consolidado" ao servidor.
    queryKey: ["dre", anoMes, "unidade", visao],
    queryFn: () => dreService.consultar(anoMes, visao as number),
    enabled: periodo !== null && typeof visao === "number",
  });

  if (!periodo) {
    return (
      <div className="rounded-sm border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">Competência inválida na URL: {anoMes}.</p>
      </div>
    );
  }
  const cabecalho = consolidado.data;
  const consulta = visao === "consolidado" ? consolidado : unidade;

  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="DRE"
        comoUsar={
          <ul>
            <li>Escolha a visão nas abas: Consolidado, cada unidade, RN ou Centros de Custo (com a lista dos centros à esquerda).</li>
            <li>Clique numa linha com lupa para ver os lançamentos de origem; nas linhas de volume (Produção, Expedição, Montagem, Acompanhamento), as listas somadas por obra. Nas linhas com Σ, a composição do valor se abre logo abaixo.</li>
            <li>No menu de níveis (a seta antes do título da tabela), escolha Totais, Atribuições ou Contas para recolher ou expandir a DRE nos três níveis da planilha; as contas, sem negrito, só aparecem em Contas. A seta à esquerda de cada total ou atribuição abre e fecha só aquele grupo.</li>
            <li>Em Centros de Custo, escolha o centro na lista à esquerda; o ícone de informação ao lado do nome mostra o agrupamento e os centros de custo agrupados.</li>
            <li>Use “Apurar Competência” (ou “Reapurar Competência”) depois de importar, classificar e lançar os ajustes do mês.</li>
            <li>Com o mês conferido, “Fechar Competência” congela os valores; “Reaberturas” mostra o histórico das reaberturas.</li>
            <li>Use “Exportar” para baixar a DRE em Excel ou PDF.</li>
          </ul>
        }
        sobre={
          <>
            <p>
              A DRE consolidada, a de cada unidade e a de cada centro de custo, a partir da classificação, dos rateios, da receita prévia e dos
              lançamentos manuais. Clique numa linha para ver como o valor foi formado e chegar aos lançamentos de origem.
            </p>
            <p>
              <TextoApuracao anoMes={anoMes} />
            </p>
          </>
        }
        acoes={<AcoesApuracao anoMes={anoMes} onAvisos={setAvisos} />}
      />

      <SituacaoApuracao anoMes={anoMes} />
      {avisos.length > 0 ? (
        <div className="flex items-start gap-2 rounded-sm border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <ul>{avisos.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      ) : null}

      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <Abas
            rotulo="Visão da DRE"
            ativa={String(visao)}
            onMudar={(c) => setVisao(VISOES.find((v) => String(v.visao) === c)!.visao)}
            abas={VISOES.map((v) => ({ chave: String(v.visao), rotulo: v.nome }))}
          />
        </div>
        {visao === "centros" ? (
          grupoEscolhido && grupos.data?.apuradoEm ? <ExportarDRE anoMes={anoMes} visao={{ grupo: grupoEscolhido }} /> : null
        ) : cabecalho?.apuradoEm ? (
          <ExportarDRE anoMes={anoMes} visao={visao} />
        ) : null}
      </div>

      {visao === "centros" ? (
        <VisaoCentros key={anoMes} anoMes={anoMes} escolhido={grupoEscolhido} onEscolher={setGrupo} />
      ) : consulta.isError ? (
        <Erro erro={consulta.error} padrao="Erro ao carregar a DRE." />
      ) : consulta.isPending ? (
        <Carregando />
      ) : (consulta.data?.linhas ?? []).some((l) => l.valor !== null) ? (
        <TabelaDRE
          key={String(visao)}
          linhas={consulta.data!.linhas}
          anoMes={anoMes}
          visao={visao === "consolidado" ? { consolidado: true } : { unidade: visao as number }}
          titulo={`DRE · ${VISOES.find((v) => v.visao === visao)?.nome ?? ""}`}
        />
      ) : (
        <SemApuracao />
      )}
    </div>
  );
}
