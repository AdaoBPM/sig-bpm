"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, History, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { competenciasService } from "@/app/competencias/services/competenciasService";
import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

import { cenariosService, type Cenario, type Visualizacao } from "../services/cenariosService";
import { botaoPrimario, CampoVisualizacao, classeSelect, Erro } from "./CenarioDialog";
import { ImportarCenarioDialog } from "./ImportarCenarioDialog";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const dataHora = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null);

/** As configurações do cenário: nome, descrição, visualização e a referência (um arquivo ou o resultado realizado de um ano). */
export function ConfiguracoesCenario({ cenario }: { cenario: Cenario }) {
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
  // Mês a mês (os meses fechados, cada um no seu mês) ou a média de um período replicada nos doze meses (12/10/2026).
  const [modo, setModo] = useState<"MES_A_MES" | "MEDIA">("MES_A_MES");
  const [deEscolhido, setDe] = useState<number | null>(null);
  const [ateEscolhido, setAte] = useState<number | null>(null);
  const de = deEscolhido !== null && mesesFechados.includes(deEscolhido) ? deEscolhido : mesesFechados[0];
  const ate = ateEscolhido !== null && mesesFechados.includes(ateEscolhido) ? ateEscolhido : mesesFechados[mesesFechados.length - 1];
  const periodo = de && ate && de <= ate ? Array.from({ length: ate - de + 1 }, (_, k) => de + k) : [];
  const abertasNoPeriodo = periodo.filter((m) => !mesesFechados.includes(m));
  const periodoInvalido = modo === "MEDIA" && (!periodo.length || abertasNoPeriodo.length > 0);
  const abrev = (m: number) => MESES[m - 1].slice(0, 3);

  const salvar = useMutation({
    mutationFn: () => cenariosService.atualizar(cenario.id, { nome: nome.trim(), descricao: descricao.trim() || null, visualizacao }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cenarios"] });
      toast.success("Configurações gravadas.");
    },
  });
  const carregar = useMutation({
    mutationFn: () => cenariosService.referenciaRealizado(cenario.id, ano!, modo === "MEDIA" ? { modo, de, ate } : { modo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cenarios"] });
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
      toast.success(modo === "MEDIA" ? `Média do realizado de ${ano} (${abrev(de)} a ${abrev(ate)}) carregada nos 12 meses.` : `Resultado realizado de ${ano} carregado no cenário.`);
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
          Opcional: uma base para a DRE do cenário, que depois se edita na tela Resultados. A referência substitui a DRE do cenário; os indicadores
          mudam com o resultado realizado (os realizados dos meses fechados) ou com um arquivo que tenha a aba das metas.
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
              ["realizado", "Resultado Realizado", "A DRE e os indicadores das competências fechadas de um exercício: mês a mês ou a média de um período, replicada nos doze meses.", History],
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
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
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
              <p className="min-w-0 flex-1 pb-2 text-xs text-gray-600">Fechadas: {mesesFechados.map((m) => MESES[m - 1]).join(", ")}.</p>
            </div>
            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="mb-1.5 text-sm leading-none font-medium">Importação</legend>
              {(
                [
                  ["MES_A_MES", "Mês a Mês", "Cada competência fechada no mês dela; os demais meses ficam vazios."],
                  ["MEDIA", "Média Replicada", "A média de um período do realizado, replicada em todos os doze meses do cenário."],
                ] as const
              ).map(([v, rotulo, detalhe]) => (
                <label key={v} className={`flex cursor-pointer items-start gap-2 rounded-sm border px-3 py-2 text-sm ${modo === v ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:bg-gray-50"}`}>
                  <input type="radio" name="modo-realizado" className="mt-1 accent-black" checked={modo === v} onChange={() => setModo(v)} />
                  <span>
                    <span className="font-medium text-gray-900">{rotulo}</span>
                    <span className="block text-xs text-gray-600">{detalhe}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            {modo === "MEDIA" ? (
              <div className="flex flex-wrap items-end gap-3">
                {(
                  [
                    ["cfg-de", "De", de, setDe],
                    ["cfg-ate", "Até", ate, setAte],
                  ] as const
                ).map(([idCampo, rotulo, valor, mudar]) => (
                  <div key={idCampo} className="space-y-1.5">
                    <Label htmlFor={idCampo}>{rotulo}</Label>
                    <select id={idCampo} value={valor ?? ""} onChange={(e) => mudar(Number(e.target.value))} className={`${classeSelect} w-36`}>
                      {mesesFechados.map((m) => (
                        <option key={m} value={m}>
                          {MESES[m - 1]}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                <p className={`min-w-0 flex-1 pb-2 text-xs ${periodoInvalido ? "text-red-700" : "text-gray-600"}`}>
                  {!periodo.length
                    ? "O mês inicial vem depois do final."
                    : abertasNoPeriodo.length
                      ? `O período tem meses sem competência fechada: ${abertasNoPeriodo.map((m) => MESES[m - 1]).join(", ")}.`
                      : `A média de ${periodo.length} mês(es), de ${MESES[de - 1]} a ${MESES[ate - 1]}, em todos os meses do cenário.`}
                </p>
              </div>
            ) : null}
            <div className="flex justify-end">
              <Button type="button" className={botaoPrimario} disabled={periodoInvalido} onClick={() => setConfirmar(true)}>
                <History className="size-4" />
                Carregar Realizado
              </Button>
            </div>
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
                {modo === "MEDIA"
                  ? `A DRE do cenário (todas as abas e os doze meses) é substituída pela média do realizado de ${ano}, de ${MESES[de - 1]} a ${MESES[ate - 1]} (${periodo.length} mês(es)), replicada em todos os meses. Os indicadores do cenário também ficam com as médias realizadas do período em todos os meses (os que saem da DRE se recalculam das contas médias).`
                  : `A DRE do cenário (todas as abas e os doze meses) é substituída pela das competências fechadas de ${ano} (${mesesFechados.map(abrev).join(", ")}), cada uma no seu mês. Os indicadores do cenário também são substituídos pelos realizados desses meses.`}{" "}
                Os valores editados e os lançamentos manuais do cenário se perdem.
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
