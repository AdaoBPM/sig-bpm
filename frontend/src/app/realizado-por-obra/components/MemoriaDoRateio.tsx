"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { realizadoObraService, type MemoriaDoRateio as Memoria } from "../services/realizadoObraService";

const reais = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const numero = (v: number) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
/** A quantidade da base com a medida ("578,60 m³"); a receita bruta em reais. */
const quantidade = (v: number, medida: string) => (medida === "R$" ? reais(v) : `${numero(v)} ${medida}`);

/** Os subtotais agrupados que abrem a memória de cálculo: a Mão de Obra e os Gastos Gerais, Diretos e Indiretos. */
export const temMemoria = (l: { codigo: string; tipo: string }) => l.tipo === "SUBTOTAL" && /^[A-Z]+\.(MOD|MOI|GGD|GGI)\./.test(l.codigo);

/** Uma linha da conta: o sinal (÷, ×, =, +), o texto e o valor. */
function Passo({ sinal, texto, valor, forte }: { sinal: string; texto: ReactNode; valor: string; forte?: boolean }) {
  return (
    <div className={`grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-baseline gap-x-2 py-1 ${forte ? "font-bold text-gray-900" : "text-gray-700"}`}>
      <span className="text-center text-gray-500">{sinal}</span>
      <span>{texto}</span>
      <span className="text-right whitespace-nowrap">{valor}</span>
    </div>
  );
}

function Bloco({ b, m }: { b: Memoria["blocos"][number]; m: Memoria }) {
  const nome = m.descricao;
  const th = "px-3 py-2 text-right whitespace-nowrap";
  const td = "px-3 py-1.5 text-right whitespace-nowrap text-gray-700";
  return (
    <section className="rounded-sm border border-gray-200 bg-white">
      <header className="flex items-baseline justify-between gap-3 border-b border-gray-200 px-4 py-2.5">
        <h3 className="font-bold text-gray-900">
          {b.linha}
          {b.unidade ? <span className="font-normal text-gray-500"> · {b.unidade}</span> : null}
        </h3>
        <span className="font-bold whitespace-nowrap text-gray-900">{reais(b.total)}</span>
      </header>
      <div className="px-4 py-2 text-sm">
        {b.base ? (
          <>
            <Passo sinal="" texto={<>{nome} da linha, sem os centros de obra (o rateio da linha, da etapa Linhas)</>} valor={reais(b.rateado)} />
            <Passo
              sinal="÷"
              texto={
                <>
                  {b.base.nome} na linha, nas obras vendidas{b.base.doExercicio ? ` (no exercício até ${m.mes}: a linha não teve ${b.base.nome} no mês)` : ""}
                </>
              }
              valor={quantidade(b.base.total, b.base.medida)}
            />
            <Passo sinal="=" texto={<>R$ por {b.base.medida === "R$" ? "real de receita" : b.base.medida}</>} valor={b.base.total ? reais(b.rateado / b.base.total) : "—"} />
            <Passo sinal="×" texto={<>{b.base.nome} da obra na linha</>} valor={quantidade(b.base.daVenda, b.base.medida)} />
            <Passo sinal="=" texto="Parte da obra no rateio da linha" valor={reais(b.calculado)} forte />
          </>
        ) : b.unidade ? (
          <p className="py-1 text-gray-600">A linha não teve base no mês nem no exercício: o rateio dela ficou Sem Obra.</p>
        ) : (
          <p className="py-1 text-gray-600">Lançamentos dos centros da obra que não foram a nenhuma linha (a Sem Linha não tem rateio entre as obras).</p>
        )}
        <Passo sinal="+" texto="Lançamentos dos centros da obra que foram à linha (o direto)" valor={reais(b.direto)} />
        <Passo sinal="=" texto={<>{nome} da obra na linha</>} valor={reais(b.total)} forte />
        {!b.confere ? (
          <p className="mt-1 rounded-sm border border-yellow-200 bg-yellow-50 px-3 py-2 text-yellow-800">
            As listas mudaram depois da gravação das obras: a conta com as listas de hoje dá {reais(b.calculado)}, e vale o gravado na etapa Linhas, {reais(b.rateio)}.
          </p>
        ) : null}
      </div>
      {b.contas.length ? (
        <div className="overflow-x-auto border-t border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-bpm-primary text-xs font-bold text-black uppercase">
                <th className="px-3 py-2 text-left whitespace-nowrap">Conta</th>
                <th className={th}>Custo da Linha</th>
                <th className={th}>Parte da Obra</th>
                <th className={th}>Direto</th>
                <th className={th}>Total</th>
              </tr>
            </thead>
            <tbody>
              {b.contas.map((c) => (
                <tr key={c.codigo} className="border-t border-gray-100">
                  <td className="px-3 py-1.5 whitespace-nowrap text-gray-700">{c.descricao}</td>
                  <td className={td}>{reais(c.rateado)}</td>
                  <td className={td}>{reais(c.rateio)}</td>
                  <td className={td}>{reais(c.direto)}</td>
                  <td className={td}>{reais(c.rateio + c.direto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

/**
 * A Memória de Cálculo de um subtotal agrupado dos Resultados do Realizado por Obra (03/11/2026, pedido do Adão: a Mão de Obra
 * e os Gastos Gerais, Diretos e Indiretos): em cada linha da venda, o custo da linha sem os centros de obra, dividido pela base
 * da linha e multiplicado pela base da obra, mais os lançamentos dos centros da obra que foram à linha; e por conta.
 */
export function MemoriaDoRateio({ mes, rotuloMes, aba, codigo, onFechar }: { mes: number; rotuloMes: string; aba: string; codigo: string; onFechar: () => void }) {
  const consulta = useQuery({ queryKey: ["realizado-obra", "memoria", mes, aba, codigo], queryFn: () => realizadoObraService.memoria(mes, aba, codigo) });
  const m = consulta.data;
  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-sm sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            Memória de Cálculo · {m ? `${m.descricao} · ${m.aba}` : "Carregando"} · {rotuloMes}
            {m ? <span className="ml-2 text-gray-600">{reais(m.total)}</span> : null}
          </DialogTitle>
          <DialogDescription>
            {m ? `${m.venda.codigo} · ${m.venda.nome}. ` : ""}Em cada linha, o custo dela sem os centros de obra, dividido pela base da linha nas obras vendidas
            e multiplicado pela base da obra, mais os lançamentos dos centros da obra que foram à linha.
          </DialogDescription>
        </DialogHeader>
        {consulta.isError ? <p className="text-sm text-red-700">{mensagemDeErro(consulta.error, "Erro ao carregar a memória de cálculo.")}</p> : null}
        {consulta.isPending ? <div className="h-40 animate-pulse rounded-sm bg-gray-100" /> : null}
        {m ? (
          <div className="space-y-3">
            {m.blocos.length ? m.blocos.map((b) => <Bloco key={b.linha} b={b} m={m} />) : <p className="text-sm text-gray-600">A obra não tem {m.descricao} no mês.</p>}
            {m.blocos.length > 1 ? (
              <div className="flex items-baseline justify-between rounded-sm border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-bold text-gray-900">
                <span>
                  {m.descricao} da obra no {m.aba} (a soma das linhas)
                </span>
                <span className="whitespace-nowrap">{reais(m.total)}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
