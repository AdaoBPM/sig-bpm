"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Popover } from "@base-ui/react/popover";
import { ArrowDown, ArrowDown01, ArrowDown10, ArrowDownAZ, ArrowDownZA, ArrowUp, ChevronDown, Filter, FilterX, Search } from "lucide-react";

import { distintos, ESTADO_INICIAL, filtrar, ordenar, type Coluna, type EstadoTabela } from "@/lib/filtrosDeTabela";

/** Acima disso, a lista do filtro mostra só os primeiros; a pesquisa acha os demais. */
const MAXIMO_NA_LISTA = 500;

const ROTULOS_ORDEM = {
  texto: ["Classificar de A a Z", "Classificar de Z a A", ArrowDownAZ, ArrowDownZA],
  numero: ["Do menor para o maior", "Do maior para o menor", ArrowDown01, ArrowDown10],
  data: ["Do mais antigo para o mais recente", "Do mais recente para o mais antigo", ArrowDown01, ArrowDown10],
} as const;

type FiltroProps<T> = { coluna: Coluna<T>; linhas: T[]; colunas: Coluna<T>[]; estado: EstadoTabela; onMudar: (e: EstadoTabela) => void };

/** O botão do rótulo e o painel de ordenar e filtrar, como o filtro do Excel. */
function FiltroDeColuna<T>({ coluna, linhas, colunas, estado, onMudar }: FiltroProps<T>) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [marcados, setMarcados] = useState<Set<string>>(new Set());

  const filtrado = !!estado.filtros[coluna.chave];
  const ordem = estado.ordem?.chave === coluna.chave ? estado.ordem : null;
  // A lista mostra os valores das linhas que passam nos filtros das outras colunas.
  const valores = useMemo(
    () => (aberto ? distintos(filtrar(linhas, colunas, estado, coluna.chave), coluna) : []),
    [aberto, linhas, colunas, estado, coluna],
  );
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const achados = termo ? valores.filter((v) => v.texto.toLocaleLowerCase("pt-BR").includes(termo)) : valores;
  const mostrados = achados.slice(0, MAXIMO_NA_LISTA);
  const todosMarcados = achados.length > 0 && achados.every((v) => marcados.has(v.texto));

  const abrir = (sim: boolean) => {
    if (sim) {
      setBusca("");
      setMarcados(new Set(estado.filtros[coluna.chave] ?? distintos(filtrar(linhas, colunas, estado, coluna.chave), coluna).map((v) => v.texto)));
    }
    setAberto(sim);
  };
  const aplicar = () => {
    // Com pesquisa, valem só os achados marcados (como no Excel).
    const escolhidos = (termo ? achados : valores).filter((v) => marcados.has(v.texto)).map((v) => v.texto);
    const filtros = { ...estado.filtros };
    if (escolhidos.length === valores.length) delete filtros[coluna.chave];
    else filtros[coluna.chave] = escolhidos;
    onMudar({ ...estado, filtros });
    setAberto(false);
  };
  const limpar = () => {
    const filtros = { ...estado.filtros };
    delete filtros[coluna.chave];
    onMudar({ ...estado, filtros });
    setAberto(false);
  };
  const ordenarPor = (decrescente: boolean) => {
    onMudar({ ...estado, ordem: { chave: coluna.chave, decrescente } });
    setAberto(false);
  };

  const [rotuloCresc, rotuloDecresc, IconeCresc, IconeDecresc] = ROTULOS_ORDEM[coluna.tipo ?? "texto"];
  const Icone = filtrado ? Filter : ordem ? (ordem.decrescente ? ArrowDown : ArrowUp) : ChevronDown;
  const itemMenu = "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm normal-case tracking-normal font-normal text-gray-800 hover:bg-gray-100 disabled:pointer-events-none disabled:text-gray-400";

  return (
    <Popover.Root open={aberto} onOpenChange={abrir}>
      <Popover.Trigger
        aria-label={`Ordenar e filtrar ${coluna.rotulo}`}
        className={`inline-flex size-4 shrink-0 items-center justify-center rounded-sm border ${
          filtrado || ordem ? "border-black bg-bpm-primary text-black" : "border-gray-300 bg-white text-gray-500 hover:border-gray-500 hover:text-gray-900"
        }`}
      >
        <Icone className="size-3" strokeWidth={filtrado ? 2.5 : 2} fill={filtrado ? "currentColor" : "none"} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={4} align={coluna.alinhamento === "direita" ? "end" : "start"} className="z-50">
          <Popover.Popup className="w-72 rounded-sm border border-gray-200 bg-white p-1.5 text-gray-900 shadow-lg outline-none">
            <button type="button" className={itemMenu} onClick={() => ordenarPor(false)}>
              <IconeCresc className="size-4 text-gray-500" />
              {rotuloCresc}
            </button>
            <button type="button" className={itemMenu} onClick={() => ordenarPor(true)}>
              <IconeDecresc className="size-4 text-gray-500" />
              {rotuloDecresc}
            </button>
            <button type="button" className={itemMenu} disabled={!filtrado} onClick={limpar}>
              <FilterX className="size-4 text-gray-500" />
              Limpar filtro de &quot;{coluna.rotulo}&quot;
            </button>
            <div className="my-1.5 border-t border-gray-200" />
            <div className="relative px-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Pesquisar"
                aria-label={`Pesquisar em ${coluna.rotulo}`}
                className="h-8 w-full rounded-sm border border-gray-300 pr-2 pl-7 text-sm outline-none focus:border-gray-500"
              />
            </div>
            <div className="mt-1.5 max-h-64 overflow-y-auto rounded-sm border border-gray-200 py-1 text-sm">
              <label className="flex cursor-pointer items-center gap-2 px-2 py-1 font-medium hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={todosMarcados}
                  onChange={(e) => {
                    const novo = new Set(marcados);
                    achados.forEach((v) => (e.target.checked ? novo.add(v.texto) : novo.delete(v.texto)));
                    setMarcados(novo);
                  }}
                  className="size-3.5 accent-black"
                />
                {termo ? "(Selecionar todos os resultados)" : "(Selecionar tudo)"}
              </label>
              {mostrados.map((v) => (
                <label key={v.texto} className="flex cursor-pointer items-center gap-2 px-2 py-1 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={marcados.has(v.texto)}
                    onChange={(e) => {
                      const novo = new Set(marcados);
                      if (e.target.checked) novo.add(v.texto);
                      else novo.delete(v.texto);
                      setMarcados(novo);
                    }}
                    className="size-3.5 accent-black"
                  />
                  <span className="min-w-0 flex-1 truncate" title={v.texto}>
                    {v.texto}
                  </span>
                  <span className="text-xs text-gray-400 tabular-nums">{v.n.toLocaleString("pt-BR")}</span>
                </label>
              ))}
              {achados.length > MAXIMO_NA_LISTA ? (
                <p className="px-2 py-1 text-xs text-gray-500">
                  Mostrando {MAXIMO_NA_LISTA} de {achados.length.toLocaleString("pt-BR")}; pesquise para achar os demais.
                </p>
              ) : null}
              {achados.length === 0 ? <p className="px-2 py-1 text-xs text-gray-500">Nada encontrado.</p> : null}
            </div>
            <div className="mt-1.5 flex justify-end gap-2">
              <button type="button" onClick={() => setAberto(false)} className="h-8 rounded-sm border border-gray-300 px-3 text-sm hover:bg-gray-100">
                Cancelar
              </button>
              <button
                type="button"
                onClick={aplicar}
                disabled={!(termo ? achados : valores).some((v) => marcados.has(v.texto))}
                className="bg-bpm-primary hover:bg-bpm-primary-hover h-8 rounded-sm px-4 text-sm font-bold text-black disabled:opacity-50"
              >
                OK
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

type Opcoes = {
  /** Linhas por página; sem ele, a tabela mostra todas. */
  porPaginaInicial?: number;
};

/**
 * Ordenar e filtrar pelos rótulos das colunas, como no Excel, com a paginação
 * depois do filtro. As colunas precisam ser estáveis (definidas fora do
 * componente ou num useMemo), porque entram nas memórias de cálculo.
 */
export function useTabelaFiltravel<T>(linhas: T[] | undefined, colunas: Coluna<T>[], opcoes: Opcoes = {}) {
  const [estado, setEstado] = useState<EstadoTabela>(ESTADO_INICIAL);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(opcoes.porPaginaInicial ?? 0);
  const todas = useMemo(() => linhas ?? [], [linhas]);
  const filtradas = useMemo(() => ordenar(filtrar(todas, colunas, estado), colunas, estado), [todas, colunas, estado]);
  const paginas = porPagina ? Math.max(1, Math.ceil(filtradas.length / porPagina)) : 1;
  const atual = Math.min(pagina, paginas);
  const visiveis = porPagina ? filtradas.slice((atual - 1) * porPagina, atual * porPagina) : filtradas;
  const mudar = (e: EstadoTabela) => {
    setEstado(e);
    setPagina(1);
  };

  const cabecalho: ReactNode = (
    <thead>
      <tr className="border-b border-gray-200 bg-gray-50">
        {colunas.map((c) => (
          <th
            key={c.chave}
            className={`px-4 py-3 text-xs font-bold tracking-wide text-gray-600 uppercase ${c.alinhamento === "direita" ? "text-right" : "text-left"} ${c.classe ?? ""}`}
          >
            {c.semFiltro ? (
              c.rotulo
            ) : (
              <span className={`inline-flex items-center gap-1 ${c.alinhamento === "direita" ? "flex-row-reverse" : ""}`}>
                {c.rotulo}
                <FiltroDeColuna coluna={c} linhas={todas} colunas={colunas} estado={estado} onMudar={mudar} />
              </span>
            )}
          </th>
        ))}
      </tr>
    </thead>
  );

  return {
    cabecalho,
    /** As linhas da página atual, já filtradas e ordenadas. */
    visiveis,
    /** Todas as que passam nos filtros (para totais e exportação). */
    filtradas,
    total: filtradas.length,
    totalGeral: todas.length,
    ativos: Object.keys(estado.filtros).length > 0 || estado.ordem !== null,
    limpar: () => mudar(ESTADO_INICIAL),
    pagina: atual,
    setPagina,
    porPagina,
    setPorPagina: (n: number) => {
      setPorPagina(n);
      setPagina(1);
    },
  };
}

/** A linha da tabela quando os filtros não deixam nada (o cabeçalho fica, para desfazer o filtro). */
export function SemResultado({ colunas, onLimpar }: { colunas: number; onLimpar: () => void }) {
  return (
    <tr>
      <td colSpan={colunas} className="px-4 py-10 text-center text-sm text-gray-600">
        Nenhum registro com esses filtros.{" "}
        <button type="button" onClick={onLimpar} className="font-medium text-gray-900 underline underline-offset-2">
          Limpar filtros
        </button>
      </td>
    </tr>
  );
}
