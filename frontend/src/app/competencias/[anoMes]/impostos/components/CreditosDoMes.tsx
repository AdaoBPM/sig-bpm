"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { type ColunaExportavel, ExportarTabela } from "@/components/shared/ExportarTabela";

import { mensagemDeErro } from "../../conferencia-planilha/services/conferenciaService";
import { inteiro, lerAnoMes, rotuloCompetencia } from "../../utils/formatacao";
import { codigoNaTabela, impostosService, type CreditosDaConta, type ImpostosDoMes } from "../services/impostosService";
import { CODIGO_DO_TOTAL, TabelaDosCreditos, type GrupoDeColunas, type LinhaDosCreditos } from "./TabelaDosCreditos";

const Destaque = ({ children }: { children: ReactNode }) => (
  <div className="rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white px-4 py-3 text-sm text-gray-700">{children}</div>
);

// O que arredonda para zero sai sem o sinal ("0", e não "-0"); os percentuais com duas casas (21,25%).
const reais = (v: number | null) => (v === null ? "—" : inteiro(Math.round(v) || 0));
const pct2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percentual = (v: number | null) => (v === null ? "—" : `${pct2.format(v * 100)}%`);

/** Os dois créditos, na ordem das colunas (04/11/2026, pedido do Adão; antes, os Impostos Creditáveis, Já Creditados e à Creditar). */
const CREDITOS: Array<{ chave: "creditado" | "estornado"; rotulo: string }> = [
  { chave: "creditado", rotulo: "Creditado" },
  { chave: "estornado", rotulo: "Estornado" },
];

/** Uma linha da tabela (e do Exportar): o total, o subtotal de um grupo ou uma conta, na unidade. */
type Linha = CreditosDaConta & { unidade: string; codigo: string; descricao: string; tipo: LinhaDosCreditos["tipo"] };

/** Em cada unidade, o total no alto e, embaixo, cada grupo com as contas dele (como os totais e as atribuições do Consolidado). */
function linhasDa(u: ImpostosDoMes["unidades"][number]): Linha[] {
  return [
    { ...u.total, unidade: u.nome, codigo: CODIGO_DO_TOTAL, descricao: "Total", tipo: "TOTAL" },
    ...u.grupos.flatMap((g) => [
      { ...g.total, unidade: u.nome, codigo: g.codigo, descricao: g.descricao, tipo: "SUBTOTAL" as const },
      ...g.contas.map((c) => ({ ...c, unidade: u.nome, codigo: codigoNaTabela(g.codigo, c.codigo), tipo: "ITEM" as const })),
    ]),
  ];
}

const COLUNAS: ColunaExportavel<Linha>[] = [
  { chave: "unidade", rotulo: "Unidade", valor: (l) => l.unidade },
  { chave: "conta", rotulo: "Conta", valor: (l) => l.descricao },
  { chave: "valor", rotulo: "Valor da Conta", tipo: "numero", moeda: true, valor: (l) => l.valor ?? undefined, texto: (l) => reais(l.valor) },
  ...CREDITOS.flatMap((c): ColunaExportavel<Linha>[] => [
    { chave: `${c.chave}Valor`, rotulo: `${c.rotulo} (R$)`, tipo: "numero", moeda: true, valor: (l) => l[c.chave].valor ?? undefined, texto: (l) => reais(l[c.chave].valor) },
    { chave: `${c.chave}Pct`, rotulo: `${c.rotulo} (%)`, texto: (l) => percentual(l[c.chave].pct) },
  ]),
];

/**
 * As colunas da tabela: o valor da conta e, do Creditado e do Estornado, o R$ e o %, numa linha só de rótulos ("Creditado
 * (R$)" e "%", 04/11/2026, pedido do Adão; antes, o nome do crédito em cima do R$ e do %).
 */
const GRUPOS: GrupoDeColunas[] = [
  { chave: "valor", rotulo: null, colunas: [{ rotulo: "Valor da Conta", largura: 128 }] },
  ...CREDITOS.map((c) => ({ chave: c.chave, rotulo: null, colunas: [{ rotulo: `${c.rotulo} (R$)`, largura: 136 }, { rotulo: "%", largura: 72, pct: true }] })),
];
const textos = (l: Linha) => [reais(l.valor), ...CREDITOS.flatMap((c) => [reais(l[c.chave].valor), percentual(l[c.chave].pct)])];

const useCreditosDoMes = (anoMes: string) =>
  useQuery({ queryKey: ["impostos-do-mes", anoMes], queryFn: () => impostosService.doMes(anoMes), enabled: lerAnoMes(anoMes) !== null });

/** O Exportar da aba Impostos: as duas tabelas, com a unidade de cada linha, em Excel ou PDF. */
export function ExportarCreditosDoMes({ anoMes }: { anoMes: string }) {
  const { data } = useCreditosDoMes(anoMes);
  const periodo = lerAnoMes(anoMes);
  if (!data || !periodo) return null;
  return <ExportarTabela titulo={`Créditos de Impostos · ${rotuloCompetencia(periodo.ano, periodo.mes)}`} colunas={COLUNAS} linhas={data.unidades.flatMap(linhasDa)} />;
}

/**
 * Os Créditos de Impostos do mês: a aba Impostos da tela Resultados do Fechamento Mensal (04/11/2026, pedido do Adão; de
 * 03/11/2026, a etapa Impostos). Uma tabela por unidade (Matriz e Filial), com as contas de Matérias Primas, de Gastos Gerais
 * Variáveis da Produção e o Frete e Descarga, o valor de cada uma na DRE apurada da unidade e o Creditado e o Estornado do mês
 * (a aba Impostos (Lista) importada), em R$ e em %.
 */
export function CreditosDoMes({ anoMes }: { anoMes: string }) {
  const consulta = useCreditosDoMes(anoMes);
  const dados = consulta.data;
  if (consulta.isError) {
    return (
      <div className="rounded-sm border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">{mensagemDeErro(consulta.error, "Erro ao carregar os créditos de impostos do mês.")}</p>
      </div>
    );
  }
  if (!dados) return <div className="h-64 animate-pulse rounded-sm bg-gray-100" />;
  return (
    <div className="space-y-6">
      {!dados.competencia.apurada ? <Destaque>A competência ainda não foi apurada: os valores das contas e os % saem da DRE apurada (Apurar Competência).</Destaque> : null}
      {!dados.temCreditos ? <Destaque>Sem os créditos de impostos neste mês: importe a aba Impostos (Lista) em Importações.</Destaque> : null}
      {dados.unidades.map((u) => (
        <TabelaDosCreditos
          key={u.nome}
          titulo={u.nome}
          grupos={GRUPOS}
          linhas={linhasDa(u).map((l) => ({ codigo: l.codigo, tipo: l.tipo, descricao: l.descricao, valores: textos(l) }))}
          chaveDoNivel="sig.impostos.nivel"
        />
      ))}
    </div>
  );
}
