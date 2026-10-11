"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

import {
  importacoesService,
  type ImportacaoDetalhe,
  type Rejeicao,
  type ResumoBalancete,
  type ResumoDreComercial,
  type ResumoEstoqueInicial,
  type ResumoIndicadores,
  type ResumoLista,
} from "../services/importacoesService";
import {
  dataHora,
  ROTULO_TIPO,
  inteiro,
  moeda,
  ROTULO_REJEICAO,
} from "../../utils/formatacao";
import { SheetHeader } from "@/components/ui/sheet";
import { useAuth } from "@/context/AuthContext";
import { atualizarCompetencia } from "@/lib/atualizarCompetencia";
import { iniciaisMaiusculas } from "@/lib/texto";

/** Acima disso a tabela de rejeições corta — o relatório completo fica no banco. */
const MAX_REJEICOES = 200;

type ResultadoImportacaoProps = {
  id: string;
  anoMes: string;
  /** No painel lateral, sem a moldura de cartão; o nome do arquivo vira o título do painel. */
  noPainel?: boolean;
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
      <p className="text-xs font-bold text-gray-600">{iniciaisMaiusculas(rotulo)}</p>
      <p className={`mt-1 text-2xl font-extrabold ${cor}`}>{inteiro(valor)}</p>
      {detalhe ? <p className="mt-0.5 text-xs text-gray-500">{detalhe}</p> : null}
    </div>
  );
}

