"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

import { cenariosService, type Cenario } from "../services/cenariosService";

export const botaoPrimario = "bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm";
export const classeSelect = "h-9 w-full rounded-sm border border-gray-300 bg-white px-3 text-sm";

export function Erro({ erro }: { erro: string | null }) {
  if (!erro) return null;
  return (
    <div className="flex items-center gap-2 rounded-sm border border-red-200 bg-red-50 p-3">
      <AlertCircle className="size-4 shrink-0 text-red-700" />
      <p className="text-sm text-red-700">{erro}</p>
    </div>
  );
}

/**
 * Novo cenário (vazio, num exercício, ou a cópia de outro, com a DRE e as metas dele) ou a edição do nome e da
 * descrição de um cenário.
 */
export function CenarioDialog({ cenario, cenarios, onFechar }: { cenario: Cenario | null; cenarios: Cenario[]; onFechar: () => void }) {
  const queryClient = useQueryClient();
  const atual = new Date().getFullYear();
  const [nome, setNome] = useState(cenario?.nome ?? "");
  const [descricao, setDescricao] = useState(cenario?.descricao ?? "");
  const [ano, setAno] = useState(String(cenario?.ano ?? atual));
  const [copiarDe, setCopiarDe] = useState("");
  const origem = cenarios.find((c) => c.id === copiarDe);

  const salvar = useMutation({
    mutationFn: () =>
      cenario
        ? cenariosService.atualizar(cenario.id, { nome: nome.trim(), descricao: descricao.trim() || null })
        : cenariosService.criar({ nome: nome.trim(), ano: Number(ano), descricao: descricao.trim() || null, copiarDe: copiarDe || null }),
    onSuccess: (c) => {
      queryClient.invalidateQueries({ queryKey: ["cenarios"] });
      toast.success(cenario ? "Cenário alterado." : `Cenário ${c.nome} criado.`);
      onFechar();
    },
  });

  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent className="rounded-sm sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{cenario ? "Editar Cenário" : "Novo Cenário"}</DialogTitle>
          <DialogDescription>
            {cenario
              ? "O nome e a descrição do cenário. A DRE e as metas mudam pela importação de um arquivo e pelos lançamentos manuais."
              : "Um cenário vazio, num exercício, ou a cópia de outro cenário, com a DRE e as metas dele. Depois, importe um arquivo no cenário ou ajuste os lançamentos manuais."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cenario-nome">Nome</Label>
            <Input id="cenario-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} className="rounded-sm" placeholder="Ex.: Cenário Adotado (REV02)" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cenario-descricao">Descrição (opcional)</Label>
            <Input id="cenario-descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={500} className="rounded-sm" />
          </div>
          {cenario ? null : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="cenario-copia">Copiar de (opcional)</Label>
                <select id="cenario-copia" value={copiarDe} onChange={(e) => setCopiarDe(e.target.value)} className={classeSelect}>
                  <option value="">Nenhum (cenário vazio)</option>
                  {cenarios.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.ano})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cenario-ano">Exercício</Label>
                <select id="cenario-ano" value={origem ? String(origem.ano) : ano} onChange={(e) => setAno(e.target.value)} disabled={!!origem} className={classeSelect}>
                  {[atual - 1, atual, atual + 1, atual + 2].map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
        <Erro erro={salvar.isError ? mensagemDeErro(salvar.error, "Não foi possível gravar o cenário.") : null} />
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" className={botaoPrimario} disabled={!nome.trim() || salvar.isPending} onClick={() => salvar.mutate()}>
            {salvar.isPending ? "Gravando…" : cenario ? "Gravar" : "Criar Cenário"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A exclusão de um cenário, com a confirmação. */
export function ExcluirCenarioDialog({ cenario, onFechar }: { cenario: Cenario; onFechar: () => void }) {
  const queryClient = useQueryClient();
  const excluir = useMutation({
    mutationFn: () => cenariosService.excluir(cenario.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cenarios"] });
      toast.success(`Cenário ${cenario.nome} excluído.`);
      onFechar();
    },
  });
  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent className="rounded-sm sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir Cenário</DialogTitle>
          <DialogDescription>
            O cenário {cenario.nome} ({cenario.ano}) sai da lista, com a DRE e as metas dele. A exclusão fica no log de auditoria e não se desfaz.
          </DialogDescription>
        </DialogHeader>
        <Erro erro={excluir.isError ? mensagemDeErro(excluir.error, "Não foi possível excluir o cenário.") : null} />
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" className="rounded-sm bg-red-700 font-bold text-white hover:bg-red-800" disabled={excluir.isPending} onClick={() => excluir.mutate()}>
            {excluir.isPending ? "Excluindo…" : "Excluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
