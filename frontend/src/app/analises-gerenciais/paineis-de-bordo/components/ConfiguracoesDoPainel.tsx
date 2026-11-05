"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudCheck, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Abas } from "@/components/shared/Abas";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAbaLembrada } from "@/hooks/useAbaLembrada";

import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";
import { classeSelect, Erro } from "@/app/cenarios/components/CenarioDialog";
import { ConfiguracoesDoRelatorio } from "@/app/analises-gerenciais/relatorios-executivos/components/ConfiguracoesDoRelatorio";
import { useProcesso } from "@/app/analises-gerenciais/relatorios-executivos/components/processo";
import type { MudancaDasConfiguracoes } from "@/app/analises-gerenciais/relatorios-executivos/services/relatoriosExecutivosService";

import { AUTOMATICA, TEXTO_DA_AUTOMATICA } from "../services/paineisDeBordoService";
import { CompartilharPainel } from "./CompartilharPainel";
import { CampoVisualizacaoDoPainel } from "./VisualizacaoDoPainel";

/** O destaque das Configurações dos cenários (01/11/2026, pedido do Adão): a faixa amarelo-ouro à esquerda. */
const DESTAQUE = "rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white";

type AbaDasConfiguracoes = "geral" | "comparativos";

/**
 * As Configurações do painel de bordo (01/11/2026, pedido do Adão: em duas abas, como as dos cenários, e em destaques). A
 * aba **Geral**: o grupo Painel (o nome, a competência e a visualização), o Compartilhar (os editores convidados) e o
 * Excluir Painel — quem criou o painel (ou o Administrador) e, desde 03/11/2026, com o painel em elaboração, os editores
 * convidados mudam o Painel e o Compartilhar; o Excluir fica com quem o criou. A aba **Comparativos**: a Comparação Padrão e a
 * Comparação PROVA (as dos Relatórios Executivos), que quem edita o painel (também os editores convidados) muda.
 */
export function ConfiguracoesDoPainel({ painelId, excluir }: { painelId: string; excluir: React.ReactNode }) {
  const [aba, setAba] = useAbaLembrada<AbaDasConfiguracoes>("configuracoes", "geral", ["geral", "comparativos"]);
  return (
    <div className="space-y-6">
      <Abas
        rotulo="Configurações do painel"
        ativa={aba}
        onMudar={(a) => setAba(a as AbaDasConfiguracoes)}
        abas={[
          { chave: "geral", rotulo: "Geral" },
          { chave: "comparativos", rotulo: "Comparativos" },
        ]}
      />
      {aba === "geral" ? (
        <>
          <GeralDoPainel painelId={painelId} excluir={excluir} />
          <CompartilharPainel painelId={painelId} />
        </>
      ) : (
        <ConfiguracoesDoRelatorio relatorioId={painelId} destaque />
      )}
    </div>
  );
}

/**
 * O grupo Painel da aba Geral (31/10/2026): o nome, a visualização (Privado ou Público, como nos cenários) e a competência
 * — só mais um campo, entre as fechadas (vários painéis por competência), ou, desde 03/11/2026, a Automática (a última
 * fechada, sempre; com o aviso de que os textos não mudam com ela). Cada mudança se salva na hora; quem criou o painel (ou o
 * Administrador) muda e, com o painel em elaboração, também os editores convidados (03/11/2026). O Excluir Painel (`excluir`)
 * fica no canto de baixo, à direita, do grupo (03/11/2026, pedido do Adão; antes, embaixo do Compartilhar).
 */
