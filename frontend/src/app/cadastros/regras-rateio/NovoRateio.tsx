"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { atualizarCompetencia } from "@/lib/atualizarCompetencia";

import { botaoPrimario, classeSelect, Erro } from "@/app/cenarios/components/CenarioDialog";
import { lerNumero } from "@/app/cenarios/components/EdicaoDialogs";
import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

import { edicaoService } from "../services/edicaoService";
import { servicoDosPercentuaisFixos } from "./PercentuaisFixos";

type Tipo = "PARAMETRICO" | "FIXO";
const pct = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

/** O botão Novo Rateio (14/10/2026; antes, o Novo do cadastro e o Percentuais Fixos), na linha do título. */
export function BotaoNovoRateio() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button type="button" className={botaoPrimario} onClick={() => setAberto(true)}>
        <Plus className="size-4" />
        Novo Rateio
      </Button>
      {aberto ? <NovoRateioDialog onFechar={() => setAberto(false)} /> : null}
    </>
  );
}

/**
 * Um rateio novo (14/10/2026): o Rótulo e, ao lado, o Tipo. Paramétrico: uma regra por volume — a chave, o destino (a
 * linha dos Totais das Listas Operacionais) e a vigência; o percentual sai do volume do destino no mês. Fixo: a chave,
 * a vigência e o percentual de cada um dos quatro destinos (Matriz, Filial, Montagem e Complementar), somando 100%; o
 * rótulo é a base do rótulo de cada destino.
 */
