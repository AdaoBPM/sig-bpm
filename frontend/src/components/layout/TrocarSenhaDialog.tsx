"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService } from "@/services/authService";

/** Troca da própria senha, pelo menu do usuário (Passo 22). */
export function TrocarSenhaDialog({ onFechar }: { onFechar: () => void }) {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const salvar = useMutation({
    mutationFn: () => authService.trocarSenha(atual, nova),
    onSuccess: () => {
      toast.success("Senha trocada.");
      onFechar();
    },
    onError: (e) => toast.error((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Não foi possível trocar a senha."),
  });
  const valida = atual.length > 0 && nova.length >= 8 && nova === confirma;
  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent className="rounded-sm sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Trocar senha</DialogTitle>
          <DialogDescription>A senha nova precisa de ao menos 8 caracteres.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="s-atual">Senha atual</Label>
            <Input id="s-atual" type="password" value={atual} onChange={(e) => setAtual(e.target.value)} className="rounded-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-nova">Senha nova</Label>
            <Input id="s-nova" type="password" value={nova} onChange={(e) => setNova(e.target.value)} className="rounded-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-confirma">Repita a senha nova</Label>
            <Input id="s-confirma" type="password" value={confirma} onChange={(e) => setConfirma(e.target.value)} className="rounded-sm" />
            {confirma && nova !== confirma ? <p className="text-xs text-red-700">As duas senhas novas não são iguais.</p> : null}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!valida || salvar.isPending}
            onClick={() => salvar.mutate()}
            className="bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm"
          >
            {salvar.isPending ? "Trocando…" : "Trocar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
