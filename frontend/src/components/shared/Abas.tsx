"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { iniciaisMaiusculas } from "@/lib/texto";

export type Aba = {
  chave: string;
  rotulo: ReactNode;
  /** Ícone ou sinal antes do rótulo. */
  sinal?: ReactNode;
  /** Com href, a aba é um link (muda a rota); sem, chama onMudar. */
  href?: string;
};

type Props = { abas: Aba[]; ativa: string; onMudar?: (chave: string) => void; rotulo: string };

/**
 * As abas de todas as telas (G9 do levantamento de layout): sublinhado na
 * atual, para não se confundir com a barra de etapas do mês, e rolagem
 * horizontal quando não cabem. Os rótulos saem com iniciais maiúsculas, como
 * os nomes das telas. Sem números ao lado do rótulo (13/10/2026): as abas
 * mostram só o nome (e o sinal, quando há).
 */
export function Abas({ abas, ativa, onMudar, rotulo }: Props) {
  return (
    <div role="tablist" aria-label={rotulo} className="flex min-w-0 gap-1 overflow-x-auto overflow-y-hidden border-b border-gray-200">
      {abas.map((a) => {
        const atual = a.chave === ativa;
        const classe = `-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm whitespace-nowrap ${
          atual ? "border-black font-bold text-gray-900" : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900"
        }`;
        const conteudo = (
          <>
            {a.sinal}
            {typeof a.rotulo === "string" ? iniciaisMaiusculas(a.rotulo) : a.rotulo}
          </>
        );
        return a.href ? (
          <Link key={a.chave} href={a.href} role="tab" aria-selected={atual} className={classe}>
            {conteudo}
          </Link>
        ) : (
          <button key={a.chave} type="button" role="tab" aria-selected={atual} onClick={() => onMudar?.(a.chave)} className={classe}>
            {conteudo}
          </button>
        );
      })}
    </div>
  );
}
