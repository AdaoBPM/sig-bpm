"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DepartamentoAcesso } from "@/services/authService";

import { classeSelect, mensagemDeErro, usuariosService, type OpcoesUsuarios, type Usuario } from "../services/usuariosService";

type Props = { opcoes: OpcoesUsuarios; editando: Usuario | null; onFechar: () => void };

/** Cadastro e edição de um usuário: perfil, situação, setores (Alimentador) e departamentos (Gestor). */
export function UsuarioDialog({ opcoes, editando, onFechar }: Props) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState(editando?.nome ?? "");
  const [email, setEmail] = useState(editando?.email ?? "");
  const [perfilId, setPerfilId] = useState(editando?.perfil.id ?? opcoes.perfis.find((p) => p.ativo)?.id ?? "");
  const [ativo, setAtivo] = useState(editando?.ativo ?? true);
  const [setores, setSetores] = useState<string[]>(editando?.setores ?? []);
  const [departamentos, setDepartamentos] = useState<DepartamentoAcesso[]>(editando?.departamentos ?? []);
  const [senha, setSenha] = useState("");
  const perfil = opcoes.perfis.find((p) => p.id === perfilId);

  const salvar = useMutation({
    mutationFn: () => {
      const d = { nome, email, perfilId, ativo, setores, departamentos };
      return editando ? usuariosService.atualizar(editando.id, d) : usuariosService.criar({ ...d, senha });
    },
    onSuccess: () => {
      toast.success(editando ? "Usuário atualizado." : "Usuário criado.");
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      onFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível salvar o usuário.")),
  });
  const alternar = <T,>(lista: T[], item: T) => (lista.includes(item) ? lista.filter((x) => x !== item) : [...lista, item]);
  const podeSalvar = nome.trim().length >= 2 && email.includes("@") && perfilId && (editando || senha.length >= 8);

  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-sm sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
          <DialogDescription>O que o usuário pode fazer vem do perfil. Setores e departamentos só valem se o perfil recorta por eles.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="u-nome">Nome</Label>
              <Input id="u-nome" value={nome} onChange={(e) => setNome(e.target.value)} className="rounded-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-email">E-mail corporativo</Label>
              <Input id="u-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-perfil">Perfil</Label>
              <select id="u-perfil" value={perfilId} onChange={(e) => setPerfilId(e.target.value)} className={classeSelect}>
                {opcoes.perfis.map((p) => (
                  <option key={p.id} value={p.id} disabled={!p.ativo}>
                    {p.nome}
                    {p.ativo ? "" : " (inativo)"}
                  </option>
                ))}
              </select>
            </div>
            {!editando ? (
              <div className="space-y-1.5">
                <Label htmlFor="u-senha">Senha inicial</Label>
                <Input id="u-senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} className="rounded-sm" placeholder="ao menos 8 caracteres" />
              </div>
            ) : (
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-gray-900">
                <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="size-4 accent-black" />
                Ativo (pode entrar no sistema)
              </label>
            )}
          </div>

          {perfil?.recorteSetor ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-gray-900">Setores<span className="font-normal text-gray-500">: listas que pode digitar e importar</span></legend>
              <div className="grid gap-1 sm:grid-cols-2">
                {opcoes.setores.map((s) => (
                  <label key={s.tipo} className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={setores.includes(s.tipo)} onChange={() => setSetores(alternar(setores, s.tipo))} className="size-4 accent-black" />
                    {s.rotulo}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          {perfil?.recorteDepartamento ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-gray-900">Departamentos<span className="font-normal text-gray-500">: movimentações e centros de custo que pode consultar</span></legend>
              <div className="grid gap-1 sm:grid-cols-2">
                {opcoes.departamentos.map((d) => (
                  <label key={d.departamento} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={departamentos.includes(d.departamento)}
                      onChange={() => setDepartamentos(alternar(departamentos, d.departamento))}
                      className="size-4 accent-black"
                    />
                    {d.rotulo}
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500">A DRE é inteira para todos; sem departamento marcado, o usuário não vê movimentações nem centros de custo.</p>
            </fieldset>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!podeSalvar || salvar.isPending}
            onClick={() => salvar.mutate()}
            className="bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm"
          >
            {salvar.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
