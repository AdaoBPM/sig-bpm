import Link from "next/link";
import { Lock } from "lucide-react";

/**
 * O selo das telas de cálculo (classificação, rateios, receita, estoque) numa
 * competência apurada ou fechada, ao lado do título (G4 do levantamento de
 * layout): os valores estão congelados, e o recálculo é a reapuração da
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
      className="inline-flex items-center gap-1.5 rounded-sm border border-gray-300 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
    >
      <Lock className="size-3" />
      {fechada ? "Fechada · reabrir na DRE" : "Congelada pela apuração · reapurar na DRE"}
    </Link>
  );
}
