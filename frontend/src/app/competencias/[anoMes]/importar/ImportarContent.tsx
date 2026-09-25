"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Lock } from "lucide-react";

import { DataTable } from "@/components/shared/DataTable";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { StatusCompetenciaBadge } from "../../components/StatusCompetenciaBadge";
import { EnviarArquivoForm } from "./components/EnviarArquivoForm";
import { ResultadoImportacao } from "./components/ResultadoImportacao";
import {
  importacoesService,
  type Importacao,
  type StatusImportacao,
} from "./services/importacoesService";
import {
  dataHora,
  inteiro,
  lerAnoMes,
  MESES,
  rotuloCompetencia,
} from "../utils/formatacao";

const ESTILO_STATUS: Record<StatusImportacao, { classe: string; rotulo: string }> = {
  PROCESSANDO: { classe: "border-blue-200 bg-blue-50 text-blue-700", rotulo: "Processando" },
  CONCLUIDA: { classe: "border-green-200 bg-green-50 text-green-700", rotulo: "Concluída" },
  REJEITADA: { classe: "border-red-200 bg-red-50 text-red-700", rotulo: "Recusada" },
};

function StatusImportacaoBadge({ imp }: { imp: Importacao }) {
  if (imp.substituidaEm) {
    return (
      <span className="inline-block rounded-sm border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-500">
        Substituída
      </span>
    );
  }
  const { classe, rotulo } = ESTILO_STATUS[imp.status];
  return (
    <span className={`inline-block rounded-sm border px-2 py-0.5 text-xs font-medium ${classe}`}>
      {rotulo}
    </span>
  );
}

export function ImportarContent() {
  const { anoMes } = useParams<{ anoMes: string }>();
  useRegistrarAcessoTela(`/competencias/${anoMes}/importar`);

  const periodo = lerAnoMes(anoMes);
  const [selecionada, setSelecionada] = useState<string | null>(null);

  const { data, isPending, isError, error } = useQuery({
    queryKey: ["importacoes", anoMes],
    queryFn: () => importacoesService.listar(anoMes),
    enabled: periodo !== null,
  });

  if (!periodo) {
    return (
      <div className="rounded-sm border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">
          Competência inválida na URL: {anoMes}. Use o formato aaaa-mm.
        </p>
      </div>
    );
  }

  const itens = data?.itens ?? [];
  // Sem escolha explícita, mostra a importação mais recente.
  const emFoco = selecionada ?? itens[0]?.id ?? null;
  const fechada = data?.competencia.status === "FECHADA";
  const mensagemErro =
    (error as { response?: { data?: { error?: string } } } | null)?.response?.data
      ?.error ?? "Erro ao carregar as importações.";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/competencias"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="size-4" />
          Competências
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
            Importação · {rotuloCompetencia(periodo.ano, periodo.mes)}
          </h1>
          <span className="text-sm text-gray-400">{MESES[periodo.mes - 1]}</span>
          {data ? <StatusCompetenciaBadge status={data.competencia.status} /> : null}
        </div>
      </div>

      {isError ? (
        <div className="rounded-sm border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{mensagemErro}</p>
        </div>
      ) : null}

      {fechada ? (
        <div className="flex items-center gap-2 rounded-sm border border-gray-200 bg-gray-50 p-4">
          <Lock className="size-4 shrink-0 text-gray-500" />
          <p className="text-sm text-gray-600">
            Competência fechada: não recebe importações. Para importar, ela
            precisa ser reaberta.
          </p>
        </div>
      ) : data ? (
        <PermissionGuard permission="importacao:editar">
          <EnviarArquivoForm anoMes={anoMes} onEnviado={(imp) => setSelecionada(imp.id)} />
        </PermissionGuard>
      ) : null}

      {emFoco ? <ResultadoImportacao key={emFoco} id={emFoco} anoMes={anoMes} /> : null}

      <div className="border border-gray-200 bg-white rounded-sm">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-bold text-gray-900">Histórico da competência</h2>
          <p className="text-xs text-gray-500">
            Toda importação fica registrada, inclusive as recusadas e as substituídas.
            Clique numa linha para ver o relatório.
          </p>
        </div>
        <div className="overflow-x-auto">
          <DataTable<Importacao>
            data={itens}
            isLoading={isPending}
            error={null}
            emptyMessage="Nenhuma importação nesta competência"
            emptyHint="Envie o primeiro arquivo pelo formulário acima."
            columns={["Quando", "Tipo", "Arquivo", "Estado", "Aceitas", "Rejeitadas", "Por"]}
            renderRow={(imp) => (
              <tr
                key={imp.id}
                onClick={() => setSelecionada(imp.id)}
                className={`cursor-pointer border-b border-gray-100 hover:bg-gray-50 ${
                  imp.id === emFoco ? "bg-yellow-50/60" : ""
                }`}
              >
                <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                  {dataHora(imp.importadoEm)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">{imp.tipo}</td>
                <td className="max-w-xs truncate px-4 py-3 text-sm text-gray-900">
                  {imp.nomeArquivo}
                </td>
                <td className="px-4 py-3">
                  <StatusImportacaoBadge imp={imp} />
                </td>
                <td className="px-4 py-3 text-sm tabular-nums">{inteiro(imp.linhasAceitas)}</td>
                <td className="px-4 py-3 text-sm tabular-nums">
                  {imp.linhasRejeitadas > 0 ? (
                    <span className="font-medium text-red-700">
                      {inteiro(imp.linhasRejeitadas)}
                    </span>
                  ) : (
                    <span className="text-gray-400">0</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{imp.usuario?.nome ?? "—"}</td>
              </tr>
            )}
          />
        </div>
      </div>
    </div>
  );
}
