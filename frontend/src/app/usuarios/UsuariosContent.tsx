"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { KeyRound, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/DataTable";
import { useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import type { Coluna } from "@/lib/filtrosDeTabela";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { QuadroTabela } from "@/components/shared/QuadroTabela";

import { UsuarioDialog } from "./components/UsuarioDialog";
import { mensagemDeErro, usuariosService, type Usuario } from "./services/usuariosService";

const botaoPrimario = "bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm";

const COLUNAS: Coluna<Usuario>[] = [
  { chave: "nome", rotulo: "Nome", valor: (u) => u.nome },
  { chave: "email", rotulo: "E-mail", valor: (u) => u.email },
  { chave: "perfil", rotulo: "Perfil", valor: (u) => u.perfil.nome },
];
const DEPOIS_DO_RECORTE: Coluna<Usuario>[] = [
  { chave: "situacao", rotulo: "Situação", valor: (u) => (u.ativo ? "Ativo" : "Inativo") },
  { chave: "acoes", rotulo: "", semFiltro: true },
];

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
  const rotuloSetor = useMemo(() => new Map(opcoes.data?.setores.map((s) => [s.tipo, s.rotulo])), [opcoes.data]);
  const rotuloDep = useMemo(() => new Map(opcoes.data?.departamentos.map((d) => [d.departamento, d.rotulo])), [opcoes.data]);
  // O recorte mostra os rótulos dos setores e departamentos, que vêm das opções.
  const colunas = useMemo((): Coluna<Usuario>[] => {
    const recorte: Coluna<Usuario> = {
      chave: "recorte",
      rotulo: "Recorte",
      valor: (u) =>
        [
          u.perfil.recorteSetor ? `Setores: ${u.setores.map((s) => rotuloSetor.get(s) ?? s).join(", ") || "nenhum"}` : null,
          u.perfil.recorteDepartamento ? `Departamentos: ${u.departamentos.map((d) => rotuloDep.get(d) ?? d).join(", ") || "nenhum"}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
    };
    return [...COLUNAS, recorte, ...DEPOIS_DO_RECORTE];
  }, [rotuloSetor, rotuloDep]);
  const tabela = useTabelaFiltravel(usuarios.data, colunas);

  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Usuários"
        comoUsar={
          <ul>
            <li>Use “Novo Usuário” para cadastrar; o lápis edita o nome, o perfil, os setores, os departamentos e a situação.</li>
            <li>Use “Redefinir Senha” para dar uma senha nova (ao menos 8 caracteres).</li>
            <li>O que cada um pode fazer vem do perfil, na tela Perfis.</li>
          </ul>
        }
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

      <QuadroTabela
        barra={
          tabela.ativos ? (
            <div className="ml-auto flex shrink-0 items-center gap-3">
              <button type="button" onClick={tabela.limpar} className="text-xs font-medium text-gray-900 underline underline-offset-2">
                Limpar Filtros
              </button>
              {tabela.total !== tabela.totalGeral ? (
                <p className="text-xs text-gray-600">
                  {tabela.total} de {tabela.totalGeral} usuário(s)
                </p>
              ) : null}
            </div>
          ) : undefined
        }
      >
        <DataTable<Usuario>
          data={tabela.visiveis}
          cabecalho={tabela.cabecalho}
          filtrosAtivos={tabela.ativos}
          onLimparFiltros={tabela.limpar}
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
      </QuadroTabela>

      {editando && opcoes.data ? (
        <UsuarioDialog key={editando === "novo" ? "novo" : editando.id} opcoes={opcoes.data} editando={editando === "novo" ? null : editando} onFechar={() => setEditando(null)} />
      ) : null}
      {senhaDe ? <RedefinirSenhaDialog usuario={senhaDe} onFechar={() => setSenhaDe(null)} /> : null}
    </div>
  );
}
