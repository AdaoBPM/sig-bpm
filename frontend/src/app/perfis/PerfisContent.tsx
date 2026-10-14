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
import { plural } from "@/lib/texto";

/** Quantas telas o perfil lê, e quantas edita (as abas contam dentro da tela; 14/10/2026). */
function resumoPermissoes(p: Perfil) {
  const telas = (acao: string) => new Set(p.permissoes.filter((x) => x.acao === acao && !x.chave.includes(".")).map((x) => x.chave)).size;
  const leitura = telas("LER");
  return `${leitura} ${plural(leitura, "tela", "telas")} com leitura, ${telas("EDITAR")} com edição`;
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
            <li>
              O Administrador é um perfil de sistema com acesso total a todas as telas, sem recortes (as telas novas entram sozinhas): não se exclui
              nem se inativa, as permissões dele não mudam (só a descrição se edita), não fica sem usuário ativo, e só um Administrador promove outro
              usuário a ele.
            </li>
            <li>No perfil, os grupos de telas aparecem como no menu lateral, sob o título dele (Criação de Cenários, Apuração dos Resultados, Controladoria). Clique na seta do grupo para abrir as telas dele, e na seta de uma tela para abrir as abas dela (o botão de setas para cima e para baixo, antes de “Grupo, Tela e Aba”, abre e recolhe todos). Marque em cada tela e em cada aba o que o perfil pode: Ler (a tela aparece no menu e mostra os dados; a aba aparece) ou Editar (pode alterar; marca o Ler junto). Por exemplo: ler os Resultados Realizados sem acesso ao Fechamento Mensal, ou ver a DRE só na aba Matriz.</li>
            <li>A caixa do grupo ou da tela marca (e desmarca) tudo o que está abaixo dela; o traço na caixa mostra que só parte está marcada. A aba só vale com a tela lida: marcar a aba marca a leitura da tela, e desmarcar a leitura da tela desmarca as abas.</li>
            <li>As permissões valem também no servidor: uma aba sem permissão não aparece e os dados dela não são enviados.</li>
            <li>Os recortes por setor e por departamento limitam o que os usuários do perfil alcançam, por cima dos grupos. O recorte por departamento limita as movimentações da DRE às linhas dos departamentos do usuário (as da Receita Bruta, da Receita Líquida e dos Impostos Operacionais ficam abertas a todos) e os centros de custo aos dele; o recorte por centro de custo (o Coordenador) limita a visão por centro de custo aos centros marcados no usuário (de uma gestão), com as movimentações deles, e nas unidades deixa só as movimentações abertas a todos; com recorte por departamento ou por centro de custo, o Fechamento Mensal não mostra as etapas com lançamentos de todos os departamentos (Classificação, Lançamentos, Receita, Rateios, Estoque, Conferência), nem o Controle de Usuários a Auditoria; com recorte por setor, o Fechamento Mensal mostra só Competências, Importações e Listas.</li>
          </ul>
        }
        sobre={
          <p>
            Os tipos de usuário e o que cada um pode fazer: Ler ou Editar em cada tela do menu lateral (e nas etapas do mês) e em cada aba de conteúdo
            delas (as abas que só filtram a mesma lista, as das Listas e as dos modais seguem a tela). Até 14/10/2026, as permissões eram por grupo de
            telas; cada tela e cada aba herdou a do grupo dela. Os perfis de sistema (Contábil, Alimentador, Gestão) podem ser
            editados e inativados, mas não excluídos.
          </p>
        }
        acoes={
        <PermissionGuard permission="perfis:editar">
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
                <PermissionGuard permission="perfis:editar">
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
