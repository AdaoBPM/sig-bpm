"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowDownToLine, CheckCircle2, Loader2, MinusCircle, Upload, XCircle } from "lucide-react";

import { CampoArquivo } from "@/components/shared/CampoArquivo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

import { cenariosService, type Cenario, type Mudancas, type PreviaCenario, type Visualizacao } from "../services/cenariosService";
import { useTipoDoCenario } from "./tipoDoCenario";
import { botaoPrimario, CampoVisualizacao, classeSelect, Erro } from "./CenarioDialog";

const ICONES = {
  importar: <ArrowDownToLine className="size-4 text-gray-900" />,
  ok: <CheckCircle2 className="size-4 text-green-600" />,
  aviso: <AlertTriangle className="size-4 text-yellow-600" />,
  erro: <XCircle className="size-4 text-red-600" />,
  fora: <MinusCircle className="size-4 text-gray-400" />,
};

/** A situação de uma aba, como na importação do Fechamento Mensal: o ícone, o texto, o detalhe e os avisos. */
function Situacao({ icone, texto, detalhe, avisos = [] }: { icone: keyof typeof ICONES; texto: string; detalhe?: string; avisos?: string[] }) {
  return (
    <div className="flex min-w-0 items-start gap-2 py-1">
      <span className="mt-0.5 shrink-0">{ICONES[icone]}</span>
      <div className="min-w-0">
        <span className={`font-medium ${icone === "erro" ? "text-red-700" : "text-gray-900"}`}>{texto}</span>
        {detalhe ? <p className="text-xs text-gray-600">{detalhe}</p> : null}
        {avisos.map((a) => (
          <p key={a} className="text-xs text-yellow-800">
            {a}
          </p>
        ))}
      </div>
    </div>
  );
}

const plural = (n: number, um: string, varios: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;

/** O que muda no cenário: os valores novos, os alterados e os que saem. */
function textoMudancas(m: Mudancas) {
  const partes = [m.novas ? plural(m.novas, "valor novo", "valores novos") : null, m.alteradas ? plural(m.alteradas, "alterado", "alterados") : null, m.removidas ? plural(m.removidas, "removido", "removidos") : null];
  return partes.filter(Boolean).join(", ");
}

/** A situação de uma aba da prévia (ou, depois de importar, o que foi feito). */
function situacaoDaAba(acao: "NOVA" | "SUBSTITUI", mudancas: Mudancas, conteudo: string, importado: boolean, avisos: string[], substitui = "Substitui a do cenário"): ReactNode {
  if (importado) return <Situacao icone="ok" texto="Importada" detalhe={conteudo} avisos={avisos} />;
  if (acao === "NOVA") return <Situacao icone={avisos.length ? "aviso" : "importar"} texto="Será importada" detalhe={conteudo} avisos={avisos} />;
  if (mudancas.semMudanca) return <Situacao icone="fora" texto="Sem mudança" detalhe={`${conteudo}; igual ao que o cenário tem.`} avisos={avisos} />;
  return <Situacao icone={avisos.length ? "aviso" : "importar"} texto={substitui} detalhe={`${conteudo}; ${textoMudancas(mudancas)}.`} avisos={avisos} />;
}

/** A prévia: as abas lidas, o que cada uma traz e o que muda no cenário; depois de importar, o mesmo quadro com o que foi feito. */
function TabelaPrevia({ p, importado }: { p: PreviaCenario; importado: boolean }) {
  const novo = !p.cenario;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto rounded-sm border border-gray-200 [--topo-tabela:0px]">
      <table className="tabela-sig w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs font-bold text-gray-900">
            <th className="w-56 px-3 py-2">Aba</th>
            <th className="px-3 py-2">Situação</th>
          </tr>
        </thead>
        <tbody>
          {p.visoes.map((v) => (
            <tr key={v.visao} className="border-b border-gray-100 align-top">
              <td className="px-3 py-2">
                <div className="font-medium text-gray-900">{v.aba}</div>
                <div className="text-xs text-gray-500">DRE · {v.nome}</div>
              </td>
              <td className="px-3 py-1">
                {situacaoDaAba(
                  v.acao,
                  v.mudancas,
                  `${plural(v.linhas, "linha da DRE", "linhas da DRE")}, ${plural(v.meses, "mês", "meses")}`,
                  importado,
                  v.semPar.length ? [`Sem par na Estrutura da DRE (fica de fora): ${v.semPar.join("; ")}.`] : [],
                )}
              </td>
            </tr>
          ))}
          {/* As visões sem aba no arquivo, numa linha só: as que ficam como estão e as que ficam vazias. */}
          {[true, false].map((temValores) => {
            const grupo = p.faltam.filter((f) => !novo && f.temValores === temValores);
            const lista = novo ? (temValores ? [] : p.faltam) : grupo;
            if (lista.length === 0) return null;
            return (
              <tr key={String(temValores)} className="border-b border-gray-100 align-top">
                <td className="px-3 py-2">
                  <div className="font-medium text-gray-400">—</div>
                  <div className="text-xs text-gray-500">DRE · {lista.map((f) => f.nome).join(", ")}</div>
                </td>
                <td className="px-3 py-1">
                  <Situacao icone="fora" texto="Sem aba no arquivo" detalhe={temValores ? "Fica como está no cenário." : lista.length > 1 ? "As visões ficam vazias no cenário." : "A visão fica vazia no cenário."} />
                </td>
              </tr>
            );
          })}
          <tr className="align-top">
            <td className="px-3 py-2">
              <div className={`font-medium ${p.metas ? "text-gray-900" : "text-gray-400"}`}>{p.metas?.aba ?? "—"}</div>
              <div className="text-xs text-gray-500">Metas dos Indicadores</div>
            </td>
            <td className="px-3 py-1">
              {p.metas ? (
                situacaoDaAba(
                  p.metas.acao,
                  p.metas.mudancas,
                  `${plural(p.metas.indicadores, "indicador", "indicadores")}, ${plural(p.metas.meses, "mês", "meses")}`,
                  importado,
                  [
                    ...(p.metas.ignorados.length ? [`Fora do cadastro dos indicadores (ignorados): ${p.metas.ignorados.join("; ")}.`] : []),
                    ...(p.metas.digitados && !importado ? [`Substitui ${plural(p.metas.digitados, "lançamento manual digitado", "lançamentos manuais digitados")} no cenário.`] : []),
                  ],
                  "Substitui as do cenário",
                )
              ) : (
                <Situacao
                  icone="fora"
                  texto="Sem a aba das metas no arquivo"
                  detalhe={novo || p.metasAtuais === 0 ? "O cenário fica sem metas: importe depois um arquivo com a aba Metas (Orçamento) ou Metas." : "As metas ficam como estão no cenário."}
                />
              )}
            </td>
          </tr>
        </tbody>
      </table>
      {p.ignoradas.length ? <p className="px-3 py-2 text-xs text-gray-500">Abas com o nome de uma unidade que não são uma DRE (ignoradas): {p.ignoradas.join(", ")}.</p> : null}
    </div>
  );
}

