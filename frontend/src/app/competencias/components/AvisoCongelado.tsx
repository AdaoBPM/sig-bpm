import Link from "next/link";
import { Lock } from "lucide-react";

/**
 * Aviso das telas de cálculo (classificação, rateios, receita, estoque) numa
 * competência apurada ou fechada: os valores estão congelados, e o recálculo
 * é a reapuração da competência inteira, na tela da DRE. `oQue` vem com a
 * preposição: "da classificação", "do rateio"…
 */
export function AvisoCongelado({ anoMes, fechada, oQue }: { anoMes: string; fechada: boolean; oQue: string }) {
  return (
    <div className="flex items-start gap-2 rounded-sm border border-gray-200 bg-gray-50 p-4">
      <Lock className="mt-0.5 size-4 shrink-0 text-gray-500" />
      <p className="text-sm text-gray-600">
        {fechada ? (
          <>Competência fechada: os valores {oQue} não podem ser recalculados. Para mudar, reabra a competência na </>
        ) : (
          <>Os valores {oQue} estão congelados pela apuração da competência. Para recalcular, reapure a competência na </>
        )}
        <Link href={`/competencias/${anoMes}/dre`} className="font-medium text-gray-900 underline underline-offset-2">
          tela da DRE
        </Link>
        .
      </p>
    </div>
  );
}
