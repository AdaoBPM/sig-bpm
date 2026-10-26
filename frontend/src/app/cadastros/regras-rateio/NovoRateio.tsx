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
import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

import { edicaoService } from "../services/edicaoService";
import { conferirPercentuais, PercentuaisDosDestinos, servicoDosPercentuaisFixos } from "./PercentuaisFixos";

type Tipo = "PARAMETRICO" | "FIXO";

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
  const [textosLinhas, setTextosLinhas] = useState<Record<string, Record<string, string>>>({});

  const chaves = fixos.data?.chaves ?? [];
  const chaveAtual = chave || chaves[0]?.chave || "";
  const daChave = chaves.find((c) => c.chave === chaveAtual);
  // Os destinos do paramétrico: as linhas dos Totais da chave (as opções do campo Destino do cadastro).
  const opcoesDestino = (def.data?.campos.find((c) => c.nome === "origemDoVolume")?.opcoes ?? []).filter((o) => !o.grupos || o.grupos.includes(chaveAtual));
  const destinoAtual = opcoesDestino.some((o) => o.valor === destino) ? destino : (opcoesDestino[0]?.valor ?? "");
  const conferido = conferirPercentuais(daChave?.destinos ?? [], textos, textosLinhas);
  const vigenciaOk = !!inicio && (!fim || fim >= inicio);
  const pronto = vigenciaOk && !!chaveAtual && (tipo === "PARAMETRICO" ? !!rotulo.trim() && !!destinoAtual : !conferido.invalido && conferido.somaCerta && conferido.linhasCertas);

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
        percentuais: conferido.percentuais,
        linhas: conferido.porLinha,
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
          <DialogDescription render={<div />}>
            <p>Rateios com a mesma chave não podem ter vigências sobrepostas.</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>Paramétrico: o percentual dos destinos sai dos valores mensais das respectivas listas (chaves).</li>
              <li>Fixo: os percentuais de Matriz, Filial, Montagem e Complementar, somando 100%; e, em cada destino com percentual, os das linhas da unidade dele, também somando 100%.</li>
            </ul>
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
              <PercentuaisDosDestinos prefixo="nr" conferido={conferido} textos={textos} setTextos={setTextos} textosLinhas={textosLinhas} setTextosLinhas={setTextosLinhas} />
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
