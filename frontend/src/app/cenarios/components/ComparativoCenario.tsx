"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { CampoBusca } from "@/components/shared/Filtros";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useAlteracoesPendentes } from "@/lib/alteracoesPendentes";

import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

import { cenariosService, rotuloMarcacao, rotuloVersao, type Comparativo } from "../services/cenariosService";
import { botaoPrimario, Erro } from "./CenarioDialog";
import { lerNumero } from "./EdicaoDialogs";

// Os quadros com o destaque amarelo-ouro à esquerda; o título com iniciais maiúsculas (13/10/2026).
/** A variação máxima no campo: sempre com duas casas (13/10/2026), sem separador de milhar (fácil de editar). */
const duasCasas = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
const QUADRO = "space-y-4 rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white p-5";
const TITULO = "text-sm font-bold text-gray-900";

/**
 * A aba Comparativo das Configurações do cenário (13/10/2026; antes, a aba Referência da tela Comparativo e, antes, a
 * aba Comparar dos Resultados): o cenário com que este se compara e a variação máxima (em %) de cada total da DRE. Com
 * um cenário comparado, a aba Justificativas da tela Reajustes lista as contas que passam da variação.
 */
export function ComparativoCenario({ id, podeEditar }: { id: string; podeEditar: boolean }) {
  const consulta = useQuery({ queryKey: ["cenarios", id, "comparativo"], queryFn: () => cenariosService.comparativo(id) });
  if (consulta.isError) return <Erro erro={mensagemDeErro(consulta.error, "Erro ao carregar o comparativo.")} />;
  if (consulta.isPending) return <div className="h-64 animate-pulse rounded-sm bg-gray-100" />;
  return <Formulario key={JSON.stringify(consulta.data)} id={id} dados={consulta.data} podeEditar={podeEditar} />;
}

