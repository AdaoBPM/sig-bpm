"use client";

import { Fragment, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { etapasDoMes } from "@/lib/etapasDoMes";
import { navGrupos } from "@/lib/navigation-config";

import { mensagemDeErro, usuariosService, type Acao, type OpcoesUsuarios, type Perfil, type Permissao } from "../../usuarios/services/usuariosService";

type Props = { opcoes: OpcoesUsuarios; editando: Perfil | null; onFechar: () => void };

const ROTULO_ACAO: Record<Acao, string> = { VER: "Ver", LER: "Ler", EDITAR: "Editar" };
const NIVEL: Record<Acao, number> = { VER: 1, LER: 2, EDITAR: 3 };

/** "cadastros:ver" → "CADASTROS": o recurso da permissão de uma tela. */
const recursoDe = (permissao?: string) => (permissao ? permissao.split(":")[0].toUpperCase() : null);
type TelaDoMenu = { tela: string; recurso: string };
type ItemDoMenu = { item: string; telas: TelaDoMenu[] };

/**
 * As telas como o menu as mostra (11/10/2026): os grupos do menu lateral, cada item dele e as telas da barra do
 * topo (no Fechamento Mensal, as etapas do mês e o abrir, fechar e reabrir), com o recurso que dá a permissão de
 * cada uma. Os recursos que nenhuma tela usa vão no fim, em Outros.
 */
function telasDoMenu(recursos: string[]): Array<{ grupo: string; itens: ItemDoMenu[] }> {
  const blocos = navGrupos.map((g) => ({
    grupo: g.titulo,
    itens: g.itens
      .map((item): ItemDoMenu => {
        if (item.telas) return { item: item.title, telas: item.telas.flatMap((t) => (recursoDe(t.permission) ? [{ tela: t.title, recurso: recursoDe(t.permission)! }] : [])) };
        if (item.href === "/competencias") {
          return {
            item: item.title,
            telas: [
              { tela: "Abrir, Fechar e Reabrir Competências", recurso: "COMPETENCIA" },
              ...etapasDoMes(() => true, undefined).map((e) => ({ tela: e.rotulo, recurso: recursoDe(e.permissao)! })),
            ],
          };
        }
        return { item: item.title, telas: recursoDe(item.permission) ? [{ tela: item.title, recurso: recursoDe(item.permission)! }] : [] };
      })
      .filter((i) => i.telas.length > 0),
  }));
  const usados = new Set(blocos.flatMap((b) => b.itens.flatMap((i) => i.telas.map((t) => t.recurso))));
  const outros = recursos.filter((r) => !usados.has(r));
  return outros.length ? [...blocos, { grupo: "Outros", itens: [{ item: "Outros", telas: outros.map((r) => ({ tela: r, recurso: r })) }] }] : blocos;
}

/**
 * Tipo de usuário: nome, situação, recortes e as permissões, por grupo do menu e tela (cada tela segue o recurso dela;
 * as telas do mesmo recurso mudam juntas).
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
  const rotuloRecurso = useMemo(() => new Map(opcoes.recursos.map((r) => [r.recurso, r.rotulo])), [opcoes.recursos]);
  const blocos = useMemo(() => telasDoMenu(opcoes.recursos.map((r) => r.recurso)), [opcoes.recursos]);
  const caixas = (recurso: string, rotulo: string) =>
    opcoes.acoes.map((a) => (
      <td key={a} className="px-3 py-1.5 text-center">
        <input
          type="checkbox"
          aria-label={`${rotulo}: ${ROTULO_ACAO[a]}`}
          checked={(nivel[recurso] ?? 0) >= NIVEL[a]}
          onChange={(e) => marcar(recurso, a, e.target.checked)}
          className="size-4 accent-black"
        />
      </td>
    ));

  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-sm sm:max-w-3xl">
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
                Recorta por Departamento<span className="text-gray-500">: o usuário só vê as movimentações e os centros de custo dos departamentos marcados nele</span>
              </span>
            </label>
          </div>
          <table className="tabela-sig w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-bold text-gray-900">
                <th className="px-3 py-2">Tela</th>
                <th className="px-3 py-2">Permissão</th>
                {opcoes.acoes.map((a) => (
                  <th key={a} className="px-3 py-2 text-center">
                    {ROTULO_ACAO[a]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {blocos.map((b) => (
                <Fragment key={b.grupo}>
                  <tr className="border-y border-gray-300">
                    <td colSpan={2 + opcoes.acoes.length} className="bg-yellow-50 px-3 py-1.5 text-xs font-bold tracking-wide text-gray-900 uppercase">
                      {b.grupo}
                    </td>
                  </tr>
                  {b.itens.map((i) => {
                    // O item sem barra de telas (Cenários Sintéticos, por exemplo) é uma tela só: uma linha, sem subtítulo.
                    const unico = i.telas.length === 1 && i.telas[0].tela === i.item;
                    return (
                      <Fragment key={i.item}>
                        {unico ? null : (
                          <tr className="border-b border-gray-100">
                            <td colSpan={2 + opcoes.acoes.length} className="px-3 pt-2 pb-1 text-sm font-bold text-gray-900">
                              {i.item}
                            </td>
                          </tr>
                        )}
                        {i.telas.map((t) => {
                          const rotulo = rotuloRecurso.get(t.recurso) ?? t.recurso;
                          return (
                            <tr key={t.tela} className="border-b border-gray-100">
                              <td className={`py-1.5 pr-3 text-gray-900 ${unico ? "pl-3 font-bold" : "pl-7"}`}>{t.tela === t.recurso ? rotulo : t.tela}</td>
                              <td className="px-3 py-1.5 text-xs text-gray-500">{rotulo}</td>
                              {caixas(t.recurso, t.tela)}
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-500">
            Ver: a tela aparece. Ler: os dados carregam. Editar: pode alterar. A permissão é a do recurso da coluna Permissão: as telas do mesmo recurso
            (por exemplo, as dos Cadastros) mudam juntas.
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
