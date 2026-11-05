"use client";

import { Fragment, type ReactNode } from "react";

import { TabelaLarga } from "@/app/relatorios/components/TabelaLarga";

import { Agrupador, SeletorNivel, useNiveisDRE } from "../../dre/components/NiveisDRE";

/**
 * Uma linha da tabela dos Créditos de Impostos: o total, um grupo (Matérias Primas, Gastos Gerais Variáveis) ou uma conta,
 * com os textos das colunas na ordem delas. Os códigos são os da Estrutura da DRE (o do total, CODIGO_DO_TOTAL), que dão os
 * níveis: o total, os grupos e as contas.
 */
export type LinhaDosCreditos = { codigo: string; tipo: "TOTAL" | "SUBTOTAL" | "ITEM"; descricao: string; valores: string[] };
/** As colunas em grupos: o rótulo em cima (o mês); sem ele, cada coluna ocupa as duas linhas dos rótulos, com o nome dela. */
export type GrupoDeColunas = { chave: string; rotulo: string | null; colunas: Array<{ rotulo: string; largura: number; pct?: boolean }> };

/** O total da tabela, acima dos grupos (como os totais da DRE): o código abre o grupo CPP nos níveis. */
export const CODIGO_DO_TOTAL = "CPP.CREDITOS_DE_IMPOSTOS";

/** A escala do amarelo do Consolidado: o total um tom acima dos grupos; as contas em branco. */
const fundoDa = (l: LinhaDosCreditos) => (l.tipo === "TOTAL" ? "bg-yellow-200" : l.tipo === "SUBTOTAL" ? "bg-yellow-100" : "bg-white");

/**
 * A tabela dos Créditos de Impostos (03/11/2026, pedido do Adão: o padrão da aba Consolidado de Resultados Empresariais), na
 * aba Impostos dos Resultados do Fechamento Mensal e na de Resultados Empresariais › Resultados: os rótulos presos no topo e a
 * descrição presa à esquerda (`TabelaLarga`), a escala do amarelo (o total, os grupos e as contas), o menu de níveis (Totais,
 * Atribuições, Contas; a escolha fica guardada em `chaveDoNivel`) e a seta de cada grupo, que abre e fecha só ele. `botoes`:
 * outros botões ao lado dos níveis (o de recolher os meses anteriores).
 */
export function TabelaDosCreditos({
  titulo,
  grupos,
  linhas,
  chaveDoNivel,
  botoes,
  larguraDaDescricao = 380,
}: {
  titulo: string;
  grupos: GrupoDeColunas[];
  linhas: LinhaDosCreditos[];
  chaveDoNivel: string;
  botoes?: ReactNode;
  larguraDaDescricao?: number;
}) {
  const niveis = useNiveisDRE(linhas, chaveDoNivel);
  const colunas = grupos.flatMap((g) => g.colunas);
  // A primeira coluna de cada grupo, com a borda à esquerda.
  const inicios = new Set(grupos.map((g, k) => grupos.slice(0, k).reduce((s, x) => s + x.colunas.length, 0)));
  const emDuasLinhas = grupos.some((g) => g.rotulo);
  const th = "px-1.5 py-2 text-right text-xs font-bold whitespace-nowrap text-gray-900 uppercase";
  return (
    <TabelaLarga
      larguras={[larguraDaDescricao, ...colunas.map((c) => c.largura)]}
      cabecalho={
        <>
          <tr className={emDuasLinhas ? "" : "border-b border-gray-300"}>
            <th rowSpan={emDuasLinhas ? 2 : 1} className="left-0 !z-20 px-3 py-2 text-left align-bottom">
              <span className="flex items-center gap-3">
                <span className="flex shrink-0 items-center gap-1.5">
                  <SeletorNivel nivel={niveis.nivelGeral} onEscolher={niveis.escolherNivel} />
                  {botoes}
                </span>
                <span className="truncate text-sm font-bold tracking-wide whitespace-nowrap text-gray-900 uppercase" title={titulo}>
                  {titulo}
                </span>
              </span>
            </th>
            {grupos.map((g) =>
              g.rotulo ? (
                <th key={g.chave} colSpan={g.colunas.length} className={`${th} border-l border-gray-300 !pb-0.5 !text-center`}>
                  {g.rotulo}
                </th>
              ) : (
                <Fragment key={g.chave}>
                  {g.colunas.map((c, k) => (
                    <th key={k} rowSpan={emDuasLinhas ? 2 : 1} className={`${th} align-bottom ${k === 0 ? "border-l border-gray-300" : ""}`}>
                      {c.rotulo}
                    </th>
                  ))}
                </Fragment>
              ),
            )}
          </tr>
          {emDuasLinhas ? (
            <tr className="border-b border-gray-300">
              {grupos
                .filter((g) => g.rotulo)
                .flatMap((g) =>
                  g.colunas.map((c, k) => (
                    <th key={`${g.chave}-${k}`} className={`${th} !pt-0.5 ${k === 0 ? "border-l border-gray-300" : ""}`}>
                      {c.rotulo}
                    </th>
                  )),
                )}
            </tr>
          ) : null}
        </>
      }
      corpo={niveis.linhas
        .filter((l) => niveis.visivel(l))
        .map((l) => {
          const destaque = l.tipo !== "ITEM";
          const fundo = fundoDa(l);
          const cor = destaque ? "text-gray-900" : "text-gray-700";
          return (
            <tr key={l.codigo} className={destaque ? "border-y border-gray-300 font-bold" : "border-t border-gray-100"}>
              <td className={`sticky left-0 z-10 overflow-hidden py-1.5 pr-3 whitespace-nowrap ${fundo} ${niveis.recuo(l)} ${cor}`}>
                <span className="flex min-w-0 items-center gap-1">
                  <Agrupador grupo={niveis.grupo(l)} fechado={niveis.fechado(l)} onAlternar={() => niveis.alternar(l.codigo)} />
                  <span className="truncate" title={l.descricao}>
                    {l.descricao}
                  </span>
                </span>
              </td>
              {colunas.map((c, i) => (
                <td
                  key={i}
                  className={`px-1.5 py-1.5 text-right whitespace-nowrap ${fundo} ${c.pct ? `text-xs ${destaque ? "text-gray-700" : "text-gray-500"}` : cor} ${inicios.has(i) ? "border-l border-gray-100" : ""}`}
                >
                  {l.valores[i]}
                </td>
              ))}
            </tr>
          );
        })}
    />
  );
}