function GeralDoPainel({ painelId, excluir }: { painelId: string; excluir: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { rota, servico } = useProcesso();
  const chave = [rota, "configuracoes", painelId];
  const consulta = useQuery({ queryKey: chave, queryFn: () => servico.configuracoes(painelId) });
  // O nome em edição; undefined: o gravado.
  const [nome, setNome] = useState<string | undefined>(undefined);
  const [salvoEm, setSalvoEm] = useState<Date | null>(null);
  const gravar = useMutation({
    mutationFn: (m: MudancaDasConfiguracoes) => servico.gravarConfiguracoes(painelId, m),
    onError: () => setNome(undefined),
    onSuccess: (c, m) => {
      queryClient.setQueryData(chave, c);
      // A barra, o título dos slides e a lista mostram o nome, a visualização e a competência.
      queryClient.invalidateQueries({ queryKey: [rota, "relatorio", painelId] });
      queryClient.invalidateQueries({ queryKey: [rota], exact: true });
      // Os cards e as tabelas mudam de mês (e, na automática, de comparação).
      if ("ano" in m || "automatica" in m) {
        queryClient.invalidateQueries({ queryKey: [rota, "dados", painelId] });
        queryClient.invalidateQueries({ queryKey: [rota, "resultados", painelId] });
      }
      setNome(undefined);
      setSalvoEm(new Date());
      toast.success(
        "nome" in m
          ? "Nome do painel salvo."
          : "visualizacao" in m
            ? "Visualização do painel salva."
            : "automatica" in m
              ? "Competência automática salva: o painel mostra sempre a última competência fechada."
              : "Competência do painel salva: os cards e as tabelas vão até ela.",
      );
    },
  });
  if (consulta.isError) return <Erro erro={mensagemDeErro(consulta.error, "Erro ao carregar as configurações do painel.")} />;
  if (!consulta.data) return <div className="h-48 animate-pulse rounded-sm bg-gray-100" />;
  const c = consulta.data;
  const pode = !!c.podeEditarGeral;
  const travado = !pode || gravar.isPending;
  const gravarNome = () => {
    const n = (nome ?? c.nome ?? "").trim();
    if (nome === undefined || n === c.nome) return setNome(undefined);
    if (!n) {
      toast.error("Dê um nome ao painel.");
      return setNome(undefined);
    }
    gravar.mutate({ nome: n });
  };
  return (
    <section className={`space-y-4 p-5 ${DESTAQUE}`}>
      <div>
        <h2 className="text-base font-bold text-gray-900">Painel</h2>
        <p className="mt-1 text-sm text-gray-600">
          O nome do painel (o da barra do topo e o dos slides), a visualização e a competência: os cards e as tabelas trazem as competências fechadas até ela
          (na Automática, até a última fechada).
          Criado por {c.criadoPor}.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="nome-do-painel">Nome</Label>
          <Input
            id="nome-do-painel"
            value={nome ?? c.nome ?? ""}
            maxLength={80}
            disabled={travado}
            onChange={(e) => setNome(e.target.value)}
            onBlur={gravarNome}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setNome(undefined);
            }}
            className="rounded-sm disabled:bg-gray-50 disabled:text-gray-700 disabled:opacity-100"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="competencia-do-painel">Competência</Label>
          <select
            id="competencia-do-painel"
            value={c.automatica ? AUTOMATICA : `${c.ano}|${c.mes}`}
            disabled={travado}
            onChange={(e) => {
              if (e.target.value === AUTOMATICA) return gravar.mutate({ automatica: true });
              const [ano, mes] = e.target.value.split("|").map(Number);
              gravar.mutate({ ano, mes });
            }}
            className={classeSelect}
          >
            {c.ultimaFechada ? <option value={AUTOMATICA}>Automática (a última fechada: {c.ultimaFechada})</option> : null}
            {(c.competencias ?? []).map((x) => (
              <option key={`${x.ano}|${x.mes}`} value={`${x.ano}|${x.mes}`}>
                {x.rotulo}
              </option>
            ))}
          </select>
        </div>
      </div>
      {/* O aviso da competência automática (03/11/2026): os números mudam sozinhos; os textos, não. */}
      {c.automatica ? <p className="rounded-sm border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">{TEXTO_DA_AUTOMATICA}</p> : null}
      <CampoVisualizacaoDoPainel valor={c.visualizacao ?? "PRIVADO"} onMudar={(v) => (v !== c.visualizacao ? gravar.mutate({ visualizacao: v }) : undefined)} emLinhas desabilitado={travado} />
      <Erro erro={gravar.isError ? mensagemDeErro(gravar.error, "Não foi possível salvar as configurações do painel.") : null} />
      <div className="flex flex-wrap items-center justify-end gap-3">
        {pode ? (
          <p className="flex items-center justify-end gap-1.5 text-sm text-gray-500" role="status">
            {gravar.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <CloudCheck className="size-4" />}
            {gravar.isPending ? "Salvando…" : salvoEm ? `Salvo às ${salvoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "As mudanças se salvam sozinhas."}
          </p>
        ) : (
          <p className="min-w-0 flex-1 text-sm text-gray-600">
            Quem criou o painel ({c.criadoPor}), o Administrador e, com o painel em elaboração, os editores convidados mudam o nome, a competência e a
            visualização.
          </p>
        )}
        {excluir}
      </div>
    </section>
  );
}
