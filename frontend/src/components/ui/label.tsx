"use client";

import { Children, type ComponentProps } from "react";

import { iniciaisMaiusculas } from "@/lib/texto";
import { cn } from "@/lib/utils";

/** Os nomes dos campos com iniciais maiúsculas (padrão de nomes do SPEC). */
function Label({ className, children, ...props }: ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "text-sm leading-none font-medium text-gray-900 select-none",
        className,
      )}
      {...props}
    >
      {Children.map(children, (c) => (typeof c === "string" ? iniciaisMaiusculas(c) : c))}
    </label>
  );
}

export { Label };
