"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Calculator, ChevronDown, ChevronRight, Lock } from "lucide-react";
import { toast } from "sonner";

import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { Button } from "@/components/ui/button";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { StatusCompetenciaBadge } from "../../components/StatusCompetenciaBadge";
import { dataHora, lerAnoMes, MESES, moeda, rotuloCompetencia } from "../utils/formatacao";
import { dreService, mensagemDeErro, ROTULO_CHAVE, UNIDADES, type LinhaDRE } from "./services/dreService";

const ehVolume = (l: LinhaDRE) => l.grupoSigla === "P" || l.grupoSigla === "S";
const volume = (v: string) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

function Composicao({ l }: { l: LinhaDRE }) {
  const c = l.composicao!;
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
      {c.observacao ? <p className="text-gray-500">{c.observacao}</p> : null}
    </div>
  );
}

export function DREContent() {
  const { anoMes } = useParams<{ anoMes: string }>();
  useRegistrarAcessoTela(`/competencias/${anoMes}/dre`);
  const periodo = lerAnoMes(anoMes);
  const queryClient = useQueryClient();
  const [unidade, setUnidade] = useState(1);
  const [aberta, setAberta] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);

  const dre = useQuery({
    queryKey: ["dre", anoMes, unidade],
    queryFn: () => dreService.consultar(anoMes, unidade),
    enabled: periodo !== null,
  });
  const apurar = useMutation({
    mutationFn: () => dreService.apurar(anoMes),
    onSuccess: (r) => {
      setAvisos(r.avisos);
      toast.success("DRE apurada.");
      queryClient.invalidateQueries({ queryKey: ["dre", anoMes] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível apurar a DRE.")),
  });

  if (!periodo) {
    return (
      <div className="rounded-sm border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">Competência inválida na URL: {anoMes}.</p>
      </div>
    );
  }
  const dados = dre.data;
  const bloqueada = dados?.competencia.status === "FECHADA" || dados?.congelado;
  const linhas = dados?.linhas ?? [];

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
              {dados ? <StatusCompetenciaBadge status={dados.competencia.status} /> : null}
            </div>
            <p className="text-sm text-gray-600">
              A DRE de cada unidade, a partir da classificação, dos rateios, da receita prévia e dos lançamentos
              manuais. Clique numa linha para ver como o valor foi formado.{" "}
              {dados?.apuradoEm ? `Apurada em ${dataHora(dados.apuradoEm)}.` : "Ainda não apurada."}
            </p>
          </div>
          {!bloqueada && dados ? (
            <PermissionGuard permission="apuracao:editar">
              <Button
                type="button"
                onClick={() => apurar.mutate()}
                disabled={apurar.isPending}
                className="bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm"
              >
                <Calculator className="size-4" />
                {apurar.isPending ? "Apurando…" : dados.apuradoEm ? "Apurar de novo" : "Apurar DRE"}
              </Button>
            </PermissionGuard>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {UNIDADES.map((u) => (
          <button
            key={u.codigo}
            type="button"
            onClick={() => {
              setUnidade(u.codigo);
              setAberta(null);
            }}
            className={`rounded-sm border px-3 py-1.5 text-sm font-medium ${unidade === u.codigo ? "border-black bg-black text-white" : "border-gray-300 text-gray-900 hover:bg-gray-100"}`}
          >
            {u.nome}
          </button>
        ))}
      </div>

      {bloqueada ? (
        <div className="flex items-center gap-2 rounded-sm border border-gray-200 bg-gray-50 p-4">
          <Lock className="size-4 shrink-0 text-gray-500" />
          <p className="text-sm text-gray-600">DRE congelada: não pode ser reapurada.</p>
        </div>
      ) : null}
      {avisos.length > 0 ? (
        <div className="flex items-start gap-2 rounded-sm border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <ul>{avisos.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      ) : null}

      {dre.isError ? (
        <div className="rounded-sm border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{mensagemDeErro(dre.error, "Erro ao carregar a DRE.")}</p>
        </div>
      ) : dre.isPending ? (
        <div className="h-64 animate-pulse rounded-sm bg-gray-100" />
      ) : linhas.some((l) => l.valor !== null) ? (
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
                        className={`border-t border-gray-100 ${destaque ? "bg-gray-50 font-bold" : ""} ${l.composicao ? "cursor-pointer hover:bg-gray-50" : ""}`}
                        onClick={() => (l.composicao ? setAberta(aberto ? null : l.codigo) : undefined)}
                      >
                        <td className={`px-4 py-1.5 ${destaque ? "text-gray-900" : "pl-8 text-gray-700"}`}>
                          <span className="inline-flex items-center gap-1">
                            {l.composicao ? (aberto ? <ChevronDown className="size-3.5 text-gray-400" /> : <ChevronRight className="size-3.5 text-gray-400" />) : null}
                            {l.descricao}
                          </span>
                        </td>
                        <td className="px-4 py-1.5 text-right tabular-nums">
                          {l.valor === null ? "—" : ehVolume(l) ? volume(l.valor) : moeda(l.valor)}
                        </td>
                      </tr>
                      {aberto && l.composicao ? (
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
        </div>
      ) : (
        <div className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">
          Nenhuma apuração ainda. Apure os rateios e a receita prévia do mês e, depois, a DRE.
        </div>
      )}
    </div>
  );
}
