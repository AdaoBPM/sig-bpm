"use client";

import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * O campo de senha com o botão de ver o que se digita (o olho, à direita), como no cadastro de usuários
 * (11/10/2026). A senha volta a ficar oculta ao clicar de novo.
 */
export function CampoSenha({ className, ...props }: Omit<ComponentProps<typeof Input>, "type">) {
  const [visivel, setVisivel] = useState(false);
  return (
    <div className="relative">
      <Input type={visivel ? "text" : "password"} autoComplete="new-password" className={cn("pr-10", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        aria-label={visivel ? "Ocultar a senha" : "Mostrar a senha"}
        aria-pressed={visivel}
        title={visivel ? "Ocultar a senha" : "Mostrar a senha"}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-sm text-gray-500 hover:text-gray-900"
      >
        {visivel ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
