import type { ReactNode } from "react";

/**
 * As etiquetas da barra de tarefas (27/10/2026, pedido do Adão; o padrão de todas as barras com etiquetas): a situação do
 * relatório, a da competência, a versão e a marcação do cenário… ficam à direita da barra, depois das abas ou das etapas,
 * e não ao lado do nome do RE, da competência ou do cenário. Com a barra em linhas (a tela estreita), ficam na última.
 */
export function EtiquetasDaBarra({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 items-center gap-2 px-1 xl:ml-auto">{children}</div>;
}