/** Linhas recusadas. No balancete, com filial, centro, conta e valor. */
function TabelaRejeicoes({
  rejeicoes,
  balancete = false,
}: {
  rejeicoes: Rejeicao[];
  balancete?: boolean;
}) {
  if (rejeicoes.length === 0) return null;
  const colunas = balancete
    ? ["Linha", "Motivo", "Detalhe", "Filial", "Centro", "Conta", "Valor"]
    : ["Linha", "Motivo", "Detalhe"];
  return (
    <div className="border border-gray-200 rounded-sm">
      <div className="border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-bold text-gray-900">Linhas Rejeitadas</h3>
        <p className="text-xs text-gray-500">
          Não foram gravadas. Corrija o cadastro ou o arquivo e importe de novo.
          {rejeicoes.length > MAX_REJEICOES
            ? ` Mostrando as primeiras ${MAX_REJEICOES} de ${inteiro(rejeicoes.length)}.`
            : null}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="tabela-sig w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {colunas.map((c) => (
                <th
                  key={c}
                  className="px-4 py-2 text-left text-xs font-bold text-gray-600"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rejeicoes.slice(0, MAX_REJEICOES).map((r) => (
              <tr key={`${r.linha}-${r.codigo}`} className="border-b border-gray-100">
                <td className="px-4 py-2 text-sm">{r.linha}</td>
                <td className="px-4 py-2 text-sm font-medium text-red-700">
                  {ROTULO_REJEICAO[r.codigo] ?? r.codigo}
                </td>
                <td className="px-4 py-2 text-sm text-gray-600">{r.mensagem}</td>
                {balancete ? (
                  <>
                    <td className="px-4 py-2 text-sm">{r.filial ?? "—"}</td>
                    <td className="px-4 py-2 text-sm">{r.codigoCentroCusto ?? "—"}</td>
                    <td className="px-4 py-2 text-sm">{r.reduzido ?? "—"}</td>
                    <td className="px-4 py-2 text-right text-sm">
                      {r.valor ? moeda(r.valor) : "—"}
                    </td>
                  </>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LoteSubstituido({ em }: { em: string | null }) {
  if (!em) return null;
  return (
    <div className="flex items-center gap-2 rounded-sm border border-gray-200 bg-gray-50 p-3">
      <AlertCircle className="size-4 shrink-0 text-gray-500" />
      <p className="text-sm text-gray-600">
        Lote substituído por uma importação posterior em {dataHora(em)}. Os
        registros dele não estão mais na competência.
      </p>
    </div>
  );
}

function ConcluidaBalancete({ imp }: { imp: ImportacaoDetalhe }) {
  const resumo = imp.resumo as ResumoBalancete | null;
  const rejeicoes = imp.relatorioErros ?? [];
  const centros = resumo?.centrosSemCadastro ?? [];
  const foraDoCadastro = centros.filter((c) => !c.obra);
  const obras = centros.filter((c) => c.obra);

  if (resumo?.modo === "COMPARACAO") {
    return (
      <div className="flex items-start gap-2 rounded-sm border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <p>
          Competência fechada: o balancete foi só comparado com o gravado, e nada foi substituído.{" "}
          {resumo.divergencias
            ? `${inteiro(resumo.divergencias)} divergência(s) nova(s), somando ${resumo.diferenca} de diferença.`
            : "Nenhuma diferença nova em relação ao que está gravado."}{" "}
          <Link href="/divergencias" className="font-medium underline underline-offset-2">
            Ver divergências
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <LoteSubstituido em={imp.substituidaEm} />
      {resumo?.retroativas?.some((r) => r.divergencias > 0) ? (
        <div className="flex items-start gap-2 rounded-sm border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            O arquivo traz meses já fechados que diferem do gravado:{" "}
            {resumo.retroativas
              .filter((r) => r.divergencias > 0)
              .map((r) => `${r.competencia} (${inteiro(r.divergencias)} divergência(s))`)
              .join(", ")}
            .{" "}
            <Link href="/divergencias" className="font-medium underline underline-offset-2">
              Ver divergências
            </Link>
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
            <h3 className="text-sm font-bold text-gray-900">Conferência do Arquivo</h3>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-600">Soma das Linhas do Mês</dt>
                <dd className="font-medium">{moeda(resumo.somaArquivo)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-600">Total Geral do Arquivo</dt>
                <dd className="font-medium">
                  {resumo.totalGeral === null ? "—" : moeda(resumo.totalGeral)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-gray-100 pt-1.5">
                <dt className="text-gray-600">Gravado</dt>
                <dd className="font-bold">{moeda(resumo.valorAceito)}</dd>
              </div>
              {Number(resumo.valorRejeitado) !== 0 ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-red-700">Rejeitado</dt>
                  <dd className="font-bold text-red-700">
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
            <h3 className="text-sm font-bold text-gray-900">Por Filial</h3>
            <table className="tabela-sig mt-2 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="py-1 font-bold">Filial</th>
                  <th className="py-1 text-right font-bold">Lançamentos</th>
                  <th className="py-1 text-right font-bold">Movimentação</th>
                </tr>
              </thead>
              <tbody>
                {resumo.porFilial.map((f) => (
                  <tr key={f.filial} className="border-t border-gray-100">
                    <td className="py-1.5">{f.filial}</td>
                    <td className="py-1.5 text-right">{inteiro(f.linhas)}</td>
                    <td className="py-1.5 text-right">{moeda(f.valor)}</td>
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
                  <li key={c.codigo}>
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

      <TabelaRejeicoes rejeicoes={rejeicoes} balancete />
    </div>
  );
}

function ConcluidaLista({ imp }: { imp: ImportacaoDetalhe }) {
  const resumo = imp.resumo as ResumoLista | null;
  const rejeicoes = imp.relatorioErros ?? [];

  return (
    <div className="space-y-4">
      <LoteSubstituido em={imp.substituidaEm} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Contador rotulo="Linhas lidas" valor={imp.linhasLidas} />
        <Contador rotulo="Aceitas" valor={imp.linhasAceitas} destaque="ok" detalhe="registros do mês gravados" />
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
              ? `${inteiro(resumo.ignoradas.outrosMeses)} de outros meses · ${inteiro(resumo.ignoradas.vazias)} sem dado` +
                (resumo.ignoradas.semEfeito ? ` · ${inteiro(resumo.ignoradas.semEfeito)} fora da receita` : "")
              : undefined
          }
        />
      </div>

      {resumo ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="border border-gray-200 rounded-sm p-4">
            <h3 className="text-sm font-bold text-gray-900">
              {resumo.receita ? "Totais da Lista" : "Volumes para os Rateios"}
            </h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {resumo.receita
                ? "Por unidade, para conferir com a aba de resumo da lista. Alimentam a receita prévia."
                : "As linhas da aba Totais do BASE REALIZADO (OPERAÇÃO) que esta lista alimenta."}
            </p>
            <table className="tabela-sig mt-2 w-full text-sm">
              <tbody>
                {resumo.totais.map((t) => (
                  <tr key={t.codigo} className="border-t border-gray-100">
                    <td className="py-1.5 text-gray-700">{t.rotulo}</td>
                    <td className="py-1.5 text-right font-medium">
                      {t.medida === "R$"
                        ? moeda(t.quantidade)
                        : Number(t.quantidade).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                    </td>
                    <td className="py-1.5 pl-2 text-xs text-gray-500">{t.medida}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border border-gray-200 rounded-sm p-4 text-sm text-gray-600">
            <h3 className="text-sm font-bold text-gray-900">Leitura</h3>
            <p className="mt-2">
              Aba lida: <span className="font-medium text-gray-900">{resumo.aba}</span>
            </p>
            <p className="mt-1">
              {resumo.obrasCriadas > 0
                ? `${inteiro(resumo.obrasCriadas)} obra(s) nova(s) cadastradas a partir desta lista.`
                : "Nenhuma obra nova."}
            </p>
            {resumo.substituiu.length > 0 ? <p className="mt-1">Substituiu o lote anterior desta lista.</p> : null}
          </div>
        </div>
      ) : null}

      {resumo && resumo.avisos.length > 0 ? (
        <div className="rounded-sm border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-yellow-800" />
            <ul className="space-y-1 text-sm text-yellow-800">
              {resumo.avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <TabelaRejeicoes rejeicoes={rejeicoes} />
    </div>
  );
}

function valorOuTraco(v: string | null) {
  return v === null ? "—" : moeda(v);
}

function ConcluidaDreComercial({ imp }: { imp: ImportacaoDetalhe }) {
  const resumo = imp.resumo as ResumoDreComercial | null;
  const rejeicoes = imp.relatorioErros ?? [];
  const p = resumo?.precos;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Contador rotulo="Linhas lidas" valor={imp.linhasLidas} />
        <Contador
          rotulo="Preços"
          valor={imp.linhasAceitas}
          destaque="ok"
          detalhe={resumo ? `de ${inteiro(resumo.obras)} obras` : undefined}
        />
        <Contador
          rotulo="Rejeitadas"
          valor={imp.linhasRejeitadas}
          destaque={imp.linhasRejeitadas > 0 ? "erro" : undefined}
        />
        <Contador
          rotulo="Ignoradas"
          valor={imp.linhasIgnoradas}
          detalhe={
            resumo?.ignoradas
              ? `${inteiro(resumo.ignoradas.foraDoFiltro)} fora dos preços · ${inteiro(resumo.ignoradas.repetidas)} repetidas · ${inteiro(resumo.ignoradas.vazias)} vazias`
              : "vazias ou repetidas"
          }
        />
      </div>

      {resumo && p ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="border border-gray-200 rounded-sm p-4">
            <h3 className="text-sm font-bold text-gray-900">Mudanças nos Preços</h3>
            <dl className="mt-3 space-y-1.5 text-sm">
              {(
                [
                  ["Novos", p.novos, "text-green-700"],
                  ["Alterados (o anterior fica no histórico)", p.alterados, "text-yellow-800"],
                  ["Sem mudança", p.inalterados, "text-gray-900"],
                  ["Fora do arquivo (encerrados, ficam no histórico)", p.removidos, "text-red-700"],
                ] as const
              ).map(([rotulo, n, cor]) => (
                <div key={rotulo} className="flex justify-between gap-4">
                  <dt className="text-gray-600">{iniciaisMaiusculas(rotulo)}</dt>
                  <dd className={`font-bold ${cor}`}>{inteiro(n)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="border border-gray-200 rounded-sm p-4 text-sm text-gray-600">
            <h3 className="text-sm font-bold text-gray-900">Obras</h3>
            <p className="mt-2">
              Aba lida: <span className="font-medium text-gray-900">{resumo.aba}</span>
            </p>
            <p className="mt-1">
              {resumo.obrasCriadas > 0
                ? `${inteiro(resumo.obrasCriadas)} obra(s) nova(s) cadastradas a partir da DRE.`
                : "Nenhuma obra nova."}
            </p>
            {resumo.obrasNomeadas ? (
              <p className="mt-1">{inteiro(resumo.obrasNomeadas)} obra(s) sem nome receberam o nome da aba Pedidos.</p>
            ) : null}
            <p className="mt-1">
              {resumo.obrasComAditivo.length > 0
                ? `Com aditivo (versão acima de 0): ${resumo.obrasComAditivo.join(", ")}.`
                : "Nenhuma obra com aditivo."}
            </p>
            <p className="mt-1">
              {inteiro(resumo.obrasSemContrato)} obra(s) cadastrada(s) sem preço vigente na versão 0
              (sem contrato).
            </p>
          </div>
        </div>
      ) : null}

      {resumo && resumo.obrasRepetidas.length > 0 ? (
        <div className="rounded-sm border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-start gap-2 text-sm text-yellow-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">DRE colada mais de uma vez</p>
              <p className="mt-0.5">
                Linhas idênticas repetidas foram gravadas uma vez só. Na planilha, a soma da
                receita contaria essas linhas em dobro.
              </p>
              <p className="mt-1">
                {resumo.obrasRepetidas.map((o) => `${o.obra} (${o.linhas} linha(s))`).join(", ")}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {resumo && p && resumo.alteracoes.length > 0 ? (
        <div className="border border-gray-200 rounded-sm">
          <div className="border-b border-gray-200 px-4 py-3">
            <h3 className="text-sm font-bold text-gray-900">Preços Alterados</h3>
            <p className="text-xs text-gray-500">
              O preço anterior continua registrado para o que já foi apurado com ele.
              {resumo.alteracoes.length < p.alterados
                ? ` Mostrando ${resumo.alteracoes.length} de ${inteiro(p.alterados)}.`
                : null}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="tabela-sig w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-bold text-gray-600">
                  <th className="px-4 py-2">Obra</th>
                  <th className="px-4 py-2">Etapa · Linha</th>
                  <th className="px-4 py-2">Conta</th>
                  <th className="px-4 py-2 text-right">V. Unit.</th>
                  <th className="px-4 py-2 text-right">V. Total</th>
                </tr>
              </thead>
              <tbody>
                {resumo.alteracoes.map((a) => (
                  <tr
                    key={`${a.obra}|${a.etapa}|${a.linha}|${a.conta}|${a.departamento}`}
                    className="border-b border-gray-100"
                  >
                    <td className="px-4 py-2 font-medium">{a.obra}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {a.etapa ?? "—"} · {a.linha}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{a.conta}</td>
                    <td className="px-4 py-2 text-right">
                      <span className="text-red-700 line-through">{valorOuTraco(a.antes.unitario)}</span>{" "}
                      <span className="text-green-700">{valorOuTraco(a.depois.unitario)}</span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className="text-red-700 line-through">{valorOuTraco(a.antes.total)}</span>{" "}
                      <span className="text-green-700">{valorOuTraco(a.depois.total)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <p className="text-xs text-gray-500">
        Consulte os preços e o histórico em{" "}
        <Link href="/cadastros/precos-contrato" className="underline">
          Preços do contrato
        </Link>
        .
      </p>

      <TabelaRejeicoes rejeicoes={rejeicoes} />
    </div>
  );
}

function ConcluidaEstoqueInicial({ imp }: { imp: ImportacaoDetalhe }) {
  const resumo = imp.resumo as ResumoEstoqueInicial | null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Contador rotulo="Linhas lidas" valor={imp.linhasLidas} />
        <Contador rotulo="Saldos" valor={resumo?.saldos ?? 0} destaque="ok" detalhe="por obra e linha" />
        <Contador rotulo="Rejeitadas" valor={imp.linhasRejeitadas} destaque={imp.linhasRejeitadas > 0 ? "erro" : undefined} />
        <Contador rotulo="Obras novas" valor={resumo?.obrasCriadas ?? 0} />
      </div>
      {resumo ? (
        <div className="border border-gray-200 rounded-sm p-4">
          <h3 className="text-sm font-bold text-gray-900">Saldo por Linha</h3>
          <table className="tabela-sig mt-2 w-full text-sm">
            <tbody>
              {resumo.porLinha.map((l) => (
                <tr key={l.linha} className="border-t border-gray-100">
                  <td className="py-1.5 text-gray-700">{l.linha}</td>
                  <td className="py-1.5 text-right">{Number(l.volume).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} m³</td>
                  <td className="py-1.5 text-right">{moeda(l.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-gray-500">
            Aba lida: {resumo.aba}. Vale como o saldo final desta competência; a apuração do mês seguinte parte dele.
          </p>
        </div>
      ) : null}
      <TabelaRejeicoes rejeicoes={imp.relatorioErros ?? []} />
    </div>
  );
}

/** O valor do indicador como na aba: percentuais (fração) em %, os demais com até duas casas. */
const valorIndicador = (nome: string, v: number) =>
  /Inadimplência|Turnover|Margem de Contribuição|Mix/.test(nome)
    ? `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
    : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function ConcluidaIndicadores({ imp }: { imp: ImportacaoDetalhe }) {
  const resumo = imp.resumo as ResumoIndicadores | null;
  const metas = imp.tipo === "METAS_ORCAMENTO";
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Contador rotulo="Linhas lidas" valor={imp.linhasLidas} />
        <Contador rotulo={metas ? "Metas" : "Indicadores"} valor={imp.linhasAceitas} destaque="ok" detalhe="com valor no mês" />
        <Contador rotulo="Rejeitadas" valor={imp.linhasRejeitadas} destaque={imp.linhasRejeitadas > 0 ? "erro" : undefined} />
        <Contador rotulo="Sem valor no mês" valor={imp.linhasIgnoradas} />
      </div>
      {resumo ? (
        <div className="rounded-sm border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-900">{metas ? "Metas do Mês" : "Indicadores do Mês"}</h3>
          <table className="tabela-sig mt-2 w-full text-sm">
            <tbody>
              {resumo.indicadores.map((i) => (
                <tr key={i.nome} className="border-t border-gray-100">
                  <td className="py-1.5 text-gray-700">{i.nome}</td>
                  <td className="py-1.5 text-right">{valorIndicador(i.nome, i.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-gray-500">
            Aba lida: {resumo.aba}.{" "}
            {metas
              ? "Os valores são o orçado do Painel de Bordo (Resultados Realizados); não entram na apuração."
              : "Os valores vão para a tela Indicadores (Resultados Realizados); não entram na apuração."}
          </p>
        </div>
      ) : null}
      <TabelaRejeicoes rejeicoes={imp.relatorioErros ?? []} />
    </div>
  );
}

export function ResultadoImportacao({ id, anoMes, noPainel }: ResultadoImportacaoProps) {
  const queryClient = useQueryClient();
  const { refresh } = useAuth();
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
      // A importação muda o mês inteiro (e, no balancete de mês fechado, as divergências e o aviso).
      atualizarCompetencia(queryClient, anoMes);
      void refresh();
    }
  }, [status, anoMes, queryClient, refresh]);

  const titulo = imp ? (
    <>
      <h2 className="text-xl font-bold tracking-tight text-gray-900">
        {ROTULO_TIPO[imp.tipo] ?? imp.tipo} · {imp.nomeArquivo}
      </h2>
      <p className="text-sm text-gray-500">
        {dataHora(imp.importadoEm)}
        {imp.usuario ? ` · ${imp.usuario.nome}` : null}
        {imp.substituidaEm ? ` · substituída em ${dataHora(imp.substituidaEm)}` : null}
      </p>
    </>
  ) : null;

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
    <div className={noPainel ? "" : "border border-gray-200 bg-white rounded-sm p-6"}>
      {noPainel ? (
        // No painel, o título fica fixo ao rolar (com o botão de fechar).
        <SheetHeader className="-top-6 -mx-6 -mt-6 mb-1 gap-1 px-6 pt-6 pb-3">{titulo}</SheetHeader>
      ) : (
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">{titulo}</div>
      )}

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
        imp.tipo === "BALANCETE" ? (
          <ConcluidaBalancete imp={imp} />
        ) : imp.tipo === "DRE_COMERCIAL" ? (
          <ConcluidaDreComercial imp={imp} />
        ) : imp.tipo === "ESTOQUE_INICIAL" ? (
          <ConcluidaEstoqueInicial imp={imp} />
        ) : imp.tipo === "INDICADORES_ADMIN" || imp.tipo === "INDICADORES_COMERCIAL" || imp.tipo === "METAS_ORCAMENTO" ? (
          <ConcluidaIndicadores imp={imp} />
        ) : (
          <ConcluidaLista imp={imp} />
        )
      )}
    </div>
  );
}
