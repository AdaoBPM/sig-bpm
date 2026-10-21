"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * O modo de publicação (21/10/2026): a ferramenta só para consulta enquanto o servidor é atualizado. O estado vem da
 * rota /api/publicacao (o sinal no servidor, ou o backend sem responder) e de qualquer resposta 503 com o código da
 * publicação (o interceptor do `api` avisa aqui). Com a publicação, a faixa pergunta a cada 10 s; sem ela, a cada 60 s.
 */
export const CODIGO_DA_PUBLICACAO = "PUBLICACAO_EM_ANDAMENTO";

type Estado = { publicacao: boolean; backend: boolean };
let estado: Estado = { publicacao: false, backend: true };
const ouvintes = new Set<() => void>();
const mudar = (novo: Estado) => {
  if (novo.publicacao === estado.publicacao && novo.backend === estado.backend) return;
  estado = novo;
  ouvintes.forEach((o) => o());
};

/** Chamado pelo interceptor do `api` numa resposta 503 da publicação: a faixa aparece na hora. */
export function avisarPublicacao(backend: boolean) {
  mudar({ publicacao: true, backend });
}

async function consultar() {
  try {
    const r = await fetch("/api/publicacao", { cache: "no-store" });
    if (r.ok) mudar((await r.json()) as Estado);
  } catch {
    // As telas também não respondem (o próprio frontend sendo trocado): fica como estava.
  }
}

export function usePublicacao(): Estado {
  const atual = useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    () => estado,
    () => estado,
  );
  useEffect(() => {
    void consultar();
    const t = setInterval(() => void consultar(), atual.publicacao ? 10_000 : 60_000);
    const aoVoltar = () => void consultar();
    window.addEventListener("focus", aoVoltar);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [atual.publicacao]);
  return atual;
}
