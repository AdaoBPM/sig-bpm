"use client";

import type { ReactNode } from "react";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { iniciaisMaiusculas } from "@/lib/texto";

/** O valor do seletor que quer dizer "sem filtro" (o Select não aceita valor vazio). */
const TODOS = "__todos__";

export type OpcaoFiltro = { valor: string; rotulo: string };

/**
 * Um seletor de filtro (G8 do levantamento de layout): o do design system, com
 * o rótulo da opção escolhida à vista (e não o valor interno) e a opção "todos".
 */
export function SeletorFiltro({
  rotulo,
  valor,
  onMudar,
  opcoes,
  todos = "Todos",
  largura = "w-48",
}: {
  rotulo: string;
  valor: string | undefined;
  onMudar: (valor: string | undefined) => void;
  opcoes: OpcaoFiltro[];
  /** O rótulo da opção sem filtro; null quando o filtro é obrigatório. */
  todos?: string | null;
  largura?: string;
}) {
  const atual = valor ?? (todos === null ? opcoes[0]?.valor : TODOS);
  const rotuloDe = (v: string | null) => (v === TODOS ? todos : (opcoes.find((o) => o.valor === v)?.rotulo ?? v));
  return (
    <div className="space-y-1">
      <span className="block text-xs font-medium text-gray-600">{iniciaisMaiusculas(rotulo)}</span>
      <Select value={atual} onValueChange={(v) => onMudar(v === TODOS || v === null ? undefined : String(v))}>
        <SelectTrigger className={`${largura} rounded-sm`} aria-label={rotulo}>
          <SelectValue>{(v: string | null) => rotuloDe(v)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {todos !== null ? <SelectItem value={TODOS}>{todos}</SelectItem> : null}
          {opcoes.map((o) => (
            <SelectItem key={o.valor} value={o.valor}>
              {o.rotulo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** A barra de filtros acima da tabela, com "Limpar filtros" quando algum está ativo. */
export function BarraDeFiltros({ children, ativos, onLimpar, direita }: { children: ReactNode; ativos?: boolean; onLimpar?: () => void; direita?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-wrap items-end gap-3">
        {children}
        {ativos && onLimpar ? (
          <button type="button" onClick={onLimpar} className="inline-flex h-9 items-center gap-1 rounded-sm px-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900">
            <X className="size-3.5" />
            Limpar filtros
          </button>
        ) : null}
      </div>
      {direita ? <div className="flex items-end gap-2">{direita}</div> : null}
    </div>
  );
}

/** O campo de busca de todas as tabelas, com a lupa. */
export function CampoBusca({ valor, onMudar, placeholder, rotulo = "Buscar", largura = "sm:w-80" }: { valor: string; onMudar: (v: string) => void; placeholder: string; rotulo?: string; largura?: string }) {
  return (
    <div className={`relative w-full ${largura}`}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
      <Input aria-label={rotulo} value={valor} onChange={(e) => onMudar(e.target.value)} placeholder={placeholder} className="h-9 rounded-sm border-gray-300 pl-9" />
    </div>
  );
}
