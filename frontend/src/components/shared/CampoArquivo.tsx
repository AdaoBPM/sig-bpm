"use client";

import { useRef, type Ref } from "react";

import { cn } from "@/lib/utils";

type Props = {
  /** O arquivo escolhido (o nome aparece no campo); null: nenhum. */
  arquivo: File | null;
  onEscolher: (arquivo: File | null) => void;
  accept?: string;
  disabled?: boolean;
  /** Para um <Label htmlFor> apontar para o campo. */
  id?: string;
  "aria-label"?: string;
  /** O <input type="file"> de verdade, para a tela limpar o valor (escolher o mesmo arquivo de novo). */
  ref?: Ref<HTMLInputElement>;
  className?: string;
};

/**
 * O campo de escolher arquivo em português. O <input type="file"> do
 * navegador escreve "Browse…" e "No file selected." na língua do navegador, e
 * esse texto não se troca; aqui ele fica escondido, e o botão e o nome do
 * arquivo são nossos.
 */
export function CampoArquivo({ arquivo, onEscolher, accept, disabled, id, ref, className, ...rest }: Props) {
  const campo = useRef<HTMLInputElement | null>(null);
  const ligar = (el: HTMLInputElement | null) => {
    campo.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };
  return (
    <div
      className={cn(
        "flex h-9 w-full min-w-0 items-center gap-3 rounded-sm border border-gray-300 bg-white px-3 text-sm",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <input
        ref={ligar}
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        tabIndex={-1}
        aria-label={rest["aria-label"]}
        className="sr-only"
        onChange={(e) => onEscolher(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => campo.current?.click()}
        className="shrink-0 rounded-sm font-medium text-gray-900 hover:underline focus-visible:ring-1 focus-visible:ring-black focus-visible:outline-none disabled:pointer-events-none"
      >
        Escolher Arquivo…
      </button>
      <span className={cn("min-w-0 truncate", arquivo ? "text-gray-900" : "text-gray-500")} title={arquivo?.name}>
        {arquivo ? arquivo.name : "Nenhum arquivo selecionado."}
      </span>
    </div>
  );
}
