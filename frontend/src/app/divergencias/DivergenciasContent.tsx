"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LockKeyholeOpen, MessageSquareText } from "lucide-react";
import { toast } from "sonner";

import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { atualizarCompetencia } from "@/lib/atualizarCompetencia";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { Carregando, ErroCarga } from "@/components/shared/Estados";
import { BarraDeFiltros, SeletorFiltro } from "@/components/shared/Filtros";
import { Paginacao } from "@/components/shared/Paginacao";
import { QuadroTabela } from "@/components/shared/QuadroTabela";
import { SemResultado, useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import type { Coluna } from "@/lib/filtrosDeTabela";

import { StatusCompetenciaBadge } from "../competencias/components/StatusCompetenciaBadge";
import { dataHora, inteiro, moeda } from "../competencias/[anoMes]/utils/formatacao";
import {
  divergenciasService,
  mensagemDeErro,
  ROTULO_STATUS,
  ROTULO_TIPO,
  type Divergencia,
  type FiltroDivergencias,
  type StatusDivergencia,
  type TipoDivergencia,
} from "./services/divergenciasService";

const botaoPrimario = "bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm";
const rotulo = (ano: number, mes: number) => `${String(mes).padStart(2, "0")}/${ano}`;
const anoMes = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, "0")}`;
const POR_PAGINA = 100;
/** Todas as do filtro da barra vêm de uma vez: o filtro e a ordem das colunas valem para todas. */
const TODOS = 5000;
const COR_STATUS: Record<StatusDivergencia, string> = {
  ABERTA: "border-yellow-200 bg-yellow-50 text-yellow-800",
  JUSTIFICADA: "border-gray-200 bg-gray-50 text-gray-600",
  RESOLVIDA_POR_REABERTURA: "border-green-200 bg-green-50 text-green-700",
  RESOLVIDA_POR_REAPURACAO: "border-green-200 bg-green-50 text-green-700",
};

// As células desta tabela têm px-3; o cabeçalho acompanha.
const COLUNAS: Coluna<Divergencia>[] = [
  { chave: "competencia", rotulo: "Competência", tipo: "data", valor: (i) => i.competencia.ano * 100 + i.competencia.mes, texto: (i) => rotulo(i.competencia.ano, i.competencia.mes), classe: "px-3!" },
  { chave: "descricao", rotulo: "O que diverge", valor: (i) => i.descricao, classe: "px-3!" },
  { chave: "gravado", rotulo: "Gravado", tipo: "numero", alinhamento: "direita", valor: (i) => Number(i.valorGravado), texto: (i) => moeda(i.valorGravado), classe: "px-3!" },
  { chave: "recebido", rotulo: "Recebido", tipo: "numero", alinhamento: "direita", valor: (i) => Number(i.valorRecebido), texto: (i) => moeda(i.valorRecebido), classe: "px-3!" },
  { chave: "diferenca", rotulo: "Diferença", tipo: "numero", alinhamento: "direita", valor: (i) => Number(i.diferenca), texto: (i) => moeda(i.diferenca), classe: "px-3!" },
  { chave: "situacao", rotulo: "Situação", valor: (i) => ROTULO_STATUS[i.status], classe: "px-3!" },
];
const MARCAR: Coluna<Divergencia> = { chave: "marcar", rotulo: "", semFiltro: true, classe: "px-3!" };

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
  const [filtro, setFiltro] = useState<FiltroDivergencias>({ status: "ABERTA" });
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [dialogo, setDialogo] = useState<{ tipo: "justificar" } | { tipo: "resolver"; competencia: string } | null>(null);
  const lista = useQuery({
    queryKey: ["divergencias", filtro, TODOS],
    queryFn: () => divergenciasService.listar({ ...filtro, pagina: 1, porPagina: TODOS }),
    placeholderData: keepPreviousData,
  });
  const colunas = useMemo(() => (podeTratar ? [MARCAR, ...COLUNAS] : COLUNAS), [podeTratar]);
  const tabela = useTabelaFiltravel(lista.data?.itens, colunas, { porPaginaInicial: POR_PAGINA });
  // Só se justifica o que está à vista: a marcada que o filtro ou a ordem tiram da página sai da conta.
  const escolhidas = tabela.visiveis.filter((i) => marcadas.has(i.id)).map((i) => i.id);
  const muda = (p: Partial<FiltroDivergencias>) => {
    setMarcadas(new Set());
    setFiltro((f) => ({ ...f, ...p }));
    tabela.setPagina(1);
  };
  const atualizar = () => {
    setMarcadas(new Set());
    setDialogo(null);
    atualizarCompetencia(queryClient);
    void refresh(); // o aviso de abertas no menu
  };
  const justificar = useMutation({
    mutationFn: (texto: string) => divergenciasService.justificar(escolhidas, texto),
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
  const abertasNaPagina = tabela.visiveis.filter((i) => i.status === "ABERTA");

  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Divergências"
        comoUsar={
          <ul>
            <li>Filtre por competência, tipo e situação.</li>
            <li>Marque as divergências e clique em “Justificar”, com o motivo (ao menos 15 caracteres).</li>
            <li>Para corrigir em vez de justificar, use “Resolver por Reabertura” no quadro da competência fechada: o mês é reaberto para reimportar e reapurar.</li>
          </ul>
        }
        sobre={
          <p>
            Dado recebido depois do fechamento ou da apuração que difere do que está gravado: o balancete de um mês fechado, ou o preço de
            contrato que valorou a receita de um mês apurado. A competência não muda sozinha — a divergência é justificada, ou resolvida
            reabrindo a competência (no preço de um mês ainda aberto, reapurando).
          </p>
        }
      />

      {d && d.competencias.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {d.competencias.map((c) => (
            <div key={anoMes(c.ano, c.mes)} className="space-y-2 rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white p-4">
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

      {/* Filtros no padrão (G8 do levantamento de layout); a situação padrão é "Aberta". */}
      <BarraDeFiltros
        ativos={!!filtro.competencia || !!filtro.tipo || filtro.status !== "ABERTA"}
        onLimpar={() => muda({ competencia: undefined, tipo: undefined, status: "ABERTA" })}
        direita={
          podeTratar ? (
            <Button type="button" className={botaoPrimario} disabled={escolhidas.length === 0} onClick={() => setDialogo({ tipo: "justificar" })}>
              <MessageSquareText className="size-4" />
              Justificar {escolhidas.length > 0 ? `(${escolhidas.length})` : "selecionadas"}
            </Button>
          ) : null
        }
      >
        <SeletorFiltro
          rotulo="Competência"
          valor={filtro.competencia}
          onMudar={(v) => muda({ competencia: v })}
          todos="Todas"
          largura="w-36"
          opcoes={(d?.competencias ?? []).map((c) => ({ valor: anoMes(c.ano, c.mes), rotulo: rotulo(c.ano, c.mes) }))}
        />
        <SeletorFiltro
          rotulo="Tipo"
          valor={filtro.tipo}
          onMudar={(v) => muda({ tipo: v as TipoDivergencia | undefined })}
          opcoes={Object.entries(ROTULO_TIPO).map(([valor, r]) => ({ valor, rotulo: r }))}
        />
        <SeletorFiltro
          rotulo="Situação"
          valor={filtro.status}
          onMudar={(v) => muda({ status: v as StatusDivergencia | undefined })}
          todos="Todas"
          largura="w-56"
          opcoes={Object.entries(ROTULO_STATUS).map(([valor, r]) => ({ valor, rotulo: r }))}
        />
      </BarraDeFiltros>

      <QuadroTabela
        barra={
          <>
            <div className="ml-auto flex shrink-0 items-center gap-3">
              {tabela.ativos ? (
                <button type="button" onClick={tabela.limpar} className="text-xs font-medium text-gray-900 underline underline-offset-2">
                  Limpar Filtros
                </button>
              ) : null}
              <span className="text-xs text-gray-600">
                {d ? (tabela.ativos && tabela.total !== tabela.totalGeral ? `${inteiro(tabela.total)} de ${inteiro(tabela.totalGeral)} divergência(s)` : `${inteiro(tabela.total)} divergência(s)`) : ""}
              </span>
            </div>
          </>
        }
        rodape={
          d && tabela.total > 0 ? (
            <Paginacao
              total={tabela.total}
              pagina={tabela.pagina}
              porPagina={tabela.porPagina}
              onPagina={(p) => {
                setMarcadas(new Set());
                tabela.setPagina(p);
              }}
              carregando={lista.isFetching}
            />
          ) : null
        }
      >
        {lista.isError ? <ErroCarga mensagem={mensagemDeErro(lista.error, "Erro ao carregar as divergências.")} /> : null}
          <table className="tabela-sig w-full border-collapse text-sm">
            {tabela.cabecalhoCom({
              marcar: (
                <input
                  type="checkbox"
                  aria-label="Marcar as abertas da página"
                  checked={abertasNaPagina.length > 0 && abertasNaPagina.every((i) => marcadas.has(i.id))}
                  disabled={abertasNaPagina.length === 0}
                  onChange={(e) => setMarcadas(e.target.checked ? new Set(abertasNaPagina.map((i) => i.id)) : new Set())}
                  className="size-4 accent-black"
                />
              ),
            })}
            <tbody>
              {lista.isPending && !d ? (
                <tr>
                  <td colSpan={7}>
                    <Carregando linhas={3} />
                  </td>
                </tr>
              ) : d?.itens.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                    Nenhuma divergência com esses filtros.
                  </td>
                </tr>
              ) : d && tabela.visiveis.length === 0 ? (
                <SemResultado colunas={colunas.length} onLimpar={tabela.limpar} />
              ) : (
                tabela.visiveis.map((i) => (
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
                    <td className="px-3 py-2 text-right whitespace-nowrap">{moeda(i.valorGravado)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{moeda(i.valorRecebido)}</td>
                    <td className="px-3 py-2 text-right font-medium whitespace-nowrap">{moeda(i.diferenca)}</td>
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
      </QuadroTabela>

      {dialogo?.tipo === "justificar" ? (
        <DialogoTexto
          titulo={`Justificar ${escolhidas.length} divergência(s)`}
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
