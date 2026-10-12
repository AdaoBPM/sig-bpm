"use client";

import Link from "next/link";

import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

/** Os cenários analíticos (montados pelas premissas): a tela virá depois; por enquanto, os cenários são os sintéticos. */
export function CenariosAnaliticosContent() {
  useRegistrarAcessoTela("/cenarios/analiticos");
  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Cenários Analíticos"
        sobre={<p>Os cenários analíticos, montados a partir das premissas da operação: tela em desenvolvimento. Por enquanto, os cenários são os sintéticos.</p>}
        comoUsar={
          <ul>
            <li>Use Cenários Sintéticos para importar ou criar um cenário.</li>
          </ul>
        }
      />
      <p className="rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white px-4 py-3 text-sm text-gray-700">
        Tela em desenvolvimento. Por enquanto, use{" "}
        <Link href="/cenarios/sinteticos" className="font-medium text-gray-900 underline underline-offset-2">
          Cenários Sintéticos
        </Link>
        .
      </p>
    </div>
  );
}
