"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

import { BaldeBadge } from "@/components/shared/BaldeBadge";
import { DataTable } from "@/components/shared/DataTable";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { Parametros } from "@/components/shared/Parametros";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { AvisoCongelado } from "../../components/AvisoCongelado";
import { apuracaoService } from "../../services/apuracaoService";
import { StatusCompetenciaBadge } from "../../components/StatusCompetenciaBadge";
import { dataHora, inteiro, lerAnoMes, MESES, moeda, rotuloCompetencia } from "../utils/formatacao";
import { VALIDACOES, ValidacaoBadge } from "./components/ValidacaoBadge";
import {
  classificacaoService,
  type LancamentoClassificado,
  type Situacao,
  type Validacao,
} from "./services/classificacaoService";

const POR_PAGINA = 50;

function Filtro({
  ativo,
  onClick,
  rotulo,
  quantidade,
  destaque,
}: {
  ativo: boolean;
  onClick: () => void;
  rotulo: string;
  quantidade: number;
  destaque?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-sm border px-3 py-1.5 text-sm font-medium ${
        ativo
          ? "border-black bg-black text-white"
          : destaque
            ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
            : "border-gray-300 bg-white text-gray-900 hover:bg-gray-100"
      }`}
    >
      {rotulo} <span className="tabular-nums opacity-80">{inteiro(quantidade)}</span>
    </button>
  );
}

function CelulaCentro({ l }: { l: LancamentoClassificado }) {
  if (!l.codigoCentroCusto) {
    return <span className="text-xs text-gray-400">sem centro de custo</span>;
  }
  const obra = /^1\.9[89](\.|$)/.test(l.codigoCentroCusto);
  return (
    <div>
      <div className="font-medium tabular-nums text-gray-900">{l.codigoCentroCusto}</div>
      <div className="max-w-56 truncate text-xs text-gray-600" title={l.nomeCentroCusto ?? ""}>
        {l.nomeCentroCusto}
      </div>
      {l.centroCusto ? (
        <Parametros
          departamento={l.centroCusto.departamento}
          atribuicao={l.centroCusto.atribuicao}
        />
      ) : (
        <span className="text-xs text-gray-400">{obra ? "obra" : "fora do cadastro"}</span>
      )}
    </div>
  );
}

function CelulaConta({ l }: { l: LancamentoClassificado }) {
  const adotada = l.contaAdotada ?? l.contaResultado;
  return (
    <div>
      {l.reclassificado ? (
        <div className="flex items-center gap-1 text-xs text-gray-400 line-through">
          <span className="tabular-nums">{l.contaResultado.reduzido}</span>
          <span className="max-w-48 truncate">{l.contaResultado.descricao}</span>
        </div>
      ) : null}
      <div className="flex items-center gap-1 text-gray-900">
        {l.reclassificado ? (
          <ArrowRight className="size-3.5 shrink-0 text-yellow-700" aria-label="reclassificada" />
        ) : null}
        <span className="tabular-nums">{adotada.reduzido}</span>
        <span className="max-w-56 truncate" title={adotada.descricao}>
          {adotada.descricao}
        </span>
      </div>
      <Parametros departamento={adotada.departamento} atribuicao={adotada.atribuicao} />
    </div>
  );
}

export function ClassificacaoContent() {
  const { anoMes } = useParams<{ anoMes: string }>();
  useRegistrarAcessoTela(`/competencias/${anoMes}/classificacao`);
  const periodo = lerAnoMes(anoMes);
  const queryClient = useQueryClient();

  const [situacao, setSituacao] = useState<Situacao>("PENDENCIAS");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const buscaDebounced = useDebounce(busca, 300);

  const apuracao = useQuery({ queryKey: ["apuracao", anoMes], queryFn: () => apuracaoService.situacao(anoMes) });
  const resumo = useQuery({
    queryKey: ["classificacao", anoMes, "resumo"],
    queryFn: () => classificacaoService.resumo(anoMes),
    enabled: periodo !== null,
  });

  const lista = useQuery({
    queryKey: ["classificacao", anoMes, "lancamentos", situacao, buscaDebounced, pagina],
    queryFn: () =>
      classificacaoService.lancamentos(anoMes, {
        situacao,
        busca: buscaDebounced || undefined,
        pagina,
        porPagina: POR_PAGINA,
      }),
    enabled: periodo !== null,
    placeholderData: keepPreviousData,
  });

  const reclassificar = useMutation({
    mutationFn: () => classificacaoService.reclassificar(anoMes),
    onSuccess: (r) => {
      toast.success(
        `${inteiro(r.lancamentos)} lançamentos classificados em ${(r.duracaoMs / 1000).toFixed(1)} s.`,
      );
      queryClient.invalidateQueries({ queryKey: ["classificacao", anoMes] });
    },
    onError: (e) => {
      toast.error(
        (e as { response?: { data?: { error?: string } } }).response?.data?.error ??
          "Não foi possível reclassificar.",
      );
    },
  });

  if (!periodo) {
    return (
      <div className="rounded-sm border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">Competência inválida na URL: {anoMes}.</p>
      </div>
    );
  }

  const r = resumo.data;
  const quantidade = (v: Validacao) =>
    r?.porValidacao.find((g) => g.validacao === v)?.lancamentos ?? 0;
  const pendenciasPorTipo = (Object.keys(VALIDACOES) as Validacao[]).filter(
    (v) => v !== "OK" && quantidade(v) > 0,
  );
  const fechada = r?.competencia.status === "FECHADA";
  // Apurada, a classificação faz parte do retrato congelado: só a reapuração a refaz.
  const apurada = apuracao.data?.apurada ?? false;
  const totalPaginas = Math.max(1, Math.ceil((lista.data?.total ?? 0) / POR_PAGINA));

  function filtrar(s: Situacao) {
    setSituacao(s);
    setPagina(1);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/competencias"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="size-4" />
          Competências
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
                Classificação · {rotuloCompetencia(periodo.ano, periodo.mes)}
              </h1>
              <span className="text-sm text-gray-400">{MESES[periodo.mes - 1]}</span>
              {r ? <StatusCompetenciaBadge status={r.competencia.status} /> : null}
            </div>
            <p className="text-sm text-gray-600">
              Destino de cada lançamento do balancete na DRE e a verificação da coluna
              LANÇ. OK?. A correção é sempre no cadastro — depois dela, reclassifique.
            </p>
          </div>
          {!fechada && !apurada ? (
            <PermissionGuard permission="classificacao:editar">
              <Button
                type="button"
                variant="outline"
                onClick={() => reclassificar.mutate()}
                disabled={reclassificar.isPending || !r || r.total === 0}
                className="rounded-sm border border-black text-black hover:bg-gray-100"
              >
                <RefreshCw className={`size-4 ${reclassificar.isPending ? "animate-spin" : ""}`} />
                {reclassificar.isPending ? "Reclassificando…" : "Reclassificar"}
              </Button>
            </PermissionGuard>
          ) : null}
        </div>
      </div>

      {fechada || apurada ? <AvisoCongelado anoMes={anoMes} fechada={fechada} oQue="da classificação" /> : null}

      {r && r.total > 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { rotulo: "Lançamentos", valor: r.total },
            { rotulo: "Pendências", valor: r.pendentes, erro: r.pendentes > 0 },
            { rotulo: "Reclassificados", valor: r.reclassificados, detalhe: "pelo cadastro de reclassificação" },
            {
              rotulo: "Classificado em",
              texto: r.classificadoEm ? dataHora(r.classificadoEm) : "nunca",
            },
          ].map((k) => (
            <div key={k.rotulo} className="border border-gray-200 bg-white rounded-sm p-4">
              <p className="text-xs font-bold tracking-wide text-gray-600 uppercase">{k.rotulo}</p>
              <p
                className={`mt-1 font-extrabold tabular-nums ${k.texto ? "text-base" : "text-2xl"} ${
                  k.erro ? "text-red-700" : "text-gray-900"
                }`}
              >
                {k.texto ?? inteiro(k.valor ?? 0)}
              </p>
              {k.detalhe ? <p className="mt-0.5 text-xs text-gray-500">{k.detalhe}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      {r && r.naoClassificados > 0 ? (
        <div className="flex items-center gap-2 rounded-sm border border-yellow-200 bg-yellow-50 p-4">
          <AlertTriangle className="size-4 shrink-0 text-yellow-800" />
          <p className="text-sm text-yellow-800">
            {inteiro(r.naoClassificados)} lançamento(s) ainda sem classificação. Use
            Reclassificar para calculá-los.
          </p>
        </div>
      ) : null}

      {r && r.total === 0 ? (
        <div className="border border-gray-200 bg-white rounded-sm py-12 text-center">
          <p className="text-sm font-medium text-gray-900">Nenhum lançamento nesta competência</p>
          <p className="mt-1 text-sm text-gray-600">
            Importe o balancete em{" "}
            <Link href={`/competencias/${anoMes}/importar`} className="underline">
              Importações
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 bg-white rounded-sm">
          <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              <Filtro
                ativo={situacao === "PENDENCIAS"}
                onClick={() => filtrar("PENDENCIAS")}
                rotulo="Pendências"
                quantidade={r?.pendentes ?? 0}
                destaque={(r?.pendentes ?? 0) > 0}
              />
              {pendenciasPorTipo.map((v) => (
                <Filtro
                  key={v}
                  ativo={situacao === v}
                  onClick={() => filtrar(v)}
                  rotulo={VALIDACOES[v].codigo.startsWith("<") ? VALIDACOES[v].codigo : VALIDACOES[v].rotulo}
                  quantidade={quantidade(v)}
                />
              ))}
              <Filtro
                ativo={situacao === "TODOS"}
                onClick={() => filtrar("TODOS")}
                rotulo="Todos"
                quantidade={r?.total ?? 0}
              />
            </div>
            <div className="relative w-full lg:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setPagina(1);
                }}
                placeholder="Centro ou conta…"
                className="rounded-sm border-gray-300 pl-9"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <DataTable<LancamentoClassificado>
              data={lista.data?.itens ?? []}
              isLoading={lista.isPending}
              error={lista.isError ? "Erro ao carregar os lançamentos." : null}
              emptyMessage={
                situacao === "PENDENCIAS" ? "Nenhuma pendência de classificação" : "Nenhum lançamento encontrado"
              }
              emptyHint={
                situacao === "PENDENCIAS"
                  ? "Todos os lançamentos têm destino e passaram na verificação."
                  : "Ajuste a busca ou o filtro."
              }
              columns={["Filial", "Centro de custo", "Conta", "Verificação", "Rateio", "Linha da DRE", "Valor"]}
              renderRow={(l) => (
                <tr key={l.id} className="border-b border-gray-100 align-top hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm tabular-nums text-gray-900">{l.filial}</td>
                  <td className="px-4 py-3 text-sm">
                    <CelulaCentro l={l} />
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <CelulaConta l={l} />
                  </td>
                  <td className="px-4 py-3">
                    <ValidacaoBadge validacao={l.validacao} />
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <BaldeBadge balde={l.balde} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {l.linhaDRE?.descricao ?? <span className="text-red-700">sem destino</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums whitespace-nowrap text-gray-900">
                    {moeda(l.valorMovimento)}
                  </td>
                </tr>
              )}
            />
          </div>

          {lista.data && lista.data.total > POR_PAGINA ? (
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm text-gray-600">
              <span className="tabular-nums">
                {inteiro((pagina - 1) * POR_PAGINA + 1)}–
                {inteiro(Math.min(pagina * POR_PAGINA, lista.data.total))} de{" "}
                {inteiro(lista.data.total)}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pagina <= 1}
                  onClick={() => setPagina((p) => p - 1)}
                  className="rounded-sm"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pagina >= totalPaginas}
                  onClick={() => setPagina((p) => p + 1)}
                  className="rounded-sm"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
