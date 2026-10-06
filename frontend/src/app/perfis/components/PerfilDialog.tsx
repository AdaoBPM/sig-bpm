"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { mensagemDeErro, usuariosService, type Acao, type OpcoesUsuarios, type Perfil, type Permissao } from "../../usuarios/services/usuariosService";

type Props = { opcoes: OpcoesUsuarios; editando: Perfil | null; onFechar: () => void };

const ROTULO_ACAO: Record<Acao, string> = { VER: "Ver", LER: "Ler", EDITAR: "Editar" };
const NIVEL: Record<Acao, number> = { VER: 1, LER: 2, EDITAR: 3 };

/**
 * Tipo de usuário: nome, situação, recortes e a matriz recurso × ação.
 * Marcar "Editar" marca também "Ler" e "Ver"; desmarcar "Ver" desmarca o resto
 * — a mesma coerência que o backend grava.
 */
export function PerfilDialog({ opcoes, editando, onFechar }: Props) {
  const queryClient = useQueryClient();
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState(editando?.nome ?? "");
  const [descricao, setDescricao] = useState(editando?.descricao ?? "");
  const [ativo, setAtivo] = useState(editando?.ativo ?? true);
  const [recorteSetor, setRecorteSetor] = useState(editando?.recorteSetor ?? false);
  const [recorteDepartamento, setRecorteDepartamento] = useState(editando?.recorteDepartamento ?? false);
  const [nivel, setNivel] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const p of editando?.permissoes ?? []) m[p.recurso] = Math.max(m[p.recurso] ?? 0, NIVEL[p.acao]);
    return m;
  });

  const permissoes = (): Permissao[] =>
    Object.entries(nivel).flatMap(([recurso, n]) => opcoes.acoes.filter((a) => NIVEL[a] <= n).map((acao) => ({ recurso, acao })));
  const salvar = useMutation({
    mutationFn: () => {
      const d = { nome, descricao: descricao || null, ativo, recorteSetor, recorteDepartamento, permissoes: permissoes() };
      return editando ? usuariosService.atualizarPerfil(editando.id, d) : usuariosService.criarPerfil({ ...d, codigo });
    },
    onSuccess: () => {
      toast.success(editando ? "Perfil atualizado." : "Perfil criado.");
      queryClient.invalidateQueries({ queryKey: ["perfis"] });
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      onFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível salvar o perfil.")),
  });
  const marcar = (recurso: string, a: Acao, marcado: boolean) =>
    setNivel((m) => ({ ...m, [recurso]: marcado ? NIVEL[a] : NIVEL[a] - 1 }));

  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-sm sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editando ? `Perfil ${editando.nome}` : "Novo perfil"}</DialogTitle>
          <DialogDescription>
            O perfil é o tipo de usuário. As permissões valem para todos os usuários dele, a partir da próxima ação de cada um.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {!editando ? (
              <div className="space-y-1.5">
                <Label htmlFor="p-codigo">Código</Label>
                <Input id="p-codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="ex.: DIRETORIA" className="rounded-sm" />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="p-nome">Nome</Label>
              <Input id="p-nome" value={nome} onChange={(e) => setNome(e.target.value)} className="rounded-sm" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="p-descricao">Descrição</Label>
              <Input id="p-descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="rounded-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm text-gray-900">
              <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="size-4 accent-black" />
              Ativo (inativo, os usuários dele não entram)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-900">
              <input type="checkbox" checked={recorteSetor} onChange={(e) => setRecorteSetor(e.target.checked)} className="size-4 accent-black" />
              <span>
                Recorta por Setor<span className="text-gray-500">: o usuário só alcança as listas dos setores marcados nele</span>
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-900">
              <input type="checkbox" checked={recorteDepartamento} onChange={(e) => setRecorteDepartamento(e.target.checked)} className="size-4 accent-black" />
              <span>
                Recorta por Departamento<span className="text-gray-500">: o usuário só vê as movimentações e os centros de custo dos departamentos marcados nele</span>
              </span>
            </label>
          </div>
          <table className="tabela-sig w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-bold text-gray-600">
                <th className="px-3 py-2">Recurso</th>
                {opcoes.acoes.map((a) => (
                  <th key={a} className="px-3 py-2 text-center">
                    {ROTULO_ACAO[a]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {opcoes.recursos.map((r) => (
                <tr key={r.recurso} className="border-b border-gray-100">
                  <td className="px-3 py-1.5 text-gray-900">{r.rotulo}</td>
                  {opcoes.acoes.map((a) => (
                    <td key={a} className="px-3 py-1.5 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${r.rotulo}: ${ROTULO_ACAO[a]}`}
                        checked={(nivel[r.recurso] ?? 0) >= NIVEL[a]}
                        onChange={(e) => marcar(r.recurso, a, e.target.checked)}
                        className="size-4 accent-black"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-500">Ver: a tela aparece. Ler: os dados carregam. Editar: pode alterar.</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={nome.trim().length < 2 || (!editando && codigo.trim().length < 2) || salvar.isPending}
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
