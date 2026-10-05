"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { KeyRound, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/DataTable";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";

import { UsuarioDialog } from "./components/UsuarioDialog";
import { mensagemDeErro, usuariosService, type Usuario } from "./services/usuariosService";

const botaoPrimario = "bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm";

function RedefinirSenhaDialog({ usuario, onFechar }: { usuario: Usuario; onFechar: () => void }) {
  const [senha, setSenha] = useState("");
  const salvar = useMutation({
    mutationFn: () => usuariosService.redefinirSenha(usuario.id, senha),
    onSuccess: () => {
      toast.success(`Senha de ${usuario.nome} redefinida.`);
      onFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível redefinir a senha.")),
  });
  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent className="rounded-sm sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Redefinir senha</DialogTitle>
          <DialogDescription>
            Nova senha de {usuario.nome} ({usuario.email}). Passe a ele por um canal seguro; ele pode trocá-la depois, no menu do usuário.
          </DialogDescription>
        </DialogHeader>
        <Input type="password" aria-label="Nova senha" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="ao menos 8 caracteres" className="rounded-sm" />
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" className={botaoPrimario} disabled={senha.length < 8 || salvar.isPending} onClick={() => salvar.mutate()}>
            Redefinir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UsuariosContent() {
  useRegistrarAcessoTela("/usuarios");
  const [editando, setEditando] = useState<Usuario | null | "novo">(null);
  const [senhaDe, setSenhaDe] = useState<Usuario | null>(null);
  const usuarios = useQuery({ queryKey: ["usuarios"], queryFn: usuariosService.listar });
  const opcoes = useQuery({ queryKey: ["usuarios", "opcoes"], queryFn: usuariosService.opcoes });
  const rotuloSetor = new Map(opcoes.data?.setores.map((s) => [s.tipo, s.rotulo]));
  const rotuloDep = new Map(opcoes.data?.departamentos.map((d) => [d.departamento, d.rotulo]));

  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Usuários"
        sobre={
          <p>
            Quem entra no sistema e com qual perfil. O perfil define o que cada um pode fazer; os setores e os departamentos recortam o que ele
            alcança.
          </p>
        }
        acoes={
          <PermissionGuard permission="usuarios:editar">
            <Button type="button" className={botaoPrimario} disabled={!opcoes.data} onClick={() => setEditando("novo")}>
              <Plus className="size-4" />
              Novo usuário
            </Button>
          </PermissionGuard>
        }
      />

      <DataTable<Usuario>
        data={usuarios.data ?? []}
        isLoading={usuarios.isPending}
        error={usuarios.isError ? mensagemDeErro(usuarios.error, "Erro ao carregar os usuários.") : null}
        emptyMessage="Nenhum usuário"
        columns={["Nome", "E-mail", "Perfil", "Recorte", "Situação", ""]}
        renderRow={(u) => (
          <tr key={u.id} className={`border-b border-gray-100 hover:bg-gray-50 ${u.ativo ? "" : "text-gray-400"}`}>
            <td className="px-4 py-3 text-sm font-medium">{u.nome}</td>
            <td className="px-4 py-3 text-sm">{u.email}</td>
            <td className="px-4 py-3 text-sm">{u.perfil.nome}</td>
            <td className="px-4 py-3 text-xs text-gray-600">
              {u.perfil.recorteSetor ? `Setores: ${u.setores.map((s) => rotuloSetor.get(s) ?? s).join(", ") || "nenhum"}` : null}
              {u.perfil.recorteDepartamento ? `Departamentos: ${u.departamentos.map((d) => rotuloDep.get(d) ?? d).join(", ") || "nenhum"}` : null}
              {!u.perfil.recorteSetor && !u.perfil.recorteDepartamento ? "—" : null}
            </td>
            <td className="px-4 py-3 text-sm">{u.ativo ? "Ativo" : "Inativo"}</td>
            <td className="px-4 py-3 text-right whitespace-nowrap">
              <PermissionGuard permission="usuarios:editar">
                <Button type="button" variant="ghost" size="icon" aria-label="Editar" disabled={!opcoes.data} onClick={() => setEditando(u)}>
                  <Pencil className="size-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label="Redefinir senha" onClick={() => setSenhaDe(u)}>
                  <KeyRound className="size-4" />
                </Button>
              </PermissionGuard>
            </td>
          </tr>
        )}
      />

      {editando && opcoes.data ? (
        <UsuarioDialog key={editando === "novo" ? "novo" : editando.id} opcoes={opcoes.data} editando={editando === "novo" ? null : editando} onFechar={() => setEditando(null)} />
      ) : null}
      {senhaDe ? <RedefinirSenhaDialog usuario={senhaDe} onFechar={() => setSenhaDe(null)} /> : null}
    </div>
  );
}
