"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { TabelaResultados } from "@/app/relatorios/resultados/ResultadosContent";
import { mensagemDeErro, type LinhaResultado } from "@/app/relatorios/services/relatoriosService";

import { cenariosService } from "../services/cenariosService";
import { botaoPrimario, Erro } from "./CenarioDialog";
import { ReajusteDialog, ValorDialog } from "./EdicaoDialogs";

const Carregando = () => <div className="h-64 animate-pulse rounded-sm bg-gray-100" />;

/**
 * Uma aba da DRE do cenário. Nas unidades, as contas se editam: a caixa de cada linha e de cada mês marca valores, e
 * clicar numa linha reajusta os marcados; clicar num valor edita aquele valor. O Consolidado só soma as unidades.
 */
export function EdicaoDRE({ id, visao, nome }: { id: string; visao: number; nome: string }) {
  const queryClient = useQueryClient();
  const consulta = useQuery({ queryKey: ["cenarios", id, "edicao", visao], queryFn: () => cenariosService.edicao(id, visao) });
  const [linhas, setLinhas] = useState<Set<string>>(new Set());
  const [meses, setMeses] = useState<Set<number>>(new Set());
  const [reajuste, setReajuste] = useState<string | null>(null);
  const [valor, setValor] = useState<{ l: LinhaResultado; i: number } | null>(null);
  const gravar = useMutation({
    mutationFn: (alteracoes: Array<{ linha: string; mes: number; valor: number }>) => cenariosService.gravarValores(id, visao, alteracoes),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["cenarios", id] });
      // Se o cenário é o Orçamento Empresarial, o orçado de Resultados Realizados muda.
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
      toast.success(`${r.alteradas} valor(es) gravado(s); totais e Consolidado recalculados.`);
      setReajuste(null);
      setValor(null);
    },
  });
  if (consulta.isError) return <Erro erro={mensagemDeErro(consulta.error, "Erro ao carregar a DRE do cenário.")} />;
  if (consulta.isPending) return <Carregando />;
  const dados = consulta.data;
  const editaveis = new Set(dados.editaveis);
  const consolidado = visao === 0;
  const porCodigo = new Map(dados.linhas.map((l) => [l.codigo, l]));
  const marcados = [...linhas].filter((c) => editaveis.has(c) && porCodigo.has(c)).flatMap((c) =>
    [...meses].sort((a, b) => a - b).map((i) => ({ linha: c, mes: dados.meses[i].mes, atual: porCodigo.get(c)!.meses[i]?.valor ?? 0 })),
  );
  const erroGravar = gravar.isError ? mensagemDeErro(gravar.error, "Não foi possível gravar.") : null;
  const todosOsMeses = meses.size === dados.meses.length;

  return (
    <div className="space-y-3">
      {consolidado ? (
        <p className="rounded-sm border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600">
          O Consolidado soma as contas das unidades, e os totais saem da Estrutura da DRE: edite os valores nas abas Matriz, Filial, Serviços, Despesas +
          Extra e RN.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-sm border border-gray-200 bg-white px-4 py-2 text-sm">
          <span className="text-gray-700">
            <span className="font-bold text-gray-900">{marcados.length}</span> valor(es) marcado(s) · {linhas.size} conta(s) × {meses.size} mês(es)
          </span>
          <button type="button" className="text-xs font-medium text-gray-900 underline underline-offset-2" onClick={() => setMeses(todosOsMeses ? new Set() : new Set(dados.meses.map((_, i) => i)))}>
            {todosOsMeses ? "Desmarcar os Meses" : "Marcar Todos os Meses"}
          </button>
          {linhas.size || meses.size ? (
            <button
              type="button"
              className="text-xs font-medium text-gray-900 underline underline-offset-2"
              onClick={() => {
                setLinhas(new Set());
                setMeses(new Set());
              }}
            >
              Limpar Marcação
            </button>
          ) : null}
          <Button type="button" className={`${botaoPrimario} ml-auto`} disabled={marcados.length === 0} onClick={() => setReajuste(nome)}>
            Reajustar Marcados
          </Button>
        </div>
      )}
      <TabelaResultados
        key={visao}
        dados={dados}
        titulo={`Resultados · ${nome}`}
        visao={visao === 0 ? { consolidado: true } : { unidade: visao }}
        nomeVisao={nome}
        consultas={false}
        edicao={
          consolidado
            ? undefined
            : {
                editavel: (l) => editaveis.has(l.codigo),
                linhasMarcadas: linhas,
                mesesMarcados: meses,
                onMarcarLinhas: (codigos, marcar) =>
                  setLinhas((s) => {
                    const n = new Set(s);
                    for (const c of codigos) if (marcar) n.add(c);
                    else n.delete(c);
                    return n;
                  }),
                onMarcarMes: (i, marcar) =>
                  setMeses((s) => {
                    const n = new Set(s);
                    if (marcar) n.add(i);
                    else n.delete(i);
                    return n;
                  }),
                onCelula: (l, i) => setValor({ l, i }),
                onConta: (l) => setReajuste(`${nome} · ${l.descricao}`),
              }
        }
      />
      {reajuste !== null ? (
        <ReajusteDialog
          valores={marcados}
          rotulo={`${reajuste}. O reajuste vale para todas as contas e meses marcados.`}
          gravando={gravar.isPending}
          erro={erroGravar}
          onAplicar={(novos) => gravar.mutate(novos)}
          onFechar={() => {
            setReajuste(null);
            gravar.reset();
          }}
        />
      ) : null}
      {valor ? (
        <ValorDialog
          conta={`${nome} · ${valor.l.descricao}`}
          rotuloMes={dados.meses[valor.i].rotulo}
          mesesSeguintes={dados.meses.slice(valor.i + 1).map((m) => m.rotulo)}
          atual={valor.l.meses[valor.i]?.valor ?? 0}
          gravando={gravar.isPending}
          erro={erroGravar}
          onGravar={(v, replicar) =>
            gravar.mutate(dados.meses.slice(valor.i, replicar ? dados.meses.length : valor.i + 1).map((m) => ({ linha: valor.l.codigo, mes: m.mes, valor: v })))
          }
          onFechar={() => {
            setValor(null);
            gravar.reset();
          }}
        />
      ) : null}
    </div>
  );
}
