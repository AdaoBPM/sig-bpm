"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";

import { Input } from "@/components/ui/input";

export type OpcaoDaBusca = { id: string; codigo: string; nome: string; detalhe?: string | null };

const MAX_SUGESTOES = 15;
const rotulo = (o: OpcaoDaBusca) => `${o.codigo} — ${o.nome}`;
/** Sem acentos e sem caixa, para a busca achar "manutencao" em "MANUTENÇÃO". */
const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Uma lista com busca (27/10/2026: o modal Contestar): o código e o nome de cada opção; digitar filtra por qualquer
 * termo (todos os termos, em qualquer ordem), e o X limpa a escolha.
 */
export function BuscaNaLista({
  id,
  opcoes,
  valor,
  onEscolher,
  placeholder,
}: {
  id: string;
  opcoes: OpcaoDaBusca[];
  valor: OpcaoDaBusca | null;
  onEscolher: (o: OpcaoDaBusca | null) => void;
  placeholder: string;
}) {
  const [texto, setTexto] = useState(valor ? rotulo(valor) : "");
  const [aberta, setAberta] = useState(false);
  const termos = normal(texto).split(/\s+/).filter(Boolean);
  const sugestoes = useMemo(
    () => opcoes.filter((o) => !termos.length || termos.every((t) => normal(`${rotulo(o)} ${o.detalhe ?? ""}`).includes(t))).slice(0, MAX_SUGESTOES),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- os termos saem do texto.
    [opcoes, texto],
  );
  return (
    <div className="relative">
      <Input
        id={id}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setAberta(true);
          if (valor) onEscolher(null);
        }}
        onFocus={() => setAberta(true)}
        onBlur={() => setTimeout(() => setAberta(false), 150)}
        placeholder={placeholder}
        className="rounded-sm border-gray-300 pr-8"
        autoComplete="off"
      />
      {texto ? (
        <button
          type="button"
          aria-label="Limpar"
          onClick={() => {
            setTexto("");
            onEscolher(null);
          }}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 text-gray-400 hover:text-gray-700"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
      {aberta && !valor && sugestoes.length > 0 ? (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-sm border border-gray-200 bg-white shadow-sm">
          {sugestoes.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onEscolher(o);
                  setTexto(rotulo(o));
                  setAberta(false);
                }}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100"
              >
                <span className="font-medium">{o.codigo}</span> {o.nome}
                {o.detalhe ? <span className="block text-xs text-gray-500">{o.detalhe}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
