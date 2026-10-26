"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp } from "lucide-react";
import { toast } from "sonner";

import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/context/PermissionContext";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { plural } from "@/lib/texto";

import { Seletor, useExercicios } from "@/app/relatorios/components/SeletorPeriodo";
import { formato, mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

import { resultadosLinhaService, type DocumentosDoMes, type ImportacaoDeDocumentos } from "../services/resultadosLinhaService";

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
          <span className="block text-xs text-gray-500">{`${dataHora(vigente.importadoEm)}${vigente.usuario ? ` · ${vigente.usuario}` : ""}`}</span>
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
 * A Importação dos Resultados por Linha (26/10/2026): as requisições e as notas fiscais de cada mês do exercício — a
 * tarefa delas leva os custos às linhas. Importar envia o LISTAS REALIZADO (RESULTADOS) do mês (as abas Requisições
 * (Lista) e Notas Fiscais (Lista)), também num mês fechado: os documentos não entram na DRE.
 */
export function ImportacaoContent() {
  useRegistrarAcessoTela("/resultados-por-linha/importacao");
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const pode = hasPermission("resultados_linha_importacao:editar");
  // Os exercícios com alguma competência apurada (as fechadas e as abertas: os documentos valem também nos meses abertos).
  const exercicios = useExercicios(false);
  const [anoEscolhido, setAno] = useState<number | null>(null);
  const ano = anoEscolhido ?? exercicios.anos[0];
  const consulta = useQuery({
    queryKey: ["resultados-por-linha", "documentos", ano],
    queryFn: () => resultadosLinhaService.documentos(ano!),
    enabled: !!ano,
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
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Importação"
        sobre={
          <p>
            As requisições e as notas fiscais de cada mês do exercício. A tarefa de cada uma leva os custos às linhas nos Resultados por Linha
            (Cadastros da Controladoria › Linhas › Tarefas); sem elas, os custos do mês vão às linhas pelas regras da Alocação nas Linhas. Os documentos não
            entram na DRE: importá-los não pede reapurar e vale também num mês fechado.
          </p>
        }
        comoUsar={
          <ul>
            <li>Escolha o exercício: a tabela mostra, em cada mês, as requisições e as notas fiscais importadas (os itens, o valor, quando e por quem).</li>
            <li>
              “Importar” (quem edita a Importação, na tela Perfis) envia o LISTAS REALIZADO (RESULTADOS) do mês: as abas Requisições (Lista) e Notas Fiscais
              (Lista) substituem as do mês, também num mês fechado. A importação segue em segundo plano; a tabela se atualiza sozinha até terminar.
            </li>
            <li>Se uma aba for recusada, o motivo aparece em vermelho no mês, e a importação anterior continua valendo.</li>
          </ul>
        }
        acoes={
          ano ? (
            <Seletor
              rotulo="Exercício"
              valor={String(ano)}
              opcoes={exercicios.anos.map((a) => ({ valor: String(a), rotulo: String(a) }))}
              onMudar={(v) => setAno(Number(v))}
              largura="w-28"
            />
          ) : null
        }
      />
      {consulta.isError ? <p className="text-sm text-red-700">{mensagemDeErro(consulta.error, "Erro ao carregar os documentos.")}</p> : null}
      {!ano && !exercicios.carregando ? (
        <p className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">Nenhuma competência apurada ainda.</p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-gray-200 bg-white">
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
      )}
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
    </div>
  );
}
