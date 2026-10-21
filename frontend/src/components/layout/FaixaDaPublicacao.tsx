"use client";

import { Hourglass } from "lucide-react";

import { usePublicacao } from "@/lib/publicacao";

/**
 * A faixa do modo de publicação (21/10/2026), no topo de todas as telas: com o sinal ligado no servidor, a consulta
 * continua e as gravações ficam bloqueadas; com o backend sem responder (a troca dos containers), a mesma faixa, no
 * lugar dos erros de conexão.
 */
export function FaixaDaPublicacao() {
  const { publicacao, backend } = usePublicacao();
  if (!publicacao) return null;
  return (
    <div role="status" className="flex items-center gap-2 border-b border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-900 md:px-6">
      <Hourglass className="size-4 shrink-0" />
      {backend
        ? "Publicação em andamento: as telas continuam para consulta, mas criar, editar, apagar, importar e apurar ficam bloqueados até o fim (alguns minutos)."
        : "Publicação em andamento: o servidor está sendo atualizado e volta em instantes. As telas podem não carregar até lá."}
    </div>
  );
}
