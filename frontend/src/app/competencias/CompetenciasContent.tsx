"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";

import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { etapasDoMes } from "@/lib/etapasDoMes";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { QuadroTabela } from "@/components/shared/QuadroTabela";
import { SeletorFiltro } from "@/components/shared/Filtros";

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
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  useRegistrarAcessoTela("/competencias");

  const [ano, setAno] = useState<string>(TODOS);

  const { data, isPending, isError } = useQuery({
    queryKey: ["competencias", ano],
    queryFn: () =>
      competenciasService.listar(ano === TODOS ? undefined : Number(ano)),
  });

  const itens = data?.itens ?? [];

  // As telas de cada mês que o perfil do usuário alcança (Passo 22), na ordem do fechamento.
  const etapas = etapasDoMes(hasPermission, user?.acesso);

  return (
    <div className="space-y-6">
      <CabecalhoDaTela titulo="Competências" sobre={<p>Cada mês do fechamento e o estado em que ele se encontra.</p>} />

      <PermissionGuard permission="competencia:editar">
        <AbrirCompetenciaForm />
      </PermissionGuard>

      <QuadroTabela
        barra={
          <>
            <SeletorFiltro
              rotulo="Exercício"
              valor={ano === TODOS ? undefined : ano}
              onMudar={(v) => setAno(v ?? TODOS)}
              todos="Todos os anos"
              largura="w-40"
              opcoes={(data?.anos ?? []).map((a) => ({ valor: String(a), rotulo: String(a) }))}
            />
            <span className="text-xs text-gray-600">{isPending ? "" : `${itens.length} competência(s)`}</span>
          </>
        }
      >
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
              "",
            ]}
            renderRow={(c) => (
              <tr
                key={c.id}
                className="border-b border-gray-100 hover:bg-gray-50"
              >
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {String(c.mes).padStart(2, "0")}/{c.ano}
                  <span className="ml-2 text-xs text-gray-400">
                    {c.nomeMes}
                  </span>
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
                <td className="px-4 py-3">
                  {/* Um botão só por competência, com todas as etapas (G1 do levantamento de layout). */}
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button type="button" variant="outline" size="sm" className="rounded-sm">
                            Abrir
                            <ChevronDown className="size-3.5" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-52">
                        {etapas.map((e) => (
                          <DropdownMenuItem
                            key={e.chave}
                            render={<Link href={`/competencias/${c.ano}-${String(c.mes).padStart(2, "0")}/${e.caminho}`} />}
                          >
                            <e.icone />
                            {e.rotulo}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            )}
          />
      </QuadroTabela>
    </div>
  );
}
