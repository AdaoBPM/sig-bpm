"use client";

import { Fragment, useLayoutEffect, useMemo, useRef, type ComponentType } from "react";

import { BarraDeRolagem } from "@/components/shared/BarraDeRolagem";
import { SemResultado, useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import type { Coluna } from "@/lib/filtrosDeTabela";

import { ROTULO_DO_ORCADO } from "../../competencias/[anoMes]/dre/components/NiveisDRE";
import { formato, type Indicador, type MesRelatorio } from "../services/relatoriosService";

/** Os grupos, na ordem e com os nomes das abas da planilha (Produção, Serviços…). */
const NOME_DO_GRUPO: Record<string, string> = { GME: "Metas Estratégicas (GME)" };

export const SENTIDO: Record<string, string> = { "↑": "Quanto maior, melhor", "↓": "Quanto menor, melhor", "=": "Acompanhamento", "-": "Sem sentido definido" };

/** O valor na unidade do indicador, como nas abas dos setores. */
export function valor(i: Pick<Indicador, "unidade">, v: number | null) {
  if (v === null) return "—";
  switch (i.unidade) {
    case "%":
      return formato.pct(v);
    case "R$":
      return formato.inteiro(v);
    case "colab.":
    case "ocorr.":
      return formato.inteiro(v);
    case "pistas":
      return formato.umaCasa(v);
    default:
      return formato.valor(v);
  }
}

/** As larguras das colunas fixas (Indicador, Sent., Und.) e das de valor. */
const LARGURA = { indicador: 400, sentido: 84, unidade: 100, mes: 112, acumulado: 124, orcado: 148 };

/**
 * As colunas, com os filtros e a ordem nos rótulos, como nas demais tabelas.
 * As três primeiras ficam presas à esquerda; os meses (e o acumulado) rolam.
 * A posição das presas segue a largura real da coluna Indicador (--largura-indicador),
 * que cresce quando a tabela é mais estreita que a área.
 */
function montarColunas<T extends Indicador>(meses: MesRelatorio[], indices: number[], acumulado: boolean, orcado: boolean): Coluna<T>[] {
  const ultimo = meses.length - 1;
  // O orçado (Resultados Realizados, 11/10/2026): o do último mês, depois dele, e o acumulado, depois do acumulado.
  const orcadoDoMes: Coluna<T>[] = orcado
    ? [{ chave: "orcado:mes", rotulo: `Orçado ${meses[ultimo].rotulo}`, tipo: "numero", alinhamento: "direita", valor: (i) => i.orcado[ultimo] ?? null, texto: (i) => valor(i, i.orcado[ultimo] ?? null), classe: ROTULO_DO_ORCADO }]
    : [];
  const orcadoAcumulado: Coluna<T>[] = orcado
    ? [{ chave: "orcado:acum", rotulo: "Orçado Acum.", tipo: "numero", alinhamento: "direita", valor: (i) => i.totalOrcado, texto: (i) => valor(i, i.totalOrcado), classe: ROTULO_DO_ORCADO }]
    : [];
  return [
    { chave: "indicador", rotulo: "Indicador", valor: (i) => i.nome, classe: "sticky left-0 !z-30" },
    {
      chave: "sentido",
      rotulo: "Sent.",
      valor: (i) => i.sentido,
      texto: (i) => `${i.sentido} ${SENTIDO[i.sentido] ?? ""}`.trim(),
      classe: "sticky left-[var(--largura-indicador)] !z-30",
    },
    { chave: "unidade", rotulo: "Und.", valor: (i) => i.unidade, classe: `sticky left-[calc(var(--largura-indicador)+84px)] !z-30 shadow-[inset_-1px_0_0_#d1d5db]` },
    ...indices.map(
      (k): Coluna<T> => ({
        chave: `mes:${meses[k].mes}`,
        rotulo: meses[k].rotulo,
        tipo: "numero",
        alinhamento: "direita",
        valor: (i) => i.meses[k],
        texto: (i) => valor(i, i.meses[k]),
      }),
    ),
    ...orcadoDoMes,
    ...(acumulado
      ? [
          {
            chave: "acumulado",
            rotulo: "Acumulado",
            tipo: "numero",
            alinhamento: "direita",
            valor: (i: T) => i.total,
            texto: (i: T) => valor(i, i.total),
            classe: "border-l border-gray-300",
          } as Coluna<T>,
        ]
      : []),
    ...orcadoAcumulado,
  ];
}

type Props<T extends Indicador> = {
  meses: MesRelatorio[];
  indicadores: T[];
  /** Só a coluna do último mês, sem o acumulado (a etapa Indicadores do Fechamento Mensal). */
  soUltimoMes?: boolean;
  /** Clicar na linha (o gráfico do indicador; a edição dos lançamentos manuais do cenário). */
  onClicar?: (i: T) => void;
  dicaDoClique?: string;
  iconeDoClique?: ComponentType<{ className?: string }>;
  /** As colunas do orçado (Resultados Realizados): a do último mês e a do acumulado. */
  comOrcado?: boolean;
  /** A célula do mês em destaque (o valor digitado, nos lançamentos manuais do cenário). */
  destacar?: (i: T, k: number) => boolean;
  dicaDoDestaque?: string;
};

/**
 * A tabela dos indicadores (Resultados Realizados / Indicadores e os cenários sintéticos): os grupos em faixas, as
 * colunas Indicador, Sent. e Und. presas à esquerda, os meses e o acumulado, com os filtros nos rótulos.
 */
export function TabelaIndicadores<T extends Indicador>({ meses, indicadores, soUltimoMes, onClicar, dicaDoClique, iconeDoClique: Icone, comOrcado, destacar, dicaDoDestaque }: Props<T>) {
  const colunas = useMemo(() => {
    const indices = soUltimoMes ? [meses.length - 1] : meses.map((_, k) => k);
    return montarColunas<T>(meses, indices, !soUltimoMes, !!comOrcado && !soUltimoMes);
  }, [meses, soUltimoMes, comOrcado]);
  const tabela = useTabelaFiltravel(indicadores, colunas);
  const larguras = [LARGURA.indicador, LARGURA.sentido, LARGURA.unidade, ...colunas.slice(3).map((c) => (c.chave.startsWith("orcado:") ? LARGURA.orcado : c.chave === "acumulado" ? LARGURA.acumulado : LARGURA.mes))];
  const ehOrcado = (chave: string) => chave.startsWith("orcado:");
  // A faixa do grupo em pedaços: amarela nas colunas do realizado, cinza nas do orçado (a mesma escala).
  const faixas = colunas.reduce<Array<{ orcado: boolean; n: number }>>((fs, c) => {
    const o = ehOrcado(c.chave);
    const ultima = fs[fs.length - 1];
    if (ultima && ultima.orcado === o) ultima.n++;
    else fs.push({ orcado: o, n: 1 });
    return fs;
  }, []);
  const total = larguras.reduce((s, w) => s + w, 0);

  // A largura real da coluna Indicador posiciona as outras duas colunas presas.
  const moldura = useRef<HTMLDivElement>(null);
  const topo = useRef<HTMLDivElement>(null);
  const corpo = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = moldura.current;
    const th = el?.querySelector("thead th");
    if (!el || !th) return;
    const medir = () => el.style.setProperty("--largura-indicador", `${th.getBoundingClientRect().width}px`);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(th);
    return () => obs.disconnect();
  }, [colunas]);


  const clicavel = !!onClicar;
  const colgroup = (
    <colgroup>
      {/* A coluna Indicador sem largura: fica com o que sobra quando a tabela é mais estreita que a área. */}
      <col style={{ minWidth: LARGURA.indicador }} />
      {larguras.slice(1).map((w, k) => (
        <col key={k} style={{ width: w }} />
      ))}
    </colgroup>
  );
  return (
    <>
      {tabela.ativos ? (
        <div className="flex justify-end">
          <button type="button" onClick={tabela.limpar} className="text-xs font-medium text-gray-900 underline underline-offset-2">
            Limpar Filtros
          </button>
        </div>
      ) : null}
      {/*
        Como a tabela de Resultados (12/10/2026; antes, uma caixa com rolagem própria): a página rola, os rótulos ficam
        presos logo abaixo do título da tela, as três primeiras colunas à esquerda, e a barra de rolagem lateral no pé
        da janela. Os rótulos e o corpo são duas tabelas com as mesmas colunas; os rótulos acompanham o corpo.
      */}
      <div ref={moldura} className="rounded-sm border border-gray-200 bg-white [--largura-indicador:400px]">
        <div ref={topo} className="sticky top-[var(--topo-tabela,0px)] z-30 overflow-hidden">
          <table className="tabela-sig table-fixed border-collapse text-sm [--topo-tabela:0px]" style={{ width: total, minWidth: "100%" }}>
            {colgroup}
            {tabela.cabecalho}
          </table>
        </div>
        <div
          ref={corpo}
          className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(e) => {
            if (topo.current && topo.current.scrollLeft !== e.currentTarget.scrollLeft) topo.current.scrollLeft = e.currentTarget.scrollLeft;
          }}
        >
        <table className="tabela-sig table-fixed border-collapse text-sm" style={{ width: total, minWidth: "100%" }}>
          {colgroup}
          <tbody>
            {tabela.visiveis.length === 0 ? (
              <SemResultado colunas={colunas.length} onLimpar={tabela.limpar} />
            ) : (
              tabela.visiveis.map((i, k) => {
                const anterior = tabela.visiveis[k - 1];
                const principal = i.numero === "";
                const tom = principal ? "text-gray-900" : "text-gray-700";
                return (
                  <Fragment key={i.nome}>
                    {!anterior || anterior.grupo !== i.grupo ? (
                      <tr className="border-y border-gray-300">
                        {faixas.map((f, n) => (
                          <td key={n} colSpan={f.n} className={`${f.orcado ? "bg-gray-200" : "bg-yellow-50"} px-3 py-2 text-sm font-bold tracking-wide text-gray-900 uppercase`}>
                            {n === 0 ? <span className="sticky left-3">{NOME_DO_GRUPO[i.grupo] ?? i.grupo}</span> : null}
                          </td>
                        ))}
                      </tr>
                    ) : null}
                    <tr
                      className={`group border-t border-gray-100 ${principal ? "font-bold" : ""} ${clicavel ? "cursor-pointer hover:bg-gray-100" : ""}`}
                      onClick={onClicar ? () => onClicar(i) : undefined}
                      title={clicavel ? dicaDoClique : undefined}
                    >
                      <td className={`sticky left-0 z-10 bg-white py-1.5 pr-3 ${clicavel ? "group-hover:bg-gray-100" : ""} ${principal ? "pl-4" : "pl-9"} ${tom}`}>
                        <div className="flex items-baseline gap-2">
                          {i.numero ? <span className="w-10 shrink-0 text-xs font-normal text-gray-400">{i.numero}</span> : null}
                          {Icone ? <Icone className="size-3.5 shrink-0 self-center text-gray-400" /> : null}
                          <span>{i.nome}</span>
                        </div>
                        <div className={`text-xs font-normal text-gray-500 ${i.numero ? "pl-12" : ""}`}>
                          {i.metodologia}
                          {i.acumulado === "ATUAL" && !soUltimoMes ? " · acumulado: o último mês" : ""}
                        </div>
                      </td>
                      <td
                        className={`sticky left-[var(--largura-indicador)] z-10 bg-white px-4 py-1.5 font-normal text-gray-600 ${clicavel ? "group-hover:bg-gray-100" : ""}`}
                        title={SENTIDO[i.sentido]}
                      >
                        {i.sentido}
                      </td>
                      <td
                        className={`sticky left-[calc(var(--largura-indicador)+84px)] z-10 bg-white shadow-[inset_-1px_0_0_#d1d5db] px-4 py-1.5 text-xs font-normal whitespace-nowrap text-gray-600 ${clicavel ? "group-hover:bg-gray-100" : ""}`}
                      >
                        {i.unidade}
                      </td>
                      {colunas.slice(3).map((c) => {
                        const mes = c.chave.startsWith("mes:") ? Number(c.chave.slice(4)) - 1 : -1;
                        const emDestaque = mes >= 0 && !!destacar?.(i, meses.findIndex((m) => m.mes === mes + 1));
                        return (
                          <td
                            key={c.chave}
                            className={`px-4 py-1.5 text-right whitespace-nowrap ${tom} ${c.chave === "acumulado" ? "border-l border-gray-300" : ""} ${emDestaque ? "bg-yellow-50" : ""}`}
                            title={emDestaque ? dicaDoDestaque : undefined}
                          >
                            {c.texto?.(i)}
                          </td>
                        );
                      })}
                    </tr>
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
        </div>
        <BarraDeRolagem area={corpo} />
      </div>
    </>
  );
}
