"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Cog, PencilLine, X } from "lucide-react";
import { toast } from "sonner";

import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { DataTable } from "@/components/shared/DataTable";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { QuadroTabela } from "@/components/shared/QuadroTabela";
import { useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/context/PermissionContext";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import type { Coluna } from "@/lib/filtrosDeTabela";
import { plural } from "@/lib/texto";

import { botaoPrimario } from "@/app/cenarios/components/CenarioDialog";
import { moeda } from "@/app/competencias/[anoMes]/utils/formatacao";

import { contestacoesService, mensagemDeErro, ROTULO_SITUACAO, type Contestacao, type SituacaoContestacao } from "../services/contestacoesService";

export type AbaDasContestacoes = "solicitadas" | "recebidas" | "validacoes";

const dataCurta = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : null);
const dataHora = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null);
const movimento = (c: Contestacao) => [dataCurta(c.emissao), c.cliForn, c.historico].filter(Boolean).join(" · ") || "—";
const de = (c: Contestacao) => [c.centroNovo ? c.centroAntes : null, c.contaNova ? c.contaAntes : null].filter(Boolean).join(" / ");
const para = (c: Contestacao) => [c.centroNovo, c.contaNova].filter(Boolean).join(" / ");

const ESTILO_SITUACAO: Record<SituacaoContestacao, string> = {
  PENDENTE: "border-yellow-200 bg-yellow-50 text-yellow-800",
  ACATADA: "border-blue-200 bg-blue-50 text-blue-700",
  RECUSADA: "border-red-200 bg-red-50 text-red-700",
  VALIDADA: "border-green-200 bg-green-50 text-green-700",
};

/** A situação, com o detalhe da validação (no balancete, pelos lançamentos ou fora do SIG). */
function Situacao({ c }: { c: Contestacao }) {
  const detalhe =
    c.situacao === "VALIDADA"
      ? c.formaValidacao === "NO_BALANCETE"
        ? "No balancete"
        : c.formaValidacao === "LANCAMENTO_MANUAL"
          ? `Lançamentos de ${c.lancadaEm ?? "—"}`
          : "Sem correção pelo SIG"
      : c.situacao === "ACATADA" && (c.competenciaFechada || !c.comItem)
        ? "Para os Lançamentos"
        : null;
  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className={`inline-block w-fit rounded-sm border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${ESTILO_SITUACAO[c.situacao]}`}>{ROTULO_SITUACAO[c.situacao]}</span>
      {detalhe ? <span className="text-[11px] text-gray-500">{detalhe}</span> : null}
    </span>
  );
}

/**
 * As telas das Contestações de Gastos (27/10/2026, pedido do Adão): a aba Solicitadas (as do usuário), a Recebidas (as
 * dos centros de custo de que ele é o responsável, com Acatar e Recusar) e a tela Validações (todas, com Processar e
 * Alterar Status). A tabela tem os filtros nos rótulos das colunas, como as demais do SIG.
 */
