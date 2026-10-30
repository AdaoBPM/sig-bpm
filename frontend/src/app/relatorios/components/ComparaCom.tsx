"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { relatoriosService, type MarcacaoComparavel } from "../services/relatoriosService";
import { Seletor } from "./SeletorPeriodo";

/**
 * A Comparação de Resultados Empresariais (21/10/2026; de início, "Compara Com"): o cenário comparado (as colunas pretas de Resultados e o
 * orçado do Painel de Bordo), entre os cenários marcados (de qualquer exercício, desde 22/10/2026: num de outro, valem os
 * mesmos meses dele) (Previsão, Orçamento, Anterior e Vendido). A lista mostra só o nome da marcação (30/10/2026, pedido do
 * Adão; antes, também o nome do cenário e o ano). O padrão (23/10/2026; antes, o Orçamento) é a
 * primeira marcação que houver, nessa ordem; a escolha fica guardada no navegador e vale nas duas telas (a lista fica só em Resultados).
 */
const CHAVE = "sig.comparaCom";
const ORDEM: MarcacaoComparavel[] = ["PREVISAO", "ORCAMENTO_EMPRESARIAL", "RESULTADOS_ANTERIORES", "RESULTADOS_VENDIDOS"];
const PADRAO = ORDEM[0];

/** A escolha guardada neste navegador; null: nenhuma (vale o padrão). */
function lerEscolha(): MarcacaoComparavel | null {
  try {
    return window.localStorage.getItem(CHAVE) as MarcacaoComparavel | null;
  } catch {
    return null;
  }
}

export function useComparaCom(ano: number | null) {
  const [escolhida, setEscolhida] = useState<MarcacaoComparavel | null>(() => (typeof window === "undefined" ? null : lerEscolha()));
  const consulta = useQuery({ queryKey: ["relatorios", "comparaveis", ano], queryFn: () => relatoriosService.comparaveis(ano!), enabled: ano !== null });
  const opcoes = consulta.data ?? [];
  // Sem escolha (ou a escolhida sem cenário marcado), a primeira marcação que houver na ORDEM (23/10/2026; antes, o Orçamento
  // mesmo sem cenário: o orçado zero para quem nunca tinha escolhido outra).
  const temA = (m: MarcacaoComparavel) => opcoes.some((o) => o.marcacao === m);
  const comparaCom = escolhida && temA(escolhida) ? escolhida : (ORDEM.find(temA) ?? PADRAO);
  const mudar = (m: MarcacaoComparavel) => {
    setEscolhida(m);
    try {
      window.localStorage.setItem(CHAVE, m);
    } catch {
      // Sem o armazenamento do navegador, vale só nesta tela.
    }
  };
  // `pronta`: as opções chegaram (ou falharam), para não pedir os dados com o padrão antes da escolha valer.
  return { comparaCom, opcoes, mudar, pronta: consulta.isSuccess || consulta.isError, atual: opcoes.find((o) => o.marcacao === comparaCom) ?? null };
}

export function SeletorComparaCom({ valor, opcoes, onMudar }: { valor: MarcacaoComparavel; opcoes: ReturnType<typeof useComparaCom>["opcoes"]; onMudar: (m: MarcacaoComparavel) => void }) {
  if (!opcoes.length) return null;
  return (
    <Seletor
      rotulo="Comparação"
      valor={valor}
      largura="w-36"
      onMudar={(v) => onMudar(v as MarcacaoComparavel)}
      opcoes={opcoes.map((o) => ({ valor: o.marcacao, rotulo: o.rotulo }))}
    />
  );
}
