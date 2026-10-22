"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { relatoriosService, type MarcacaoComparavel } from "../services/relatoriosService";
import { Seletor } from "./SeletorPeriodo";

/**
 * A Comparação de Resultados Empresariais (21/10/2026; de início, "Compara Com"): o cenário comparado (as colunas pretas de Resultados e o
 * orçado do Painel de Bordo), entre os cenários marcados (de qualquer exercício, desde 22/10/2026: num de outro, valem os
 * mesmos meses dele; o ano aparece na opção) (Orçamento Empresarial, Resultados Anteriores,
 * Resultados Vendidos e Previsão de Resultados). O padrão é o Orçamento Empresarial; a escolha fica guardada no navegador e vale nas
 * duas telas.
 */
const CHAVE = "sig.comparaCom";
const PADRAO: MarcacaoComparavel = "ORCAMENTO_EMPRESARIAL";

function lerEscolha(): MarcacaoComparavel {
  try {
    return (window.localStorage.getItem(CHAVE) as MarcacaoComparavel | null) ?? PADRAO;
  } catch {
    return PADRAO;
  }
}

export function useComparaCom(ano: number | null) {
  const [escolhida, setEscolhida] = useState<MarcacaoComparavel>(() => (typeof window === "undefined" ? PADRAO : lerEscolha()));
  const consulta = useQuery({ queryKey: ["relatorios", "comparaveis", ano], queryFn: () => relatoriosService.comparaveis(ano!), enabled: ano !== null });
  const opcoes = consulta.data ?? [];
  // A escolhida sem cenário marcado: vale o Orçamento Empresarial.
  const comparaCom = opcoes.some((o) => o.marcacao === escolhida) ? escolhida : PADRAO;
  const mudar = (m: MarcacaoComparavel) => {
    setEscolhida(m);
    try {
      window.localStorage.setItem(CHAVE, m);
    } catch {
      // Sem o armazenamento do navegador, vale só nesta tela.
    }
  };
  return { comparaCom, opcoes, mudar };
}

export function SeletorComparaCom({ valor, opcoes, onMudar }: { valor: MarcacaoComparavel; opcoes: ReturnType<typeof useComparaCom>["opcoes"]; onMudar: (m: MarcacaoComparavel) => void }) {
  if (!opcoes.length) return null;
  return (
    <Seletor
      rotulo="Comparação"
      valor={valor}
      largura="w-56"
      onMudar={(v) => onMudar(v as MarcacaoComparavel)}
      opcoes={opcoes.map((o) => ({ valor: o.marcacao, rotulo: `${o.cenario.nome === o.rotulo ? o.rotulo : `${o.rotulo} · ${o.cenario.nome}`} (${o.cenario.ano})` }))}
    />
  );
}
