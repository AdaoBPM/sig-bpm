"use client";

import type { ReactNode } from "react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

/**
 * O painel de informação que abre à direita (como o relatório das importações
 * em vigor): o "Sobre Esta Tela" do cabeçalho e o agrupamento de um centro de
 * custo na DRE. O título abre a primeira seção; as demais vêm em SecaoPainel.
 */
export function PainelInformacao({
  aberto,
  onMudar,
  titulo,
  children,
}: {
  aberto: boolean;
  onMudar: (aberto: boolean) => void;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <Sheet open={aberto} onOpenChange={onMudar}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-6 data-[side=right]:sm:max-w-2xl">
        <SheetTitle className="pr-8 text-lg font-extrabold text-gray-900">{titulo}</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}

/** O texto logo abaixo do título do painel. */
export function TextoPainel({ children }: { children: ReactNode }) {
  return <div className="mt-3 space-y-2 text-sm leading-relaxed text-gray-700">{children}</div>;
}

/** Uma seção seguinte do painel, com título próprio (ex.: "Como Usar Esta Tela"). */
export function SecaoPainel({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <>
      <h2 className="mt-6 text-base font-bold text-gray-900">{titulo}</h2>
      <div className="mt-2 text-sm leading-relaxed text-gray-700 [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:space-y-0 [&_ul]:pl-5">{children}</div>
    </>
  );
}