export function ContestacoesContent({ aba }: { aba: AbaDasContestacoes }) {
  useRegistrarAcessoTela(`/contestacoes-de-gastos/${aba}`);
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const consulta = useQuery({ queryKey: ["contestacoes", aba], queryFn: () => contestacoesService.listar(aba) });
  const [recusando, setRecusando] = useState<Contestacao | null>(null);
  const [alterando, setAlterando] = useState<Contestacao | null>(null);
  const [processando, setProcessando] = useState(false);
  const atualizar = () => queryClient.invalidateQueries({ queryKey: ["contestacoes"] });
  const responder = useMutation({
    mutationFn: (d: { id: string; acatar: boolean; justificativa: string | null }) => contestacoesService.responder(d.id, { acatar: d.acatar, justificativa: d.justificativa }),
    onSuccess: (c) => {
      toast.success(`Contestação nº ${c.numero} ${c.situacao === "ACATADA" ? "acatada" : "recusada"}.`);
      setRecusando(null);
      void atualizar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível responder a contestação.")),
  });

  const colunas: Coluna<Contestacao>[] = [
    { chave: "numero", rotulo: "Nº", tipo: "numero", valor: (c) => c.numero },
    { chave: "competencia", rotulo: "Competência", valor: (c) => c.competencia },
    { chave: "movimento", rotulo: "Movimento", valor: movimento },
    { chave: "valor", rotulo: "Valor", tipo: "numero", alinhamento: "direita", valor: (c) => Number(c.valor), texto: (c) => moeda(c.valor) },
    { chave: "de", rotulo: "De", valor: de },
    { chave: "para", rotulo: "Para", valor: para },
    ...(aba !== "solicitadas" ? [{ chave: "solicitante", rotulo: "Solicitante", valor: (c: Contestacao) => c.solicitante }] : []),
    { chave: "motivo", rotulo: "Motivo", valor: (c) => c.motivo },
    { chave: "situacao", rotulo: "Situação", valor: (c) => ROTULO_SITUACAO[c.situacao] },
    { chave: "responsavel", rotulo: "Responsável", valor: (c) => (c.situacao === "PENDENTE" ? c.responsaveis.join(", ") || "Controladoria" : c.respondidaPor) },
    { chave: "justificativa", rotulo: "Justificativa", valor: (c) => c.justificativa },
    ...(aba !== "solicitadas" ? [{ chave: "acoes", rotulo: "Ações", semFiltro: true } as Coluna<Contestacao>] : []),
  ];
  const tabela = useTabelaFiltravel(consulta.data, colunas);
  const acatadas = (consulta.data ?? []).filter((c) => c.situacao === "ACATADA");
  const diretas = acatadas.filter((c) => !c.competenciaFechada && c.comItem).length;

  const titulos: Record<AbaDasContestacoes, { titulo: string; sobre: string }> = {
    solicitadas: { titulo: "Contestações", sobre: "As contestações que você pediu, com a situação de cada uma." },
    recebidas: { titulo: "Contestações", sobre: "As contestações dos centros de custo de que você é o responsável: acate ou recuse as pendentes." },
    validacoes: { titulo: "Validações", sobre: "Todas as contestações, de todos os usuários e de todas as competências: processe as acatadas e mude a situação de qualquer uma." },
  };

  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo={titulos[aba].titulo}
        sobre={<p>{titulos[aba].sobre}</p>}
        comoUsar={
          <ul>
            <li>
              Para contestar um movimento, abra o extrato de uma linha (a lupa) na tela Resultados do Fechamento Mensal ou nos Resultados Empresariais e
              clique na conta de um lançamento: no balancete da conta, “Contestar”, na coluna Ações, abre o modal para sugerir o novo centro de custo e/ou
              a nova conta de resultado (as listas buscam por código ou nome) e, se quiser, o motivo.
            </li>
            <li>
              A contestação vai para o responsável pelo centro de custo (o novo; sem centro novo, o do movimento): os usuários com o centro na lista
              deles (os Coordenadores); sem eles, os Gestores do departamento do centro; sem ninguém, só a Controladoria, em Validações. Quem pede e é o
              responsável já tem a contestação acatada.
            </li>
            <li>
              As situações: Pendente (o responsável ainda não respondeu), Acatada (o responsável aceitou; espera a Controladoria), Recusada e Validada (a
              Controladoria corrigiu o movimento — no balancete, ou pelos lançamentos da aba Contestações dos Lançamentos). A justificativa (da recusa ou
              da mudança de situação em Validações) aparece na coluna Justificativa.
            </li>
            {aba === "recebidas" ? <li>Na coluna Ações, “Acatar” aceita a contestação pendente e “Recusar” a recusa (a justificativa é opcional).</li> : null}
            {aba === "validacoes" ? (
              <>
                <li>
                  “Processar” corrige as acatadas: com a competência do movimento aberta, no próprio balancete (a classificação aplica o centro e a conta
                  novos; a competência apurada pede reapuração); com ela fechada, a contestação fica na lista do Importar da aba Contestações dos
                  Lançamentos, para virar o estorno e o lançamento novo numa competência aberta.
                </li>
                <li>
                  Na coluna Ações, “Alterar Status” muda a situação de qualquer contestação, com a justificativa (obrigatória). Tirar uma validada desfaz a
                  correção (no balancete, na próxima apuração; os lançamentos manuais saem); pôr como validada por aqui não corrige nada no SIG.
                </li>
              </>
            ) : null}
            <li>Use os filtros nos rótulos das colunas.</li>
          </ul>
        }
        acoes={
          aba === "validacoes" ? (
            <PermissionGuard permission="contestacoes_validacoes:editar">
              <Button type="button" className={botaoPrimario} disabled={!acatadas.length} onClick={() => setProcessando(true)} title={acatadas.length ? "Corrigir as contestações acatadas" : "Nenhuma contestação acatada"}>
                <Cog className="size-4" />
                Processar
              </Button>
            </PermissionGuard>
          ) : undefined
        }
      />
      <QuadroTabela
        barra={
          tabela.ativos ? (
            <button type="button" onClick={tabela.limpar} className="ml-auto text-xs font-medium text-gray-900 underline underline-offset-2">
              Limpar Filtros
            </button>
          ) : undefined
        }
      >
        <DataTable<Contestacao>
          data={tabela.visiveis}
          cabecalho={tabela.cabecalho}
          filtrosAtivos={tabela.ativos}
          onLimparFiltros={tabela.limpar}
          isLoading={consulta.isPending}
          error={consulta.isError ? mensagemDeErro(consulta.error, "Erro ao carregar as contestações.") : null}
          emptyMessage="Nenhuma contestação"
          emptyHint={aba === "solicitadas" ? "Conteste um movimento no balancete de uma conta (o extrato das linhas, nos Resultados)." : "Nada por aqui."}
          columns={colunas.map((c) => c.rotulo)}
          renderRow={(c) => (
            <tr key={c.id} className="border-b border-gray-100 align-top text-xs hover:bg-gray-50">
              <td className="px-3 py-2 font-medium">{c.numero}</td>
              <td className="px-3 py-2 whitespace-nowrap">{c.competencia}</td>
              <td className="px-3 py-2">
                {movimento(c)}
                <div className="text-gray-500">
                  Filial {c.filial}
                  {c.contaBalancete ? ` · Conta do balancete ${c.contaBalancete}` : ""}
                  {!c.comItem ? " · fora do balancete reimportado" : ""}
                </div>
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap">{moeda(c.valor)}</td>
              <td className="px-3 py-2">
                {c.centroNovo ? <div>{c.centroAntes ?? "—"}</div> : null}
                {c.contaNova ? <div>{c.contaAntes ?? "—"}</div> : null}
              </td>
              <td className="px-3 py-2 font-medium">
                {c.centroNovo ? <div>{c.centroNovo}</div> : null}
                {c.contaNova ? <div>{c.contaNova}</div> : null}
              </td>
              {aba !== "solicitadas" ? (
                <td className="px-3 py-2">
                  {c.solicitante}
                  <div className="text-gray-500">{dataHora(c.solicitadaEm)}</div>
                </td>
              ) : null}
              <td className="px-3 py-2 text-gray-700">{c.motivo ?? <span className="text-gray-400">—</span>}</td>
              <td className="px-3 py-2">
                <Situacao c={c} />
              </td>
              <td className="px-3 py-2">
                {c.situacao === "PENDENTE" ? (
                  <span className="text-gray-600">Aguarda {c.responsaveis.join(", ") || "a Controladoria"}</span>
                ) : c.respondidaPor ? (
                  <>
                    {c.respondidaPor}
                    <div className="text-gray-500">{dataHora(c.respondidaEm)}</div>
                  </>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-gray-700">
                {c.justificativa ? (
                  <>
                    {c.justificativa}
                    <div className="text-gray-500">
                      {c.justificadaPor ?? "SIG"}
                      {c.justificadaEm ? `, ${dataHora(c.justificadaEm)}` : ""}
                    </div>
                  </>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              {aba === "recebidas" ? (
                <td className="px-3 py-2 whitespace-nowrap">
                  {c.situacao === "PENDENTE" && c.souResponsavel && hasPermission("contestacoes.recebidas:editar") ? (
                    <span className="inline-flex gap-1.5">
                      <Button type="button" size="sm" variant="outline" className="h-7 rounded-sm px-2 text-xs" disabled={responder.isPending} onClick={() => responder.mutate({ id: c.id, acatar: true, justificativa: null })}>
                        <Check className="size-3.5" />
                        Acatar
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="h-7 rounded-sm border-red-300 px-2 text-xs text-red-700 hover:bg-red-50" onClick={() => setRecusando(c)}>
                        <X className="size-3.5" />
                        Recusar
                      </Button>
                    </span>
                  ) : null}
                </td>
              ) : null}
              {aba === "validacoes" ? (
                <td className="px-3 py-2 whitespace-nowrap">
                  {hasPermission("contestacoes_validacoes:editar") ? (
                    <Button type="button" size="sm" variant="outline" className="h-7 rounded-sm px-2 text-xs" onClick={() => setAlterando(c)}>
                      <PencilLine className="size-3.5" />
                      Alterar Status
                    </Button>
                  ) : null}
                </td>
              ) : null}
            </tr>
          )}
        />
      </QuadroTabela>

      {recusando ? <RecusarDialog c={recusando} pendente={responder.isPending} onFechar={() => setRecusando(null)} onRecusar={(j) => responder.mutate({ id: recusando.id, acatar: false, justificativa: j })} /> : null}
      {alterando ? (
        <AlterarStatusDialog
          c={alterando}
          onFechar={() => setAlterando(null)}
          onAlterada={() => {
            setAlterando(null);
            void atualizar();
          }}
        />
      ) : null}
      {processando ? (
        <ProcessarDialog
          acatadas={acatadas.length}
          diretas={diretas}
          onFechar={() => setProcessando(false)}
          onProcessado={() => {
            setProcessando(false);
            void atualizar();
          }}
        />
      ) : null}
    </div>
  );
}

/** Recusar (aba Recebidas): a justificativa, opcional, aparece para quem pediu. */
function RecusarDialog({ c, pendente, onFechar, onRecusar }: { c: Contestacao; pendente: boolean; onFechar: () => void; onRecusar: (justificativa: string | null) => void }) {
  const [texto, setTexto] = useState("");
  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent avisoAoSair className="rounded-sm sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Recusar a Contestação nº {c.numero}</DialogTitle>
          <DialogDescription>
            {movimento(c)} · {moeda(c.valor)}. A justificativa (opcional) aparece para quem pediu, nas Contestações e em Validações.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="rc-justificativa">Justificativa (opcional)</Label>
          <textarea id="rc-justificativa" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={500} rows={3} className="w-full rounded-sm border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" variant="outline" className="rounded-sm border-red-300 text-red-700 hover:bg-red-50" disabled={pendente} onClick={() => onRecusar(texto.trim() || null)}>
            {pendente ? "Recusando…" : "Recusar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Alterar Status (Validações): qualquer situação, com a justificativa obrigatória. */
function AlterarStatusDialog({ c, onFechar, onAlterada }: { c: Contestacao; onFechar: () => void; onAlterada: () => void }) {
  const [situacao, setSituacao] = useState<SituacaoContestacao>(c.situacao);
  const [texto, setTexto] = useState("");
  const salvar = useMutation({
    mutationFn: () => contestacoesService.alterarSituacao(c.id, { situacao, justificativa: texto.trim() }),
    onSuccess: (x) => {
      toast.success(`Contestação nº ${x.numero}: ${ROTULO_SITUACAO[x.situacao]}.`);
      onAlterada();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível alterar a situação.")),
  });
  const desfaz = c.situacao === "VALIDADA" && situacao !== "VALIDADA";
  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent avisoAoSair className="rounded-sm sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Alterar Status da Contestação nº {c.numero}</DialogTitle>
          <DialogDescription>
            {movimento(c)} · {moeda(c.valor)} · hoje, {ROTULO_SITUACAO[c.situacao]}. A justificativa aparece nas Contestações e em Validações.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="as-situacao">Situação</Label>
            <select id="as-situacao" value={situacao} onChange={(e) => setSituacao(e.target.value as SituacaoContestacao)} className="h-9 w-full rounded-sm border border-gray-300 bg-white px-2 text-sm">
              {(Object.keys(ROTULO_SITUACAO) as SituacaoContestacao[]).map((s) => (
                <option key={s} value={s}>
                  {ROTULO_SITUACAO[s]}
                </option>
              ))}
            </select>
          </div>
          {desfaz ? (
            <p className="rounded-sm border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-900">
              A contestação deixa de ser validada: a correção dela sai{" "}
              {c.formaValidacao === "LANCAMENTO_MANUAL" ? `(os lançamentos de ${c.lancadaEm ?? "—"} são excluídos)` : "do balancete na próxima apuração"}.
            </p>
          ) : null}
          {situacao === "VALIDADA" && c.situacao !== "VALIDADA" ? (
            <p className="rounded-sm border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-900">
              Validada por aqui, a contestação não corrige nada no SIG (é a correção feita fora dele). Para corrigir o movimento, use “Processar”.
            </p>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="as-justificativa">Justificativa</Label>
            <textarea id="as-justificativa" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={500} rows={3} className="w-full rounded-sm border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" className={botaoPrimario} disabled={!texto.trim() || situacao === c.situacao || salvar.isPending} onClick={() => salvar.mutate()}>
            {salvar.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Processar (Validações): a confirmação, com quantas vão ao balancete e quantas aos lançamentos. */
function ProcessarDialog({ acatadas, diretas, onFechar, onProcessado }: { acatadas: number; diretas: number; onFechar: () => void; onProcessado: () => void }) {
  const processar = useMutation({
    mutationFn: contestacoesService.processar,
    onSuccess: (r) => {
      const partes = [
        `${r.validadas} ${plural(r.validadas, "contestação validada", "contestações validadas")} no balancete`,
        r.paraLancamentos ? `${r.paraLancamentos} para o Importar dos Lançamentos` : null,
        r.reapurar.length ? `reapure ${r.reapurar.join(", ")}` : null,
      ].filter(Boolean);
      toast.success(`${partes.join("; ")}.`);
      onProcessado();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível processar as contestações.")),
  });
  const paraLancamentos = acatadas - diretas;
  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent className="rounded-sm sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Processar as Contestações Acatadas</DialogTitle>
          <DialogDescription>
            {acatadas} {plural(acatadas, "contestação acatada", "contestações acatadas")}: {diretas} com a competência do movimento aberta{" "}
            {plural(diretas, "fica validada", "ficam validadas")} no balancete (a classificação aplica o centro e a conta novos; a competência apurada pede
            reapuração), e {paraLancamentos} com a competência fechada {plural(paraLancamentos, "fica", "ficam")} para o Importar da aba Contestações dos
            Lançamentos de uma competência aberta.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" className={botaoPrimario} disabled={processar.isPending} onClick={() => processar.mutate()}>
            {processar.isPending ? "Processando…" : "Processar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
