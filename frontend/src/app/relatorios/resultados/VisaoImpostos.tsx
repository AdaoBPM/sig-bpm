"use client";

import { useQuery } from "@tanstack/react-query";

import { type ColunaExportavel, ExportarTabela } from "@/components/shared/ExportarTabela";

import { CODIGO_DO_TOTAL, TabelaDosCreditos, type GrupoDeColunas, type LinhaDosCreditos } from "../../competencias/[anoMes]/impostos/components/TabelaDosCreditos";
import { codigoNaTabela } from "../../competencias/[anoMes]/impostos/services/impostosService";
import { inteiro } from "../../competencias/[anoMes]/utils/formatacao";
import { BotaoMeses, useMesesRecolhidos } from "../components/MesesRecolhidos";
import { mensagemDeErro, relatoriosService, type CreditosDoMes, type CreditosDosMeses } from "../services/relatoriosService";

const pct2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percentual = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${pct2.format(v * 100)}%`);
// O que arredonda para zero sai sem o sinal ("0", e não "-0").
const reais = (v: number | null | undefined) => (v === null || v === undefined ? "—" : inteiro(Math.round(v) || 0));

/** Os dois créditos de cada mês, na ordem das colunas (04/11/2026, pedido do Adão; antes, os Creditados e os à Creditar, em %). */
const CREDITOS: Array<{ chave: "creditado" | "estornado"; rotulo: string }> = [
  { chave: "creditado", rotulo: "Creditado" },
  { chave: "estornado", rotulo: "Estornado" },
];
/** Os textos de um mês: de cada crédito, o R$ e o %. */
const doMes = (m: CreditosDoMes | undefined) => CREDITOS.flatMap((c) => [reais(m?.[c.chave].valor), percentual(m?.[c.chave].pct)]);

/** Uma linha da aba: o total, um grupo ou uma conta de uma unidade, com os créditos de cada mês. */
type Linha = { unidade: string; codigo: string; tipo: LinhaDosCreditos["tipo"]; descricao: string; grupo: string; meses: CreditosDoMes[] };

/** Em cada unidade, o total no alto e, embaixo, cada grupo com as contas dele (como os totais e as atribuições do Consolidado). */
const linhasDa = (u: CreditosDosMeses["unidades"][number]): Linha[] => [
  { unidade: u.nome, codigo: CODIGO_DO_TOTAL, tipo: "TOTAL", descricao: "Total", grupo: "", meses: u.total.meses },
  ...u.grupos.flatMap((g) => [
    { unidade: u.nome, codigo: g.codigo, tipo: "SUBTOTAL" as const, descricao: g.descricao, grupo: g.descricao, meses: g.meses },
    ...g.contas.map((c) => ({ unidade: u.nome, codigo: codigoNaTabela(g.codigo, c.codigo), tipo: "ITEM" as const, descricao: c.descricao, grupo: g.descricao, meses: c.meses })),
  ]),
];

const useImpostos = (ano: number, ate: number) => useQuery({ queryKey: ["relatorios", "impostos", ano, ate], queryFn: () => relatoriosService.impostos(ano, ate) });

/** O Exportar da aba (as tabelas das duas unidades, com todos os meses, em Excel ou PDF), no lugar do Exportar dos Resultados. */
export function ExportarImpostos({ ano, ate }: { ano: number; ate: number }) {
  const { data } = useImpostos(ano, ate);
  if (!data?.meses.length) return null;
  const colunas: ColunaExportavel<Linha>[] = [
    { chave: "unidade", rotulo: "Unidade", valor: (l) => l.unidade },
    { chave: "conta", rotulo: "Conta", valor: (l) => l.descricao },
    { chave: "grupo", rotulo: "Grupo", valor: (l) => l.grupo },
    ...data.meses.flatMap((m, i): ColunaExportavel<Linha>[] =>
      CREDITOS.flatMap((c): ColunaExportavel<Linha>[] => [
        {
          chave: `${c.chave}Valor${i}`,
          rotulo: `${m.rotulo} ${c.rotulo} (R$)`,
          tipo: "numero",
          moeda: true,
          valor: (l) => l.meses[i]?.[c.chave].valor ?? undefined,
          texto: (l) => reais(l.meses[i]?.[c.chave].valor),
        },
        { chave: `${c.chave}Pct${i}`, rotulo: `${m.rotulo} ${c.rotulo} (%)`, texto: (l) => percentual(l.meses[i]?.[c.chave].pct) },
      ]),
    ),
  ];
  return <ExportarTabela titulo={`Resultados ${ano} · Créditos de Impostos`} colunas={colunas} linhas={data.unidades.flatMap(linhasDa)} />;
}

/**
 * A aba Impostos (Créditos de Impostos) de Resultados Empresariais › Resultados (03/11/2026, pedido do Adão; de início,
 * Almoxarifado): desde 04/11/2026, uma tabela por unidade (Matriz e Filial), com o total, os grupos (Matérias Primas e Gastos
 * Gerais Variáveis, com o Frete e Descarga) e as contas deles, e o Creditado e o Estornado (em R$ e em %) de cada mês fechado do
 * exercício, até o mês escolhido (a aba Impostos dos Resultados do Fechamento Mensal); na tabela do Consolidado (`TabelaDosCreditos`), com
 * os meses anteriores recolhidos ou não, como nas demais tabelas de Resultados.
 */
export function VisaoImpostos({ ano, ate }: { ano: number; ate: number }) {
  const consulta = useImpostos(ano, ate);
  const [recolhido, alternarMeses] = useMesesRecolhidos();
  const dados = consulta.data;
  if (consulta.isError) return <p className="rounded-sm border border-red-200 bg-red-50 p-4 text-sm text-red-700">{mensagemDeErro(consulta.error, "Erro ao carregar os créditos de impostos.")}</p>;
  if (!dados) return <div className="h-64 animate-pulse rounded-sm bg-gray-100" />;
  if (!dados.meses.length) return <p className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">Nenhuma competência fechada no período.</p>;
  // Recolhidos, os meses anteriores saem e fica o último (o de referência).
  const indices = dados.meses.map((_, i) => i).filter((i) => !recolhido || i === dados.meses.length - 1);
  const grupos: GrupoDeColunas[] = indices.map((i) => ({
    chave: String(dados.meses[i].mes),
    rotulo: dados.meses[i].rotulo,
    colunas: CREDITOS.flatMap((c) => [
      // Numa linha só: "Creditado (R$)" e "%" (04/11/2026, pedido do Adão).
      { rotulo: `${c.rotulo} (R$)`, largura: 136 },
      { rotulo: "%", largura: 72, pct: true },
    ]),
  }));
  return (
    <div className="space-y-6">
      {dados.unidades.map((u) => (
        <TabelaDosCreditos
          key={u.codigo}
          titulo={u.nome}
          grupos={grupos}
          linhas={linhasDa(u).map((l) => ({ codigo: l.codigo, tipo: l.tipo, descricao: l.descricao, valores: indices.flatMap((i) => doMes(l.meses[i])) }))}
          chaveDoNivel="sig.impostos.nivel"
          botoes={dados.meses.length > 1 ? <BotaoMeses recolhido={recolhido} onAlternar={alternarMeses} /> : null}
        />
      ))}
    </div>
  );
}
