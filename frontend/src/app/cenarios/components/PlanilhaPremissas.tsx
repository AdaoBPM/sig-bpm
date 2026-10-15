"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CopyCheck, FileUp, FolderUp, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { plural } from "@/lib/texto";

import { ExportarRelatorio } from "@/app/relatorios/components/ExportarRelatorio";
import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

import { cenariosService, type AnaliseDePremissas } from "../services/cenariosService";
import { botaoPrimario, Erro, OpcaoEmLinha } from "./CenarioDialog";

const invalidar = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: ["cenarios"] });
  queryClient.invalidateQueries({ queryKey: ["relatorios"] });
};

/**
 * O botão Replicar Médias / Apagar Valores (15/10/2026), na altura do título das Premissas: em todas as abas, replica a
 * Média de Referência de cada linha nos doze meses, ou deixa os meses em branco.
 */
export function BotaoReplicarMedias({ id }: { id: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button type="button" className={botaoPrimario} onClick={() => setAberto(true)}>
        <CopyCheck className="size-4" />
        Replicar Médias / Apagar Valores
      </Button>
      {aberto ? <ReplicarMediasDialog id={id} onFechar={() => setAberto(false)} /> : null}
    </>
  );
}

function ReplicarMediasDialog({ id, onFechar }: { id: string; onFechar: () => void }) {
  const queryClient = useQueryClient();
  const [acao, setAcao] = useState<"replicar" | "apagar">("replicar");
  const gravar = useMutation({
    mutationFn: () => cenariosService.replicarMedias(id, acao),
    onSuccess: (r) => {
      invalidar(queryClient);
      toast.success(
        acao === "replicar"
          ? `Médias replicadas em ${r.linhas} ${plural(r.linhas, "linha", "linhas")} (${r.valores} ${plural(r.valores, "valor", "valores")}); a DRE do cenário foi recalculada.`
          : `Valores apagados em ${r.linhas} ${plural(r.linhas, "linha", "linhas")}; a DRE do cenário foi recalculada.`,
      );
      onFechar();
    },
  });
  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-sm sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Replicar Médias / Apagar Valores</DialogTitle>
          <DialogDescription>
            Vale para todas as abas das premissas: Matriz, Filial, Serviços, Centros de Custo (com o Quadro de Lotação), Investimentos (a Depreciação
            Base), Extra-Operacional e Indicadores Manuais. A DRE do cenário se
            recalcula, e a mudança fica no histórico (tela Reajustes).
          </DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-2">
          <legend className="sr-only">O que fazer</legend>
          <OpcaoEmLinha
            nome="replicar-medias"
            marcada={acao === "replicar"}
            onMarcar={() => setAcao("replicar")}
            rotulo="Replicar Médias"
            detalhe="A Média de Referência de cada linha vai para os doze meses, no lugar dos valores de hoje. As linhas sem média ficam como estão."
            Icone={CopyCheck}
          />
          <OpcaoEmLinha
            nome="replicar-medias"
            marcada={acao === "apagar"}
            onMarcar={() => setAcao("apagar")}
            rotulo="Apagar Valores"
            detalhe="Os doze meses de cada linha ficam em branco (os Dias Úteis voltam aos do calendário). As Médias de Referência ficam."
            Icone={X}
          />
        </fieldset>
        <Erro erro={gravar.isError ? mensagemDeErro(gravar.error, "Não foi possível gravar.") : null} />
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" className={botaoPrimario} disabled={gravar.isPending} onClick={() => gravar.mutate()}>
            {gravar.isPending ? "Gravando…" : acao === "replicar" ? "Replicar Médias" : "Apagar Valores"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** O Exportar Premissas (15/10/2026): só em Excel, a aba atual ou todas, com os centros de custo numa aba, um por aba ou um arquivo por centro. */
export function ExportarPremissas({ id, aba }: { id: string; aba: string }) {
  return (
    <ExportarRelatorio
      endereco={`/proxy/cenarios/${id}/premissas/exportar`}
      padrao="Premissas"
      rotulo="Exportar Premissas"
      opcoes={[
        ...(aba === "rateios" ? [] : [{ chave: "atual", excel: "Aba Atual", pdf: null, params: { escopo: "atual", aba } }]),
        { chave: "todas", excel: "Todas as Abas (os centros de custo numa aba)", pdf: null, params: { escopo: "todas" } },
        { chave: "centros_abas", excel: "Todas as Abas (um centro de custo por aba)", pdf: null, params: { escopo: "centros_abas" } },
        { chave: "centros_arquivos", excel: "Centros de Custo (um arquivo por centro)", pdf: null, params: { escopo: "centros_arquivos" } },
      ]}
    />
  );
}

/** O botão Importar Valores (15/10/2026), antes do Exportar Premissas. */
export function BotaoImportarValores({ id }: { id: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button type="button" className={botaoPrimario} onClick={() => setAberto(true)}>
        <Upload className="size-4" />
        Importar Valores
      </Button>
      {aberto ? <ImportarValoresDialog id={id} onFechar={() => setAberto(false)} /> : null}
    </>
  );
}

type Item = { id: number; nome: string; estado: "analisando" | "pronto" | "erro"; analises: AnaliseDePremissas[]; erro?: string };

/**
 * O Importar Valores (15/10/2026): a lista dos arquivos escolhidos (um ou vários, ou uma pasta), cada um conferido no
 * padrão do Exportar Premissas assim que entra, com o que muda (os valores e as justificativas). Grava-se só em
 * "Importar", como nas importações do Fechamento Mensal; a importação fica no histórico (tela Reajustes).
 */
function ImportarValoresDialog({ id, onFechar }: { id: string; onFechar: () => void }) {
  const queryClient = useQueryClient();
  const [itens, setItens] = useState<Item[]>([]);
  const proximo = useRef(1);
  const arquivo = useRef<HTMLInputElement>(null);
  const pasta = useRef<HTMLInputElement>(null);
  const adicionar = (lista: FileList | null) => {
    const arquivos = [...(lista ?? [])].filter((f) => /\.(xlsx|zip)$/i.test(f.name) && !f.name.startsWith("~$"));
    if (lista && lista.length && !arquivos.length) toast.error("Nenhum arquivo .xlsx ou .zip na escolha.");
    for (const f of arquivos) {
      const n = proximo.current++;
      const nome = f.webkitRelativePath || f.name;
      setItens((xs) => [...xs, { id: n, nome, estado: "analisando", analises: [] }]);
      cenariosService
        .analisarPremissas(id, f)
        .then((analises) => setItens((xs) => xs.map((x) => (x.id === n ? { ...x, estado: "pronto", analises } : x))))
        .catch((e) => setItens((xs) => xs.map((x) => (x.id === n ? { ...x, estado: "erro", erro: mensagemDeErro(e, "Não foi possível ler o arquivo.") } : x))));
    }
  };
  const analises = itens.flatMap((x) => x.analises);
  const validas = analises.filter((a) => a.valido);
  const valores = validas.reduce((s, a) => s + a.alteracoes.length, 0);
  const justificativas = validas.reduce((s, a) => s + a.justificativas.length, 0);
  const analisando = itens.some((x) => x.estado === "analisando");
  const importar = useMutation({
    mutationFn: () => cenariosService.importarPremissas(id, validas),
    onSuccess: (r) => {
      invalidar(queryClient);
      toast.success(
        `${r.valores} ${plural(r.valores, "valor importado", "valores importados")} e ${r.justificativas} ${plural(r.justificativas, "justificativa", "justificativas")}; a DRE do cenário foi recalculada.`,
      );
      onFechar();
    },
  });
  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent avisoAoSair={itens.length > 0} className="flex max-h-[90vh] flex-col rounded-sm sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Importar Valores</DialogTitle>
          <DialogDescription>
            Escolha os arquivos (ou uma pasta) gerados pelo Exportar Premissas: planilhas .xlsx ou o .zip de um arquivo por centro. Cada arquivo é
            conferido assim que entra na lista; os valores mensais e as justificativas se gravam só em “Importar” (em branco, o mês fica sem valor).
            A Média de Referência e Justificar? não se importam.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={arquivo} type="file" accept=".xlsx,.zip" multiple className="hidden" onChange={(e) => (adicionar(e.target.files), (e.target.value = ""))} />
          <input
            ref={(el) => {
              pasta.current = el;
              el?.setAttribute("webkitdirectory", "");
            }}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => (adicionar(e.target.files), (e.target.value = ""))}
          />
          <Button type="button" variant="outline" className="rounded-sm" onClick={() => arquivo.current?.click()}>
            <FileUp className="size-4" />
            Escolher Arquivos
          </Button>
          <Button type="button" variant="outline" className="rounded-sm" onClick={() => pasta.current?.click()}>
            <FolderUp className="size-4" />
            Escolher Pasta
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-sm border border-gray-200">
          <table className="tabela-sig w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-3 py-2 text-left text-xs font-bold">Arquivo</th>
                <th className="px-3 py-2 text-left text-xs font-bold">Situação</th>
                <th className="px-3 py-2 text-right text-xs font-bold">Linhas</th>
                <th className="px-3 py-2 text-right text-xs font-bold">Valores</th>
                <th className="px-3 py-2 text-right text-xs font-bold">Justificativas</th>
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {itens.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                    Nenhum arquivo escolhido.
                  </td>
                </tr>
              ) : null}
              {itens.flatMap((x) => {
                const remover = (
                  <button type="button" title="Tirar da lista" aria-label={`Tirar ${x.nome} da lista`} className="rounded-sm p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900" onClick={() => setItens((xs) => xs.filter((y) => y.id !== x.id))}>
                    <X className="size-4" />
                  </button>
                );
                if (x.estado !== "pronto")
                  return [
                    <tr key={x.id} className="border-b border-gray-100">
                      <td className="px-3 py-2 break-all text-gray-900">{x.nome}</td>
                      <td colSpan={4} className={`px-3 py-2 ${x.estado === "erro" ? "text-red-700" : "text-gray-500"}`}>
                        {x.estado === "erro" ? x.erro : "Conferindo…"}
                      </td>
                      <td className="px-2 py-2 text-right">{remover}</td>
                    </tr>,
                  ];
                return x.analises.map((a, k) => (
                  <tr key={`${x.id}-${k}`} className="border-b border-gray-100 align-top">
                    <td className="px-3 py-2 break-all text-gray-900">
                      {a.arquivo}
                      {[...a.erros.map((e) => ({ e, erro: true })), ...a.avisos.map((e) => ({ e, erro: false }))].map(({ e, erro }) => (
                        <p key={e} className={`mt-1 text-xs ${erro ? "text-red-700" : "text-gray-500"}`}>
                          {e}
                        </p>
                      ))}
                    </td>
                    <td className={`px-3 py-2 whitespace-nowrap ${a.valido ? "text-green-700" : "text-red-700"}`}>{a.valido ? "No padrão" : "Fora do padrão"}</td>
                    <td className="px-3 py-2 text-right">{a.linhas.toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2 text-right">{a.valido ? a.alteracoes.length.toLocaleString("pt-BR") : "—"}</td>
                    <td className="px-3 py-2 text-right">{a.valido ? a.justificativas.length.toLocaleString("pt-BR") : "—"}</td>
                    <td className="px-2 py-2 text-right">{k === 0 ? remover : null}</td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
        <Erro erro={importar.isError ? mensagemDeErro(importar.error, "Não foi possível importar.") : null} />
        <DialogFooter className="items-center">
          <span className="text-xs text-gray-600 sm:mr-auto">
            {validas.length} {plural(validas.length, "planilha no padrão", "planilhas no padrão")}: {valores.toLocaleString("pt-BR")} {plural(valores, "valor muda", "valores mudam")} e{" "}
            {justificativas} {plural(justificativas, "justificativa", "justificativas")}.
          </span>
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" className={botaoPrimario} disabled={analisando || importar.isPending || valores + justificativas === 0} onClick={() => importar.mutate()}>
            {importar.isPending ? "Importando…" : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
