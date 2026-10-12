"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/DataTable";
import { useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { Button } from "@/components/ui/button";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import type { Coluna } from "@/lib/filtrosDeTabela";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { QuadroTabela } from "@/components/shared/QuadroTabela";

import { mensagemDeErro, usuariosService, type Perfil } from "../usuarios/services/usuariosService";
import { PerfilDialog } from "./components/PerfilDialog";

/** Quantos grupos de telas do menu o perfil lê, e quantos edita. */
function resumoPermissoes(p: Perfil) {
  const editar = new Set(p.permissoes.filter((x) => x.acao === "EDITAR").map((x) => x.recurso));
  const ler = new Set(p.permissoes.filter((x) => x.acao === "LER").map((x) => x.recurso));
  return `${ler.size} grupo(s) com leitura, ${editar.size} com edição`;
}

const recorte = (p: Perfil) => [p.recorteSetor ? "por setor" : null, p.recorteDepartamento ? "por departamento" : null].filter(Boolean).join(", ");

const COLUNAS: Coluna<Perfil>[] = [
  { chave: "perfil", rotulo: "Perfil", valor: (p) => p.nome },
  { chave: "permissoes", rotulo: "Permissões", valor: resumoPermissoes },
  { chave: "recorte", rotulo: "Recorte", valor: recorte },
  { chave: "usuarios", rotulo: "Usuários", tipo: "numero", valor: (p) => p.usuarios, texto: (p) => String(p.usuarios) },
  { chave: "situacao", rotulo: "Situação", valor: (p) => (p.ativo ? "Ativo" : "Inativo") },
  { chave: "acoes", rotulo: "", semFiltro: true },
];

export function PerfisContent() {
  useRegistrarAcessoTela("/perfis");
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<Perfil | null | "novo">(null);
  const perfis = useQuery({ queryKey: ["perfis"], queryFn: usuariosService.perfis });
  const opcoes = useQuery({ queryKey: ["usuarios", "opcoes"], queryFn: usuariosService.opcoes });
  const excluir = useMutation({
    mutationFn: (id: string) => usuariosService.excluirPerfil(id),
    onSuccess: () => {
      toast.success("Perfil excluído.");
      queryClient.invalidateQueries({ queryKey: ["perfis"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível excluir o perfil.")),
  });
  const tabela = useTabelaFiltravel(perfis.data, COLUNAS);

  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Perfis de Usuário"
        comoUsar={
          <ul>
            <li>Use “Novo Perfil” para criar um tipo de usuário; o lápis edita e a lixeira exclui (os perfis de sistema só se inativam).</li>
            <li>No perfil, os grupos de telas aparecem como no menu lateral, sob o título dele (Criação de Cenários, Apuração dos Resultados, Controladoria). Marque em cada grupo o que o perfil pode: Ler (o grupo aparece no menu e as telas mostram os dados) ou Editar (pode alterar; marca o Ler junto). Cada grupo tem permissões próprias: por exemplo, ler os Resultados Realizados sem acesso ao Fechamento Mensal.</li>
            <li>Os recortes por setor e por departamento limitam o que os usuários do perfil alcançam, por cima dos grupos: com recorte por departamento, o Fechamento Mensal não mostra as etapas com lançamentos de todos os departamentos (Classificação, Lançamentos, Receita, Rateios, Estoque, Conferência), nem o Controle de Usuários a Auditoria; com recorte por setor, o Fechamento Mensal mostra só Importações e Listas.</li>
          </ul>
        }
        sobre={
          <p>
            Os tipos de usuário e o que cada um pode fazer: Ler ou Editar em cada grupo de telas do menu lateral. Os perfis de sistema (Contábil, Alimentador, Gestão) podem ser
            editados e inativados, mas não excluídos.
          </p>
        }
        acoes={
        <PermissionGuard permission="usuarios:editar">
          <Button
            type="button"
            disabled={!opcoes.data}
            onClick={() => setEditando("novo")}
            className="bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm"
          >
            <Plus className="size-4" />
            Novo perfil
          </Button>
        </PermissionGuard>
        }
      />

      <QuadroTabela
        barra={
          tabela.ativos ? (
            <button type="button" onClick={tabela.limpar} className="ml-auto text-xs font-medium text-gray-900 underline underline-offset-2">
              Limpar Filtros
            </button>
          ) : undefined
        }
      >
        <DataTable<Perfil>
          data={tabela.visiveis}
          cabecalho={tabela.cabecalho}
          filtrosAtivos={tabela.ativos}
          onLimparFiltros={tabela.limpar}
          isLoading={perfis.isPending}
          error={perfis.isError ? mensagemDeErro(perfis.error, "Erro ao carregar os perfis.") : null}
          emptyMessage="Nenhum perfil"
          columns={["Perfil", "Permissões", "Recorte", "Usuários", "Situação", ""]}
          renderRow={(p) => (
            <tr key={p.id} className={`border-b border-gray-100 hover:bg-gray-50 ${p.ativo ? "" : "text-gray-400"}`}>
              <td className="px-4 py-3 text-sm">
                <span className="font-medium">{p.nome}</span>
                {p.sistema ? <span className="ml-2 text-xs text-gray-500">sistema</span> : null}
                {p.descricao ? <div className="text-xs text-gray-500">{p.descricao}</div> : null}
              </td>
              <td className="px-4 py-3 text-xs text-gray-600">{resumoPermissoes(p)}</td>
              <td className="px-4 py-3 text-xs text-gray-600">
                {recorte(p) || "—"}
              </td>
              <td className="px-4 py-3 text-sm">{p.usuarios}</td>
              <td className="px-4 py-3 text-sm">{p.ativo ? "Ativo" : "Inativo"}</td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                <PermissionGuard permission="usuarios:editar">
                  <Button type="button" variant="ghost" size="icon" aria-label="Editar" disabled={!opcoes.data} onClick={() => setEditando(p)}>
                    <Pencil className="size-4" />
                  </Button>
                  {!p.sistema ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir"
                      disabled={excluir.isPending}
                      onClick={() => {
                        if (window.confirm(`Excluir o perfil ${p.nome}? A exclusão fica no log de auditoria.`)) excluir.mutate(p.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </PermissionGuard>
              </td>
            </tr>
          )}
        />
      </QuadroTabela>

      {editando && opcoes.data ? (
        <PerfilDialog key={editando === "novo" ? "novo" : editando.id} opcoes={opcoes.data} editando={editando === "novo" ? null : editando} onFechar={() => setEditando(null)} />
      ) : null}
    </div>
  );
}
