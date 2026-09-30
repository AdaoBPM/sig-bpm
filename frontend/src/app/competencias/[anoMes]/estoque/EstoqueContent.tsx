"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Calculator, Info, Search } from "lucide-react";
import { toast } from "sonner";

import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { AvisoCongelado } from "../../components/AvisoCongelado";
import { StatusCompetenciaBadge } from "../../components/StatusCompetenciaBadge";
import { dataHora, lerAnoMes, MESES, moeda, rotuloCompetencia } from "../utils/formatacao";
import { estoqueService, mensagemDeErro, ROTULO_CRITERIO_ESTOQUE } from "./services/estoqueService";

const m3 = (v: string) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const ROTULO_MEDIA: Record<string, string> = { ESTRUTURA: "Estrutura", ALVEOLARES: "Alveolares", ESTACAS: "Estacas", GERAL: "Geral" };

export function EstoqueContent() {
  const { anoMes } = useParams<{ anoMes: string }>();
  useRegistrarAcessoTela(`/competencias/${anoMes}/estoque`);
  const periodo = lerAnoMes(anoMes);
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [avisos, setAvisos] = useState<string[]>([]);

  const estoque = useQuery({
    queryKey: ["estoque", anoMes],
    queryFn: () => estoqueService.consultar(anoMes),
    enabled: periodo !== null,
  });
  const apurar = useMutation({
    mutationFn: () => estoqueService.apurar(anoMes),
    onSuccess: (r) => {
      setAvisos(r.avisos ?? []);
      toast.success("Saldo de estoque apurado.");
      queryClient.setQueryData(["estoque", anoMes], r);
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível apurar.")),
  });

  const dados = estoque.data;
  const saldos = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (dados?.saldos ?? []).filter((s) => !t || `${s.obra} ${s.nomeObra} ${s.linha}`.toLowerCase().includes(t));
  }, [dados, busca]);

  if (!periodo) {
    return (
      <div className="rounded-sm border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">Competência inválida na URL: {anoMes}.</p>
      </div>
    );
  }
  const bloqueada = dados?.competencia.status === "FECHADA" || dados?.congelado || dados?.inicial;

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
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
                Estoque · {rotuloCompetencia(periodo.ano, periodo.mes)}
              </h1>
              <span className="text-sm text-gray-400">{MESES[periodo.mes - 1]}</span>
              {dados ? <StatusCompetenciaBadge status={dados.competencia.status} /> : null}
            </div>
            <p className="text-sm text-gray-600">
              Saldo do mês anterior mais a produção, menos a expedição, por obra e linha. Serve para conferência e
              não entra no resultado.{" "}
              {dados?.inicial ? "Saldo inicial importado." : dados?.apuradoEm ? `Apurado em ${dataHora(dados.apuradoEm)}.` : "Ainda não apurado."}
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
                {apurar.isPending ? "Apurando…" : dados.apuradoEm ? "Apurar de novo" : "Apurar estoque"}
              </Button>
            </PermissionGuard>
          ) : null}
        </div>
      </div>

      {dados?.inicial ? (
        <div className="flex items-center gap-2 rounded-sm border border-gray-200 bg-gray-50 p-4">
          <Info className="size-4 shrink-0 text-gray-500" />
          <p className="text-sm text-gray-600">Saldo inicial, importado da aba Estoque (2025). Os meses seguintes partem dele.</p>
        </div>
      ) : dados?.congelado || dados?.competencia.status === "FECHADA" ? (
        <AvisoCongelado anoMes={anoMes} fechada={dados?.competencia.status === "FECHADA"} oQue="do saldo de estoque" />
      ) : null}
      {avisos.length > 0 ? (
        <div className="flex items-start gap-2 rounded-sm border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <ul>{avisos.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      ) : null}

      {estoque.isError ? (
        <div className="rounded-sm border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{mensagemDeErro(estoque.error, "Erro ao carregar o estoque.")}</p>
        </div>
      ) : estoque.isPending ? (
        <div className="h-64 animate-pulse rounded-sm bg-gray-100" />
      ) : dados && dados.saldos.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {dados.medias.map((m) => (
              <div key={m.linha} className="border border-gray-200 bg-white rounded-sm p-4">
                <p className="text-xs font-bold tracking-wide text-gray-600 uppercase">{ROTULO_MEDIA[m.linha] ?? m.linha}</p>
                <p className="mt-1 text-xl font-extrabold tabular-nums text-gray-900">{m3(m.volume)} m³</p>
                <p className="text-sm tabular-nums text-gray-700">{moeda(m.valor)}</p>
                <p className="mt-0.5 text-xs text-gray-500">preço médio {moeda(m.precoMedio)}/m³</p>
              </div>
            ))}
          </div>

          <div className="border border-gray-200 bg-white rounded-sm">
            <div className="flex flex-col gap-2 border-b border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-bold text-gray-900">Saldo por obra e linha</h2>
              <div className="relative w-full sm:w-72">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Obra ou linha…" className="rounded-sm border-gray-300 pl-9" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-bold tracking-wide text-gray-600 uppercase">
                    <th className="px-4 py-2">Obra</th>
                    <th className="px-4 py-2">Linha</th>
                    <th className="px-4 py-2 text-right">Movimento (m³)</th>
                    <th className="px-4 py-2 text-right">Movimento (R$)</th>
                    <th className="px-4 py-2">Valoração</th>
                    <th className="px-4 py-2 text-right">Saldo (m³)</th>
                    <th className="px-4 py-2 text-right">Saldo (R$)</th>
                    <th className="px-4 py-2 text-right">R$/m³</th>
                  </tr>
                </thead>
                <tbody>
                  {saldos.map((s) => (
                    <tr key={`${s.obra}|${s.linha}`} className="border-b border-gray-100">
                      <td className="px-4 py-2">
                        <div className="font-medium tabular-nums text-gray-900">{s.obra}</div>
                        {s.nomeObra !== s.obra ? <div className="text-xs text-gray-500">{s.nomeObra}</div> : null}
                      </td>
                      <td className="px-4 py-2 text-gray-700">{s.linha}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{m3(s.movimentoVolume)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{moeda(s.movimentoValor)}</td>
                      <td className="px-4 py-2 text-xs text-gray-600">
                        {s.criterio ? ROTULO_CRITERIO_ESTOQUE[s.criterio] ?? s.criterio : "—"}
                        {s.precoMovimento ? <div className="tabular-nums">{moeda(s.precoMovimento)}/m³</div> : null}
                      </td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums">{m3(s.saldoVolume)}</td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums">{moeda(s.saldoValor)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-600">{moeda(s.precoMedio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">
          Nenhum saldo ainda. Apure o estoque (o mês anterior precisa ter saldo) ou, na competência de 12/2025, importe o
          saldo inicial.
        </div>
      )}
    </div>
  );
}
