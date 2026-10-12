"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { Abas } from "@/components/shared/Abas";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/context/PermissionContext";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { TabelaIndicadores } from "@/app/relatorios/indicadores/TabelaIndicadores";
import { mensagemDeErro, type MesRelatorio } from "@/app/relatorios/services/relatoriosService";

import { botaoPrimario, Erro } from "../../../components/CenarioDialog";
import { AvisoMarcado } from "../../../components/AvisoMarcado";
import { cenariosService, type IndicadorDoCenario } from "../../../services/cenariosService";

/** As abas: os indicadores da DRE de Produção e Serviços, os lançamentos manuais e as metas orçadas (todos). */
// As Metas primeiro (12/10/2026): o compilado dos indicadores, como o Consolidado nos Resultados.
const ABAS = [
  { chave: "metas", rotulo: "Metas" },
  { chave: "resultados", rotulo: "Indicadores de Resultados" },
  { chave: "manuais", rotulo: "Indicadores Manuais" },
];
const DA_ABA: Record<string, (i: IndicadorDoCenario) => boolean> = {
  resultados: (i) => i.classe === "RESULTADO" && (i.grupo === "Produção" || i.grupo === "Serviços"),
  manuais: (i) => i.classe === "MANUAL",
  metas: () => true,
};

// Os percentuais se digitam em % (0,25 = 25%), como nas abas Comercial e Administrativo das Listas.
const emPct = (i: IndicadorDoCenario) => i.unidade === "%";
const paraTexto = (i: IndicadorDoCenario, v: number | null) =>
  v === null ? "" : (emPct(i) ? v * 100 : v).toLocaleString("pt-BR", { maximumFractionDigits: 6, useGrouping: false });
