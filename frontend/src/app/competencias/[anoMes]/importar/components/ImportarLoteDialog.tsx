"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Circle, Loader2, MinusCircle, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { inteiro } from "../../utils/formatacao";
import {
  importacoesService,
  type AbaLote,
  type ImportacaoDetalhe,
  type ResultadoLote,
  type ResumoBalancete,
  type ResumoDreComercial,
} from "../services/importacoesService";

const mensagemDoErro = (error: unknown) =>
  (error as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Não foi possível ler o arquivo.";

/** O que a importação mexeu em competências fechadas (ou já apuradas, nos preços), para avisar na linha da aba. */
function avisosDeFechadas(d: ImportacaoDetalhe): string[] {
  const r = d.resumo as (ResumoBalancete & ResumoDreComercial) | null;
  if (!r) return [];
  const avisos: string[] = [];
  if (r.modo === "COMPARACAO") {
    avisos.push(
      r.divergencias ? `Competência fechada: ${inteiro(r.divergencias)} divergência(s) com o gravado.` : "Competência fechada: sem diferença com o gravado.",
    );
  }
  const retro = (r.retroativas ?? []).filter((x) => x.divergencias > 0);
  if (retro.length) avisos.push(`Diferenças em competências fechadas: ${retro.map((x) => `${x.competencia} (${inteiro(x.divergencias)})`).join(", ")}.`);
  if (Array.isArray(r.divergencias) && r.divergencias.length) {
    const porMes = new Map<string, number>();
    for (const x of r.divergencias) porMes.set(x.competencia, (porMes.get(x.competencia) ?? 0) + 1);
    avisos.push(`Preços alterados em competências já apuradas: ${[...porMes].map(([m, n]) => `${m} (${n})`).join(", ")}.`);
  }
  return avisos;
}

/** Uma aba na fila: acompanha a importação até terminar. */
function AbaNaFila({ anoMes, aba, onAbrirRelatorio }: { anoMes: string; aba: AbaLote; onAbrirRelatorio: (id: string) => void }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["importacao", aba.importacaoId],
    queryFn: () => importacoesService.detalhar(aba.importacaoId!),
    refetchInterval: (q) => (q.state.data && q.state.data.status !== "PROCESSANDO" ? false : 1500),
  });
  const terminou = data && data.status !== "PROCESSANDO";
  // Ao terminar, a tela por trás (Em Vigor, Histórico, andamento do mês) se atualiza.
  useEffect(() => {
    if (!terminou) return;
    queryClient.invalidateQueries({ queryKey: ["importacoes", anoMes] });
    queryClient.invalidateQueries({ queryKey: ["competencias"] });
  }, [terminou, anoMes, queryClient]);

  if (!data || (data.status === "PROCESSANDO" && data.progresso === 0)) return <Situacao icone="fila" texto="Na fila" />;
  if (data.status === "PROCESSANDO") return <Situacao icone="andamento" texto={`Importando… ${data.progresso}%`} />;
  const relatorio = (
    <button type="button" onClick={() => onAbrirRelatorio(data.id)} className="text-xs font-medium text-gray-900 underline underline-offset-2">
      Relatório
    </button>
  );
  if (data.status === "REJEITADA") {
    return (
      <Situacao icone="erro" texto="Recusada" detalhe={data.motivoRejeicao ?? undefined}>
        {relatorio}
      </Situacao>
    );
  }
  const fechadas = avisosDeFechadas(data);
  return (
    <Situacao
      icone={fechadas.length ? "aviso" : "ok"}
      texto={data.comparacao ? "Comparada" : "Importada"}
      detalhe={`${inteiro(data.linhasAceitas)} registro(s) gravado(s)${data.linhasRejeitadas ? `, ${inteiro(data.linhasRejeitadas)} com erro` : ""}.`}
      avisos={fechadas}
    >
      {relatorio}
    </Situacao>
  );
}

const ICONES = {
  fila: <Circle className="size-4 text-gray-400" />,
  andamento: <Loader2 className="size-4 animate-spin text-gray-700" />,
  ok: <CheckCircle2 className="size-4 text-green-600" />,
  aviso: <AlertTriangle className="size-4 text-yellow-600" />,
  erro: <XCircle className="size-4 text-red-600" />,
  fora: <MinusCircle className="size-4 text-gray-400" />,
};

function Situacao({
  icone,
  texto,
  detalhe,
  avisos = [],
  children,
}: {
  icone: keyof typeof ICONES;
  texto: string;
  detalhe?: string;
  avisos?: string[];
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0">{ICONES[icone]}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className={`font-medium ${icone === "erro" ? "text-red-700" : "text-gray-900"}`}>{texto}</span>
          {children}
        </div>
        {detalhe ? <p className={`text-xs ${icone === "erro" ? "text-red-700" : "text-gray-600"}`}>{detalhe}</p> : null}
        {avisos.map((a) => (
          <p key={a} className="text-xs text-yellow-800">
            {a}{" "}
            <Link href="/divergencias" className="font-medium underline underline-offset-2">
              Ver divergências
            </Link>
          </p>
        ))}
      </div>
    </div>
  );
}

