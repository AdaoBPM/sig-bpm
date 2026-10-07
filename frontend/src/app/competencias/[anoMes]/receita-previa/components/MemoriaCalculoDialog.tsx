"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Abas } from "@/components/shared/Abas";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Carregando } from "@/components/shared/Estados";
import { SemResultado, useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import type { Coluna } from "@/lib/filtrosDeTabela";

import { inteiro, moeda } from "../../utils/formatacao";
import {
  GRUPOS_ORIGEM,
  receitaPreviaService,
  ROTULO_CRITERIO,
  ROTULO_NATUREZA,
  ROTULO_UNIDADE,
  ROTULO_VENDA,
  type ItemReceita,
  type Natureza,
} from "../services/receitaPreviaService";

type Props = { anoMes: string; unidade: number; natureza: Natureza; onFechar: () => void };

const valorOuTraco = (v: string | null) => (v === null ? "—" : moeda(v));
const quantidade = (v: string | null) => (v === null ? "—" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 }));
const numero = (v: string | null) => (v === null ? null : Number(v));

/** Coluna de número à direita: ordena pelo valor e filtra pelo texto como aparece na célula. */
const numerica = (chave: string, rotulo: string, campo: (i: ItemReceita) => string | null, formato: (v: string | null) => string): Coluna<ItemReceita> => ({
  chave,
  rotulo,
  tipo: "numero",
  alinhamento: "direita",
  valor: (i) => numero(campo(i)),
  texto: (i) => (campo(i) === null ? null : formato(campo(i))),
});

/**
 * Memória de cálculo: cada registro de lista ou lançamento que compôs a linha,
 * separado como nas abas de receita do BASE PRÉVIAS (Produção, Expedição,
 * Saídas, Devoluções, Serviços e Lanç. Manuais), com filtro e ordem nos
 * rótulos das colunas.
 */
