"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, LockKeyholeOpen, MessageSquareText } from "lucide-react";
import { toast } from "sonner";

import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { atualizarCompetencia } from "@/lib/atualizarCompetencia";

import { StatusCompetenciaBadge } from "../competencias/components/StatusCompetenciaBadge";
import { dataHora, inteiro, moeda } from "../competencias/[anoMes]/utils/formatacao";
import {
  divergenciasService,
  mensagemDeErro,
  ROTULO_STATUS,
  ROTULO_TIPO,
  type FiltroDivergencias,
  type StatusDivergencia,
  type TipoDivergencia,
} from "./services/divergenciasService";

const classeSelect = "h-9 w-full rounded-sm border border-gray-300 bg-white px-3 text-sm";
const botaoPrimario = "bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm";
const rotulo = (ano: number, mes: number) => `${String(mes).padStart(2, "0")}/${ano}`;
const anoMes = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, "0")}`;
const COR_STATUS: Record<StatusDivergencia, string> = {
  ABERTA: "border-yellow-200 bg-yellow-50 text-yellow-800",
  JUSTIFICADA: "border-gray-200 bg-gray-50 text-gray-600",
  RESOLVIDA_POR_REABERTURA: "border-green-200 bg-green-50 text-green-700",
  RESOLVIDA_POR_REAPURACAO: "border-green-200 bg-green-50 text-green-700",
};

/** Justificar as escolhidas ou resolver uma competência por reabertura: ambos pedem texto. */
function DialogoTexto({ titulo, descricao, acao, onConfirmar, onFechar, pendente }: { titulo: string; descricao: string; acao: string; onConfirmar: (t: string) => void; onFechar: () => void; pendente: boolean }) {
  const [texto, setTexto] = useState("");
  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent className="rounded-sm sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <textarea aria-label="Justificativa" value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2 text-sm" placeholder="ao menos 15 caracteres" />
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" className={botaoPrimario} disabled={texto.trim().length < 15 || pendente} onClick={() => onConfirmar(texto)}>
            {pendente ? "Gravando…" : acao}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DivergenciasContent() {
  useRegistrarAcessoTela("/divergencias");
  const queryClient = useQueryClient();
  const { refresh } = useAuth();
  const { hasPermission } = usePermissions();
  const podeTratar = hasPermission("divergencia:editar");
  const [filtro, setFiltro] = useState<FiltroDivergencias>({ status: "ABERTA", pagina: 1 });
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [dialogo, setDialogo] = useState<{ tipo: "justificar" } | { tipo: "resolver"; competencia: string } | null>(null);
  const lista = useQuery({ queryKey: ["divergencias", filtro], queryFn: () => divergenciasService.listar(filtro), placeholderData: keepPreviousData });
  const muda = (p: Partial<FiltroDivergencias>) => {
    setMarcadas(new Set());
    setFiltro((f) => ({ ...f, ...p, pagina: p.pagina ?? 1 }));
  };
  const atualizar = () => {
    setMarcadas(new Set());
    setDialogo(null);
    atualizarCompetencia(queryClient);
    void refresh(); // o aviso de abertas no menu
  };
  const justificar = useMutation({
    mutationFn: (texto: string) => divergenciasService.justificar([...marcadas], texto),
    onSuccess: (r) => {
      toast.success(`${r.justificadas} divergência(s) justificada(s).`);
      atualizar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível justificar.")),
  });
  const resolver = useMutation({
    mutationFn: ({ competencia, texto }: { competencia: string; texto: string }) => divergenciasService.resolver(competencia, texto),
    onSuccess: (r) => {
      toast.success(`Competência reaberta; ${r.resolvidas} divergência(s) resolvida(s). Importe o dado novo e reapure.`);
      atualizar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível resolver.")),
  });

  const d = lista.data;
  const abertasNaPagina = d?.itens.filter((i) => i.status === "ABERTA") ?? [];
  const totalPaginas = d ? Math.max(1, Math.ceil(d.total / d.porPagina)) : 1;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Divergências</h1>
        <p className="text-sm text-gray-600">
          Dado recebido depois do fechamento ou da apuração que difere do que está gravado: o balancete de um mês fechado, ou o preço de
          contrato que valorou a receita de um mês apurado. A competência não muda sozinha — a divergência é justificada, ou resolvida
          reabrindo a competência (no preço de um mês ainda aberto, reapurando).
        </p>
      </div>

      {d && d.competencias.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {d.competencias.map((c) => (
            <div key={anoMes(c.ano, c.mes)} className="space-y-2 rounded-sm border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <button type="button" className="font-bold text-gray-900 hover:underline" onClick={() => muda({ competencia: anoMes(c.ano, c.mes) })}>
                  {rotulo(c.ano, c.mes)}
                </button>
                <StatusCompetenciaBadge status={c.status} />
              </div>
              <p className="text-sm text-gray-600">
                {inteiro(c.abertas)} aberta(s) de {inteiro(c.total)}
              </p>
              {c.status === "FECHADA" && c.abertas > 0 && podeTratar ? (
                <PermissionGuard permission="competencia:editar">
                  <Button type="button" variant="outline" size="sm" className="rounded-sm" onClick={() => setDialogo({ tipo: "resolver", competencia: anoMes(c.ano, c.mes) })}>
                    <LockKeyholeOpen className="size-3.5" />
                    Resolver por reabertura
                  </Button>
                </PermissionGuard>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-sm border border-gray-200 bg-white p-4 sm:flex-row sm:items-end">
        <div className="min-w-40 space-y-1.5">
          <label className="text-sm font-medium text-gray-900" htmlFor="d-comp">
            Competência
          </label>
          <select id="d-comp" value={filtro.competencia ?? ""} onChange={(e) => muda({ competencia: e.target.value || undefined })} className={classeSelect}>
            <option value="">Todas</option>
            {d?.competencias.map((c) => (
              <option key={anoMes(c.ano, c.mes)} value={anoMes(c.ano, c.mes)}>
                {rotulo(c.ano, c.mes)}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-40 space-y-1.5">
          <label className="text-sm font-medium text-gray-900" htmlFor="d-tipo">
            Tipo
          </label>
          <select id="d-tipo" value={filtro.tipo ?? ""} onChange={(e) => muda({ tipo: (e.target.value || undefined) as TipoDivergencia | undefined })} className={classeSelect}>
            <option value="">Todos</option>
            {Object.entries(ROTULO_TIPO).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-48 space-y-1.5">
          <label className="text-sm font-medium text-gray-900" htmlFor="d-status">
            Situação
          </label>
          <select id="d-status" value={filtro.status ?? ""} onChange={(e) => muda({ status: (e.target.value || undefined) as StatusDivergencia | undefined })} className={classeSelect}>
            <option value="">Todas</option>
            {Object.entries(ROTULO_STATUS).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1" />
        {podeTratar ? (
          <Button type="button" className={botaoPrimario} disabled={marcadas.size === 0} onClick={() => setDialogo({ tipo: "justificar" })}>
            <MessageSquareText className="size-4" />
            Justificar {marcadas.size > 0 ? `(${marcadas.size})` : "selecionadas"}
          </Button>
        ) : null}
      </div>

      <div className="rounded-sm border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 text-sm text-gray-600">
          <span>{d ? `${inteiro(d.total)} divergência(s)` : "…"}</span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" className="rounded-sm" disabled={filtro.pagina <= 1} onClick={() => muda({ pagina: filtro.pagina - 1 })} aria-label="Anterior">
              <ChevronLeft className="size-4" />
            </Button>
            <span className="tabular-nums">
              {filtro.pagina} / {totalPaginas}
            </span>
            <Button type="button" variant="outline" size="icon" className="rounded-sm" disabled={filtro.pagina >= totalPaginas} onClick={() => muda({ pagina: filtro.pagina + 1 })} aria-label="Próxima">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
        {lista.isError ? <p className="p-4 text-sm text-red-700">{mensagemDeErro(lista.error, "Erro ao carregar as divergências.")}</p> : null}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-bold tracking-wide text-gray-600 uppercase">
                {podeTratar ? (
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label="Marcar as abertas da página"
                      checked={abertasNaPagina.length > 0 && abertasNaPagina.every((i) => marcadas.has(i.id))}
                      onChange={(e) => setMarcadas(e.target.checked ? new Set(abertasNaPagina.map((i) => i.id)) : new Set())}
                      className="size-4 accent-black"
                    />
                  </th>
                ) : null}
                <th className="px-3 py-2">Competência</th>
                <th className="px-3 py-2">O que diverge</th>
                <th className="px-3 py-2 text-right">Gravado</th>
                <th className="px-3 py-2 text-right">Recebido</th>
                <th className="px-3 py-2 text-right">Diferença</th>
                <th className="px-3 py-2">Situação</th>
              </tr>
            </thead>
            <tbody>
              {lista.isPending && !d ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                    Carregando…
                  </td>
                </tr>
              ) : d?.itens.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                    Nenhuma divergência com esses filtros.
                  </td>
                </tr>
              ) : (
                d?.itens.map((i) => (
                  <tr key={i.id} className="border-b border-gray-100 align-top">
                    {podeTratar ? (
                      <td className="px-3 py-2">
                        {i.status === "ABERTA" ? (
                          <input
                            type="checkbox"
                            aria-label="Marcar"
                            checked={marcadas.has(i.id)}
                            onChange={(e) => {
                              const n = new Set(marcadas);
                              if (e.target.checked) n.add(i.id);
                              else n.delete(i.id);
                              setMarcadas(n);
                            }}
                            className="size-4 accent-black"
                          />
                        ) : null}
                      </td>
                    ) : null}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="font-medium">{rotulo(i.competencia.ano, i.competencia.mes)}</span>
                      <div className="text-xs text-gray-500">{ROTULO_TIPO[i.tipo]}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-gray-900">{i.descricao}</div>
                      <div className="text-xs text-gray-500">
                        detectada em {dataHora(i.detectadaEm)} · {i.importacao.nomeArquivo}
                        {i.importacao.comparacao ? " (comparação)" : ""}
                      </div>
                      {i.impacto !== null ? <div className="text-xs text-gray-600">Efeito na receita apurada: {moeda(i.impacto)}</div> : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{moeda(i.valorGravado)}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{moeda(i.valorRecebido)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums whitespace-nowrap">{moeda(i.diferenca)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded-sm border px-2 py-0.5 text-xs font-medium ${COR_STATUS[i.status]}`}>{ROTULO_STATUS[i.status]}</span>
                      {i.tratadaEm ? (
                        <div className="mt-1 max-w-64 text-xs text-gray-500">
                          {i.tratadaPor} · {dataHora(i.tratadaEm)}
                          {i.justificativa ? <div className="text-gray-600">{i.justificativa}</div> : null}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {dialogo?.tipo === "justificar" ? (
        <DialogoTexto
          titulo={`Justificar ${marcadas.size} divergência(s)`}
          descricao="A justificativa fica registrada com o seu nome. A competência continua como está."
          acao="Justificar"
          pendente={justificar.isPending}
          onConfirmar={(t) => justificar.mutate(t)}
          onFechar={() => setDialogo(null)}
        />
      ) : null}
      {dialogo?.tipo === "resolver" ? (
        <DialogoTexto
          titulo={`Resolver ${dialogo.competencia.slice(5)}/${dialogo.competencia.slice(0, 4)} por reabertura`}
          descricao="A competência é reaberta, com esta justificativa, e as divergências abertas dela ficam resolvidas. Depois, importe o dado novo e reapure."
          acao="Reabrir e resolver"
          pendente={resolver.isPending}
          onConfirmar={(t) => resolver.mutate({ competencia: dialogo.competencia, texto: t })}
          onFechar={() => setDialogo(null)}
        />
      ) : null}
    </div>
  );
}