function Formulario({ id, dados, podeEditar }: { id: string; dados: Comparativo; podeEditar: boolean }) {
  const queryClient = useQueryClient();
  const [comparado, setComparado] = useState(dados.comparadoCom?.id ?? "");
  const [limites, setLimites] = useState<Record<string, string>>(() => Object.fromEntries(dados.totais.map((t) => [t.codigo, t.limite === null ? "" : duasCasas(t.limite)])));
  const [todos, setTodos] = useState("");
  const [escolhendo, setEscolhendo] = useState(false);
  const escolhido = dados.opcoes.find((o) => o.id === comparado) ?? null;
  const lidos = Object.fromEntries(Object.entries(limites).map(([c, t]) => [c, lerNumero(t)]));
  const invalidos = dados.totais.filter((t) => lidos[t.codigo] === undefined || (lidos[t.codigo] ?? 0) < 0);
  const mudou = comparado !== (dados.comparadoCom?.id ?? "") || dados.totais.some((t) => (lidos[t.codigo] ?? null) !== t.limite);
  const comLimite = dados.totais.filter((t) => typeof lidos[t.codigo] === "number").length;
  // Sair com o comparativo mudado e não gravado pergunta antes (13/10/2026).
  useAlteracoesPendentes(mudou);
  const valorTodos = lerNumero(todos);

  const gravar = useMutation({
    mutationFn: () =>
      cenariosService.gravarComparativo(id, {
        comparadoComId: comparado || null,
        limites: Object.fromEntries(dados.totais.map((t) => [t.codigo, (lidos[t.codigo] as number | null) ?? null])),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cenarios"] });
      toast.success(comparado ? "Comparativo gravado." : "Comparativo desligado.");
    },
  });

  return (
    <div className="space-y-6">
      <section className={QUADRO}>
        <div className="flex flex-wrap items-end gap-3">
          {/* O cenário escolhido e o botão que abre o modal de escolha (13/10/2026; antes, uma lista). */}
          <div className="w-full max-w-xl space-y-1.5">
            <span className="text-sm leading-none font-medium">Cenário Comparado</span>
            <div className="flex items-center gap-2">
              <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-sm border border-gray-300 bg-gray-50 px-3 text-sm">
                {escolhido ? (
                  <>
                    <span className="truncate font-medium text-gray-900">{escolhido.nome}</span>
                    <span className="shrink-0 text-gray-600">
                      {rotuloVersao(escolhido.versao)} · {escolhido.ano}
                    </span>
                    <Etiqueta>{ROTULO_DO_TIPO[escolhido.tipo]}</Etiqueta>
                    {escolhido.marcacao ? <Etiqueta>{rotuloMarcacao(escolhido.marcacao)}</Etiqueta> : null}
                  </>
                ) : (
                  <span className="text-gray-500">Nenhum (sem comparativo)</span>
                )}
              </div>
              {podeEditar ? (
                <Button type="button" variant="outline" className="shrink-0 rounded-sm" onClick={() => setEscolhendo(true)}>
                  Escolher Cenário
                </Button>
              ) : null}
            </div>
          </div>
          <p className="min-w-0 flex-1 pb-2 text-xs text-gray-600">
            {comparado
              ? "Cada conta se compara, mês a mês e em cada aba da DRE, com a mesma conta do cenário escolhido. As que passam da variação máxima do total delas aparecem na aba Justificativas da tela Reajustes."
              : "Sem cenário comparado, o comparativo fica desligado e a aba Justificativas (tela Reajustes) não aparece. As variações máximas ficam guardadas."}
          </p>
        </div>
      </section>

      <section className={QUADRO}>
        {/* O "Preencher Todos Com" à direita, ao lado do texto (13/10/2026). */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h2 className={TITULO}>Variação Máxima</h2>
            <p className="mt-1 text-xs text-gray-600">
              A variação aceita (em %, para mais ou para menos) nas contas de cada total. Em branco, as contas do total não se verificam.
            </p>
          </div>
          {podeEditar ? (
            <div className="flex shrink-0 items-center gap-2">
              <Label htmlFor="cmp-todos">Preencher Todos Com</Label>
              <Input id="cmp-todos" value={todos} onChange={(e) => setTodos(e.target.value)} placeholder="%" inputMode="decimal" className="w-24 rounded-sm text-right" />
              <Button
                type="button"
                variant="outline"
                className="rounded-sm"
                disabled={typeof valorTodos !== "number" || valorTodos < 0}
                onClick={() => setLimites(Object.fromEntries(dados.totais.map((t) => [t.codigo, duasCasas(valorTodos as number)])))}
              >
                Aplicar
              </Button>
              <Button type="button" variant="outline" className="rounded-sm" disabled={comLimite === 0} onClick={() => setLimites(Object.fromEntries(dados.totais.map((t) => [t.codigo, ""])))}>
                Limpar
              </Button>
            </div>
          ) : null}
        </div>
        <div className="rounded-sm border border-gray-200">
          <table className="tabela-sig w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-600">Total</th>
                <th className="w-48 px-4 py-2.5 text-right text-xs font-bold text-gray-600">Variação Máxima (%)</th>
              </tr>
            </thead>
            <tbody>
              {dados.totais.map((t) => {
                const invalido = invalidos.some((x) => x.codigo === t.codigo);
                return (
                  <tr key={t.codigo} className="border-b border-gray-100 last:border-b-0">
                    <td className="px-4 py-1.5 text-sm">{t.descricao}</td>
                    <td className="px-4 py-1.5 text-right">
                      <Input
                        aria-label={`Variação máxima de ${t.descricao}`}
                        value={limites[t.codigo]}
                        onChange={(e) => setLimites((l) => ({ ...l, [t.codigo]: e.target.value }))}
                        // Ao sair do campo, o número digitado fica com duas casas.
                        onBlur={() => {
                          const v = lerNumero(limites[t.codigo]);
                          if (typeof v === "number" && v >= 0) setLimites((l) => ({ ...l, [t.codigo]: duasCasas(v) }));
                        }}
                        disabled={!podeEditar}
                        inputMode="decimal"
                        placeholder="—"
                        className={`ml-auto h-8 w-28 rounded-sm text-right ${invalido ? "border-red-400" : ""}`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {invalidos.length ? <p className="text-xs text-red-700">Variação inválida em {invalidos.map((t) => t.descricao).join(", ")}: use um número a partir de zero.</p> : null}
        <Erro erro={gravar.isError ? mensagemDeErro(gravar.error, "Não foi possível gravar o comparativo.") : null} />
        {podeEditar ? (
          <div className="flex items-center justify-end gap-3">
            <span className="text-xs text-gray-500">{comLimite} de {dados.totais.length} totais com variação máxima.</span>
            <Button type="button" className={botaoPrimario} disabled={!mudou || invalidos.length > 0 || gravar.isPending} onClick={() => gravar.mutate()}>
              {gravar.isPending ? "Gravando…" : "Gravar Comparativo"}
            </Button>
          </div>
        ) : null}
      </section>
      {escolhendo ? (
        <EscolherCenarioDialog
          opcoes={dados.opcoes}
          atual={comparado}
          onEscolher={(c) => {
            setComparado(c);
            setEscolhendo(false);
          }}
          onFechar={() => setEscolhendo(false)}
        />
      ) : null}
    </div>
  );
}

/** O tipo do cenário na etiqueta (13/10/2026: o comparativo vale entre sintéticos e analíticos). */
const ROTULO_DO_TIPO = { SINTETICO: "Sintético", ANALITICO: "Analítico" } as const;

const Etiqueta = ({ children }: { children: React.ReactNode }) => (
  <span className="shrink-0 rounded-sm border border-gray-300 bg-white px-1.5 py-px text-xs font-medium whitespace-nowrap text-gray-700">{children}</span>
);
/** O texto para a busca: sem diferença de maiúsculas e de acentos. */
const paraBusca = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * A escolha do cenário comparado (13/10/2026; antes, uma lista): a lista dos cenários, com a busca pelo nome e os
 * filtros "Apenas Vigentes" (a versão mais recente de cada cenário) e "Apenas com Marcação". A escolha vale no
 * formulário; grava-se em "Gravar Comparativo".
 */
function EscolherCenarioDialog({
  opcoes,
  atual,
  onEscolher,
  onFechar,
}: {
  opcoes: Comparativo["opcoes"];
  atual: string;
  onEscolher: (id: string) => void;
  onFechar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [soVigentes, setSoVigentes] = useState(false);
  const [soMarcados, setSoMarcados] = useState(false);
  const [escolha, setEscolha] = useState(atual);
  const termo = paraBusca(busca.trim());
  const visiveis = opcoes.filter((o) => (!soVigentes || o.vigente) && (!soMarcados || o.marcacao) && (!termo || paraBusca(`${o.nome} ${rotuloVersao(o.versao)} ${o.ano} ${ROTULO_DO_TIPO[o.tipo]}`).includes(termo)));
  const linha = (marcada: boolean) =>
    `flex cursor-pointer items-center gap-3 border-b border-gray-100 px-3 py-2 text-sm last:border-b-0 ${marcada ? "bg-gray-100" : "hover:bg-gray-50"}`;
  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent className="flex max-h-[85vh] flex-col rounded-sm sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Escolher Cenário Comparado</DialogTitle>
          <DialogDescription>
            O cenário com que este se compara, conta a conta e mês a mês: sintético ou analítico. Entre um sintético e um analítico, compara-se a
            DRE; o que só os analíticos têm (como os centros de custo) só se compara entre analíticos. A escolha grava-se em “Gravar Comparativo”.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <CampoBusca rotulo="Buscar cenário" valor={busca} onMudar={setBusca} placeholder="Nome, versão, exercício ou tipo…" largura="w-72" />
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" className="accent-black" checked={soVigentes} onChange={(e) => setSoVigentes(e.target.checked)} />
            Apenas Vigentes
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" className="accent-black" checked={soMarcados} onChange={(e) => setSoMarcados(e.target.checked)} />
            Apenas com Marcação
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-sm border border-gray-200" role="radiogroup" aria-label="Cenários">
          <label className={linha(escolha === "")}>
            <input type="radio" name="cenario-comparado" className="accent-black" checked={escolha === ""} onChange={() => setEscolha("")} />
            <span className="text-gray-700">Nenhum (sem comparativo)</span>
          </label>
          {visiveis.map((o) => (
            <label key={o.id} className={linha(escolha === o.id)}>
              <input type="radio" name="cenario-comparado" className="accent-black" checked={escolha === o.id} onChange={() => setEscolha(o.id)} />
              <span className="min-w-0 flex-1 truncate font-medium text-gray-900">{o.nome}</span>
              <span className="shrink-0 text-gray-600">
                {rotuloVersao(o.versao)} · {o.ano}
              </span>
              <Etiqueta>{ROTULO_DO_TIPO[o.tipo]}</Etiqueta>
              {o.vigente ? <Etiqueta>Vigente</Etiqueta> : null}
              {o.marcacao ? <Etiqueta>{rotuloMarcacao(o.marcacao)}</Etiqueta> : null}
            </label>
          ))}
          {visiveis.length === 0 ? <p className="px-3 py-6 text-center text-sm text-gray-500">Nenhum cenário com esses filtros.</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" className={botaoPrimario} disabled={escolha === atual} onClick={() => onEscolher(escolha)}>
            Escolher
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
