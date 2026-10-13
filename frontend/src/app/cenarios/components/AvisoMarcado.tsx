import { Lock } from "lucide-react";

import { rotuloMarcacao, type MarcacaoCenario } from "../services/cenariosService";

/**
 * O aviso da trava dos cenários marcados (12/10/2026): um cenário com marcação não se edita (a DRE, os indicadores
 * manuais e a referência); tira-se a marcação, ou marca-se outro cenário, em Configurações / Cenário (Marcar Cenário).
 */
export function AvisoMarcado({ marcacao, oQue }: { marcacao: MarcacaoCenario; oQue: string }) {
  return (
    <p className="flex items-start gap-2 rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white px-4 py-2 text-sm text-gray-700">
      <Lock className="mt-0.5 size-4 shrink-0 text-gray-500" />
      <span>
        O cenário está marcado como {rotuloMarcacao(marcacao)}: {oQue} não se edita. Para editar, tire a marcação (ou marque outro cenário) em
        Configurações / Cenário (Marcar Cenário).
      </span>
    </p>
  );
}
