import Link from "next/link";
import { Lock } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * O selo das telas de cálculo (classificação, rateios, receita, estoque) numa
 * competência apurada ou fechada, à direita do cabeçalho, em amarelo-ouro como
 * os demais botões da altura do título (leva à DRE): os valores estão congelados, e o recálculo é a reapuração da
 * competência inteira, na tela da DRE. `oQue` vem com a preposição: "da
 * classificação", "do rateio"…
 */
export function AvisoCongelado({ anoMes, fechada, oQue }: { anoMes: string; fechada: boolean; oQue: string }) {
  const explicacao = fechada
    ? `Competência fechada: os valores ${oQue} não podem ser recalculados. Para mudar, reabra a competência na tela da DRE.`
    : `Os valores ${oQue} estão congelados pela apuração da competência. Para recalcular, reapure a competência na tela da DRE.`;
  return (
    <Link
      href={`/competencias/${anoMes}/dre`}
      title={explicacao}
      className={cn(buttonVariants(), "bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm")}
    >
      <Lock className="size-4" />
      {fechada ? "Fechada · Reabrir na DRE" : "Congelada pela Apuração · Reapurar na DRE"}
    </Link>
  );
}