/**
 * Importar um arquivo, num cenário novo ou num que já existe, como a importação do Fechamento Mensal: escolhido o
 * arquivo, a ferramenta lê e confere as abas e mostra o que vai entrar e o que muda no cenário; nada é gravado antes
 * de o usuário clicar em Importar.
 */
export function ImportarCenarioDialog({ cenario, onFechar }: { cenario: Cenario | null; onFechar: () => void }) {
  const { base } = useTipoDoCenario();
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [visualizacao, setVisualizacao] = useState<Visualizacao>("PUBLICA");
  const atual = new Date().getFullYear();
  const [ano, setAno] = useState(String(atual));
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [envio, setEnvio] = useState(0);
  const analisar = useMutation({
    mutationFn: (f: File) => {
      setEnvio(0);
      return cenariosService.analisar(f, cenario?.id ?? null, setEnvio);
    },
  });
  const importar = useMutation({
    mutationFn: () => cenariosService.importar(analisar.data!, cenario ? { cenarioId: cenario.id } : { nome: nome.trim(), ano: Number(ano), descricao: descricao.trim() || null, visualizacao }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cenarios"] });
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
    },
  });
  const previa = analisar.data;
  const feito = importar.data;
  const exibida = feito?.previa ?? previa;
  const recomecar = () => {
    analisar.reset();
    importar.reset();
    setArquivo(null);
  };
  const ocupado = analisar.isPending || importar.isPending;
  // O exercício escolhido precisa ser o dos meses do arquivo (num cenário existente, o do cenário, conferido na prévia).
  const exercicioDiferente = !cenario && previa && !feito && previa.ano !== Number(ano) ? `O arquivo é de ${previa.ano}, e o exercício escolhido, ${ano}: escolha ${previa.ano} ou outro arquivo.` : null;

  return (
    <Dialog open onOpenChange={(o) => (!o && !ocupado ? onFechar() : undefined)}>
      <DialogContent avisoAoSair className="flex max-h-[90vh] flex-col overflow-hidden rounded-sm sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{cenario ? `Importar Arquivo no Cenário ${cenario.nome}` : "Importar Cenário"}</DialogTitle>
          <DialogDescription>
            Escolha uma planilha (.xlsx) com as abas da DRE por unidade, como as do ORÇAMENTO BPM 2026 (Consolidado, Matriz, Filial, Serviços,
            Desp.+Extra e Extra RN), e a aba das metas, como a Metas (Orçamento) do INDICADORES DE RESULTADO. A ferramenta lê o arquivo, confere as
            abas e o exercício (os meses dos rótulos) e mostra o que vai entrar{cenario ? " e o que muda no cenário" : ""}. Nada é importado antes de você confirmar.
          </DialogDescription>
        </DialogHeader>

        {feito ? null : cenario ? (
          <p className="shrink-0 text-sm text-gray-700">
            Exercício: <span className="font-medium text-gray-900">{cenario.ano}</span> (o do cenário).
          </p>
        ) : (
          <div className="grid shrink-0 gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <div className="space-y-1.5">
              <Label htmlFor="importar-nome">Nome do Cenário</Label>
              <Input id="importar-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} className="rounded-sm" placeholder="Ex.: Cenário Adotado (REV02)" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="importar-ano">Exercício</Label>
              <select id="importar-ano" value={ano} onChange={(e) => setAno(e.target.value)} disabled={importar.isPending} className={classeSelect}>
                {[atual - 1, atual, atual + 1, atual + 2].map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="importar-descricao">Descrição (opcional)</Label>
              <Input id="importar-descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={500} className="rounded-sm" />
            </div>
            <div className="sm:col-span-2">
              <CampoVisualizacao valor={visualizacao} onMudar={setVisualizacao} bloqueio={importar.isPending ? "Importando…" : null} />
            </div>
          </div>
        )}

        {!exibida ? (
          <div className="shrink-0 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="importar-arquivo">Arquivo</Label>
              <CampoArquivo
                id="importar-arquivo"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                arquivo={arquivo}
                disabled={analisar.isPending}
                onEscolher={(f) => {
                  setArquivo(f);
                  if (f) analisar.mutate(f);
                }}
              />
            </div>
            {analisar.isPending ? (
              <p className="flex items-center gap-2 text-sm text-gray-700">
                <Loader2 className="size-4 animate-spin" />
                {envio < 100 ? `Enviando o arquivo… ${envio}%` : "Lendo as abas e comparando com o cenário…"}
              </p>
            ) : null}
            <Erro erro={analisar.isError ? mensagemDeErro(analisar.error, "Não foi possível ler o arquivo.") : null} />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <p className="shrink-0 text-sm text-gray-700">
              <span className="font-medium text-gray-900">{exibida.nomeArquivo}</span>: exercício {exibida.ano}
              {feito
                ? `, importado em ${feito.cenario.nome}.`
                : exibida.cenario
                  ? `, no cenário ${exibida.cenario.nome}.`
                  : ", num cenário novo."}
            </p>
            {exibida.bloqueio ? <Erro erro={exibida.bloqueio} /> : null}
            {exercicioDiferente ? <Erro erro={exercicioDiferente} /> : null}
            {!feito && !exibida.cenario && !nome.trim() ? <p className="shrink-0 text-sm text-yellow-800">Dê um nome ao cenário para importar.</p> : null}
            <TabelaPrevia p={exibida} importado={!!feito} />
            <Erro erro={importar.isError ? mensagemDeErro(importar.error, "Não foi possível importar o arquivo.") : null} />
          </div>
        )}

        <DialogFooter className="shrink-0">
          {feito ? (
            <>
              <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
                Fechar
              </Button>
              <Link href={`${base}/${feito.cenario.id}/resultados`} onClick={onFechar} className={`${botaoPrimario} inline-flex h-9 items-center px-4 text-sm`}>
                Abrir o Cenário
              </Link>
            </>
          ) : previa ? (
            <>
              <Button type="button" variant="outline" className="rounded-sm" onClick={recomecar} disabled={importar.isPending}>
                Escolher Outro Arquivo
              </Button>
              <Button
                type="button"
                className={botaoPrimario}
                disabled={!!previa.bloqueio || !!exercicioDiferente || (!cenario && !nome.trim()) || importar.isPending}
                title={!cenario && !nome.trim() ? "Dê um nome ao cenário" : undefined}
                onClick={() => importar.mutate()}
              >
                {importar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {importar.isPending ? "Importando…" : "Importar"}
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar} disabled={analisar.isPending}>
              Cancelar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
