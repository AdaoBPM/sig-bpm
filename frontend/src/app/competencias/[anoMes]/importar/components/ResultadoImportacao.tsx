"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

import {
  importacoesService,
  type ImportacaoDetalhe,
} from "../services/importacoesService";
import {
  dataHora,
  inteiro,
  moeda,
  ROTULO_REJEICAO,
} from "../utils/formatacao";

/** Acima disso a tabela de rejeições corta — o relatório completo fica no banco. */
const MAX_REJEICOES = 200;

type ResultadoImportacaoProps = {
  id: string;
  anoMes: string;
};

function Contador({
  rotulo,
  valor,
  detalhe,
  destaque,
}: {
  rotulo: string;
  valor: number;
  detalhe?: string;
  destaque?: "ok" | "erro";
}) {
  const cor =
    destaque === "erro"
      ? "text-red-700"
      : destaque === "ok"
        ? "text-green-700"
        : "text-gray-900";
  return (
    <div className="border border-gray-200 rounded-sm p-4">
      <p className="text-xs font-bold tracking-wide text-gray-600 uppercase">{rotulo}</p>
      <p className={`mt-1 text-2xl font-extrabold tabular-nums ${cor}`}>{inteiro(valor)}</p>
      {detalhe ? <p className="mt-0.5 text-xs text-gray-500">{detalhe}</p> : null}
    </div>
  );
}