/** A situação de uma aba que não entrou na fila. */
function SituacaoSemFila({ aba }: { aba: AbaLote }) {
  if (aba.situacao === "INVALIDA") return <Situacao icone="erro" texto="Estrutura inválida" detalhe={aba.mensagem} />;
  if (aba.situacao === "IGNORADA") return <Situacao icone="fora" texto="Não importada" detalhe={aba.mensagem} />;
  if (aba.envio === "SEM_MUDANCA") return <Situacao icone="fora" texto="Sem mudança" detalhe={aba.mensagem} />;
  return <Situacao icone="erro" texto="Erro" detalhe={aba.mensagem} />;
}

/**
 * "Importar Arquivo": o usuário escolhe uma planilha .xlsx; a ferramenta lê o
 * arquivo inteiro, mostra as abas que reconheceu (e se a estrutura delas está
 * certa) e importa as prontas, uma por vez, sem pedir mais nada. Uma aba com
 * erro é avisada e a próxima segue.
 */
export function ImportarLoteDialog({
  anoMes,
  aberto,
  fechada,
  onFechar,
  onAbrirRelatorio,
}: {
  anoMes: string;
  aberto: boolean;
  /** Competência fechada: só o balancete entra, para comparar. */
  fechada: boolean;
  onFechar: () => void;
  onAbrirRelatorio: (id: string) => void;
}) {
  const campo = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [envio, setEnvio] = useState(0);
  const [resultado, setResultado] = useState<ResultadoLote | null>(null);
  const enviar = useMutation({
    mutationFn: (arquivo: File) => {
      setEnvio(0);
      setResultado(null);
      return importacoesService.enviarLote(anoMes, arquivo, setEnvio);
    },
    onSuccess: (r) => {
      setResultado(r);
      // As importações novas (na fila) já entram no Histórico e no Em Vigor da tela.
      queryClient.invalidateQueries({ queryKey: ["importacoes", anoMes] });
      queryClient.invalidateQueries({ queryKey: ["competencias"] });
    },
  });
  const recomecar = () => {
    enviar.reset();
    setResultado(null);
    if (campo.current) campo.current.value = "";
  };

  const prontas = resultado?.abas.filter((a) => a.envio === "NA_FILA").length ?? 0;
  return (
    <Dialog
      open={aberto}
      onOpenChange={(o) => {
        if (!o) {
          onFechar();
          recomecar();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-sm sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{fechada ? "Comparar Balancete" : "Importar Arquivo"}</DialogTitle>
          <DialogDescription>
            Escolha uma planilha (.xlsx). A ferramenta lê o arquivo inteiro, reconhece as abas que importa pelo nome (Balancete (Lista), Projetos
            (Lista), DRE…), confere a estrutura de cada uma e importa as que estão certas, uma por vez. Só os registros do mês desta competência são
            gravados; reimportar um tipo substitui o lote anterior dele.
          </DialogDescription>
        </DialogHeader>

        {!resultado ? (
          <div className="space-y-3">
            <Input
              ref={campo}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={enviar.isPending}
              className="rounded-sm border-gray-300 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) enviar.mutate(f);
              }}
            />
            {enviar.isPending ? (
              <p className="flex items-center gap-2 text-sm text-gray-700">
                <Loader2 className="size-4 animate-spin" />
                {envio < 100 ? `Enviando o arquivo… ${envio}%` : "Lendo o arquivo e conferindo as abas…"}
              </p>
            ) : null}
            {enviar.isError ? <p className="text-sm text-red-700">{mensagemDoErro(enviar.error)}</p> : null}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              <span className="font-medium text-gray-900">{resultado.nomeArquivo}</span>:{" "}
              {resultado.abas.length === 0
                ? "nenhuma aba que a ferramenta importa."
                : `${resultado.abas.length} aba(s) reconhecida(s), ${prontas} na fila de importação.`}
            </p>
            {resultado.abas.length > 0 ? (
              <table className="tabela-sig w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-bold text-gray-900 [&>th]:!static [&>th]:!bg-bpm-primary">
                    <th className="px-3 py-2">Aba</th>
                    <th className="px-3 py-2">Tipo de Arquivo</th>
                    <th className="px-3 py-2 text-right">Registros</th>
                    <th className="px-3 py-2">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.abas.map((a) => (
                    <tr key={a.aba} className="border-b border-gray-100 align-top">
                      <td className="px-3 py-2 font-medium text-gray-900">{a.aba}</td>
                      <td className="px-3 py-2 text-gray-700">{a.rotulo}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{a.registros !== undefined ? inteiro(a.registros) : "—"}</td>
                      <td className="px-3 py-2">
                        {a.envio === "NA_FILA" && a.importacaoId ? (
                          <AbaNaFila anoMes={anoMes} aba={a} onAbrirRelatorio={onAbrirRelatorio} />
                        ) : (
                          <SituacaoSemFila aba={a} />
                        )}
                        {a.avisos.map((x) => (
                          <p key={x} className="mt-0.5 text-xs text-yellow-800">
                            {x}
                          </p>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {resultado.outras.length > 0 ? (
              <p className="text-xs text-gray-500">Abas sem importação (ignoradas): {resultado.outras.join(", ")}.</p>
            ) : null}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" className="rounded-sm" onClick={recomecar}>
                Importar Outro Arquivo
              </Button>
              <Button type="button" className="rounded-sm" onClick={() => (onFechar(), recomecar())}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
