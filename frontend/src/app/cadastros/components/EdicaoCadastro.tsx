"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePermissions } from "@/context/PermissionContext";

import { EditarRegistroDialog } from "./EditarRegistroDialog";

/**
 * A edição de um cadastro numa tela de consulta (Passo 25): o botão Novo, o
 * lápis de cada linha e o diálogo. Sem cadastros:editar, nada aparece.
 */
export function useEdicaoCadastro(entidade: string, { criar = true }: { criar?: boolean } = {}) {
  const { hasPermission } = usePermissions();
  const pode = hasPermission("cadastros:editar");
  // undefined: fechado; null: novo registro; string: o registro em edição.
  const [aberto, setAberto] = useState<string | null | undefined>(undefined);

  const botaoNovo =
    pode && criar ? (
      <Button type="button" onClick={() => setAberto(null)} className="bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm">
        <Plus className="size-4" />
        Novo
      </Button>
    ) : null;

  const botaoEditar = (id: string) =>
    pode ? (
      <button type="button" onClick={() => setAberto(id)} title="Editar" className="rounded-sm p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-900">
        <Pencil className="size-4" />
      </button>
    ) : null;

  const dialogo = aberto !== undefined ? <EditarRegistroDialog entidade={entidade} id={aberto} onFechar={() => setAberto(undefined)} /> : null;

  return { pode, botaoNovo, botaoEditar, dialogo, colunaEditar: pode ? [""] : [] };
}
