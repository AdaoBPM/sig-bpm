"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Abas } from "@/components/shared/Abas";
import { Button } from "@/components/ui/button";

import { formato, mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

import { cenariosService, type ItemJustificativa } from "../services/cenariosService";
import { botaoPrimario, Erro } from "./CenarioDialog";

const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const QUADRO = "rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white px-4 py-2 text-sm text-gray-700";
const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const percentual = (v: number) => `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

/**
 * A aba Justificativas da tela Reajustes (13/10/2026; antes, da tela Comparativo e, antes, uma tela própria): com um
 * cenário comparado (Configurações / Comparativo), as contas de cada aba da DRE com algum mês acima da variação
 * máxima do total delas, os meses e a justificativa de cada uma.
 */
export function JustificativasCenario({ id, podeEditar }: { id: string; podeEditar: boolean }) {
  const consulta = useQuery({ queryKey: ["cenarios", id, "justificativas"], queryFn: () => cenariosService.justificativas(id) });
  const [visao, setVisao] = useState("0");
  const [soPendentes, setSoPendentes] = useState(false);
  const dados = consulta.data;
  const atual = dados?.visoes.find((v) => String(v.visao) === visao);
  const itens = (atual?.itens ?? []).filter((i) => !soPendentes || !i.justificativa);
  const pendentes = (dados?.visoes ?? []).reduce((s, v) => s + v.itens.filter((i) => !i.justificativa).length, 0);
  return (
    <div className="space-y-6">
      {consulta.isError ? (
        <Erro erro={mensagemDeErro(consulta.error, "Erro ao carregar as justificativas.")} />
      ) : consulta.isPending ? (
        <div className="h-64 animate-pulse rounded-sm bg-gray-100" />
      ) : !dados?.comparadoCom ? (
        <p className={QUADRO}>
          O cenário não tem comparativo. Escolha um cenário para comparar em{" "}
          {podeEditar ? (
            <Link href={`/cenarios/sinteticos/${id}/configuracoes?aba=comparativo`} className="font-medium text-gray-900 underline underline-offset-2">
              Configurações / Comparativo
            </Link>
          ) : (
            "Configurações / Comparativo"
          )}
          .
        </p>
      ) : (
        <>
          <p className={QUADRO}>
            Comparado com <span className="font-bold text-gray-900">{dados.comparadoCom.nome}</span> ({dados.comparadoCom.ano}).{" "}
            {pendentes ? `${pendentes.toLocaleString("pt-BR")} conta(s) sem justificativa, somando as abas.` : "Todas as contas acima da variação estão justificadas."}
          </p>
          <Abas
            rotulo="Abas da DRE"
            ativa={visao}
            onMudar={setVisao}
            abas={dados.visoes.map((v) => ({ chave: String(v.visao), rotulo: v.nome, contagem: v.itens.length }))}
          />
          <div className="rounded-sm border border-gray-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-2.5 text-sm">
              <span className="text-gray-600">
                {atual?.itens.length ?? 0} conta(s) acima da variação em {atual?.nome}; {(atual?.itens ?? []).filter((i) => !i.justificativa).length} sem justificativa.
              </span>
              <label className="inline-flex items-center gap-2 text-gray-700">
                <input type="checkbox" className="accent-black" checked={soPendentes} onChange={(e) => setSoPendentes(e.target.checked)} />
                Só Sem Justificativa
              </label>
            </div>
            {itens.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500">
                {atual?.itens.length ? "Todas as contas desta aba estão justificadas." : "Nenhuma conta desta aba passa da variação máxima."}
              </p>
            ) : (
              <table className="tabela-sig w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="min-w-72 px-4 py-2.5 text-left text-xs font-bold text-gray-600">Conta</th>
                    <th className="w-24 px-4 py-2.5 text-right text-xs font-bold text-gray-600">Variação Máxima</th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-600">Meses Acima</th>
                    <th className="w-[28rem] px-4 py-2.5 text-left text-xs font-bold text-gray-600">Justificativa</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((i) => (
                    <Linha key={`${visao}|${i.codigo}|${i.justificativa?.texto ?? ""}`} id={id} visao={Number(visao)} item={i} podeEditar={podeEditar} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Linha({ id, visao, item, podeEditar }: { id: string; visao: number; item: ItemJustificativa; podeEditar: boolean }) {
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState(item.justificativa?.texto ?? "");
  const mudou = texto.trim() !== (item.justificativa?.texto ?? "");
  const gravar = useMutation({
    mutationFn: () => cenariosService.gravarJustificativa(id, visao, item.codigo, texto.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cenarios", id, "justificativas"] });
      toast.success(texto.trim() ? "Justificativa gravada." : "Justificativa apagada.");
    },
  });
  return (
    <tr className="border-b border-gray-100 align-top">
      <td className="px-4 py-2 text-sm">
        <span className={item.ehTotal ? "font-bold text-gray-900" : "text-gray-900"}>{item.descricao}</span>
        {item.ehTotal ? null : <span className="block text-xs text-gray-500">{item.total}</span>}
      </td>
      <td className="px-4 py-2 text-right text-sm whitespace-nowrap">{item.limite.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</td>
      <td className="px-4 py-2">
        <div className="flex max-w-md flex-wrap gap-1">
          {item.meses.map((m) => (
            <span
              key={m.mes}
              title={`${MESES[m.mes - 1]}: cenário ${formato.valor(m.valor)} · comparado ${formato.valor(m.comparado)}`}
              className="rounded-sm border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-xs whitespace-nowrap text-gray-700"
            >
              <span className="font-medium text-gray-900">{MESES[m.mes - 1]}</span> {m.variacao === null ? "sem base" : percentual(m.variacao)}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-2">
        {podeEditar ? (
          <div className="space-y-1.5">
            <textarea
              aria-label={`Justificativa de ${item.descricao}`}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={2000}
              rows={2}
              placeholder="Digite a justificativa"
              className="w-full rounded-sm border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-500">
                {item.justificativa ? `Por ${item.justificativa.usuarioNome} em ${dataHora(item.justificativa.atualizadoEm)}` : null}
              </span>
              {mudou ? (
                <Button type="button" size="sm" className={botaoPrimario} disabled={gravar.isPending} onClick={() => gravar.mutate()}>
                  {gravar.isPending ? "Gravando…" : "Gravar"}
                </Button>
              ) : null}
            </div>
            {gravar.isError ? <p className="text-xs text-red-700">{mensagemDeErro(gravar.error, "Não foi possível gravar a justificativa.")}</p> : null}
          </div>
        ) : item.justificativa ? (
          <p className="text-sm whitespace-pre-wrap text-gray-700">
            {item.justificativa.texto}
            <span className="block text-xs text-gray-500">
              Por {item.justificativa.usuarioNome} em {dataHora(item.justificativa.atualizadoEm)}
            </span>
          </p>
        ) : (
          <span className="text-sm text-gray-400">Sem justificativa</span>
        )}
      </td>
    </tr>
  );
}
