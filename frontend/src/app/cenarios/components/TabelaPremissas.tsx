"use client";

import { Fragment, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { BarraDeRolagem } from "@/components/shared/BarraDeRolagem";
import { Button } from "@/components/ui/button";

import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

import { cenariosService, type LinhaDaPremissa, type OrigemDaGravacao, type PremissasDaUnidade, type TabelaDePremissas } from "../services/cenariosService";
import { botaoPrimario } from "./CenarioDialog";
import { ReajusteDialog, ValorDialog } from "./EdicaoDialogs";

/** As larguras das colunas (a premissa, a unidade, a Média de Referência e os meses): as mesmas nos rótulos e no corpo. */
const LARGURA = { premissa: 340, und: 92, referencia: 116, mes: 104 };

/** Os botões da barra de marcação, como os da edição da DRE dos sintéticos. */
const botaoCinza = "rounded-sm border border-gray-200 bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-900 hover:bg-gray-200";

/** O número como a tabela mostra: as casas da linha (os valores em R$ do resultado, sem casas). */
function formatar(v: number | null, l: Pick<LinhaDaPremissa, "casas" | "und">) {
  if (v === null || v === undefined) return "—";
  const casas = l.und === "R$" ? 0 : l.casas;
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** A caixa de marcar, com o estado "alguns" (indeterminado) dos subtítulos. */
function Caixa({ marcada, alguns, rotulo, onMudar }: { marcada: boolean; alguns?: boolean; rotulo: string; onMudar: (marcar: boolean) => void }) {
  return (
    <input
      type="checkbox"
      aria-label={rotulo}
      className="size-3.5 shrink-0 cursor-pointer accent-black"
      checked={marcada}
      ref={(el) => {
        if (el) el.indeterminate = !!alguns && !marcada;
      }}
      onChange={(e) => onMudar(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

/**
 * Uma tabela das premissas (13/10/2026): uma unidade numa venda (Matriz · Global, Matriz · Mercantil…). As linhas vêm em
 * seções (Jornada, Ajustes, Produção e Serviços, Receita Operacional, Custos, Despesas Variáveis de Venda e o Resultado
 * das Premissas), com o subtítulo de cada linha de produto ou de obra; depois da descrição, a unidade, a Média de
 * Referência e os doze meses. As premissas se editam como a DRE dos sintéticos: clicar num valor edita aquele mês (com
 * a chave de replicar aos meses seguintes); as caixas das linhas e dos meses marcam valores, e "Reajustar Marcados"
 * aplica um reajuste (percentual ou absoluto) a todos. Os cálculos (volumes, receita líquida média, resultado) não se
 * editam. O valor em cinza é o padrão (os dias úteis do calendário, ou zero), ainda não gravado.
 */
export function TabelaPremissas({ id, dados, tabela, editavel }: { id: string; dados: PremissasDaUnidade; tabela: TabelaDePremissas; editavel: boolean }) {
  return (
    <TabelaEditavel
      titulo={`${dados.nome} · ${tabela.titulo}`}
      meses={dados.meses}
      linhas={tabela.linhas}
      editavel={editavel}
      aoGravar={(alteracoes, origem) =>
        cenariosService.gravarPremissas(
          id,
          dados.unidade,
          alteracoes.map((a) => ({ venda: tabela.venda, chave: a.linha, mes: a.mes, valor: a.valor })),
          origem,
        )
      }
      mensagem={(n) => `${n} premissa(s) gravada(s); a DRE do cenário foi recalculada.`}
    />
  );
}

/**
 * A tabela editável mês a mês (13/10/2026): as premissas de uma unidade e venda e as contas de um centro de custo. As
 * linhas vêm em seções, com subtítulos; depois da descrição, a unidade, a Média de Referência (`comReferencia`) e os
 * meses. Clicar num valor edita aquele mês (com a chave de replicar aos meses seguintes); as caixas das linhas e dos
 * meses marcam valores, e "Reajustar Marcados" aplica um reajuste a todos. As linhas de cálculo não se editam.
 */
export function TabelaEditavel({
  titulo,
  subtitulo,
  meses: mesesDaTabela,
  linhas: linhasDaTabela,
  editavel,
  aoGravar,
  mensagem,
  comReferencia = true,
  item = "premissa(s)",
  cabecalho = "PREMISSA",
}: {
  titulo: string;
  subtitulo?: React.ReactNode;
  meses: Array<{ mes: number; rotulo: string }>;
  linhas: LinhaDaPremissa[];
  editavel: boolean;
  aoGravar?: (alteracoes: Array<{ linha: string; mes: number; valor: number }>, origem: OrigemDaGravacao) => Promise<{ alteradas: number }>;
  mensagem?: (alteradas: number) => string;
  comReferencia?: boolean;
  /** O que se marca, na barra ("premissa(s)", "conta(s)"). */
  item?: string;
  /** O rótulo da primeira coluna. */
  cabecalho?: string;
}) {
  const queryClient = useQueryClient();
  const [linhas, setLinhas] = useState<Set<string>>(new Set());
  const [meses, setMeses] = useState<Set<number>>(new Set());
  const [reajuste, setReajuste] = useState(false);
  const [valor, setValor] = useState<{ l: LinhaDaPremissa; i: number } | null>(null);
  const gravar = useMutation({
    mutationFn: ({ alteracoes, origem }: { alteracoes: Array<{ linha: string; mes: number; valor: number }>; origem: OrigemDaGravacao }) => aoGravar!(alteracoes, origem),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["cenarios"] });
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
      toast.success(mensagem ? mensagem(r.alteradas) : `${r.alteradas} valor(es) gravado(s).`);
      setReajuste(false);
      setValor(null);
    },
  });
  const porChave = new Map(linhasDaTabela.map((l) => [l.chave, l]));
  const premissas = linhasDaTabela.filter((l) => l.tipo === "PREMISSA");
  const marcados = [...linhas]
    .filter((c) => porChave.get(c)?.tipo === "PREMISSA")
    .flatMap((c) => [...meses].sort((a, b) => a - b).map((i) => ({ linha: c, mes: mesesDaTabela[i].mes, atual: porChave.get(c)!.valores[i] ?? 0 })));
  const marcarLinhas = (chaves: string[], marcar: boolean) =>
    setLinhas((s) => {
      const n = new Set(s);
      for (const c of chaves) if (marcar) n.add(c);
      else n.delete(c);
      return n;
    });
  const todosOsMeses = meses.size === mesesDaTabela.length;
  const erroGravar = gravar.isError ? mensagemDeErro(gravar.error, "Não foi possível gravar.") : null;
  const colunas = (comReferencia ? 3 : 2) + mesesDaTabela.length;
  // Como a tabela de Indicadores: os rótulos ficam presos logo abaixo do título da tela, numa tabela própria que acompanha
  // a rolagem lateral do corpo, e a barra de rolagem fica no pé da janela.
  const topo = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const total = LARGURA.premissa + LARGURA.und + (comReferencia ? LARGURA.referencia : 0) + LARGURA.mes * mesesDaTabela.length;
  const colgroup = (
    <colgroup>
      <col style={{ width: LARGURA.premissa }} />
      <col style={{ width: LARGURA.und }} />
      {comReferencia ? <col style={{ width: LARGURA.referencia }} /> : null}
      {mesesDaTabela.map((m) => (
        <col key={m.mes} style={{ width: LARGURA.mes }} />
      ))}
    </colgroup>
  );

  // As linhas da tabela com os títulos das seções e os subtítulos das linhas de produto.
  const corpo: React.ReactNode[] = [];
  let secao = "";
  let grupo: string | null = null;
  for (const l of linhasDaTabela) {
    if (l.secao !== secao) {
      secao = l.secao;
      grupo = null;
      const daSecao = premissas.filter((p) => p.secao === secao).map((p) => p.chave);
      const marcadas = daSecao.filter((c) => linhas.has(c)).length;
      corpo.push(
        <tr key={`s-${secao}`} className="border-y border-gray-300">
          <td colSpan={colunas} className="bg-yellow-100 px-3 py-2 text-sm font-bold tracking-wide text-gray-900 uppercase">
            <span className="sticky left-3 inline-flex items-center gap-2">
              {editavel && daSecao.length ? (
                <Caixa marcada={marcadas === daSecao.length} alguns={marcadas > 0} rotulo={`Marcar ${secao}`} onMudar={(m) => marcarLinhas(daSecao, m)} />
              ) : null}
              {secao}
            </span>
          </td>
        </tr>,
      );
    }
    if (l.grupo && l.grupo !== grupo) {
      grupo = l.grupo;
      const g = grupo;
      const doGrupo = premissas.filter((p) => p.secao === secao && p.grupo === g).map((p) => p.chave);
      const marcadas = doGrupo.filter((c) => linhas.has(c)).length;
      corpo.push(
        <tr key={`g-${secao}-${g}`} className="border-t border-gray-200 bg-gray-50">
          <td className="sticky left-0 z-10 bg-gray-50 py-1.5 pr-3 pl-4 text-sm font-bold text-gray-900">
            <span className="inline-flex items-center gap-2">
              {editavel && doGrupo.length ? <Caixa marcada={marcadas === doGrupo.length} alguns={marcadas > 0} rotulo={`Marcar ${g}`} onMudar={(m) => marcarLinhas(doGrupo, m)} /> : null}
              {g}
            </span>
          </td>
          <td colSpan={colunas - 1} />
        </tr>,
      );
    }
    const ePremissa = l.tipo === "PREMISSA";
    const marcada = linhas.has(l.chave);
    corpo.push(
      <tr key={l.chave} className="border-t border-gray-100">
        <td className={`sticky left-0 z-10 bg-white py-1.5 pr-3 text-sm ${l.grupo ? "pl-9" : "pl-4"} ${ePremissa ? "text-gray-900" : "text-gray-600"} ${l.tipo === "CALCULO" && l.und === "R$" ? "font-bold" : ""}`}>
          <span className="inline-flex items-center gap-2">
            {editavel && ePremissa ? <Caixa marcada={marcada} rotulo={`Marcar ${l.rotulo}`} onMudar={(m) => marcarLinhas([l.chave], m)} /> : editavel ? <span className="size-3.5 shrink-0" aria-hidden /> : null}
            {l.rotulo}
          </span>
        </td>
        <td className="px-3 py-1.5 text-xs whitespace-nowrap text-gray-500">{l.und}</td>
        {comReferencia ? <td className="border-r border-gray-300 bg-gray-50 px-3 py-1.5 text-right text-sm whitespace-nowrap text-gray-700">{formatar(l.referencia, l)}</td> : null}
        {l.valores.map((v, i) => {
          const contornado = ePremissa && marcada && meses.has(i);
          const classe = `px-3 py-1.5 text-right text-sm whitespace-nowrap ${contornado ? "outline outline-1 -outline-offset-1 outline-gray-900" : ""} ${
            ePremissa ? (l.gravados[i] ? "text-gray-900" : "text-gray-400") : l.tipo === "CALCULO" && l.und === "R$" ? "font-bold text-gray-900" : "text-gray-600"
          }`;
          return editavel && ePremissa ? (
            <td key={i} className={`${classe} cursor-pointer hover:bg-gray-100`} title={l.gravados[i] ? "Editar o valor" : "Valor padrão; clique para editar"} onClick={() => setValor({ l, i })}>
              {formatar(v, l)}
            </td>
          ) : (
            <td key={i} className={classe}>
              {formatar(v, l)}
            </td>
          );
        })}
      </tr>,
    );
  }

  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-base font-bold tracking-wide text-gray-900 uppercase">{titulo}</h2>
        {subtitulo ? <p className="text-xs text-gray-600">{subtitulo}</p> : null}
      </div>
      {editavel ? (
        <div className="flex flex-wrap items-center gap-3 rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white px-4 py-2 text-sm">
          <span className="text-gray-700">
            <span className="font-bold text-gray-900">{marcados.length}</span> valor(es) marcado(s) · {linhas.size} {item} × {meses.size} mês(es)
          </span>
          <button type="button" className={botaoCinza} onClick={() => setMeses(todosOsMeses ? new Set() : new Set(mesesDaTabela.map((_, i) => i)))}>
            {todosOsMeses ? "Desmarcar os Meses" : "Marcar Todos os Meses"}
          </button>
          {linhas.size || meses.size ? (
            <button
              type="button"
              className={botaoCinza}
              onClick={() => {
                setLinhas(new Set());
                setMeses(new Set());
              }}
            >
              Limpar Seleção
            </button>
          ) : null}
          <Button type="button" className={`${botaoPrimario} ml-auto`} disabled={marcados.length === 0} onClick={() => setReajuste(true)}>
            Reajustar Marcados
          </Button>
        </div>
      ) : null}
      <div className="rounded-sm border border-gray-200 bg-white">
        <div ref={topo} className="sticky top-[var(--topo-tabela,0px)] z-30 overflow-hidden">
        <table className="tabela-sig table-fixed border-collapse [--topo-tabela:0px]" style={{ width: total, minWidth: "100%" }}>
          {colgroup}
          <thead>
            <tr className="border-b border-gray-300">
              <th className="sticky left-0 z-20 px-4 py-2 text-left text-xs font-bold">{cabecalho}</th>
              <th className="px-3 py-2 text-left text-xs font-bold">Und.</th>
              {comReferencia ? (
                <th className="border-r border-gray-300 px-3 py-2 text-right text-xs font-bold whitespace-nowrap" title="As médias do realizado da referência do cenário">
                  Média de Ref.
                </th>
              ) : null}
              {mesesDaTabela.map((m, i) => (
                <th key={m.mes} className="px-3 py-2 text-right text-xs font-bold whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">
                    {editavel ? (
                      <Caixa
                        marcada={meses.has(i)}
                        rotulo={`Marcar ${m.rotulo}`}
                        onMudar={(marcar) =>
                          setMeses((s) => {
                            const n = new Set(s);
                            if (marcar) n.add(i);
                            else n.delete(i);
                            return n;
                          })
                        }
                      />
                    ) : null}
                    {m.rotulo}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
        </table>
        </div>
        <div
          ref={area}
          className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(e) => {
            if (topo.current && topo.current.scrollLeft !== e.currentTarget.scrollLeft) topo.current.scrollLeft = e.currentTarget.scrollLeft;
          }}
        >
        <table className="tabela-sig table-fixed border-collapse" style={{ width: total, minWidth: "100%" }}>
          {colgroup}
          <tbody>
            {corpo.map((r, k) => (
              <Fragment key={k}>{r}</Fragment>
            ))}
          </tbody>
        </table>
        </div>
        <BarraDeRolagem area={area} />
      </div>
      {reajuste ? (
        <ReajusteDialog
          valores={marcados}
          rotulo={`${titulo}. O reajuste vale para todos os valores marcados.`}
          gravando={gravar.isPending}
          erro={erroGravar}
          onAplicar={(novos, r) => gravar.mutate({ alteracoes: novos, origem: { tipo: "MARCADOS", modo: r.modo, reajuste: r.valor, replicado: false } })}
          onFechar={() => {
            setReajuste(false);
            gravar.reset();
          }}
        />
      ) : null}
      {valor ? (
        <ValorDialog
          conta={[titulo, valor.l.grupo, valor.l.rotulo].filter(Boolean).join(" · ") + ` (${valor.l.und})`}
          rotuloMes={mesesDaTabela[valor.i].rotulo}
          mesesSeguintes={mesesDaTabela.slice(valor.i + 1).map((m) => m.rotulo)}
          atual={valor.l.valores[valor.i] ?? 0}
          gravando={gravar.isPending}
          erro={erroGravar}
          onGravar={(v, replicar, r) =>
            gravar.mutate({
              alteracoes: mesesDaTabela.slice(valor.i, replicar ? mesesDaTabela.length : valor.i + 1).map((m) => ({ linha: valor.l.chave, mes: m.mes, valor: v })),
              origem: { tipo: "VALOR", modo: r ? r.modo : "DIGITADO", reajuste: r ? r.valor : null, replicado: replicar },
            })
          }
          onFechar={() => {
            setValor(null);
            gravar.reset();
          }}
        />
      ) : null}
    </section>
  );
}
