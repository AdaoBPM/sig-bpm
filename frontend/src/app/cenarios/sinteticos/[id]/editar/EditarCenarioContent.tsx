"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, History, Upload } from "lucide-react";
import { toast } from "sonner";

import { Abas } from "@/components/shared/Abas";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { competenciasService } from "@/app/competencias/services/competenciasService";
import { TabelaResultados } from "@/app/relatorios/resultados/ResultadosContent";
import { mensagemDeErro, type LinhaResultado } from "@/app/relatorios/services/relatoriosService";

import { botaoPrimario, CampoVisualizacao, classeSelect, Erro } from "../../../components/CenarioDialog";
import { ReajusteDialog, ValorDialog } from "../../../components/EdicaoDialogs";
import { ImportarCenarioDialog } from "../../../components/ImportarCenarioDialog";
import { cenariosService, type Cenario, type Visualizacao } from "../../../services/cenariosService";

/** As abas da tela: as configurações e as visões da DRE do cenário. */
const ABAS = [
  { chave: "config", rotulo: "Configurações" },
  { chave: "0", rotulo: "Consolidado" },
  { chave: "1", rotulo: "Matriz" },
  { chave: "2", rotulo: "Filial" },
  { chave: "3", rotulo: "Serviços" },
  { chave: "4", rotulo: "Despesas + Extra" },
  { chave: "5", rotulo: "RN" },
];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const dataHora = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null);
const Carregando = () => <div className="h-64 animate-pulse rounded-sm bg-gray-100" />;

