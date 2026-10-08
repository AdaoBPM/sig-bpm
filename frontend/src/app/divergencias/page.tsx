"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { competenciasService } from "@/app/competencias/services/competenciasService";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";

/**
 * Divergências virou uma etapa do mês (/competencias/AAAA-MM/divergencias).
 * O endereço antigo, usado pelos avisos, leva ao mês mais recente com
 * divergência aberta — ou, sem nenhuma, ao mês em trabalho.
 */
export default function DivergenciasPage() {
  const router = useRouter();
  const competencias = useQuery({ queryKey: ["competencias", "todos"], queryFn: () => competenciasService.listar() });
  useEffect(() => {
    const itens = competencias.data?.itens;
    if (!itens) return;
    const destino = itens.find((c) => c._count.divergencias > 0) ?? itens.find((c) => c.status !== "FECHADA") ?? itens[0];
    router.replace(destino ? `/competencias/${destino.ano}-${String(destino.mes).padStart(2, "0")}/divergencias` : "/competencias");
  }, [competencias.data, router]);
  return (
    <ProtectedLayout>
      <div className="h-40 animate-pulse rounded-sm bg-gray-100" />
    </ProtectedLayout>
  );
}
