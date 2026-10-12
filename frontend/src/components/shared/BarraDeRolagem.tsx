"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * A barra de rolagem lateral de uma área, presa no pé da janela (12/10/2026): sempre à vista enquanto a área está na
 * tela, e não só no fim dela. É a barra do próprio navegador, igual à da tabela de Indicadores (a pedido do usuário,
 * no lugar de uma desenhada pela ferramenta): uma faixa que rola sozinha, com a mesma largura do conteúdo da área, e
 * as duas se acompanham. Some quando a área não rola.
 */
export function BarraDeRolagem({ area }: { area: RefObject<HTMLDivElement | null> }) {
  const barra = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const medir = () => setLargura(el.scrollWidth > el.clientWidth + 1 ? el.scrollWidth : 0);
    // A área rolou (touchpad, Shift + roda, teclado): a barra acompanha.
    const acompanhar = () => {
      if (barra.current && barra.current.scrollLeft !== el.scrollLeft) barra.current.scrollLeft = el.scrollLeft;
    };
    medir();
    el.addEventListener("scroll", acompanhar, { passive: true });
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    if (el.firstElementChild) obs.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", acompanhar);
      obs.disconnect();
    };
  }, [area]);

  if (!largura) return null;
  return (
    <div
      ref={barra}
      aria-hidden
      // Altura mínima: a barra sobreposta do Windows 11 (a que aparece por cima do conteúdo, como na caixa de
      // Indicadores) precisa de espaço na faixa; a barra clássica soma a própria altura.
      className="sticky bottom-0 z-30 min-h-3.5 overflow-x-auto overflow-y-hidden bg-white"
      onScroll={(e) => {
        const el = area.current;
        if (el && el.scrollLeft !== e.currentTarget.scrollLeft) el.scrollLeft = e.currentTarget.scrollLeft;
      }}
    >
      <div style={{ width: largura, height: 1 }} />
    </div>
  );
}
