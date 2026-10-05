import type { ReactNode } from "react";
import { Info } from "lucide-react";

type Props = {
  titulo: ReactNode;
  /** O que a tela faz, de onde vêm os dados: fica recolhido em "Sobre esta tela". */
  sobre?: ReactNode;
  /** Selos ao lado do título, como o de valores congelados. */
  selo?: ReactNode;
  /** Botões à direita do título. */
  acoes?: ReactNode;
};

/**
 * O cabeçalho de todas as telas (G3 e G10 do levantamento de layout): título,
 * selo e ações numa linha só, e a explicação recolhida. Nas telas do mês, o
 * mês e o estado ficam na barra de etapas, e não se repetem aqui.
 */
export function CabecalhoDaTela({ titulo, sobre, selo, acoes }: Props) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">{titulo}</h1>
          {selo}
        </div>
        {acoes ? <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div> : null}
      </div>
      {sobre ? (
        <details className="group max-w-3xl text-sm text-gray-600">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900">
            <Info className="size-3.5" />
            <span className="group-open:hidden">Sobre esta tela</span>
            <span className="hidden group-open:inline">Fechar</span>
          </summary>
          <div className="mt-1.5 space-y-1">{sobre}</div>
        </details>
      ) : null}
    </div>
  );
}
