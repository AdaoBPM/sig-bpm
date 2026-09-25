"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";

import { DataTable } from "@/components/shared/DataTable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { AbrirCompetenciaForm } from "./components/AbrirCompetenciaForm";
import { StatusCompetenciaBadge } from "./components/StatusCompetenciaBadge";
import {
  competenciasService,
  type Competencia,
} from "./services/competenciasService";

const TODOS = "todos";

function dataCurta(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function CompetenciasContent() {
  useRegistrarAcessoTela("/competencias");

  const [ano, setAno] = useState<string>(TODOS);

  const { data, isPending, isError } = useQuery({
    queryKey: ["competencias", ano],
    queryFn: () =>
      competenciasService.listar(ano === TODOS ? undefined : Number(ano)),
  });

  const itens = data?.itens ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
          Competências
        </h1>
        <p className="text-sm text-gray-600">
          Cada mês do fechamento e o estado em que ele se encontra.
        </p>
      </div>

      <AbrirCompetenciaForm />

      <div className="border border-gray-200 bg-white rounded-sm">
        <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <CalendarDays className="size-4" />
            {isPending
              ? "Carregando…"
              : `${itens.length} competência(s)`}
          </div>
          <Select value={ano} onValueChange={(v) => setAno(v ?? TODOS)}>
            <SelectTrigger className="w-40 rounded-sm">
              <SelectValue placeholder="Exercício" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os anos</SelectItem>
              {(data?.anos ?? []).map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <DataTable<Competencia>
            data={itens}
            isLoading={isPending}
            error={isError ? "Erro ao carregar as competências." : null}
            emptyMessage="Nenhuma competência aberta"
            emptyHint="Use o formulário acima para abrir o primeiro mês."
            columns={[
              "Competência",
              "Estado",
              "Aberta em",
              "Apurações",
              "Fechada em",
              "Importações",
              "Divergências",
            ]}
            renderRow={(c) => (
              <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {String(c.mes).padStart(2, "0")}/{c.ano}
                  <span className="ml-2 text-xs text-gray-400">{c.nomeMes}</span>
                </td>
                <td className="px-4 py-3">
                  <StatusCompetenciaBadge status={c.status} />
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {dataCurta(c.abertaEm)}
                  {c.usuarioAbertura ? (
                    <span className="ml-1 text-xs text-gray-400">
                      por {c.usuarioAbertura.nome}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                  {c.apuracoes === 0 ? (
                    <span className="text-gray-400">nunca apurada</span>
                  ) : (
                    <>
                      {c.apuracoes}× · última em {dataCurta(c.apuradaEm)}
                    </>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {dataCurta(c.fechadaEm)}
                  {c._count.historicoReaberturas > 0 ? (
                    <span className="ml-1 text-xs text-yellow-800">
                      ({c._count.historicoReaberturas}× reaberta)
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                  {c._count.importacoes}
                </td>
                <td className="px-4 py-3 text-sm tabular-nums">
                  {c._count.divergencias > 0 ? (
                    <span className="font-medium text-yellow-800">
                      {c._count.divergencias}
                    </span>
                  ) : (
                    <span className="text-gray-400">0</span>
                  )}
                </td>
              </tr>
            )}
          />
        </div>
      </div>
    </div>
  );
}
