"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { BuscaNaLista, type OpcaoDaBusca } from "@/components/shared/BuscaNaLista";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import { botaoPrimario } from "@/app/cenarios/components/CenarioDialog";
import { moeda } from "@/app/competencias/[anoMes]/utils/formatacao";

import { contestacoesService, mensagemDeErro } from "../services/contestacoesService";

const dataCurta = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : null);

/** O movimento contestado, como o balancete mostra: o centro e a conta que valem hoje. */
export type MovimentoContestado = {
  id: string;
  filial: number;
  emissao: string | null;
  cliForn: string | null;
  historico: string | null;
  valor: string;
  centro: string | null;
  conta: string;
};

/**
 * O modal Contestar (27/10/2026, pedido do Adão), no balancete de uma conta: o usuário sugere outro centro de custo e/ou
 * outra conta de resultado para o movimento (as listas com o código e o nome, com busca por termos) e, se quiser, o
 * motivo. A contestação vai para o responsável pelo centro (o novo; sem ele, o de hoje) — ou já fica acatada, quando quem
 * pede é o responsável.
 */
export function ContestarDialog({ movimento, onFechar, onCriada }: { movimento: MovimentoContestado; onFechar: () => void; onCriada: () => void }) {
  const opcoes = useQuery({ queryKey: ["contestacoes", "opcoes"], queryFn: contestacoesService.opcoes, staleTime: 5 * 60_000 });
  const [centro, setCentro] = useState<OpcaoDaBusca | null>(null);
  const [conta, setConta] = useState<OpcaoDaBusca | null>(null);
  const [motivo, setMotivo] = useState("");
  const centros: OpcaoDaBusca[] = (opcoes.data?.centros ?? []).map((c) => ({ id: c.id, codigo: c.codigoRM ?? "—", nome: c.nomeRM, detalhe: c.departamento }));
  const contas: OpcaoDaBusca[] = (opcoes.data?.contas ?? []).map((c) => ({ id: c.id, codigo: c.reduzido, nome: c.descricao, detalhe: [c.departamento, c.atribuicao].filter(Boolean).join(" · ") || null }));
  const enviar = useMutation({
    mutationFn: () => contestacoesService.criar({ lancamentoId: movimento.id, centroNovoId: centro?.id ?? null, contaNovaId: conta?.id ?? null, motivo: motivo.trim() || null }),
    onSuccess: (c) => {
      toast.success(
        c.situacao === "ACATADA"
          ? `Contestação nº ${c.numero} acatada: você é o responsável pelo centro de custo. Ela espera a validação da Controladoria.`
          : `Contestação nº ${c.numero} enviada${c.responsaveis.length ? ` a ${c.responsaveis.join(", ")}` : " à Controladoria (o centro não tem responsável)"}.`.replace(/\.\.$/, "."),
      );
      onCriada();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível enviar a contestação.")),
  });
  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent avisoAoSair className="rounded-sm sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Contestar o Movimento</DialogTitle>
          <DialogDescription>
            Sugira o novo centro de custo e/ou a nova conta de resultado do movimento. A contestação vai para o responsável pelo centro de custo (o novo; sem
            ele, o de hoje), que a acata ou recusa; acatada, a Controladoria a valida e corrige o movimento.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-sm border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
          <dt className="text-gray-500">Movimento</dt>
          <dd className="text-gray-900">
            {[dataCurta(movimento.emissao), movimento.cliForn, movimento.historico].filter(Boolean).join(" · ") || "—"} · Filial {movimento.filial} ·{" "}
            <span className="font-semibold">{moeda(movimento.valor)}</span>
          </dd>
          <dt className="text-gray-500">Centro de Custo</dt>
          <dd className="text-gray-900">{movimento.centro ?? "—"}</dd>
          <dt className="text-gray-500">Conta</dt>
          <dd className="text-gray-900">{movimento.conta}</dd>
        </dl>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ct-centro">Novo Centro de Custo</Label>
            <BuscaNaLista id="ct-centro" opcoes={centros} valor={centro} onEscolher={setCentro} placeholder="Código ou nome do centro de custo" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct-conta">Nova Conta de Resultado</Label>
            <BuscaNaLista id="ct-conta" opcoes={contas} valor={conta} onEscolher={setConta} placeholder="Código ou nome da conta" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct-motivo">Motivo (opcional)</Label>
            <textarea
              id="ct-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full rounded-sm border border-gray-300 px-3 py-2 text-sm"
              placeholder="Por que o movimento é de outro centro ou de outra conta"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" className={botaoPrimario} disabled={(!centro && !conta) || enviar.isPending} onClick={() => enviar.mutate()} title={!centro && !conta ? "Escolha o novo centro de custo e/ou a nova conta" : undefined}>
            {enviar.isPending ? "Enviando…" : "Contestar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
