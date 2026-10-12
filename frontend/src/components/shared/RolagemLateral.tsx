"use client";

import { useRef, type ReactNode } from "react";

import { BarraDeRolagem } from "./BarraDeRolagem";

/**
 * Uma área que rola para os lados com a barra de rolagem presa no pé da janela e sempre visível (12/10/2026; a
 * BarraDeRolagem). A barra do sistema fica escondida (a rolagem pelo touchpad e por Shift + roda continua).
 * `className` vai na área (por exemplo, "lg:overflow-x-visible" para não rolar em tela larga).
 */
export function RolagemLateral({ children, className = "" }: { children: ReactNode; className?: string }) {
  const area = useRef<HTMLDivElement>(null);
  return (
    <>
      <div ref={area} className={`overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}>
        {children}
      </div>
      <BarraDeRolagem area={area} />
    </>
  );
}
