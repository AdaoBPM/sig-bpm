"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAlteracoesPendentes } from "@/lib/alteracoesPendentes";

import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";
import { botaoPrimario, Erro, OpcaoEmLinha } from "@/app/cenarios/components/CenarioDialog";
import { rotuloMarcacao } from "@/app/cenarios/services/cenariosService";

import { relatoriosExecutivosService } from "../services/relatoriosExecutivosService";

/** A chave da aba Configurações na barra do relatório (22/10/2026): antes da Capa, sem páginas e sem slides. */
export const CONFIGURACOES = "CONFIGURACOES";

/**
 * A aba Configurações do relatório (22/10/2026): preliminar à apresentação — não tem páginas, não conta nos slides e não
 * entra na tela inteira nem no PDF. O Cenário de Comparação: o orçado dos cards (Painel de Bordo e Indicadores) e das
 * tabelas; de início, o cenário marcado como Orçamento Empresarial no exercício (a marcação pode mudar de cenário: o
 * relatório escolhe um cenário público do exercício e fica com ele). Quem edita a tela grava; os demais só veem.
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
  const tipo = (t: string) => (t === "ANALITICO" ? "Analítico" : "Sintético");
  return (
    <section className="space-y-4 rounded-sm border border-gray-200 bg-white p-5">
      <div>
        <h2 className="text-base font-bold text-gray-900">Cenário de Comparação</h2>
        <p className="mt-1 text-sm text-gray-600">
          O orçado dos cards do Painel de Bordo e dos Indicadores (o destaque do desvio e os gráficos) e das tabelas de Resultados. Os cenários públicos de {c.ano}.
        </p>
      </div>
      <fieldset className="space-y-2" disabled={!c.podeEditar || gravar.isPending}>
        <legend className="sr-only">Cenário de Comparação</legend>
        <OpcaoEmLinha
          nome="cenario-de-comparacao"
          marcada={atual === null}
          onMarcar={() => setEscolhido(null)}
          rotulo="Orçamento Empresarial (a marcação)"
          detalhe={c.marcado ? `O cenário marcado como Orçamento Empresarial: hoje, ${c.marcado.nome}.` : `Nenhum cenário de ${c.ano} está marcado como Orçamento Empresarial: os cards ficam sem o orçado.`}
        />
        {c.cenarios.map((x) => (
          <OpcaoEmLinha
            key={x.id}
            nome="cenario-de-comparacao"
            marcada={atual === x.id}
            onMarcar={() => setEscolhido(x.id)}
            rotulo={x.nome}
            detalhe={[tipo(x.tipo), rotuloMarcacao(x.marcacao)].filter(Boolean).join(" · ")}
          />
        ))}
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
