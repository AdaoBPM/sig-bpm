"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAlteracoesPendentes } from "@/lib/alteracoesPendentes";

import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";
import { botaoPrimario, Erro } from "@/app/cenarios/components/CenarioDialog";
import { rotuloMarcacao } from "@/app/cenarios/services/cenariosService";

import { relatoriosExecutivosService } from "../services/relatoriosExecutivosService";

/** A chave da aba Configurações na barra do relatório (22/10/2026): antes da Capa, sem páginas e sem slides. */
export const CONFIGURACOES = "CONFIGURACOES";

/**
 * A aba Configurações do relatório (22/10/2026): preliminar à apresentação — não tem páginas, não conta nos slides e não
 * entra na tela inteira nem no PDF. O Cenário de Comparação: o orçado dos cards (Painel de Bordo e Indicadores) e das
 * tabelas; de início, o cenário marcado como Orçamento Empresarial no exercício (a marcação pode mudar de cenário: o
 * relatório pode escolher um dos cenários públicos — de qualquer exercício, sintético ou analítico, com a marcação em etiqueta —
 * e fica com ele). Quem edita a tela grava; os demais só veem.
 */
export function ConfiguracoesDoRelatorio({ relatorioId }: { relatorioId: string }) {
  const queryClient = useQueryClient();
  const consulta = useQuery({ queryKey: ["relatorios-executivos", "configuracoes", relatorioId], queryFn: () => relatoriosExecutivosService.configuracoes(relatorioId) });
  // A escolha na tela; undefined: a gravada.
  const [escolhido, setEscolhido] = useState<string | null | undefined>(undefined);
  const gravado = consulta.data?.cenarioComparadoId ?? null;
  const atual = escolhido === undefined ? gravado : escolhido;
  const mudou = escolhido !== undefined && escolhido !== gravado;
  useAlteracoesPendentes(mudou);
  const gravar = useMutation({
    mutationFn: () => relatoriosExecutivosService.gravarConfiguracoes(relatorioId, atual),
    onSuccess: (c) => {
      queryClient.setQueryData(["relatorios-executivos", "configuracoes", relatorioId], c);
      // Os cards e as tabelas mudam de comparado.
      queryClient.invalidateQueries({ queryKey: ["relatorios-executivos", "dados", relatorioId] });
      queryClient.invalidateQueries({ queryKey: ["relatorios-executivos", "resultados", relatorioId] });
      setEscolhido(undefined);
      toast.success("Configurações gravadas: os cards e as tabelas usam o cenário escolhido.");
    },
  });
  if (consulta.isError) return <Erro erro={mensagemDeErro(consulta.error, "Erro ao carregar as configurações.")} />;
  if (!consulta.data) return <div className="h-64 animate-pulse rounded-sm bg-gray-100" />;
  const c = consulta.data;
  return (
    <section className="space-y-4 rounded-sm border border-gray-200 bg-white p-5">
      <div>
        <h2 className="text-base font-bold text-gray-900">Cenário de Comparação</h2>
        <p className="mt-1 text-sm text-gray-600">
          O orçado dos cards do Painel de Bordo e dos Indicadores (o destaque do desvio e os gráficos) e das tabelas de Resultados. Escolha a marcação
          Orçamento (o cenário marcado, qualquer que seja, de qualquer exercício) ou um dos cenários; num cenário de outro exercício, valem os mesmos meses dele.
        </p>
      </div>
      {/* Todos os cenários (22/10/2026), com o ano, o tipo e a marcação em etiquetas; o escolhido em destaque. */}
      <fieldset disabled={!c.podeEditar || gravar.isPending} className="overflow-x-auto rounded-sm border border-gray-200">
        <legend className="sr-only">Cenário de Comparação</legend>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-bold tracking-wide text-gray-700 uppercase">
              <th className="w-10 px-3 py-2" />
              <th className="px-3 py-2">Cenário</th>
              <th className="w-20 px-3 py-2">Ano</th>
              <th className="w-32 px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Marcação</th>
            </tr>
          </thead>
          <tbody>
            <Linha marcada={atual === null} onMarcar={() => setEscolhido(null)}>
              <td className="px-3 py-2">
                <span className="font-semibold text-gray-900">Orçamento (a marcação)</span>
                <span className="block text-xs text-gray-500">
                  {c.marcado ? `Hoje, o cenário ${c.marcado.nome}; se a marcação mudar de cenário, o relatório acompanha.` : "Nenhum cenário está marcado como Orçamento: os cards ficam sem o orçado."}
                </span>
              </td>
              <td className="px-3 py-2 text-gray-700">{c.marcado?.ano ?? "—"}</td>
              <td className="px-3 py-2" />
              <td className="px-3 py-2">
                <Etiqueta classe={ETIQUETA_DA_MARCACAO}>Orçamento</Etiqueta>
              </td>
            </Linha>
            {c.cenarios.map((x) => (
              <Linha key={x.id} marcada={atual === x.id} onMarcar={() => setEscolhido(x.id)}>
                <td className="px-3 py-2 font-medium text-gray-900">{x.nome}</td>
                <td className="px-3 py-2 text-gray-700">{x.ano}</td>
                <td className="px-3 py-2">
                  <Etiqueta classe={x.tipo === "ANALITICO" ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-gray-100 text-gray-800"}>{x.tipo === "ANALITICO" ? "Analítico" : "Sintético"}</Etiqueta>
                </td>
                <td className="px-3 py-2">
                  <span className="flex flex-wrap gap-1.5">
                    {x.marcacao ? <Etiqueta classe={ETIQUETA_DA_MARCACAO}>{rotuloMarcacao(x.marcacao)}</Etiqueta> : <span className="text-xs text-gray-400">Sem marcação</span>}
                  </span>
                </td>
              </Linha>
            ))}
          </tbody>
        </table>
      </fieldset>
      {c.podeEditar ? (
        <div className="flex justify-end">
          <Button type="button" className={botaoPrimario} disabled={!mudou || gravar.isPending} onClick={() => gravar.mutate()}>
            <Save className="size-4" />
            {gravar.isPending ? "Gravando…" : "Gravar"}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-gray-500">Só quem edita os Relatórios Executivos muda as configurações.</p>
      )}
      <Erro erro={gravar.isError ? mensagemDeErro(gravar.error, "Não foi possível gravar as configurações.") : null} />
    </section>
  );
}

/** A marcação em destaque: o amarelo-ouro da BPM. */
const ETIQUETA_DA_MARCACAO = "border-bpm-primary bg-bpm-primary text-black";

function Etiqueta({ classe, children }: { classe: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap ${classe}`}>{children}</span>;
}

/** Uma linha da lista: o clique em qualquer lugar dela a escolhe; a escolhida, em destaque. */
function Linha({ marcada, onMarcar, children }: { marcada: boolean; onMarcar: () => void; children: React.ReactNode }) {
  return (
    <tr className={`cursor-pointer border-b border-gray-100 last:border-b-0 ${marcada ? "bg-yellow-50" : "hover:bg-gray-50"}`} onClick={onMarcar}>
      <td className="px-3 py-2">
        <input type="radio" name="cenario-de-comparacao" className="size-4 accent-black" checked={marcada} onChange={onMarcar} onClick={(e) => e.stopPropagation()} aria-label="Escolher" />
      </td>
      {children}
    </tr>
  );
}
