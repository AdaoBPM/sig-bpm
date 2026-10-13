import { Lock } from "lucide-react";

import { rotuloMarcacao, rotuloVersao, type Cenario } from "../services/cenariosService";

type Travas = Pick<Cenario, "marcacao" | "versao" | "versaoSalvaEm" | "versaoSalvaPor">;

/** O cenário não muda de dados: marcado (12/10/2026) ou com a versão congelada (13/10/2026). */
export const estaTravado = (c: Travas) => !!c.marcacao || !!c.versaoSalvaEm;

const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

/**
 * O aviso das travas do cenário: a versão congelada (13/10/2026: Congelar Versão; para mudar, reabre-se a versão ou
 * cria-se uma revisão) ou a marcação (12/10/2026: tira-se a marcação, ou marca-se outro cenário, em Configurações /
 * Cenário). A DRE, os indicadores manuais e a referência não se editam.
 */
export function AvisoMarcado({ cenario: c, oQue }: { cenario: Travas; oQue: string }) {
  return (
    <p className="flex items-start gap-2 rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white px-4 py-2 text-sm text-gray-700">
      <Lock className="mt-0.5 size-4 shrink-0 text-gray-500" />
      <span>
        {c.versaoSalvaEm ? (
          <>
            A {rotuloVersao(c.versao)} está congelada (em {data(c.versaoSalvaEm)}
            {c.versaoSalvaPor ? `, por ${c.versaoSalvaPor}` : ""}): {oQue} não se edita. Para editar, reabra a versão (Reabrir Versão) ou crie uma
            revisão (Criar Revisão), na tela Resultados.
          </>
        ) : (
          <>
            O cenário está marcado como {rotuloMarcacao(c.marcacao)}: {oQue} não se edita. Para editar, tire a marcação (ou marque outro cenário) em
            Configurações / Cenário (Marcar Cenário).
          </>
        )}
      </span>
    </p>
  );
}
