"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { StatusCompetenciaBadge } from "../../components/StatusCompetenciaBadge";
import { dataHora, lerAnoMes, MESES, moeda, rotuloCompetencia } from "../utils/formatacao";
import { DetalheDialog } from "./components/DetalheDialog";
import { ExportarDRE } from "./components/ExportarDRE";
import { PainelApuracao } from "./components/PainelApuracao";
import { dreService, mensagemDeErro, ROTULO_CHAVE, UNIDADES, type LinhaDRE, type VisaoDetalhe } from "./services/dreService";

const ehVolume = (l: LinhaDRE) => l.grupoSigla === "P" || l.grupoSigla === "S";
const volume = (v: string) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const selectClasse = "h-9 w-full max-w-xl rounded-sm border border-gray-300 bg-white px-3 text-sm";

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

function TabelaDRE({ linhas, anoMes, visao }: { linhas: LinhaDRE[]; anoMes: string; visao: VisaoDetalhe }) {
  const [aberta, setAberta] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const abre = (l: LinhaDRE) => !!l.composicao || detalhavel(l);
  return (
    <div className="border border-gray-200 bg-white rounded-sm">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {linhas
            .filter((l) => l.tipo !== "SECAO")
            .map((l) => {
              const destaque = l.tipo !== "ITEM";
              const aberto = aberta === l.codigo;
              return (
                <Fragment key={l.codigo}>
                  <tr
                    className={`border-t border-gray-100 ${destaque ? "bg-gray-50 font-bold" : ""} ${abre(l) ? "cursor-pointer hover:bg-gray-50" : ""}`}
                    onClick={() => (abre(l) ? setAberta(aberto ? null : l.codigo) : undefined)}
                  >
                    <td className={`px-4 py-1.5 ${destaque ? "text-gray-900" : "pl-8 text-gray-700"}`}>
                      <span className="inline-flex items-center gap-1">
                        {abre(l) ? (aberto ? <ChevronDown className="size-3.5 text-gray-400" /> : <ChevronRight className="size-3.5 text-gray-400" />) : null}
                        {l.descricao}
                      </span>
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums">
                      {l.valor === null ? "—" : ehVolume(l) ? volume(l.valor) : moeda(l.valor)}
                    </td>
                  </tr>
                  {aberto && abre(l) ? (
                    <tr className="border-t border-gray-100 bg-gray-50/50">
                      <td colSpan={2} className="space-y-2 px-8 py-2">
                        <Composicao l={l} />
                        {detalhavel(l) ? (
                          <Button type="button" variant="outline" size="sm" className="rounded-sm" onClick={() => setDetalhe(l.codigo)}>
                            <Search className="size-3.5" />
                            Ver lançamentos de origem
                          </Button>
                        ) : null}
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
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="dre-grupo" className="text-sm font-medium text-gray-900">
          Centro de custo
        </label>
        <div className="flex items-center gap-2">
          <select id="dre-grupo" value={escolhido ?? ""} onChange={(e) => setGrupo(e.target.value)} className={selectClasse}>
            {lista.map((g) => (
              <option key={g.grupo} value={g.grupo}>
                {g.grupo} — {moeda(g.total)}
                {g.centros > 1 ? ` (${g.centros} centros)` : ""}
              </option>
            ))}
          </select>
          {escolhido && grupos.data?.apuradoEm ? <ExportarDRE anoMes={anoMes} visao={{ grupo: escolhido }} /> : null}
        </div>
        <p className="text-xs text-gray-500">
          Os lançamentos contábeis dos centros, diretos e de rateio, em todas as filiais, pela linha da DRE em que foram
          classificados — antes do rateio. Os centros são agrupados pela coluna CENTRO DE CUSTO (CONTROLADORIA) do cadastro.
        </p>
      </div>
      {dados && dados.centros.length > 0 ? (
        <p className="text-xs text-gray-600">
          {dados.centros.map((c) => `${c.codigoRM ?? "sem código"} · ${c.nome}`).join("  |  ")}
        </p>
      ) : null}
      {centros.isError ? (
        <Erro erro={centros.error} padrao="Erro ao carregar o centro de custo." />
      ) : centros.isPending ? (
        <Carregando />
      ) : (
        <TabelaDRE linhas={dados?.linhas ?? []} anoMes={anoMes} visao={{ grupo: escolhido! }} />
      )}
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
      <div className="space-y-2">
        <Link href="/competencias" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="size-4" />
          Competências
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">DRE · {rotuloCompetencia(periodo.ano, periodo.mes)}</h1>
              <span className="text-sm text-gray-400">{MESES[periodo.mes - 1]}</span>
              {cabecalho ? <StatusCompetenciaBadge status={cabecalho.competencia.status} /> : null}
            </div>
            <p className="text-sm text-gray-600">
              A DRE consolidada, a de cada unidade e a de cada centro de custo, a partir da classificação, dos rateios, da
              receita prévia e dos lançamentos manuais. Clique numa linha para ver como o valor foi formado e chegar aos lançamentos de origem.{" "}
              {cabecalho?.apuradoEm ? `Apurada em ${dataHora(cabecalho.apuradoEm)}.` : "Ainda não apurada."}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {VISOES.map((v) => (
          <button
            key={String(v.visao)}
            type="button"
            onClick={() => setVisao(v.visao)}
            className={`rounded-sm border px-3 py-1.5 text-sm font-medium ${visao === v.visao ? "border-black bg-black text-white" : "border-gray-300 text-gray-900 hover:bg-gray-100"}`}
          >
            {v.nome}
          </button>
        ))}
        {visao !== "centros" && cabecalho?.apuradoEm ? (
          <div className="ml-auto">
            <ExportarDRE anoMes={anoMes} visao={visao} />
          </div>
        ) : null}
      </div>

      <PainelApuracao anoMes={anoMes} onAvisos={setAvisos} />
      {avisos.length > 0 ? (
        <div className="flex items-start gap-2 rounded-sm border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <ul>{avisos.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      ) : null}

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
        />
      ) : (
        <SemApuracao />
      )}
    </div>
  );
}
