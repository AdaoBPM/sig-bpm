"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

import { cenariosService, type DadosDoInvestimento, type InvestimentoDoCenario, type InvestimentosDoCenario as Dados } from "../services/cenariosService";
import { botaoPrimario, classeSelect, Erro } from "./CenarioDialog";
import { lerNumero } from "./EdicaoDialogs";
import { TabelaEditavel } from "./TabelaPremissas";
import { plural } from "@/lib/texto";

const Carregando = () => <div className="h-64 animate-pulse rounded-sm bg-gray-100" />;
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const reais = (v: number | null) => (v === null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const paraCampo = (v: number | null | undefined) => (v === null || v === undefined ? "" : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }));
const NOME_DA_UNIDADE: Record<number, string> = { 1: "Matriz", 2: "Filial", 3: "Serviços", 4: "Despesas e Extra" };

/** A confirmação do Excluir Selecionados (15/10/2026): a lista dos marcados e a soma do valor total; recalcula a DRE. */
function ExcluirInvestimentosDialog({ id, investimentos, onFechar }: { id: string; investimentos: InvestimentoDoCenario[]; onFechar: (excluiu: boolean) => void }) {
  const queryClient = useQueryClient();
  const excluir = useMutation({
    mutationFn: () => cenariosService.excluirInvestimentos(id, investimentos.map((i) => i.id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cenarios"] });
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
      toast.success(`${investimentos.length} ${plural(investimentos.length, "investimento excluído", "investimentos excluídos")}; a DRE do cenário foi recalculada.`);
      onFechar(true);
    },
  });
  const total = investimentos.reduce((s, i) => s + i.valorTotal, 0);
  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar(false) : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-sm sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Excluir Investimentos Selecionados</DialogTitle>
          <DialogDescription>
            {investimentos.length} {plural(investimentos.length, "investimento", "investimentos")}, com o valor total de {reais(total)}. A depreciação {plural(investimentos.length, "dele", "deles")} sai da DRE do
            cenário, que se recalcula, e a exclusão fica no histórico (tela Reajustes).
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
          {investimentos.map((i) => (
            <li key={i.id}>
              {i.nomeReferencia} <span className="text-gray-500">· {i.descricao} · {NOME_DA_UNIDADE[i.unidade]} · {reais(i.valorTotal)}</span>
            </li>
          ))}
        </ul>
        <Erro erro={excluir.isError ? mensagemDeErro(excluir.error, "Não foi possível excluir.") : null} />
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-sm" onClick={() => onFechar(false)}>
            Cancelar
          </Button>
          <Button type="button" variant="outline" className="rounded-sm border-red-300 text-red-700 hover:bg-red-50" disabled={excluir.isPending} onClick={() => excluir.mutate()}>
            <Trash2 className="size-4" />
            {excluir.isPending ? "Excluindo…" : "Excluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A aba Investimentos das premissas de um cenário analítico (13/10/2026): em cima, a Depreciação Base de cada unidade
 * mês a mês (digitada, com a replicação e o reajuste das premissas), com a depreciação dos investimentos e a total; embaixo,
 * a lista dos investimentos (Novo Investimento; clicar numa linha edita ou exclui), com a depreciação mensal e o ROI. As
 * caixas da lista (15/10/2026) marcam os investimentos, e "Excluir Selecionados" exclui os marcados de uma vez. Cada
 * investimento tem o Nome de Referência, único no cenário, que o identifica na planilha das premissas.
 */
export function InvestimentosDoCenario({ id, editavel }: { id: string; editavel: boolean }) {
  const consulta = useQuery({ queryKey: ["cenarios", id, "investimentos"], queryFn: () => cenariosService.investimentos(id) });
  const [aberto, setAberto] = useState<InvestimentoDoCenario | "novo" | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set());
  const [excluindo, setExcluindo] = useState(false);
  if (consulta.isError) return <Erro erro={mensagemDeErro(consulta.error, "Erro ao carregar os investimentos.")} />;
  if (consulta.isPending) return <Carregando />;
  const dados = consulta.data;
  const pode = editavel && dados.editavel;
  // Só os marcados que ainda estão na lista.
  const selecionados = dados.investimentos.filter((i) => marcados.has(i.id));
  const todos = dados.investimentos.length > 0 && selecionados.length === dados.investimentos.length;
  const marcar = (ids: string[], marca: boolean) =>
    setMarcados((atual) => {
      const novo = new Set(atual);
      for (const x of ids) {
        if (marca) novo.add(x);
        else novo.delete(x);
      }
      return novo;
    });
  return (
    <div className="space-y-8">
      <TabelaEditavel
        titulo="Depreciação"
        subtitulo="A Depreciação Base de cada unidade (digitada) e, somada a ela, a dos investimentos da lista abaixo, a partir do início de cada um."
        meses={dados.meses}
        linhas={dados.depreciacao}
        editavel={pode}
        item={["conta", "contas"]}
        cabecalho="CONTA"
        aoGravar={(alteracoes, origem) => cenariosService.gravarMensais(id, "BASE", alteracoes, origem)}
        mensagem={(n) => `${n} ${plural(n, "valor", "valores")} da depreciação base ${plural(n, "gravado", "gravados")}; a DRE do cenário foi recalculada.`}
      />
      <section className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-bold tracking-wide text-gray-900 uppercase">Investimentos</h2>
            <p className="text-xs text-gray-600">
              Depreciação Mensal = (Valor Total − Valor Pós Uso) ÷ Vida Útil, a partir do Início; ROI = (Receita Bruta Prevista − Valor Total) ÷ Valor Total ×
              100.
            </p>
          </div>
          {pode ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" className={botaoPrimario} onClick={() => setAberto("novo")}>
                <Plus className="size-4" />
                Novo Investimento
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-sm border-red-300 text-red-700 hover:bg-red-50"
                disabled={!selecionados.length}
                title={selecionados.length ? undefined : "Marque os investimentos na lista"}
                onClick={() => setExcluindo(true)}
              >
                <Trash2 className="size-4" />
                Excluir Selecionados
              </Button>
            </div>
          ) : null}
        </div>
        <div className="overflow-x-auto rounded-sm border border-gray-200 bg-white [--topo-tabela:0px]">
          <table className="tabela-sig w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                {pode ? (
                  <th className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label="Marcar todos os investimentos"
                      className="accent-black"
                      checked={todos}
                      disabled={!dados.investimentos.length}
                      ref={(el) => {
                        if (el) el.indeterminate = selecionados.length > 0 && !todos;
                      }}
                      onChange={() => marcar(dados.investimentos.map((i) => i.id), !todos)}
                    />
                  </th>
                ) : null}
                {["Nome de Referência", "Unidade", "Conta", "Descrição", "Ganho Previsto", "Receita Bruta Prevista", "Início", "Valor Total", "Valor Pós Uso", "Vida Útil", "Depreciação Mensal", "ROI"].map((c, k) => (
                  <th key={c} className={`px-3 py-2 text-xs font-bold ${k >= 5 ? "text-right" : "text-left"}`}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dados.investimentos.length === 0 ? (
                <tr>
                  <td colSpan={pode ? 13 : 12} className="px-3 py-6 text-center text-gray-500">
                    Nenhum investimento no cenário.
                  </td>
                </tr>
              ) : (
                dados.investimentos.map((i) => (
                  <tr
                    key={i.id}
                    className={`border-t border-gray-100 ${pode ? "cursor-pointer hover:bg-gray-100" : ""}`}
                    onClick={pode ? () => setAberto(i) : undefined}
                    title={pode ? "Editar ou excluir o investimento" : undefined}
                  >
                    {pode ? (
                      // A caixa marca sem abrir a edição (o clique na linha abre).
                      <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" aria-label={`Marcar ${i.nomeReferencia}`} className="accent-black" checked={marcados.has(i.id)} onChange={(e) => marcar([i.id], e.target.checked)} />
                      </td>
                    ) : null}
                    <td className="px-3 py-1.5 font-medium whitespace-nowrap text-gray-900">{i.nomeReferencia}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{NOME_DA_UNIDADE[i.unidade]}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{dados.contas.find((c) => c.unidade === i.unidade)?.rotulo}</td>
                    <td className="px-3 py-1.5 text-gray-900">{i.descricao}</td>
                    <td className="px-3 py-1.5 text-gray-600">{i.ganhoPrevisto ?? "—"}</td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">{reais(i.receitaBrutaPrevista)}</td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">{MESES[i.inicio - 1]}</td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">{reais(i.valorTotal)}</td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">{reais(i.valorPosUso)}</td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">{i.vidaUtil} meses</td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">{reais(i.depreciacaoMensal)}</td>
                    <td className="px-3 py-1.5 text-right font-bold whitespace-nowrap">{i.roi === null ? "—" : `${i.roi.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      {aberto ? <InvestimentoDialog id={id} dados={dados} investimento={aberto === "novo" ? null : aberto} onFechar={() => setAberto(null)} /> : null}
      {excluindo ? (
        <ExcluirInvestimentosDialog
          id={id}
          investimentos={selecionados}
          onFechar={(excluiu) => {
            setExcluindo(false);
            if (excluiu) setMarcados(new Set());
          }}
        />
      ) : null}
    </div>
  );
}

/** O formulário de um investimento (novo ou existente, com Excluir), com a depreciação mensal e o ROI calculados enquanto se digita. */
function InvestimentoDialog({ id, dados, investimento, onFechar }: { id: string; dados: Dados; investimento: InvestimentoDoCenario | null; onFechar: () => void }) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState(investimento?.nomeReferencia ?? "");
  const [unidade, setUnidade] = useState<number>(investimento?.unidade ?? 1);
  const [descricao, setDescricao] = useState(investimento?.descricao ?? "");
  const [ganho, setGanho] = useState(investimento?.ganhoPrevisto ?? "");
  const [receita, setReceita] = useState(paraCampo(investimento?.receitaBrutaPrevista));
  const [inicio, setInicio] = useState(investimento?.inicio ?? 1);
  const [total, setTotal] = useState(paraCampo(investimento?.valorTotal));
  const [posUso, setPosUso] = useState(paraCampo(investimento?.valorPosUso ?? 0));
  const [vida, setVida] = useState(investimento ? String(investimento.vidaUtil) : "");
  const [excluir, setExcluir] = useState(false);
  const n = { receita: lerNumero(receita), total: lerNumero(total), posUso: lerNumero(posUso), vida: lerNumero(vida) };
  const valido =
    !!nome.trim() && !!descricao.trim() && typeof n.total === "number" && n.total > 0 && (n.posUso === null || (typeof n.posUso === "number" && n.posUso >= 0)) && typeof n.vida === "number" && n.vida >= 1 && Number.isInteger(n.vida) && n.receita !== undefined;
  const mensal = typeof n.total === "number" && typeof n.vida === "number" && n.vida > 0 ? (n.total - (n.posUso ?? 0)) / n.vida : null;
  const roi = typeof n.total === "number" && n.total > 0 && typeof n.receita === "number" ? ((n.receita - n.total) / n.total) * 100 : null;
  const gravar = useMutation({
    mutationFn: (apagar: boolean) => {
      if (apagar) return cenariosService.excluirInvestimento(id, investimento!.id);
      const d: DadosDoInvestimento = {
        nomeReferencia: nome.trim(),
        unidade: unidade as 1 | 2 | 3 | 4,
        descricao: descricao.trim(),
        ganhoPrevisto: ganho.trim() || null,
        receitaBrutaPrevista: typeof n.receita === "number" ? n.receita : null,
        inicio,
        valorTotal: n.total as number,
        valorPosUso: (n.posUso as number | null) ?? 0,
        vidaUtil: n.vida as number,
      };
      return investimento ? cenariosService.alterarInvestimento(id, investimento.id, d) : cenariosService.criarInvestimento(id, d);
    },
    onSuccess: (_, apagar) => {
      queryClient.invalidateQueries({ queryKey: ["cenarios"] });
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
      toast.success(apagar ? "Investimento excluído; a DRE do cenário foi recalculada." : investimento ? "Investimento alterado; a DRE do cenário foi recalculada." : "Investimento incluído; a DRE do cenário foi recalculada.");
      onFechar();
    },
  });
  const campo = (rotulo: string, idCampo: string, valor: string, mudar: (v: string) => void, extra?: { placeholder?: string; numero?: boolean; invalido?: boolean }) => (
    <div className="space-y-1.5">
      <Label htmlFor={idCampo}>{rotulo}</Label>
      <Input
        id={idCampo}
        value={valor}
        onChange={(e) => mudar(e.target.value)}
        placeholder={extra?.placeholder}
        inputMode={extra?.numero ? "decimal" : undefined}
        className={`rounded-sm ${extra?.numero ? "text-right" : ""} ${extra?.invalido ? "border-red-400" : ""}`}
      />
    </div>
  );
  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent avisoAoSair className="max-h-[90vh] overflow-y-auto rounded-sm sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{investimento ? "Editar Investimento" : "Novo Investimento"}</DialogTitle>
          <DialogDescription>A depreciação do investimento entra na conta da unidade, mês a mês, a partir do Início e pela Vida Útil, somada à depreciação base.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* O Nome de Referência (15/10/2026): único no cenário; a planilha das premissas reconhece o investimento por ele. */}
          <div className="sm:col-span-2">{campo("Nome de Referência", "inv-nome", nome, setNome, { placeholder: "Ex.: Ponte Rolante 2027" })}</div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-unidade">Unidade</Label>
            <select id="inv-unidade" value={unidade} onChange={(e) => setUnidade(Number(e.target.value))} className={classeSelect}>
              {dados.contas.map((c) => (
                <option key={c.unidade} value={c.unidade}>
                  {c.nomeUnidade}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-conta">Conta</Label>
            {/* A conta é a de depreciação da unidade: a do maquinário de produção, de serviços ou do patrimônio. */}
            <select id="inv-conta" value={unidade} disabled className={`${classeSelect} bg-gray-50 text-gray-700`}>
              {dados.contas
                .filter((c) => c.unidade === unidade)
                .map((c) => (
                  <option key={c.unidade} value={c.unidade}>
                    {c.rotulo}
                  </option>
                ))}
            </select>
          </div>
          <div className="sm:col-span-2">{campo("Descrição", "inv-descricao", descricao, setDescricao)}</div>
          <div className="sm:col-span-2">{campo("Ganho Previsto", "inv-ganho", ganho, setGanho, { placeholder: "Ex.: mais 30% de pistas na Filial" })}</div>
          {campo("Receita Bruta Prevista (R$)", "inv-receita", receita, setReceita, { numero: true, invalido: n.receita === undefined })}
          <div className="space-y-1.5">
            <Label htmlFor="inv-inicio">Início</Label>
            <select id="inv-inicio" value={inicio} onChange={(e) => setInicio(Number(e.target.value))} className={classeSelect}>
              {MESES.map((m, k) => (
                <option key={m} value={k + 1}>
                  {m}/{dados.ano}
                </option>
              ))}
            </select>
          </div>
          {campo("Valor Total (R$)", "inv-total", total, setTotal, { numero: true, invalido: total !== "" && !(typeof n.total === "number" && n.total > 0) })}
          {campo("Valor Pós Uso (R$)", "inv-posuso", posUso, setPosUso, { numero: true, invalido: n.posUso === undefined })}
          {campo("Vida Útil (meses)", "inv-vida", vida, setVida, { numero: true, invalido: vida !== "" && !(typeof n.vida === "number" && n.vida >= 1 && Number.isInteger(n.vida)) })}
          <div className="grid grid-cols-2 gap-3 rounded-sm border border-gray-200 bg-gray-50 px-3 py-2 text-sm sm:col-span-2">
            <p>
              <span className="text-gray-600">Depreciação Mensal: </span>
              <span className="font-bold text-gray-900">{reais(mensal)}</span>
            </p>
            <p>
              <span className="text-gray-600">ROI: </span>
              <span className="font-bold text-gray-900">{roi === null ? "—" : `${roi.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`}</span>
            </p>
          </div>
        </div>
        <Erro erro={gravar.isError ? mensagemDeErro(gravar.error, "Não foi possível gravar o investimento.") : null} />
        <DialogFooter>
          {investimento ? (
            excluir ? (
              <span className="flex items-center gap-2 text-sm text-gray-700 sm:mr-auto">
                Excluir o investimento?
                <Button type="button" variant="outline" className="rounded-sm border-red-300 text-red-700 hover:bg-red-50" disabled={gravar.isPending} onClick={() => gravar.mutate(true)}>
                  Sim, Excluir
                </Button>
              </span>
            ) : (
              <Button type="button" variant="outline" className="rounded-sm border-red-300 text-red-700 hover:bg-red-50 sm:mr-auto" onClick={() => setExcluir(true)}>
                <Trash2 className="size-4" />
                Excluir
              </Button>
            )
          ) : null}
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" className={botaoPrimario} disabled={!valido || gravar.isPending} onClick={() => gravar.mutate(false)}>
            {gravar.isPending ? "Gravando…" : "Gravar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A aba Extra-Operacional das premissas de um cenário analítico (13/10/2026), como os Lançamentos Manuais do
 * fechamento: o imposto de renda e a contribuição social e as receitas e despesas financeiras, mês a mês, em Despesas e
 * Extra e no RN, com a replicação e o reajuste das premissas.
 */
export function ExtraDoCenario({ id, editavel }: { id: string; editavel: boolean }) {
  const consulta = useQuery({ queryKey: ["cenarios", id, "extra"], queryFn: () => cenariosService.extraOperacional(id) });
  if (consulta.isError) return <Erro erro={mensagemDeErro(consulta.error, "Erro ao carregar o extra-operacional.")} />;
  if (consulta.isPending) return <Carregando />;
  const dados = consulta.data;
  return (
    <div className="space-y-8">
      {dados.tabelas.map((t) => (
        <TabelaEditavel
          key={t.unidade}
          titulo={t.nome}
          meses={dados.meses}
          linhas={t.linhas}
          editavel={editavel && dados.editavel}
          item={["conta", "contas"]}
          cabecalho="CONTA"
          aoGravar={(alteracoes, origem) => cenariosService.gravarMensais(id, "EXTRA", alteracoes, origem)}
          mensagem={(n) => `${n} ${plural(n, "valor", "valores")} do extra-operacional ${plural(n, "gravado", "gravados")}; a DRE do cenário foi recalculada.`}
        />
      ))}
    </div>
  );
}
