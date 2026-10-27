"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudCheck, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";
import { Erro } from "@/app/cenarios/components/CenarioDialog";
import { rotuloMarcacao } from "@/app/cenarios/services/cenariosService";

import { relatoriosExecutivosService } from "../services/relatoriosExecutivosService";

/** A chave da aba Configurações na barra do relatório (22/10/2026): antes da Capa, sem páginas e sem slides. */
export const CONFIGURACOES = "CONFIGURACOES";

/**
 * A aba Configurações do relatório (22/10/2026): preliminar à apresentação — não tem páginas, não conta nos slides e não
 * entra na tela inteira nem no PDF. O Cenário de Comparação: o orçado dos cards (Painel de Bordo e Indicadores) e das
 * tabelas; de início, o cenário marcado como Orçamento Empresarial no exercício (a marcação pode mudar de cenário: o
 * relatório pode escolher um dos cenários públicos — de qualquer exercício, sintético ou analítico, com a marcação em etiqueta —
 * e fica com ele). Quem edita a tela escolhe, e a escolha se salva na hora (24/10/2026, o salvamento automático; antes, o
 * Gravar); os demais só veem.
 */
export function ConfiguracoesDoRelatorio({ relatorioId }: { relatorioId: string }) {
  const queryClient = useQueryClient();
  const consulta = useQuery({ queryKey: ["relatorios-executivos", "configuracoes", relatorioId], queryFn: () => relatoriosExecutivosService.configuracoes(relatorioId) });
  // A escolha em gravação; undefined: a gravada.
  const [escolhido, setEscolhido] = useState<string | null | undefined>(undefined);
  const gravado = consulta.data?.cenarioComparadoId ?? null;
  // Sem cenário escolhido (o relatório acompanha a marcação), o marcado como Orçamento fica em destaque na lista (27/10/2026: sai
  // a linha "Orçamento (a marcação)", redundante com a do cenário marcado).
  const atual = escolhido === undefined ? (gravado ?? consulta.data?.marcado?.id ?? null) : escolhido;
  const [salvoEm, setSalvoEm] = useState<Date | null>(null);
  const gravar = useMutation({
    mutationFn: (cenarioComparadoId: string | null) => relatoriosExecutivosService.gravarConfiguracoes(relatorioId, cenarioComparadoId),
    // Recusada, a escolha volta à gravada.
    onError: () => setEscolhido(undefined),
    onSuccess: (c) => {
      queryClient.setQueryData(["relatorios-executivos", "configuracoes", relatorioId], c);
      // Os cards e as tabelas mudam de comparado.
      queryClient.invalidateQueries({ queryKey: ["relatorios-executivos", "dados", relatorioId] });
      queryClient.invalidateQueries({ queryKey: ["relatorios-executivos", "resultados", relatorioId] });
      setEscolhido(undefined);
      setSalvoEm(new Date());
      toast.success("Configurações salvas: os cards e as tabelas usam o cenário escolhido.");
    },
  });
  const escolher = (id: string | null) => {
    if (!consulta.data?.podeEditar || gravar.isPending || id === atual) return;
    setEscolhido(id);
    gravar.mutate(id);
  };
  if (consulta.isError) return <Erro erro={mensagemDeErro(consulta.error, "Erro ao carregar as configurações.")} />;
  if (!consulta.data) return <div className="h-64 animate-pulse rounded-sm bg-gray-100" />;
  const c = consulta.data;
  return (
    <section className="space-y-4 rounded-sm border border-gray-200 bg-white p-5">
      <div>
        <h2 className="text-base font-bold text-gray-900">Cenário de Comparação</h2>
        <p className="mt-1 text-sm text-gray-600">
          O orçado dos cards do Painel de Bordo e dos Indicadores (o destaque do desvio e os gráficos) e das tabelas de Resultados. De início, o cenário
          marcado como Orçamento (o relatório acompanha a marcação até que se escolha um cenário); num cenário de outro exercício, valem os mesmos meses dele.
        </p>
        {/* Sem cenário escolhido e sem o marcado na lista: o que vale hoje. */}
        {gravado === null && !c.cenarios.some((x) => x.id === c.marcado?.id) ? (
          <p className="mt-1 text-sm text-gray-600">
            {c.marcado ? `Hoje, o relatório compara com ${c.marcado.nome}, o cenário marcado como Orçamento.` : "Nenhum cenário está marcado como Orçamento: escolha um cenário para os cards terem o orçado."}
          </p>
        ) : null}
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
            {c.cenarios.map((x) => (
              <Linha key={x.id} marcada={atual === x.id} onMarcar={() => escolher(x.id)}>
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
        <p className="flex items-center justify-end gap-1.5 text-sm text-gray-500" role="status">
          {gravar.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <CloudCheck className="size-4" />}
          {gravar.isPending ? "Salvando…" : salvoEm ? `Salvo às ${salvoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "A escolha se salva sozinha."}
        </p>
      ) : (
        <p className="text-xs text-gray-500">Só quem edita os Relatórios Executivos muda as configurações.</p>
      )}
      <Erro erro={gravar.isError ? mensagemDeErro(gravar.error, "Não foi possível salvar as configurações.") : null} />
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
