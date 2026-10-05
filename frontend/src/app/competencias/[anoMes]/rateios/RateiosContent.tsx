"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Calculator } from "lucide-react";
import { toast } from "sonner";

import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { Button } from "@/components/ui/button";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { iniciaisMaiusculas } from "@/lib/texto";

import { AvisoCongelado } from "../../components/AvisoCongelado";
import { dataHora, lerAnoMes } from "../utils/formatacao";
import { MEDIDA_BASE, mensagemDeErro, rateiosService, ROTULO_CHAVE } from "./services/rateiosService";

const quant = (v: string) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const pct = (v: string) => `${(Number(v) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

export function RateiosContent() {
  const { anoMes } = useParams<{ anoMes: string }>();
  useRegistrarAcessoTela(`/competencias/${anoMes}/rateios`);
  const periodo = lerAnoMes(anoMes);
  const queryClient = useQueryClient();

  const rateios = useQuery({
    queryKey: ["rateios", anoMes],
    queryFn: () => rateiosService.consultar(anoMes),
    enabled: periodo !== null,
  });
  const apurar = useMutation({
    mutationFn: () => rateiosService.apurar(anoMes),
    onSuccess: (r) => {
      toast.success("Rateios apurados.");
      queryClient.setQueryData(["rateios", anoMes], r);
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível apurar.")),
  });

  if (!periodo) {
    return (
      <div className="rounded-sm border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">Competência inválida na URL: {anoMes}.</p>
      </div>
    );
  }

  const dados = rateios.data;
  const bloqueada = dados?.competencia.status === "FECHADA" || dados?.congelado;
  const desatualizado = dados?.chaves.some((k) => k.destinos.some((d) => d.quantidadeAtual !== null));

  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Rateios"
        selo={bloqueada ? <AvisoCongelado anoMes={anoMes} fechada={dados?.competencia.status === "FECHADA"} oQue="do rateio" /> : null}
        sobre={
          <p>
            Os percentuais de cada chave de rateio, calculados pelos volumes das listas do mês — a versão sistêmica da aba Rateios.{" "}
            {dados?.apuradoEm ? `Apurados em ${dataHora(dados.apuradoEm)}.` : "Ainda não apurados."}
          </p>
        }
        acoes={
          !bloqueada && dados ? (
            <PermissionGuard permission="apuracao:editar">
              <Button
                type="button"
                onClick={() => apurar.mutate()}
                disabled={apurar.isPending}
                className="bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm"
              >
                <Calculator className="size-4" />
                {apurar.isPending ? "Apurando…" : dados.apuradoEm ? "Apurar de novo" : "Apurar rateios"}
              </Button>
            </PermissionGuard>
          ) : null
        }
      />

      {/* A legenda da nota "hoje" (E8 do levantamento de layout). */}
      {desatualizado ? (
        <div className="flex items-start gap-2 rounded-sm border border-yellow-200 bg-yellow-50 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-yellow-800" />
          <p className="text-sm text-yellow-800">
            As listas mudaram depois da apuração. Em amarelo, sob o destino, está o volume de hoje, diferente do apurado; os percentuais
            ainda usam o apurado. {bloqueada ? "Reapure a competência na DRE para usar os volumes de hoje." : "Apure de novo para usá-los."}
          </p>
        </div>
      ) : null}

      {rateios.isError ? (
        <div className="rounded-sm border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{mensagemDeErro(rateios.error, "Erro ao carregar os rateios.")}</p>
        </div>
      ) : rateios.isPending ? (
        <div className="h-64 animate-pulse rounded-sm bg-gray-100" />
      ) : dados && dados.chaves.length > 0 ? (
        <div className="space-y-4">
          {dados.chaves.map((k) => (
            <div key={k.chave} className="border border-gray-200 bg-white rounded-sm">
              <div className="border-b border-gray-200 px-4 py-3">
                <h2 className="text-sm font-bold text-gray-900">{iniciaisMaiusculas(ROTULO_CHAVE[k.chave] ?? k.chave)}</h2>
              </div>
              <table className="tabela-sig w-full table-fixed border-collapse text-sm">
                <thead>
                  <tr className="text-xs font-bold text-gray-600">
                    <th className="px-4 text-left">Destino</th>
                    <th className="w-48 px-4 text-right">Valor Apurado</th>
                    <th className="w-32 px-4 text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {k.destinos.map((d) => (
                    <tr key={d.destino} className="border-t border-gray-100">
                      <td className="px-4 py-2 text-gray-700">
                        {d.rotulo}
                        {d.quantidadeAtual !== null ? (
                          <div className="text-xs text-yellow-800" title="Volume de hoje, diferente do apurado: reapure para usar.">
                            hoje: {quant(d.quantidadeAtual)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-600">{quant(d.quantidade)}</td>
                      <td className="px-4 py-2 text-right font-bold tabular-nums">{pct(d.percentual)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-300 bg-gray-50 font-bold text-gray-900">
                    <td className="px-4 py-2">
                      Total <span className="font-normal text-gray-500">({MEDIDA_BASE[k.baseFisica] ?? k.baseFisica})</span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{quant(k.total)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {pct(String(k.destinos.reduce((s, d) => s + Number(d.percentual), 0)))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">
          Nenhuma apuração ainda. Importe ou digite as listas do mês e apure.
        </div>
      )}

      {dados ? (
        <div className="border border-gray-200 bg-white rounded-sm">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-sm font-bold text-gray-900">Memória de Cálculo: Volumes das Listas (Aba Totais)</h2>
            <p className="text-xs text-gray-500">
              Os volumes de hoje, somados das listas da competência. Expedição e montagem aparecem aqui, mas
              não entram em nenhuma chave de rateio.
            </p>
          </div>
          <table className="tabela-sig w-full border-collapse text-sm">
            <tbody>
              {dados.totais.map((t) => (
                <tr key={t.codigo} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-700">{t.rotulo}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{quant(t.quantidade)}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{t.medida}</td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/competencias/${anoMes}/listas/${t.tipo.toLowerCase().replace(/_/g, "-")}`}
                      className="text-xs text-gray-600 underline-offset-2 hover:underline"
                    >
                      ver lista
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
