"use client";

import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/context/AuthContext";

import { LISTA_LOTACAO, LISTAS, LISTAS_INDICADORES, listasService } from "../services/listasService";

/** As quatro listas de produção, cada uma na sua aba, com nome curto. */
const ABA_PRODUCAO: Record<string, string> = {
  PRODUCAO: "Produção (Volume)",
  PRODUCAO_PISTA: "Produção (Pistas)",
  PRODUCAO_METALURGIA: "Metalurgia",
  PRODUCAO_ARMADURA: "Armadura",
};

/**
 * As abas das listas: as oito listas dos rateios, depois as dos indicadores do
 * Comercial e do Administrativo e, por fim, o Quadro de Lotação (19/10/2026);
 * o Alimentador vê só as dos seus setores.
 */
export function useAbasDasListas(anoMes: string) {
  const { user } = useAuth();
  const definicoes = useQuery({ queryKey: ["listas", "campos"], queryFn: listasService.campos, staleTime: 30 * 60_000 });
  const alcanca = (tipo: string) => !user?.acesso.recorteSetor || user.acesso.setores.includes(tipo);
  return [
    ...LISTAS.filter((l) => alcanca(l.tipo)).map((l) => ({
      chave: l.slug as string,
      rotulo: ABA_PRODUCAO[l.tipo] ?? definicoes.data?.[l.tipo]?.rotulo ?? l.tipo,
      href: `/competencias/${anoMes}/listas/${l.slug}`,
    })),
    ...LISTAS_INDICADORES.filter((l) => alcanca(l.tipo)).map((l) => ({ chave: l.slug as string, rotulo: l.rotulo, href: `/competencias/${anoMes}/listas/${l.slug}` })),
    ...(alcanca(LISTA_LOTACAO.tipo) ? [{ chave: LISTA_LOTACAO.slug as string, rotulo: LISTA_LOTACAO.rotulo, href: `/competencias/${anoMes}/listas/${LISTA_LOTACAO.slug}` }] : []),
  ];
}

