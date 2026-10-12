"use client";

import { Fragment, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { navGrupos } from "@/lib/navigation-config";

import { mensagemDeErro, usuariosService, type Acao, type OpcoesUsuarios, type Perfil, type Permissao } from "../../usuarios/services/usuariosService";

type Props = { opcoes: OpcoesUsuarios; editando: Perfil | null; onFechar: () => void };

const ROTULO_ACAO: Record<Acao, string> = { LER: "Ler", EDITAR: "Editar" };
const NIVEL: Record<Acao, number> = { LER: 1, EDITAR: 2 };

/**
 * Tipo de usuário: nome, situação, recortes e as permissões em cada grupo de telas do menu lateral (11/10/2026),
 * sob o título do menu (Criação de Cenários, Apuração dos Resultados, Controladoria). Cada grupo tem Ler e Editar
 * próprios. Marcar "Editar" marca também "Ler"; desmarcar "Ler" desmarca "Editar" — a mesma coerência que o
 * backend grava.
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
  // Os itens do menu com grupo de permissão, sob o título do menu.
  const blocos = navGrupos
    .map((g) => ({ titulo: g.titulo, itens: g.itens.filter((i) => i.recurso && opcoes.recursos.some((r) => r.recurso === i.recurso)) }))
    .filter((b) => b.itens.length > 0);

  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-sm sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editando ? `Perfil ${editando.nome}` : "Novo Perfil"}</DialogTitle>
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
                Recorta por Departamento<span className="text-gray-500">: o usuário só vê as movimentações e os centros de custo dos departamentos marcados nele (as movimentações da Receita Bruta ficam abertas a todos)</span>
              </span>
            </label>
          </div>
          <table className="tabela-sig w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-bold text-gray-900">
                <th className="px-3 py-2">Grupo de Telas</th>
                {opcoes.acoes.map((a) => (
                  <th key={a} className="w-24 px-3 py-2 text-center">
                    {ROTULO_ACAO[a]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {blocos.map((b) => (
                <Fragment key={b.titulo}>
                  <tr className="border-y border-gray-300">
                    <td colSpan={1 + opcoes.acoes.length} className="bg-yellow-50 px-3 py-1.5 text-xs font-bold tracking-wide text-gray-900 uppercase">
                      {b.titulo}
                    </td>
                  </tr>
                  {b.itens.map((i) => (
                    <tr key={i.recurso} className="border-b border-gray-100">
                      <td className="px-3 py-1.5 text-gray-900">
                        <span className="inline-flex items-center gap-2">
                          <i.icon className="size-4 text-gray-500" />
                          {i.title}
                        </span>
                      </td>
                      {opcoes.acoes.map((a) => (
                        <td key={a} className="px-3 py-1.5 text-center">
                          <input
                            type="checkbox"
                            aria-label={`${i.title}: ${ROTULO_ACAO[a]}`}
                            checked={(nivel[i.recurso!] ?? 0) >= NIVEL[a]}
                            onChange={(e) => marcar(i.recurso!, a, e.target.checked)}
                            className="size-4 accent-black"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-500">
            Ler: o grupo aparece no menu e as telas dele mostram os dados. Editar: pode alterar (importar, apurar, fechar, editar cadastros…). Os
            recortes valem por cima dos grupos: com recorte por departamento, o Fechamento Mensal não mostra Classificação, Lançamentos, Receita,
            Rateios, Estoque e Conferência, nem o Controle de Usuários a Auditoria (essas telas mostram lançamentos de todos os departamentos); com
            recorte por setor, o Fechamento Mensal mostra só Importações e Listas.
          </p>
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
