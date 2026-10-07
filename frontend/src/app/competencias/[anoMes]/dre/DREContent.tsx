"use client";

import { Fragment, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronRight, Search } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { Abas } from "@/components/shared/Abas";
import { CampoBusca } from "@/components/shared/Filtros";
import { iniciaisMaiusculas } from "@/lib/texto";

import { dataHora, lerAnoMes, moeda } from "../utils/formatacao";
import { DetalheDialog } from "./components/DetalheDialog";
import { ExportarDRE } from "./components/ExportarDRE";
import { AcoesApuracao, SituacaoApuracao } from "./components/PainelApuracao";
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

function TabelaDRE({ linhas, anoMes, visao, titulo }: { linhas: LinhaDRE[]; anoMes: string; visao: VisaoDetalhe; titulo: string }) {
  const [aberta, setAberta] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<string | null>(null);
  // As linhas que chegam aos lançamentos abrem o detalhamento direto; as demais (totais, volumes) abrem a composição.
  const abre = (l: LinhaDRE) => !!l.composicao && !detalhavel(l);
  const clica = (l: LinhaDRE) => detalhavel(l) || abre(l);
  return (
    // Destaque amarelo-ouro à esquerda, como nos quadros da Receita Prévia.
    <div className="rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white">
      <table className="tabela-sig w-full border-collapse text-sm">
        {/* O cabeçalho fica preso no topo ao rolar a DRE (E10 do levantamento de layout). */}
        <thead>
          <tr className="border-b border-gray-200 text-xs font-bold text-gray-600">
            <th className="px-4 text-left">{iniciaisMaiusculas(titulo)}</th>
            <th className="w-48 px-4 text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {linhas
            .filter((l) => l.tipo !== "SECAO")
            .map((l) => {
              const destaque = l.tipo !== "ITEM";
              const aberto = aberta === l.codigo;
              return (
                <Fragment key={l.codigo}>
                  <tr
                    className={`border-t border-gray-100 ${destaque ? "bg-gray-50 font-bold" : ""} ${clica(l) ? "cursor-pointer hover:bg-gray-50" : ""}`}
                    onClick={() => (detalhavel(l) ? setDetalhe(l.codigo) : abre(l) ? setAberta(aberto ? null : l.codigo) : undefined)}
                    title={detalhavel(l) ? "Ver os lançamentos de origem" : undefined}
                  >
                    <td className={`px-4 py-1.5 ${destaque ? "text-gray-900" : "pl-8 text-gray-700"}`}>
                      <span className="inline-flex items-center gap-1">
                        {detalhavel(l) ? (
                          <Search className="size-3.5 text-gray-400" />
                        ) : abre(l) ? (
                          aberto ? <ChevronDown className="size-3.5 text-gray-400" /> : <ChevronRight className="size-3.5 text-gray-400" />
                        ) : null}
                        {l.descricao}
                      </span>
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums">
                      {l.valor === null ? "—" : ehVolume(l) ? volume(l.valor) : moeda(l.valor)}
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

function VisaoCentros({ anoMes }: { anoMes: string }) {
  const { user } = useAuth();
  const [grupo, setGrupo] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const grupos = useQuery({ queryKey: ["dre", anoMes, "grupos"], queryFn: () => dreService.grupos(anoMes) });
  const lista = grupos.data?.grupos ?? [];
  const escolhido = grupo ?? lista[0]?.grupo ?? null;
  const centros = useQuery({
    queryKey: ["dre", anoMes, "centros", escolhido],
    queryFn: () => dreService.centros(anoMes, escolhido!),
    enabled: escolhido !== null,
  });

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
  const dados = centros.data;
  const t = busca.trim().toLowerCase();
  const filtrados = lista.filter((g) => !t || g.grupo.toLowerCase().includes(t));
  return (
    // A lista dos centros, com busca e o total de cada um, à esquerda da DRE do centro (E11 do levantamento de layout).
    <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
      <div className="rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white lg:sticky lg:top-[calc(var(--topo-tabela,0px)+1rem)]">
        <div className="border-b border-gray-200 p-2">
          <CampoBusca rotulo="Buscar centro de custo" valor={busca} onMudar={setBusca} placeholder="Centro de custo…" largura="w-full" />
        </div>
        <ul className="max-h-[60vh] overflow-y-auto py-1" aria-label="Centros de custo">
          {filtrados.map((g) => (
            <li key={g.grupo}>
              <button
                type="button"
                onClick={() => setGrupo(g.grupo)}
                aria-current={g.grupo === escolhido ? "true" : undefined}
                className={`flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left text-sm ${g.grupo === escolhido ? "bg-black text-white" : "text-gray-800 hover:bg-gray-100"}`}
              >
                <span className="min-w-0">
                  <span className="block truncate" title={g.grupo}>
                    {g.grupo}
                  </span>
                  {g.centros > 1 ? <span className={`text-xs ${g.grupo === escolhido ? "text-gray-300" : "text-gray-500"}`}>{g.centros} centros</span> : null}
                </span>
                <span className="shrink-0 text-xs tabular-nums">{moeda(g.total)}</span>
              </button>
            </li>
          ))}
          {filtrados.length === 0 ? <li className="px-3 py-2 text-sm text-gray-500">Nenhum centro com esse nome.</li> : null}
        </ul>
      </div>

      <div className="min-w-0 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            {dados && dados.centros.length > 0 ? (
              <p className="text-xs text-gray-600">{dados.centros.map((c) => `${c.codigoRM ?? "sem código"} · ${c.nome}`).join("  |  ")}</p>
            ) : null}
            <p className="text-xs text-gray-500">
              Os lançamentos contábeis dos centros, diretos e de rateio, em todas as filiais, pela linha da DRE em que foram classificados — antes
              do rateio. Os centros são agrupados pela coluna CENTRO DE CUSTO (CONTROLADORIA) do cadastro.
            </p>
          </div>
          {escolhido && grupos.data?.apuradoEm ? <ExportarDRE anoMes={anoMes} visao={{ grupo: escolhido }} /> : null}
        </div>
        {centros.isError ? (
          <Erro erro={centros.error} padrao="Erro ao carregar o centro de custo." />
        ) : centros.isPending ? (
          <Carregando />
        ) : (
          <TabelaDRE linhas={dados?.linhas ?? []} anoMes={anoMes} visao={{ grupo: escolhido! }} titulo={escolhido ?? ""} />
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

  // A consolidada também traz o estado da competência e da apuração para o cabeçalho.
  const consolidado = useQuery({
    queryKey: ["dre", anoMes, "consolidado"],
    queryFn: () => dreService.consolidado(anoMes),
    enabled: periodo !== null,
  });
  const unidade = useQuery({
    queryKey: ["dre", anoMes, visao],
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
            <li>Clique numa linha com lupa para ver os lançamentos de origem; nas linhas com seta, a composição se abre logo abaixo.</li>
            <li>Use “Apurar Competência” (ou “Reapurar Competência”) depois de importar, classificar e lançar os ajustes do mês.</li>
            <li>Com o mês conferido, “Fechar Competência” congela os valores; “Reaberturas” mostra o histórico das reaberturas.</li>
            <li>Use “Exportar” para baixar a DRE em Excel ou PDF.</li>
          </ul>
        }
        sobre={
          <p>
            A DRE consolidada, a de cada unidade e a de cada centro de custo, a partir da classificação, dos rateios, da receita prévia e dos
            lançamentos manuais. Clique numa linha para ver como o valor foi formado e chegar aos lançamentos de origem.{" "}
            {cabecalho?.apuradoEm ? `Apurada em ${dataHora(cabecalho.apuradoEm)}.` : "Ainda não apurada."}
          </p>
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
        {visao !== "centros" && cabecalho?.apuradoEm ? <ExportarDRE anoMes={anoMes} visao={visao} /> : null}
      </div>

      {visao === "centros" ? (
        <VisaoCentros key={anoMes} anoMes={anoMes} />
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
