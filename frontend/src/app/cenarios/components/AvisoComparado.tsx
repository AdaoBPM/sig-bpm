"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { usePermissions } from "@/context/PermissionContext";

import { cenariosService } from "../services/cenariosService";

/**
 * O aviso do cenário comparado (13/10/2026), nas telas Resultados e Indicadores: com um comparativo ativo, as colunas
 * em preto e cinza depois do total são as do cenário comparado (como o orçado de Resultados Realizados). Sem
 * comparativo, nada aparece.
 */
export function AvisoComparado({ id, texto }: { id: string; texto: string }) {
  const { data } = useQuery({ queryKey: ["cenarios", id, "comparativo"], queryFn: () => cenariosService.comparativo(id) });
  const { hasPermission } = usePermissions();
  if (!data?.comparadoCom) return null;
  return (
    <p className="rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white px-4 py-2 text-sm text-gray-600">
      Comparado com <span className="font-bold text-gray-900">{data.comparadoCom.nome}</span> ({data.comparadoCom.ano}): {texto} O comparativo se
      escolhe em{" "}
      {/* As Configurações são de quem edita os cenários; para os demais, só o nome. */}
      {hasPermission("cenarios:editar") ? (
        <Link href={`/cenarios/sinteticos/${id}/configuracoes?aba=comparativo`} className="font-medium text-gray-900 underline underline-offset-2">
          Configurações / Comparativo
        </Link>
      ) : (
        "Configurações / Comparativo"
      )}
      .
    </p>
  );
}
