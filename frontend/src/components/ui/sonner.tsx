"use client";

import { useEffect, useState } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";

const NO_TOASTER = "[data-sonner-toaster]";
const dentroDoToaster = (alvo: EventTarget | null) => alvo instanceof Element && !!alvo.closest(NO_TOASTER);

/**
 * BPM usa identidade light — sem next-themes.
 *
 * As notificações (14/10/2026): embaixo e à direita, empilhadas até 5 (as mais recentes na frente); a pilha se abre ao
 * clicar nela (não ao passar o mouse) e se fecha ao clicar fora ou de novo nela. Para isso, o passar do mouse sobre a
 * pilha não chega ao Sonner (que a abriria). As cores do êxito (verde forte) e do erro (vermelho forte) ficam no
 * globals.css.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const [aberta, setAberta] = useState(false);
  useEffect(() => {
    const barrar = (e: MouseEvent) => {
      if (dentroDoToaster(e.target) || (e.type === "mouseout" && dentroDoToaster(e.relatedTarget))) e.stopPropagation();
    };
    const clicar = (e: MouseEvent) => {
      if (!dentroDoToaster(e.target)) setAberta(false);
      // O X de cada notificação e os botões dela não abrem nem fecham a pilha.
      else if (!(e.target as Element).closest("[data-close-button], [data-button], [data-cancel]")) setAberta((a) => !a);
    };
    const eventos = ["mouseover", "mousemove", "mouseout"] as const;
    for (const t of eventos) window.addEventListener(t, barrar, true);
    window.addEventListener("click", clicar, true);
    return () => {
      for (const t of eventos) window.removeEventListener(t, barrar, true);
      window.removeEventListener("click", clicar, true);
    };
  }, []);
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="bottom-right"
      visibleToasts={5}
      expand={aberta}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast cursor-pointer",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
