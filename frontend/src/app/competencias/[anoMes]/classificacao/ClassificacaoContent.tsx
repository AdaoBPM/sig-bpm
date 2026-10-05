"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { BaldeBadge } from "@/components/shared/BaldeBadge";
import { DataTable } from "@/components/shared/DataTable";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { Parametros } from "@/components/shared/Parametros";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/useDebounce";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { atualizarCompetencia } from "@/lib/atualizarCompetencia";

import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { Abas } from "@/components/shared/Abas";
import { FaixaIndicadores } from "@/components/shared/FaixaIndicadores";
import { CampoBusca } from "@/components/shared/Filtros";
import { Paginacao } from "@/components/shared/Paginacao";
import { QuadroTabela } from "@/components/shared/QuadroTabela";
import { AvisoCongelado } from "../../components/AvisoCongelado";
import { apuracaoService } from "../../services/apuracaoService";
import { dataHora, inteiro, lerAnoMes, moeda } from "../utils/formatacao";
import { VALIDACOES, ValidacaoBadge } from "./components/ValidacaoBadge";
import {
  classificacaoService,
  type LancamentoClassificado,
  type Situacao,
  type Validacao,
} from "./services/classificacaoService";

const POR_PAGINA_INICIAL = 50;

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
  const [porPagina, setPorPagina] = useState(POR_PAGINA_INICIAL);
  const buscaDebounced = useDebounce(busca, 300);

  const apuracao = useQuery({ queryKey: ["apuracao", anoMes], queryFn: () => apuracaoService.situacao(anoMes) });
  const resumo = useQuery({
    queryKey: ["classificacao", anoMes, "resumo"],
    queryFn: () => classificacaoService.resumo(anoMes),
    enabled: periodo !== null,
  });

  const lista = useQuery({
    queryKey: ["classificacao", anoMes, "lancamentos", situacao, buscaDebounced, pagina, porPagina],
    queryFn: () =>
      classificacaoService.lancamentos(anoMes, {
        situacao,
        busca: buscaDebounced || undefined,
        pagina,
        porPagina,
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
      atualizarCompetencia(queryClient, anoMes);
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

  function filtrar(s: Situacao) {
    setSituacao(s);
    setPagina(1);
  }

  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Classificação"
        selo={fechada || apurada ? <AvisoCongelado anoMes={anoMes} fechada={fechada} oQue="da classificação" /> : null}
        sobre={
          <p>
            Destino de cada lançamento do balancete na DRE e a verificação da coluna LANÇ. OK?. A correção é sempre no cadastro — depois
            dela, reclassifique.
          </p>
        }
        acoes={
          !fechada && !apurada ? (
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
          ) : null
        }
      />

      {r && r.total > 0 ? (
        <FaixaIndicadores
          itens={[
            { rotulo: "lançamentos", valor: inteiro(r.total) },
            { rotulo: r.pendentes === 1 ? "pendência" : "pendências", valor: inteiro(r.pendentes), tom: r.pendentes > 0 ? "atencao" : undefined },
            { rotulo: "reclassificados", valor: inteiro(r.reclassificados), dica: "Pelo cadastro de reclassificação" },
            { rotulo: "classificado em", rotuloAntes: true, valor: <span className="text-sm font-bold">{r.classificadoEm ? dataHora(r.classificadoEm) : "nunca"}</span> },
          ]}
        />
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
        <div className="space-y-3">
          <Abas
            rotulo="Situação dos lançamentos"
            ativa={situacao}
            onMudar={(c) => filtrar(c as Situacao)}
            abas={[
              {
                chave: "PENDENCIAS",
                rotulo: "Pendências",
                contagem: r?.pendentes ?? 0,
                sinal: (r?.pendentes ?? 0) > 0 ? <span className="size-2 rounded-full bg-red-600" aria-hidden /> : undefined,
              },
              ...pendenciasPorTipo.map((v) => ({
                chave: v,
                rotulo: VALIDACOES[v].codigo.startsWith("<") ? VALIDACOES[v].codigo : VALIDACOES[v].rotulo,
                contagem: quantidade(v),
              })),
              { chave: "TODOS", rotulo: "Todos", contagem: r?.total ?? 0 },
            ]}
          />
          <QuadroTabela
            barra={
              <CampoBusca
                rotulo="Buscar lançamentos"
                valor={busca}
                onMudar={(v) => {
                  setBusca(v);
                  setPagina(1);
                }}
                placeholder="Centro ou conta…"
              />
            }
            rodape={
              lista.data && lista.data.total > 0 ? (
                <Paginacao total={lista.data.total} pagina={pagina} porPagina={porPagina} onPagina={setPagina} onPorPagina={setPorPagina} carregando={lista.isFetching} />
              ) : null
            }
          >
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
          </QuadroTabela>
        </div>
      )}
    </div>
  );
}