export function MemoriaCalculoDialog({ anoMes, unidade, natureza, onFechar }: Props) {
  const { data, isPending, isError } = useQuery({
    queryKey: ["receita-previa", anoMes, "itens", unidade, natureza],
    queryFn: () => receitaPreviaService.itens(anoMes, unidade, natureza),
  });
  const grupos = useMemo(
    () => GRUPOS_ORIGEM.map((g) => ({ ...g, itens: (data?.itens ?? []).filter((i) => i.origem === g.origem) })).filter((g) => g.itens.length > 0),
    [data],
  );
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const ativo = grupos.find((g) => g.origem === escolhido) ?? grupos[0];

  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-sm sm:max-w-[95vw] 2xl:max-w-[100rem]">
        <DialogHeader>
          <DialogTitle>
            {ROTULO_UNIDADE[unidade]} · {ROTULO_NATUREZA[natureza]}
          </DialogTitle>
          <DialogDescription>
            Memória de cálculo: {data ? inteiro(data.total) : "…"} item(ns). Os valores ficam como foram apurados, com o preço vigente na
            apuração.
          </DialogDescription>
        </DialogHeader>
        {isError ? <p className="text-sm text-red-700">Erro ao carregar a memória de cálculo.</p> : null}
        {isPending ? (
          <Carregando linhas={4} />
        ) : ativo ? (
          <div className="space-y-3">
            <Abas
              rotulo="Origem dos itens"
              ativa={ativo.origem}
              onMudar={setEscolhido}
              abas={grupos.map((g) => ({ chave: g.origem, rotulo: g.rotulo, contagem: g.itens.length }))}
            />
            <TabelaDoGrupo key={ativo.origem} itens={ativo.itens} unidade={unidade} natureza={natureza} />
          </div>
        ) : (
          <p className="text-sm text-gray-600">Nenhum item nesta linha.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** A tabela de um agrupamento; trocar de aba remonta a tabela, e os filtros recomeçam. */
function TabelaDoGrupo({ itens, unidade, natureza }: { itens: ItemReceita[]; unidade: number; natureza: Natureza }) {
  const colunas = useMemo(() => {
    const algum = (f: (i: ItemReceita) => unknown) => itens.some((i) => f(i) !== null && f(i) !== undefined && f(i) !== "");
    const cs: Coluna<ItemReceita>[] = [];
    if (algum((i) => i.obra)) cs.push({ chave: "obra", rotulo: "Obra", valor: (i) => i.obra });
    if (algum((i) => i.linha)) cs.push({ chave: "linha", rotulo: "Linha", valor: (i) => i.linha });
    if (unidade !== 3) cs.push({ chave: "venda", rotulo: "Venda", valor: (i) => (i.venda ? ROTULO_VENDA[i.venda] : null) });
    cs.push({ chave: "criterio", rotulo: "Critério", valor: (i) => ROTULO_CRITERIO[i.criterio] ?? i.criterio });
    if (algum((i) => i.quantidade)) cs.push(numerica("quantidade", "Quant.", (i) => i.quantidade, quantidade));
    if (algum((i) => i.precoBruto)) cs.push(numerica("precoBruto", "Preço Bruto", (i) => i.precoBruto, valorOuTraco));
    if (algum((i) => i.precoLiquido)) cs.push(numerica("precoLiquido", "Preço Líq.", (i) => i.precoLiquido, valorOuTraco));
    cs.push(numerica("receitaBruta", "ROB", (i) => i.receitaBruta, valorOuTraco));
    cs.push(numerica("receitaLiquida", "ROL", (i) => i.receitaLiquida, valorOuTraco));
    if (unidade === 2 && natureza === "PRE_FABRICADO") cs.push(numerica("variacaoEstoque", "Var. Estoque", (i) => i.variacaoEstoque, valorOuTraco));
    if (algum((i) => i.observacao)) cs.push({ chave: "observacao", rotulo: "Observação", valor: (i) => i.observacao });
    return cs;
  }, [itens, unidade, natureza]);
  const tabela = useTabelaFiltravel(itens, colunas);

  const celula = (c: Coluna<ItemReceita>, i: ItemReceita) => {
    switch (c.chave) {
      case "obra":
        return <span className="font-medium tabular-nums">{i.obra ?? "—"}</span>;
      case "linha":
      case "venda":
      case "criterio":
        return <span className="whitespace-nowrap text-gray-600">{c.valor?.(i) ?? "—"}</span>;
      case "observacao":
        return (
          <div className="max-w-56 truncate text-xs text-yellow-800" title={i.observacao ?? undefined}>
            {i.observacao ?? ""}
          </div>
        );
      default:
        return <span className="tabular-nums">{c.texto?.(i) ?? "—"}</span>;
    }
  };

  return (
    <div className="space-y-2">
      <table className="tabela-sig w-full border-collapse text-sm">
        {tabela.cabecalho}
        <tbody>
          {tabela.visiveis.length === 0 ? (
            <SemResultado colunas={colunas.length} onLimpar={tabela.limpar} />
          ) : (
            tabela.visiveis.map((i) => (
              <tr key={i.id} className="border-b border-gray-100 align-top">
                {colunas.map((c) => (
                  <td key={c.chave} className={`px-4 py-2 ${c.alinhamento === "direita" ? "text-right whitespace-nowrap" : ""}`}>
                    {celula(c, i)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {tabela.visiveis.length > 1 ? (
          <tfoot>
            <tr className="border-t border-gray-300 bg-gray-50 font-bold text-gray-900">
              <td className="px-4 py-2" colSpan={colunas.findIndex((c) => c.chave === "receitaBruta")}>
                {tabela.total !== tabela.totalGeral ? `Total filtrado (${tabela.total} de ${tabela.totalGeral})` : "Total"}
              </td>
              {colunas.slice(colunas.findIndex((c) => c.chave === "receitaBruta")).map((c) => (
                <td key={c.chave} className="px-4 py-2 text-right whitespace-nowrap tabular-nums">
                  {c.alinhamento === "direita" ? moeda(tabela.filtradas.reduce((a, i) => a + (Number(c.valor?.(i)) || 0), 0)) : ""}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
