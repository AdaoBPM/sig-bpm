"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Calculator } from "lucide-react";
import { toast } from "sonner";

import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { Button } from "@/components/ui/button";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";

import { AvisoCongelado } from "../../components/AvisoCongelado";
import { dataHora, lerAnoMes } from "../utils/formatacao";
import { MEDIDA_BASE, mensagemDeErro, rateiosService, ROTULO_CHAVE } from "./services/rateiosService";

// Volumes com duas casas (pedido de 09/10/2026), como os percentuais; os dias de acompanhamento, sem casas.
const quant = (v: string, base?: string) => {
  const casas = base === "DIA" ? 0 : 2;
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
};
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
        comoUsar={
          <ul>
            <li>Cada seção é uma chave de rateio, com o volume total no título e um card por destino: o percentual em destaque e o volume apurado.</li>
            <li>Um “Hoje:” em amarelo, sob o volume, é o volume atual das listas, diferente do apurado: reapure para usá-lo.</li>
            <li>Para conferir os volumes de origem, veja as Listas Operacionais.</li>
            <li>Depois da apuração da DRE, a tela fica congelada: o que mudar só entra ao reapurar a competência na DRE.</li>
          </ul>
        }
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
        <div className="space-y-3">
          {dados.chaves.map((k) => (
            // Cada chave em cards, como os totais do Estoque: um por destino, com o percentual em destaque, e o do total.
            <section key={k.chave}>
              <h2 className="mb-1 text-sm font-bold tracking-wide text-gray-900 uppercase">
                {/* O total da chave junto do título (o card do total saiu em 09/10/2026). */}
                {ROTULO_CHAVE[k.chave] ?? k.chave}{" "}
                <span className="font-normal tracking-normal text-gray-500 normal-case">
                  ({quant(k.total, k.baseFisica)} {MEDIDA_BASE[k.baseFisica] ?? k.baseFisica})
                </span>
              </h2>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {k.destinos.map((d) => (
                  <div key={d.destino} className="rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white px-4 py-2">
                    <p className="text-xs font-bold text-gray-600" title={d.rotulo}>
                      {/* Só o destino ("Matriz"): a chave já está no título da seção. */}
                      {d.rotulo.replace(/^\([PS]\)\s*/, "").replace(/^.*:\s*/, "")}
                    </p>
                    {/* O percentual e o volume na mesma linha, para todas as chaves caberem na tela. */}
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-xl font-extrabold text-gray-900">{pct(d.percentual)}</p>
                      <p className="text-sm whitespace-nowrap text-gray-700">
                        {quant(d.quantidade, k.baseFisica)} <span className="text-xs text-gray-500">{MEDIDA_BASE[k.baseFisica] ?? ""}</span>
                      </p>
                    </div>
                    {d.quantidadeAtual !== null ? (
                      <p className="mt-0.5 text-xs text-yellow-800" title="Volume de hoje, diferente do apurado: reapure para usar.">
                        Hoje: {quant(d.quantidadeAtual, k.baseFisica)}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">
          Nenhuma apuração ainda. Importe ou digite as listas do mês e apure.
        </div>
      )}
    </div>
  );
}