function NovoRateioDialog({ onFechar }: { onFechar: () => void }) {
  const queryClient = useQueryClient();
  const fixos = useQuery({ queryKey: ["edicao", "regras-rateio", "percentuais-fixos"], queryFn: servicoDosPercentuaisFixos.listar });
  const def = useQuery({ queryKey: ["edicao", "regras-rateio", "definicao"], queryFn: () => edicaoService.definicao("regras-rateio") });
  const [rotulo, setRotulo] = useState("");
  const [tipo, setTipo] = useState<Tipo>("PARAMETRICO");
  const [chave, setChave] = useState("");
  const [destino, setDestino] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [textos, setTextos] = useState<Record<string, string>>({});

  const chaves = fixos.data?.chaves ?? [];
  const chaveAtual = chave || chaves[0]?.chave || "";
  const daChave = chaves.find((c) => c.chave === chaveAtual);
  // Os destinos do paramétrico: as linhas dos Totais da chave (as opções do campo Destino do cadastro).
  const opcoesDestino = (def.data?.campos.find((c) => c.nome === "origemDoVolume")?.opcoes ?? []).filter((o) => !o.grupos || o.grupos.includes(chaveAtual));
  const destinoAtual = opcoesDestino.some((o) => o.valor === destino) ? destino : (opcoesDestino[0]?.valor ?? "");
  const valores = (daChave?.destinos ?? []).map((d) => ({ ...d, valor: lerNumero(textos[d.destino] ?? "") }));
  const soma = valores.reduce((s, v) => s + (typeof v.valor === "number" ? v.valor : 0), 0);
  const invalido = valores.some((v) => v.valor === undefined || (typeof v.valor === "number" && (v.valor < 0 || v.valor > 100)));
  const somaCerta = Math.abs(soma - 100) <= 0.005;
  const vigenciaOk = !!inicio && (!fim || fim >= inicio);
  const pronto = vigenciaOk && !!chaveAtual && (tipo === "PARAMETRICO" ? !!rotulo.trim() && !!destinoAtual : !invalido && somaCerta);

  const gravar = useMutation({
    mutationFn: async () => {
      if (tipo === "PARAMETRICO") {
        await edicaoService.criar("regras-rateio", { rotulo: rotulo.trim(), chave: chaveAtual, origemDoVolume: destinoAtual, vigenciaInicio: inicio, vigenciaFim: fim || null });
        return;
      }
      await servicoDosPercentuaisFixos.gravar({
        chave: chaveAtual,
        inicioAnterior: null,
        inicio,
        fim: fim || null,
        rotulo: rotulo.trim() || null,
        percentuais: Object.fromEntries(valores.map((v) => [v.destino, typeof v.valor === "number" ? v.valor : 0])),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["edicao", "regras-rateio"] });
      atualizarCompetencia(queryClient);
      toast.success(`Rateio ${tipo === "PARAMETRICO" ? "paramétrico" : "fixo"} de ${daChave?.nome ?? ""} gravado.`);
      onFechar();
    },
  });

  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent avisoAoSair className="max-h-[90vh] overflow-y-auto rounded-sm sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Novo Rateio</DialogTitle>
          <DialogDescription>
            Rateios com a mesma chave não podem ter vigências sobrepostas. Paramétrico: o percentual de cada destino sai do volume dele nas listas do
            mês. Fixo: os percentuais de Matriz, Filial, Montagem e Complementar, somando 100%.
          </DialogDescription>
        </DialogHeader>
        {fixos.isError || def.isError ? (
          <Erro erro={mensagemDeErro(fixos.error ?? def.error, "Erro ao carregar as chaves de rateio.")} />
        ) : fixos.isPending || def.isPending ? (
          <div className="h-48 animate-pulse rounded-sm bg-gray-100" />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
              <div className="space-y-1.5">
                <Label htmlFor="nr-rotulo">{tipo === "PARAMETRICO" ? "Rótulo" : "Rótulo (opcional)"}</Label>
                <Input
                  id="nr-rotulo"
                  value={rotulo}
                  onChange={(e) => setRotulo(e.target.value)}
                  maxLength={120}
                  placeholder={tipo === "FIXO" ? `${daChave?.nome ?? "Chave"} (cada destino: “${daChave?.nome ?? "Chave"}: Matriz (Fixo)”)` : "Ex.: (P) Pré-Fabricado: Matriz"}
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nr-tipo">Tipo</Label>
                <select id="nr-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)} className={classeSelect}>
                  <option value="PARAMETRICO">Paramétrico</option>
                  <option value="FIXO">Fixo</option>
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className={`space-y-1.5 ${tipo === "FIXO" ? "sm:col-span-2" : ""}`}>
                <Label htmlFor="nr-chave">Chave</Label>
                <select id="nr-chave" value={chaveAtual} onChange={(e) => setChave(e.target.value)} className={classeSelect}>
                  {chaves.map((c) => (
                    <option key={c.chave} value={c.chave}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
              {tipo === "PARAMETRICO" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="nr-destino">Destino</Label>
                  <select id="nr-destino" value={destinoAtual} onChange={(e) => setDestino(e.target.value)} className={classeSelect}>
                    {opcoesDestino.map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.rotulo}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="nr-inicio">Vigência: Início</Label>
                <Input id="nr-inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="rounded-sm" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nr-fim">Vigência: Fim (opcional)</Label>
                <Input id="nr-fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} className={`rounded-sm ${fim && inicio && fim < inicio ? "border-red-400" : ""}`} />
              </div>
            </div>
            {tipo === "FIXO" ? (
              <>
                <div className="rounded-sm border border-gray-200 bg-white">
                  {valores.map((v) => (
                    <div key={v.destino} className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 last:border-b-0">
                      <Label htmlFor={`nr-${v.destino}`} className="text-sm text-gray-800">
                        {v.nome}
                      </Label>
                      <div className="flex items-center gap-1.5">
                        <Input
                          id={`nr-${v.destino}`}
                          inputMode="decimal"
                          value={textos[v.destino] ?? ""}
                          placeholder="0"
                          onChange={(e) => setTextos((t) => ({ ...t, [v.destino]: e.target.value }))}
                          className={`h-8 w-28 rounded-sm text-right ${v.valor === undefined || (typeof v.valor === "number" && (v.valor < 0 || v.valor > 100)) ? "border-red-400" : ""}`}
                        />
                        <span className="text-sm text-gray-600">%</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-3 bg-gray-50 px-3 py-2 text-sm">
                    <span className="font-bold text-gray-900">Soma</span>
                    <span className={`font-bold ${somaCerta ? "text-gray-900" : "text-red-700"}`}>{pct(soma)}</span>
                  </div>
                </div>
                {!somaCerta && !invalido ? <p className="text-xs text-red-700">Os percentuais precisam somar 100% (faltam {pct(100 - soma)}).</p> : null}
              </>
            ) : null}
            <Erro erro={gravar.isError ? mensagemDeErro(gravar.error, "Não foi possível gravar o rateio.") : null} />
            <DialogFooter>
              <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
                Cancelar
              </Button>
              <Button type="button" className={botaoPrimario} disabled={!pronto || gravar.isPending} onClick={() => gravar.mutate()}>
                {gravar.isPending ? "Gravando…" : "Gravar"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
