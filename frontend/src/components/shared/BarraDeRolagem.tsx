"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * A barra de rolagem lateral de uma área, presa no pé da janela e sempre visível (12/10/2026): o trilho cinza e a
 * alça que se arrasta, desenhados pela ferramenta — a barra do sistema, no Windows 11, some quando não está em uso.
 * Clicar no trilho anda uma tela para o lado. A área continua rolando pelo touchpad e por Shift + roda; a barra
 * acompanha. Some quando a área não rola.
 */
export function BarraDeRolagem({ area }: { area: RefObject<HTMLDivElement | null> }) {
  const trilho = useRef<HTMLDivElement>(null);
  const [g, setG] = useState({ visivel: 0, total: 0, pos: 0, trilho: 0 });
  const arrasto = useRef<{ x: number; pos: number } | null>(null);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const ler = () => setG({ visivel: el.clientWidth, total: el.scrollWidth, pos: el.scrollLeft, trilho: trilho.current?.clientWidth ?? el.clientWidth });
    ler();
    el.addEventListener("scroll", ler, { passive: true });
    const obs = new ResizeObserver(ler);
    obs.observe(el);
    if (el.firstElementChild) obs.observe(el.firstElementChild);
    if (trilho.current) obs.observe(trilho.current);
    return () => {
      el.removeEventListener("scroll", ler);
      obs.disconnect();
    };
  }, [area]);

  const rola = g.total > g.visivel + 1;
  const t = g.trilho || g.visivel;
  const alca = rola ? Math.max(48, (t * g.visivel) / g.total) : t;
  const curso = Math.max(1, t - alca);
  const maximo = Math.max(1, g.total - g.visivel);
  const x = (curso * g.pos) / maximo;

  return (
    <div aria-hidden className={`sticky bottom-0 z-30 border-t border-gray-200 bg-white px-1.5 py-1 ${rola ? "" : "hidden"}`}>
      <div
        ref={trilho}
        className="relative h-2.5 cursor-pointer rounded-full bg-gray-200"
        onPointerDown={(e) => {
          // No trilho (fora da alça): uma tela para o lado.
          const el = area.current;
          if (!el || e.target !== e.currentTarget) return;
          const r = e.currentTarget.getBoundingClientRect();
          el.scrollLeft += (e.clientX - r.left < x ? -1 : 1) * el.clientWidth * 0.9;
        }}
      >
        <div
          className="absolute top-0 h-2.5 cursor-grab touch-none rounded-full bg-gray-500 hover:bg-gray-700 active:cursor-grabbing active:bg-gray-800"
          style={{ width: alca, transform: `translateX(${x}px)` }}
          onPointerDown={(e) => {
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              // sem captura (ponteiro já solto): o arrasto segue pelos eventos da alça
            }
            arrasto.current = { x: e.clientX, pos: area.current?.scrollLeft ?? 0 };
          }}
          onPointerMove={(e) => {
            const el = area.current;
            if (!arrasto.current || !el) return;
            el.scrollLeft = arrasto.current.pos + ((e.clientX - arrasto.current.x) * maximo) / curso;
          }}
          onPointerUp={() => (arrasto.current = null)}
          onPointerCancel={() => (arrasto.current = null)}
        />
      </div>
    </div>
  );
}