function Concluida({ imp }: { imp: ImportacaoDetalhe }) {
  const resumo = imp.resumo;
  const rejeicoes = imp.relatorioErros ?? [];
  const centros = resumo?.centrosSemCadastro ?? [];
  const foraDoCadastro = centros.filter((c) => !c.obra);
  const obras = centros.filter((c) => c.obra);

  return (
    <div className="space-y-4">
      {imp.substituidaEm ? (
        <div className="flex items-center gap-2 rounded-sm border border-gray-200 bg-gray-50 p-3">
          <AlertCircle className="size-4 shrink-0 text-gray-500" />
          <p className="text-sm text-gray-600">
            Lote substituído por uma importação posterior em{" "}
            {dataHora(imp.substituidaEm)}. Os lançamentos dele não estão mais na
            competência.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Contador rotulo="Linhas lidas" valor={imp.linhasLidas} />
        <Contador rotulo="Aceitas" valor={imp.linhasAceitas} destaque="ok" detalhe="lançamentos gravados" />
        <Contador
          rotulo="Rejeitadas"
          valor={imp.linhasRejeitadas}
          destaque={imp.linhasRejeitadas > 0 ? "erro" : undefined}
        />
        <Contador
          rotulo="Ignoradas"
          valor={imp.linhasIgnoradas}
          detalhe={
            resumo
              ? `${inteiro(resumo.ignoradas.subtotais)} subtotais · ${inteiro(resumo.ignoradas.semMovimento)} sem movimento`
              : undefined
          }
        />
      </div>

      {resumo ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="border border-gray-200 rounded-sm p-4">
            <h3 className="text-sm font-bold text-gray-900">Conferência do arquivo</h3>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-600">Soma das linhas do mês</dt>
                <dd className="font-medium tabular-nums">{moeda(resumo.somaArquivo)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-600">Total Geral do arquivo</dt>
                <dd className="font-medium tabular-nums">
                  {resumo.totalGeral === null ? "—" : moeda(resumo.totalGeral)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-gray-100 pt-1.5">
                <dt className="text-gray-600">Gravado</dt>
                <dd className="font-bold tabular-nums">{moeda(resumo.valorAceito)}</dd>
              </div>
              {Number(resumo.valorRejeitado) !== 0 ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-red-700">Rejeitado</dt>
                  <dd className="font-bold tabular-nums text-red-700">
                    {moeda(resumo.valorRejeitado)}
                  </dd>
                </div>
              ) : null}
            </dl>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-green-700">
              <CheckCircle2 className="size-3.5" />
              {resumo.totalGeral === null
                ? "O arquivo não tem Total Geral para conferir."
                : "A soma das linhas confere com o Total Geral."}
            </p>
          </div>

          <div className="border border-gray-200 rounded-sm p-4">
            <h3 className="text-sm font-bold text-gray-900">Por filial</h3>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase">
                  <th className="py-1 font-bold">Filial</th>
                  <th className="py-1 text-right font-bold">Lançamentos</th>
                  <th className="py-1 text-right font-bold">Movimentação</th>
                </tr>
              </thead>
              <tbody>
                {resumo.porFilial.map((f) => (
                  <tr key={f.filial} className="border-t border-gray-100">
                    <td className="py-1.5">{f.filial}</td>
                    <td className="py-1.5 text-right tabular-nums">{inteiro(f.linhas)}</td>
                    <td className="py-1.5 text-right tabular-nums">{moeda(f.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-gray-500">Aba lida: {resumo.aba}</p>
          </div>
        </div>
      ) : null}

      {foraDoCadastro.length > 0 ? (
        <div className="rounded-sm border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-yellow-800" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium">
                {foraDoCadastro.length} centro(s) de custo fora do cadastro
              </p>
              <p className="mt-0.5">
                Os lançamentos foram gravados com o código de origem e vão aparecer
                como pendência na classificação até o centro ser cadastrado.
              </p>
              <ul className="mt-2 space-y-0.5">
                {foraDoCadastro.map((c) => (
                  <li key={c.codigo} className="tabular-nums">
                    <span className="font-medium">{c.codigo}</span> {c.nome ?? ""} —{" "}
                    {c.linhas} lançamento(s), {moeda(c.valor)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {obras.length > 0 ? (
        <p className="text-xs text-gray-500">
          {obras.length} centros de custo de obra (1.98 e 1.99), com{" "}
          {inteiro(obras.reduce((n, c) => n + c.linhas, 0))} lançamentos, entraram
          sem vínculo com o cadastro, como previsto: o destino deles é decidido na
          classificação.
        </p>
      ) : null}

      {rejeicoes.length > 0 ? (
        <div className="border border-gray-200 rounded-sm">
          <div className="border-b border-gray-200 px-4 py-3">
            <h3 className="text-sm font-bold text-gray-900">Linhas rejeitadas</h3>
            <p className="text-xs text-gray-500">
              Não foram gravadas. Corrija o cadastro ou o arquivo e importe de novo.
              {rejeicoes.length > MAX_REJEICOES
                ? ` Mostrando as primeiras ${MAX_REJEICOES} de ${inteiro(rejeicoes.length)}.`
                : null}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {["Linha", "Motivo", "Detalhe", "Filial", "Centro", "Conta", "Valor"].map((c) => (
                    <th
                      key={c}
                      className="px-4 py-2 text-left text-xs font-bold tracking-wide text-gray-600 uppercase"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rejeicoes.slice(0, MAX_REJEICOES).map((r) => (
                  <tr key={`${r.linha}-${r.codigo}`} className="border-b border-gray-100">
                    <td className="px-4 py-2 text-sm tabular-nums">{r.linha}</td>
                    <td className="px-4 py-2 text-sm font-medium text-red-700">
                      {ROTULO_REJEICAO[r.codigo] ?? r.codigo}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">{r.mensagem}</td>
                    <td className="px-4 py-2 text-sm">{r.filial ?? "—"}</td>
                    <td className="px-4 py-2 text-sm">{r.codigoCentroCusto ?? "—"}</td>
                    <td className="px-4 py-2 text-sm">{r.reduzido ?? "—"}</td>
                    <td className="px-4 py-2 text-right text-sm tabular-nums">
                      {r.valor ? moeda(r.valor) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ResultadoImportacao({ id, anoMes }: ResultadoImportacaoProps) {
  const queryClient = useQueryClient();
  const { data: imp, isPending, isError } = useQuery({
    queryKey: ["importacao", id],
    queryFn: () => importacoesService.detalhar(id),
    // Enquanto processa, a tela acompanha; quando termina, para de perguntar.
    refetchInterval: (query) =>
      query.state.data?.status === "PROCESSANDO" ? 1000 : false,
  });

  const status = imp?.status;
  useEffect(() => {
    if (status && status !== "PROCESSANDO") {
      queryClient.invalidateQueries({ queryKey: ["importacoes", anoMes] });
    }
  }, [status, anoMes, queryClient]);

  if (isPending) {
    return <div className="h-32 animate-pulse rounded-sm bg-gray-100" />;
  }
  if (isError || !imp) {
    return (
      <div className="rounded-sm border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">Erro ao carregar a importação.</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 bg-white rounded-sm p-6">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-xl font-bold tracking-tight text-gray-900">
          {imp.nomeArquivo}
        </h2>
        <p className="text-sm text-gray-500">
          {dataHora(imp.importadoEm)}
          {imp.usuario ? ` · ${imp.usuario.nome}` : null}
        </p>
      </div>

      {imp.status === "PROCESSANDO" ? (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="size-4 animate-spin" />
            Processando… {imp.progresso}%
          </p>
          <div className="h-2 w-full rounded-sm bg-gray-100">
            <div
              className="h-2 rounded-sm bg-bpm-primary transition-all"
              style={{ width: `${Math.max(imp.progresso, 5)}%` }}
            />
          </div>
        </div>
      ) : imp.status === "REJEITADA" ? (
        <div className="flex items-start gap-2 rounded-sm border border-red-200 bg-red-50 p-4">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-700" />
          <div className="text-sm text-red-700">
            <p className="font-medium">Arquivo recusado — nada foi gravado.</p>
            <p className="mt-0.5">{imp.motivoRejeicao}</p>
          </div>
        </div>
      ) : (
        <Concluida imp={imp} />
      )}
    </div>
  );
}
