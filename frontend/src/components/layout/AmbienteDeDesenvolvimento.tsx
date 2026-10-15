/**
 * A marca do ambiente de desenvolvimento (15/10/2026): a porta 3100 (`next dev`) tem a borda vermelha em volta da tela
 * e a etiqueta "Desenvolvimento" antes do caminho, para não se confundir com a produção (porta 3000, `next start`, sem
 * a marca). O NODE_ENV entra no código na compilação: "development" no next dev, "production" no build.
 */
export const EH_DESENVOLVIMENTO = process.env.NODE_ENV === "development";

/** A borda vermelha em volta da tela, por cima de tudo e sem pegar os cliques. */
export function BordaDoDesenvolvimento() {
  if (!EH_DESENVOLVIMENTO) return null;
  return <div aria-hidden className="pointer-events-none fixed inset-0 z-[200] border-4 border-red-600" />;
}

/** A etiqueta antes do caminho das telas. */
export function EtiquetaDoDesenvolvimento() {
  if (!EH_DESENVOLVIMENTO) return null;
  return (
    <span title="Ambiente de desenvolvimento (porta 3100), com a cópia do banco" className="shrink-0 rounded-sm bg-red-800 px-2 py-0.5 text-xs font-bold text-white">
      Desenvolvimento
    </span>
  );
}
