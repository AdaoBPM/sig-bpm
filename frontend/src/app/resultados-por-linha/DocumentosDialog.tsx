"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePermissions } from "@/context/PermissionContext";
import { plural } from "@/lib/texto";

import { formato, mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

import { resultadosLinhaService, type DocumentosDoMes, type ImportacaoDeDocumentos } from "./services/resultadosLinhaService";

const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

/** A situação de um tipo no mês: a importação em vigor e, se a última tentativa foi outra, o resultado dela. */
function Situacao({ tipo }: { tipo: DocumentosDoMes["requisicoes"] }) {
  const { vigente, ultima } = tipo;
  const outra = ultima && (!vigente || ultima.importadoEm !== vigente.importadoEm) ? ultima : null;
  const linha = (i: ImportacaoDeDocumentos) => `${plural(i.itens ?? 0, "1 item", `${(i.itens ?? 0).toLocaleString("pt-BR")} itens`)}${i.total !== null ? ` · R$ ${formato.inteiro(i.total)}` : ""}`;
  return (
    <div className="space-y-0.5">
      {vigente ? (
        <p className="text-gray-800" title={`${vigente.nomeArquivo}, em ${dataHora(vigente.importadoEm)}${vigente.usuario ? ` por ${vigente.usuario}` : ""}`}>
          {linha(vigente)}
        </p>
      ) : (
        <p className="text-gray-400">Sem importação</p>
      )}
      {outra?.status === "PROCESSANDO" ? <p className="text-xs text-gray-600">Importando… {outra.progresso}%</p> : null}
      {outra?.status === "REJEITADA" ? <p className="text-xs text-red-700">{`Recusada em ${dataHora(outra.importadoEm)}: ${outra.motivo ?? "sem motivo"}`}</p> : null}
    </div>
  );
}

/**
 * As requisições e as notas fiscais de cada mês do exercício (26/10/2026): a tarefa delas leva os custos às linhas nos
 * Resultados por Linha. Importar envia o LISTAS REALIZADO (RESULTADOS) do mês (as abas Requisições (Lista) e Notas Fiscais
 * (Lista)), também num mês fechado: os documentos não entram na DRE.
 */
export function DocumentosDialog({ ano, onFechar }: { ano: number; onFechar: () => void }) {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const pode = hasPermission("resultados_linha:editar");
  const consulta = useQuery({
    queryKey: ["resultados-por-linha", "documentos", ano],
    queryFn: () => resultadosLinhaService.documentos(ano),
    // Enquanto alguma importação processa, a lista se atualiza a cada 2 segundos.
    refetchInterval: (q) => (q.state.data?.some((m) => m.requisicoes.ultima?.status === "PROCESSANDO" || m.notas.ultima?.status === "PROCESSANDO") ? 2000 : false),
  });
  const entrada = useRef<HTMLInputElement>(null);
  const [mesEscolhido, setMes] = useState<number | null>(null);
  const [progresso, setProgresso] = useState<number | null>(null);
  const importar = useMutation({
    mutationFn: ({ mes, arquivo }: { mes: number; arquivo: File }) => resultadosLinhaService.importar(`${ano}-${String(mes).padStart(2, "0")}`, arquivo, setProgresso),
    onSuccess: () => {
      toast.success("Arquivo recebido: as requisições e as notas fiscais estão sendo importadas.");
      void queryClient.invalidateQueries({ queryKey: ["resultados-por-linha"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível importar o arquivo.")),
    onSettled: () => setProgresso(null),
  });
  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-sm sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Requisições e Notas Fiscais de {ano}</DialogTitle>
          <DialogDescription>
            A tarefa de cada requisição e nota fiscal leva os custos às linhas (Cadastros da Controladoria › Linhas › Tarefas). Importe o LISTAS REALIZADO
            (RESULTADOS) do mês: as abas Requisições (Lista) e Notas Fiscais (Lista) substituem as do mês, também num mês fechado (os documentos não entram na
            DRE).
          </DialogDescription>
        </DialogHeader>
        {consulta.isError ? <p className="text-sm text-red-700">{mensagemDeErro(consulta.error, "Erro ao carregar os documentos.")}</p> : null}
        <div className="overflow-x-auto rounded-sm border border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-bpm-primary text-left text-xs font-bold text-black">
                <th className="px-3 py-2">Mês</th>
                <th className="px-3 py-2">Requisições</th>
                <th className="px-3 py-2">Notas Fiscais</th>
                {pode ? <th className="w-32 px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {(consulta.data ?? []).map((m) => (
                <tr key={m.mes} className="border-b border-gray-100 align-top last:border-b-0">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                    {m.rotulo}
                    {m.fechada ? <span className="block text-xs text-gray-500">Fechada</span> : null}
                  </td>
                  <td className="px-3 py-2">
                    <Situacao tipo={m.requisicoes} />
                  </td>
                  <td className="px-3 py-2">
                    <Situacao tipo={m.notas} />
                  </td>
                  {pode ? (
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-sm"
                        disabled={importar.isPending}
                        onClick={() => {
                          setMes(m.mes);
                          entrada.current?.click();
                        }}
                      >
                        <FileUp className="size-4" />
                        {importar.isPending && mesEscolhido === m.mes ? (progresso !== null ? `${progresso}%` : "Enviando…") : "Importar"}
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
              {consulta.isPending ? (
                <tr>
                  <td colSpan={4} className="h-24 animate-pulse bg-gray-50" />
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <input
          ref={entrada}
          type="file"
          accept=".xlsx,.xlsm,.xls"
          className="hidden"
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            e.target.value = "";
            if (arquivo && mesEscolhido) importar.mutate({ mes: mesEscolhido, arquivo });
          }}
        />
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