function lerNumero(texto: string): number | null | undefined {
  const t = texto.trim().replace(/\./g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** Os 12 meses de um lançamento manual (vazio apaga o mês). */
function LancamentoDialog({ id, indicador, meses, onFechar }: { id: string; indicador: IndicadorDoCenario; meses: MesRelatorio[]; onFechar: () => void }) {
  const queryClient = useQueryClient();
  const [textos, setTextos] = useState(() => indicador.meses.map((v) => paraTexto(indicador, v)));
  const valores = textos.map(lerNumero);
  const invalido = valores.some((v) => v === undefined);
  const salvar = useMutation({
    mutationFn: () => cenariosService.salvarManual(id, indicador.nome, valores.map((v) => (v === null || v === undefined ? null : emPct(indicador) ? v / 100 : v))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cenarios"] });
      // Se o cenário é o Orçamento Empresarial, o orçado de Resultados Realizados muda.
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
      toast.success(`${indicador.nome}: lançamentos gravados.`);
      onFechar();
    },
  });
  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-sm sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{indicador.nome}</DialogTitle>
          <DialogDescription>
            {indicador.metodologia} · {emPct(indicador) ? "em %" : `em ${indicador.unidade}`}. Um mês vazio fica sem valor. O valor digitado vale até uma
            nova importação da aba das metas no cenário.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {meses.map((m, k) => (
            <div key={m.mes} className="space-y-1">
              <Label htmlFor={`lanc-${k}`}>{m.rotulo}</Label>
              <Input
                id={`lanc-${k}`}
                inputMode="decimal"
                value={textos[k]}
                onChange={(e) => setTextos((t) => t.map((x, j) => (j === k ? e.target.value : x)))}
                className={`rounded-sm text-right ${valores[k] === undefined ? "border-red-400" : ""}`}
              />
            </div>
          ))}
        </div>
        <Erro erro={invalido ? "Há um mês com um valor que não é número." : salvar.isError ? mensagemDeErro(salvar.error, "Não foi possível gravar.") : null} />
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" className={botaoPrimario} disabled={invalido || salvar.isPending} onClick={() => salvar.mutate()}>
            {salvar.isPending ? "Gravando…" : "Gravar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A tela Indicadores de um cenário sintético. */
export function CenarioIndicadoresContent() {
  const { id } = useParams<{ id: string }>();
  useRegistrarAcessoTela(`/cenarios/sinteticos/${id}/indicadores`);
  const { hasPermission } = usePermissions();
  // O cenário marcado não se edita (12/10/2026): os Indicadores Manuais ficam só para leitura, com o aviso.
  const cenario = useQuery({ queryKey: ["cenarios", id], queryFn: () => cenariosService.obter(id) });
  const marcacao = cenario.data?.marcacao ?? null;
  const podeEditar = hasPermission("cenarios:editar") && !!cenario.data && !marcacao;
  const [aba, setAba] = useState("metas");
  const [editando, setEditando] = useState<IndicadorDoCenario | null>(null);
  const consulta = useQuery({ queryKey: ["cenarios", id, "indicadores"], queryFn: () => cenariosService.indicadores(id) });
  const dados = consulta.data;
  const daAba = useMemo(() => dados?.indicadores.filter(DA_ABA[aba]) ?? [], [dados, aba]);
  const contagem = (chave: string) => dados?.indicadores.filter(DA_ABA[chave]).length;
  const manuais = aba === "manuais";

  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Indicadores"
        comoUsar={
          <ul>
            <li>Troque de cenário no nome dele, na barra do topo; ao lado, a tela Resultados.</li>
            <li>Metas: o compilado dos indicadores — os Indicadores de Resultados e os Indicadores Manuais juntos, com as eficiências calculadas e os importados. É o orçado que Resultados Realizados usa quando o cenário é o Orçamento Empresarial. Não se edita: muda com a DRE (tela Resultados) e com os Indicadores Manuais.</li>
            <li>Indicadores de Resultados: os de Produção e Serviços que saem da DRE do cenário (custos, volumes, mão de obra, matérias primas, gastos gerais, montagem).</li>
            <li>
              Indicadores Manuais: os quadros de lotação e os indicadores do Comercial e do Administrativo, que não saem da DRE. Vêm da aba das metas
              do arquivo importado{podeEditar ? "; clique numa linha para digitar os meses (as células digitadas ficam em amarelo)" : ""}.
            </li>
            <li>Use os filtros nos rótulos das colunas; as colunas Indicador, Sent. e Und. ficam fixas.</li>
          </ul>
        }
        sobre={
          <>
            <p>
              Os indicadores do cenário, mês a mês e acumulados, com as fórmulas do cadastro Estrutura dos Indicadores — as mesmas de Resultados
              Realizados — sobre a DRE do cenário e os lançamentos manuais. O acumulado também segue Resultados Realizados: a soma dos meses ou,
              nas razões, a média ponderada; os de posição valem o último mês.
            </p>
            <p>
              As eficiências (volume ou receita por colaborador) juntam a DRE e os quadros de lotação, e só aparecem nas Metas. A liberação
              de projetos (que vem das Listas) e os GME 4 e 8 o cenário não tem como calcular: ficam com o valor da aba das metas importada.
            </p>
          </>
        }
      />
      <Abas rotulo="Indicadores do cenário" ativa={aba} onMudar={setAba} abas={ABAS.map((a) => ({ chave: a.chave, rotulo: a.rotulo, contagem: contagem(a.chave) }))} />
      {aba === "metas" ? (
        <p className="rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white px-4 py-2 text-sm text-gray-600">
          As Metas são o compilado dos indicadores: os Indicadores de Resultados (que saem da DRE do cenário) e os Indicadores Manuais, com as
          eficiências calculadas e os importados (liberação de projetos, GME). Não se editam aqui: mudam com a DRE, na tela Resultados, e com os
          Indicadores Manuais.
        </p>
      ) : null}
      {manuais && marcacao && hasPermission("cenarios:editar") ? <AvisoMarcado marcacao={marcacao} oQue="os Indicadores Manuais" /> : null}
      {consulta.isError ? (
        <div className="rounded-sm border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{mensagemDeErro(consulta.error, "Erro ao carregar os indicadores do cenário.")}</p>
        </div>
      ) : !dados ? (
        <div className="h-64 animate-pulse rounded-sm bg-gray-100" />
      ) : (
        <TabelaIndicadores
          key={aba}
          meses={dados.meses}
          indicadores={daAba}
          onClicar={manuais && podeEditar ? setEditando : undefined}
          dicaDoClique="Digitar os lançamentos do indicador"
          iconeDoClique={manuais && podeEditar ? Pencil : undefined}
          destacar={manuais ? (i, k) => i.digitados[k] : undefined}
          dicaDoDestaque="Valor digitado"
        />
      )}
      {editando && dados ? <LancamentoDialog id={id} indicador={editando} meses={dados.meses} onFechar={() => setEditando(null)} /> : null}
    </div>
  );
}
