"use client";

import { useMemo, useRef, useState } from "react";
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

import { TabelaIndicadores, valor } from "@/app/relatorios/indicadores/TabelaIndicadores";
import { mensagemDeErro, type MesRelatorio } from "@/app/relatorios/services/relatoriosService";

import { botaoPrimario, Erro } from "../../../components/CenarioDialog";
import { AvisoMarcado, estaTravado } from "../../../components/AvisoMarcado";
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
/** O valor no campo como a tabela o mostra (13/10/2026): as mesmas casas, o separador de milhar e o %; vazio sem valor. */
const paraCampo = (i: IndicadorDoCenario, v: number | null) => (v === null ? "" : valor(i, v));
/** O valor digitado, na unidade gravada: aceita o formato da tabela ("1.234,5", "25,0%") ou só o número; vazio: null; inválido: undefined. */
function lerValor(i: IndicadorDoCenario, texto: string): number | null | undefined {
  const t = texto.replace(/R\$|%|\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return undefined;
  return emPct(i) ? n / 100 : n;
}

/** A escolha de Replicar aos Demais, guardada neste navegador (13/10/2026): vale nos próximos modais. */
const CHAVE_REPLICAR = "sig.cenarios.manuais.replicar";
function replicarGuardado() {
  try {
    return window.localStorage.getItem(CHAVE_REPLICAR) === "1";
  } catch {
    return false; // sem armazenamento
  }
}

/**
 * Os 12 meses de um lançamento manual (vazio apaga o mês). Os valores aparecem como na tabela (13/10/2026); o mês que
 * não se mexe fica com o valor gravado (sem o arredondamento da tela). Com "Replicar aos Demais", o valor digitado num
 * mês vai para os outros onze ao sair do campo (Tab).
 */
function LancamentoDialog({ id, indicador, meses, onFechar }: { id: string; indicador: IndicadorDoCenario; meses: MesRelatorio[]; onFechar: () => void }) {
  const queryClient = useQueryClient();
  const [textos, setTextos] = useState(() => indicador.meses.map((v) => paraCampo(indicador, v)));
  // Os meses mexidos (digitados ou replicados): só eles se leem do campo; os outros ficam com o valor gravado.
  const [mexidos, setMexidos] = useState<Set<number>>(() => new Set());
  const [replicar, setReplicar] = useState(replicarGuardado);
  // O mês digitado desde que o campo ganhou o foco: só ele se replica (passar com Tab por um mês sem digitar não replica).
  const digitado = useRef<number | null>(null);
  const valores = indicador.meses.map((v, k) => (mexidos.has(k) ? lerValor(indicador, textos[k]) : v));
  const invalido = valores.some((v) => v === undefined);
  const aoSair = (k: number) => {
    if (digitado.current !== k) return;
    digitado.current = null;
    const v = lerValor(indicador, textos[k]);
    if (v === undefined) return;
    const texto = paraCampo(indicador, v);
    if (replicar) {
      setTextos(textos.map(() => texto));
      setMexidos(new Set(meses.map((_, j) => j)));
    } else setTextos((t) => t.map((x, j) => (j === k ? texto : x)));
  };
  const salvar = useMutation({
    mutationFn: () => cenariosService.salvarManual(id, indicador.nome, valores.map((v) => (v === undefined ? null : v))),
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
      <DialogContent avisoAoSair className="max-h-[90vh] overflow-y-auto rounded-sm sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{indicador.nome}</DialogTitle>
          <DialogDescription>
            {indicador.metodologia} · {emPct(indicador) ? "em %" : `em ${indicador.unidade}`}. Os valores aparecem como na tabela; digite só o número
            (o separador de milhar e o % são opcionais). Um mês vazio fica sem valor. O valor digitado vale até uma nova importação da aba das metas no
            cenário.
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
                onChange={(e) => {
                  const texto = e.target.value;
                  digitado.current = k;
                  setTextos((t) => t.map((x, j) => (j === k ? texto : x)));
                  setMexidos((m) => (m.has(k) ? m : new Set(m).add(k)));
                }}
                onBlur={() => aoSair(k)}
                className={`rounded-sm text-right ${valores[k] === undefined ? "border-red-400" : ""}`}
              />
            </div>
          ))}
        </div>
        <Erro erro={invalido ? "Há um mês com um valor que não é número." : salvar.isError ? mensagemDeErro(salvar.error, "Não foi possível gravar.") : null} />
        <DialogFooter>
          {/* Replicar aos Demais (13/10/2026): à esquerda, na altura dos botões. */}
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 sm:mr-auto" title="O valor digitado num mês vai para os outros onze ao sair do campo (Tab)">
            <input type="checkbox" className="accent-black" checked={replicar} onChange={(e) => {
                const sim = e.target.checked;
                setReplicar(sim);
                try {
                  window.localStorage.setItem(CHAVE_REPLICAR, sim ? "1" : "0");
                } catch {
                  // sem armazenamento: a escolha só não é lembrada
                }
              }}
            />
            Replicar aos Demais
          </label>
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
  // Também a versão congelada (13/10/2026) trava os Indicadores Manuais.
  const travado = !!cenario.data && estaTravado(cenario.data);
  const podeEditar = hasPermission("cenarios:editar") && !!cenario.data && !travado;
  const [aba, setAba] = useState("metas");
  const [editando, setEditando] = useState<IndicadorDoCenario | null>(null);
  const consulta = useQuery({ queryKey: ["cenarios", id, "indicadores"], queryFn: () => cenariosService.indicadores(id) });
  const dados = consulta.data;
  const daAba = useMemo(() => dados?.indicadores.filter(DA_ABA[aba]) ?? [], [dados, aba]);
  const manuais = aba === "manuais";

  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Indicadores"
        comoUsar={
          <ul>
            <li>Troque de cenário no nome dele, na barra do topo; ao lado, a tela Resultados.</li>
            <li>Com um cenário comparado (Configurações / Comparativo), a coluna Comparado Acum., em preto e cinza depois do Acumulado, traz o acumulado dele.</li>
            <li>Metas: o compilado dos indicadores — os Indicadores de Resultados e os Indicadores Manuais juntos, com as eficiências calculadas e os importados. É o orçado que Resultados Realizados usa quando o cenário é o Orçamento Empresarial. Não se edita: muda com a DRE (tela Resultados) e com os Indicadores Manuais.</li>
            <li>Indicadores de Resultados: os de Produção e Serviços que saem da DRE do cenário (custos, volumes, mão de obra, matérias primas, gastos gerais, montagem).</li>
            <li>
              Indicadores Manuais: os quadros de lotação e os indicadores do Comercial e do Administrativo, que não saem da DRE. Vêm da aba das metas
              do arquivo importado{podeEditar ? "; clique numa linha para digitar os meses (as células digitadas ficam em amarelo)" : ""}.
            </li>
            <li>Na lista antes do rótulo Indicador (a seta), escolha Todos os Grupos ou um dos grupos da aba, como a lista dos níveis em Resultados.</li>
            <li>Use os filtros nos rótulos das colunas; as colunas Indicador, Sent. e Und. ficam fixas.</li>
            <li>Os indicadores sem numeração (os totais, como Custos de Produção: Matriz) ficam com a cor da faixa do grupo, e os de numeração par num tom mais fraco (amarelo nas colunas do realizado, cinza nas do comparado), para ajudar a seguir a linha. Nos Indicadores Manuais, as células digitadas ficam num amarelo mais forte.</li>
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
      <Abas rotulo="Indicadores do cenário" ativa={aba} onMudar={setAba} abas={ABAS.map((a) => ({ chave: a.chave, rotulo: a.rotulo }))} />
      {aba === "metas" ? (
        <p className="rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white px-4 py-2 text-sm text-gray-600">
          As Metas são o compilado dos indicadores: os Indicadores de Resultados (que saem da DRE do cenário) e os Indicadores Manuais, com as
          eficiências calculadas e os importados (liberação de projetos, GME). Não se editam aqui: mudam com a DRE, na tela Resultados, e com os
          Indicadores Manuais.
        </p>
      ) : null}
      {manuais && cenario.data && travado && hasPermission("cenarios:editar") ? <AvisoMarcado cenario={cenario.data} oQue="os Indicadores Manuais" /> : null}
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
          comparado={dados.comparado}
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