/** A aba Configurações: nome, descrição, visualização e a referência (um arquivo ou o resultado realizado de um ano). */
function Configuracoes({ cenario }: { cenario: Cenario }) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState(cenario.nome);
  const [descricao, setDescricao] = useState(cenario.descricao ?? "");
  const [visualizacao, setVisualizacao] = useState<Visualizacao>(cenario.visualizacao);
  const [referencia, setReferencia] = useState<"arquivo" | "realizado">("arquivo");
  const [importando, setImportando] = useState(false);
  const competencias = useQuery({ queryKey: ["competencias", "todos"], queryFn: () => competenciasService.listar() });
  const fechadas = (competencias.data?.itens ?? []).filter((c) => c.status === "FECHADA");
  const anos = [...new Set(fechadas.map((c) => c.ano))].sort((a, b) => b - a);
  const [anoEscolhido, setAno] = useState<number | null>(null);
  const ano = anoEscolhido ?? anos[0] ?? null;
  const mesesFechados = fechadas.filter((c) => c.ano === ano).map((c) => c.mes).sort((a, b) => a - b);
  const [confirmar, setConfirmar] = useState(false);

  const salvar = useMutation({
    mutationFn: () => cenariosService.atualizar(cenario.id, { nome: nome.trim(), descricao: descricao.trim() || null, visualizacao }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cenarios"] });
      toast.success("Configurações gravadas.");
    },
  });
  const carregar = useMutation({
    mutationFn: () => cenariosService.referenciaRealizado(cenario.id, ano!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cenarios"] });
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
      toast.success(`Resultado realizado de ${ano} carregado no cenário.`);
      setConfirmar(false);
    },
  });
  const mudou = nome.trim() !== cenario.nome || (descricao.trim() || null) !== cenario.descricao || visualizacao !== cenario.visualizacao;

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="space-y-4 rounded-sm border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-bold tracking-wide text-gray-900 uppercase">Cenário</h2>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <div className="space-y-1.5">
            <Label htmlFor="cfg-nome">Nome</Label>
            <Input id="cfg-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} className="rounded-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cfg-ano">Exercício</Label>
            <Input id="cfg-ano" value={String(cenario.ano)} readOnly className="rounded-sm bg-gray-50 text-gray-700" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cfg-descricao">Descrição (opcional)</Label>
            <Input id="cfg-descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={500} className="rounded-sm" />
          </div>
          <div className="sm:col-span-2">
            <CampoVisualizacao
              valor={visualizacao}
              onMudar={setVisualizacao}
              bloqueio={!cenario.podeMudarVisualizacao ? "Só quem criou o cenário ou o Administrador muda a visualização." : null}
              semParticular={cenario.marcacao ? "Um cenário marcado fica público: tire a marcação antes de torná-lo particular." : null}
            />
          </div>
        </div>
        <Erro erro={salvar.isError ? mensagemDeErro(salvar.error, "Não foi possível gravar as configurações.") : null} />
        <div className="flex justify-end">
          <Button type="button" className={botaoPrimario} disabled={!nome.trim() || !mudou || salvar.isPending} onClick={() => salvar.mutate()}>
            {salvar.isPending ? "Gravando…" : "Gravar Configurações"}
          </Button>
        </div>
      </section>

      <section className="space-y-4 rounded-sm border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-bold tracking-wide text-gray-900 uppercase">Referência</h2>
        <p className="text-sm text-gray-600">
          Opcional: uma base para a DRE do cenário, que depois se edita nas abas. A referência substitui a DRE do cenário (as metas dos indicadores
          só mudam com um arquivo que tenha a aba delas).
        </p>
        <p className="text-sm text-gray-700">
          Referência atual:{" "}
          {cenario.nomeArquivo ? (
            <span className="font-medium text-gray-900">
              {cenario.nomeArquivo}
              {cenario.importadoEm ? <span className="font-normal text-gray-500"> · em {dataHora(cenario.importadoEm)}</span> : null}
            </span>
          ) : (
            <span className="text-gray-500">nenhuma (a DRE é a digitada na ferramenta)</span>
          )}
        </p>
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">Tipo da referência</legend>
          {(
            [
              ["arquivo", "Arquivo", "Uma planilha como o ORÇAMENTO BPM (abas Consolidado, Matriz, Filial, Serviços, Desp.+Extra, RN e Metas).", FileSpreadsheet],
              ["realizado", "Resultado Realizado", "A DRE das competências fechadas de um exercício, mês a mês.", History],
            ] as const
          ).map(([v, rotulo, detalhe, Icone]) => (
            <label key={v} className={`flex cursor-pointer items-start gap-2 rounded-sm border px-3 py-2 text-sm ${referencia === v ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:bg-gray-50"}`}>
              <input type="radio" name="referencia" className="mt-1 accent-black" checked={referencia === v} onChange={() => setReferencia(v)} />
              <span>
                <span className="inline-flex items-center gap-1.5 font-medium text-gray-900">
                  <Icone className="size-3.5" />
                  {rotulo}
                </span>
                <span className="block text-xs text-gray-600">{detalhe}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {referencia === "arquivo" ? (
          <div className="flex justify-end">
            <Button type="button" className={botaoPrimario} onClick={() => setImportando(true)}>
              <Upload className="size-4" />
              Importar Arquivo
            </Button>
          </div>
        ) : anos.length === 0 ? (
          <p className="rounded-sm border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-900">Nenhuma competência fechada ainda.</p>
        ) : (
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cfg-realizado">Exercício</Label>
              <select id="cfg-realizado" value={ano ?? ""} onChange={(e) => setAno(Number(e.target.value))} className={`${classeSelect} w-32`}>
                {anos.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <p className="min-w-0 flex-1 text-xs text-gray-600">
              Fechadas: {mesesFechados.map((m) => MESES[m - 1]).join(", ")}. Os demais meses ficam vazios no cenário.
            </p>
            <Button type="button" className={botaoPrimario} onClick={() => setConfirmar(true)}>
              <History className="size-4" />
              Carregar Realizado
            </Button>
          </div>
        )}
      </section>

      {importando ? <ImportarCenarioDialog cenario={cenario} onFechar={() => setImportando(false)} /> : null}
      {confirmar && ano ? (
        <Dialog open onOpenChange={(o) => (!o ? setConfirmar(false) : undefined)}>
          <DialogContent className="rounded-sm sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Carregar Resultado Realizado</DialogTitle>
              <DialogDescription>
                A DRE do cenário (todas as abas e os doze meses) é substituída pela das competências fechadas de {ano} ({mesesFechados.map((m) => MESES[m - 1].slice(0, 3)).join(", ")}
                ). Os valores editados no cenário se perdem; as metas dos indicadores ficam como estão.
              </DialogDescription>
            </DialogHeader>
            <Erro erro={carregar.isError ? mensagemDeErro(carregar.error, "Não foi possível carregar o realizado.") : null} />
            <DialogFooter>
              <Button type="button" variant="outline" className="rounded-sm" onClick={() => setConfirmar(false)}>
                Cancelar
              </Button>
              <Button type="button" className={botaoPrimario} disabled={carregar.isPending} onClick={() => carregar.mutate()}>
                {carregar.isPending ? "Carregando…" : "Carregar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

/**
 * Uma aba da DRE do cenário. Nas unidades, as contas se editam: a caixa de cada linha e de cada mês marca valores, e
 * clicar numa linha reajusta os marcados; clicar num valor edita aquele valor. O Consolidado só soma as unidades.
 */
function EdicaoDRE({ id, visao, nome }: { id: string; visao: number; nome: string }) {
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
        titulo={`DRE · ${nome}`}
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

/** A edição de um cenário sintético pela ferramenta (12/10/2026): as configurações e a DRE de cada visão. */
export function EditarCenarioContent() {
  const { id } = useParams<{ id: string }>();
  useRegistrarAcessoTela(`/cenarios/sinteticos/${id}/editar`);
  const [aba, setAba] = useState("config");
  const cenario = useQuery({ queryKey: ["cenarios", id], queryFn: () => cenariosService.obter(id) });
  const nomeDaAba = ABAS.find((a) => a.chave === aba)?.rotulo ?? "";
  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Editar Cenário"
        comoUsar={
          <ul>
            <li>Em Configurações, mude o nome, a descrição e a visualização (Particular ou Pública) e grave. A Referência é opcional: importe um arquivo ou carregue o resultado realizado das competências fechadas de um exercício — ela substitui a DRE do cenário.</li>
            <li>Nas abas Matriz, Filial, Serviços, Despesas + Extra e RN, só os valores mensais das contas se editam; os totais, os percentuais e os valores por m³ são calculados. O Consolidado soma as unidades e não se edita.</li>
            <li>Para reajustar vários valores: marque as contas (a caixa de um total ou de uma atribuição marca as contas dele) e os meses (a caixa no rótulo de cada mês, ou “Marcar Todos os Meses”). Os valores marcados ficam contornados. Clique numa linha (ou em “Reajustar Marcados”) e informe o reajuste, percentual ou absoluto: ele vale para todos os marcados.</li>
            <li>Para editar um valor: clique nele. O modal mostra o valor atual, o reajuste (percentual ou absoluto) e o valor recalculado, que também se digita direto. A chave “Replicar aos meses posteriores” copia o valor recalculado aos meses seguintes. Essa edição não olha as caixas marcadas.</li>
            <li>Cada gravação recalcula os totais da unidade e o Consolidado; as telas Resultados e Indicadores do cenário mostram os valores novos.</li>
          </ul>
        }
        sobre={
          <p>
            A criação e a edição do cenário sem planilha (12/10/2026): a DRE de cada unidade, mês a mês no exercício, com os totais calculados pela
            Estrutura da DRE, como na apuração do realizado. A importação de um arquivo, ou a carga do realizado, é opcional e serve de base para a edição.
          </p>
        }
      />
      {cenario.isError ? (
        <Erro erro={mensagemDeErro(cenario.error, "Erro ao carregar o cenário.")} />
      ) : cenario.isPending ? (
        <Carregando />
      ) : (
        <>
          <Abas rotulo="Edição do cenário" ativa={aba} onMudar={setAba} abas={ABAS.map((a) => ({ chave: a.chave, rotulo: a.rotulo }))} />
          {aba === "config" ? <Configuracoes key={`${cenario.data.nome}|${cenario.data.descricao}|${cenario.data.visualizacao}`} cenario={cenario.data} /> : <EdicaoDRE key={aba} id={id} visao={Number(aba)} nome={nomeDaAba} />}
        </>
      )}
    </div>
  );
}
