"use client";

import { useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * O botão Configurar Gráficos (14/10/2026; antes, as listas na linha do título): abre o modal com as opções da tela — o
 * Exercício, o Período, os Rótulos e o Tipo (as Cores, desde 16/10/2026, são a Acessibilidade do menu do usuário) —, uma
 * embaixo da outra, com o rótulo à esquerda. Cada escolha vale na hora (as do Tipo e dos Rótulos ficam guardadas neste
 * navegador); o modal só fecha, sem explicação embaixo do título (14/10/2026).
 */
export function ConfigurarGraficos({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button type="button" className="bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm" onClick={() => setAberto(true)}>
        <SlidersHorizontal className="size-4" />
        Configurar Gráficos
      </Button>
      {aberto ? (
        <Dialog open onOpenChange={(o) => (!o ? setAberto(false) : undefined)}>
          <DialogContent className="rounded-sm sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Configurar Gráficos</DialogTitle>
            </DialogHeader>
            {/* As opções uma embaixo da outra: o rótulo à esquerda, a lista à direita. */}
            <div className="grid gap-3 [&_label]:justify-between [&_label>span]:text-sm [&_[data-slot=select-trigger]]:w-40">{children}</div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
