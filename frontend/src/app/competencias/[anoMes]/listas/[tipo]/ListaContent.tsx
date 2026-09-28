"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight, Lock, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/DataTable";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { StatusCompetenciaBadge } from "../../../components/StatusCompetenciaBadge";
import { inteiro, lerAnoMes, MESES, rotuloCompetencia } from "../../utils/formatacao";
import { RegistroListaDialog } from "../components/RegistroListaDialog";
import { LISTAS, listasService, mensagemDeErro, type RegistroLista } from "../services/listasService";

const POR_PAGINA = 50;

const quantidade = (v: string) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

export function ListaContent() {
  const { anoMes, tipo: slug } = useParams<{ anoMes: string; tipo: string }>();
  useRegistrarAcessoTela(`/competencias/${anoMes}/listas/${slug}`);
  const periodo = lerAnoMes(anoMes);
  const lista = LISTAS.find((l) => l.slug === slug);
  const queryClient = useQueryClient();

  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const buscaDebounced = useDebounce(busca, 300);
  // undefined: diálogo fechado; null: novo; registro: edição.
  const [editando, setEditando] = useState<RegistroLista | null | undefined>(undefined);

  const definicoes = useQuery({ queryKey: ["listas", "campos"], queryFn: listasService.campos, staleTime: 30 * 60_000 });
  const dados = useQuery({
    queryKey: ["listas", anoMes, slug, buscaDebounced, pagina],
    queryFn: () => listasService.listar(anoMes, slug, { busca: buscaDebounced || undefined, pagina, porPagina: POR_PAGINA }),
    enabled: periodo !== null && lista !== undefined,
    placeholderData: keepPreviousData,
  });

  const excluir = useMutation({
    mutationFn: (id: string) => listasService.excluir(anoMes, slug, id),
    onSuccess: () => {
      toast.success("Registro excluído.");
      queryClient.invalidateQueries({ queryKey: ["listas", anoMes, slug] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível excluir.")),
  });

  if (!periodo || !lista) {
    return (
      <div className="rounded-sm border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">Lista ou competência inválida na URL.</p>
      </div>
    );
  }

  const def = definicoes.data?.[lista.tipo];
  const d = dados.data;
  const fechada = d?.competencia.status === "FECHADA";
  const colunasDetalhe = d?.itens[0]?.detalhes.map((x) => x.rotulo) ?? [];
  const totalPaginas = Math.max(1, Math.ceil((d?.total ?? 0) / POR_PAGINA));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/competencias" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="size-4" />
          Competências
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
                Listas operacionais · {rotuloCompetencia(periodo.ano, periodo.mes)}
              </h1>
              <span className="text-sm text-gray-400">{MESES[periodo.mes - 1]}</span>
              {d ? <StatusCompetenciaBadge status={d.competencia.status} /> : null}
            </div>
            <p className="text-sm text-gray-600">
              Os volumes físicos de que saem os rateios. Registros importados se corrigem no
              arquivo; os digitados, aqui.
            </p>
          </div>
          {!fechada && def ? (
            <PermissionGuard permission="listas_operacionais:editar">
              <Button
                type="button"
                onClick={() => setEditando(null)}
                className="bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm"
              >
                <Plus className="size-4" />
                Novo registro
              </Button>
            </PermissionGuard>
          ) : null}
        </div>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Listas">
        {LISTAS.map((l) => (
          <Link
            key={l.slug}
            href={`/competencias/${anoMes}/listas/${l.slug}`}
            className={`rounded-sm border px-3 py-1.5 text-sm font-medium ${
              l.slug === slug ? "border-black bg-black text-white" : "border-gray-300 bg-white text-gray-900 hover:bg-gray-100"
            }`}
          >
            {definicoes.data?.[l.tipo]?.rotulo ?? l.tipo}
          </Link>
        ))}
      </nav>

      {fechada ? (
        <div className="flex items-center gap-2 rounded-sm border border-gray-200 bg-gray-50 p-4">
          <Lock className="size-4 shrink-0 text-gray-500" />
          <p className="text-sm text-gray-600">Competência fechada: as listas não podem ser alteradas.</p>
        </div>
      ) : null}

      {d && d.totais.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {d.totais.map((t) => (
            <div key={t.codigo} className="border border-gray-200 bg-white rounded-sm p-4">
              <p className="text-xs font-bold tracking-wide text-gray-600 uppercase">{t.rotulo.replace(/^\([PS]\) /, "")}</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-gray-900">
                {quantidade(t.quantidade)} <span className="text-sm font-medium text-gray-500">{t.medida}</span>
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="border border-gray-200 bg-white rounded-sm">
        <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600">{d ? `${inteiro(d.total)} registro(s)` : "Carregando…"}</p>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(1);
              }}
              placeholder="Obra (sigla ou nome)…"
              className="rounded-sm border-gray-300 pl-9"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <DataTable<RegistroLista>
            data={d?.itens ?? []}
            isLoading={dados.isPending}
            error={dados.isError ? mensagemDeErro(dados.error, "Erro ao carregar a lista.") : null}
            emptyMessage="Nenhum registro nesta competência"
            emptyHint="Importe a lista em Importações ou inclua um registro."
            columns={["Origem", "Obra", "Unidade", "Linha", ...colunasDetalhe, "Quantidade", ""]}
            renderRow={(r) => (
              <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2 text-xs whitespace-nowrap">
                  {r.origem === "DIGITADA" ? (
                    <span className="rounded-sm border border-yellow-200 bg-yellow-50 px-2 py-0.5 font-medium text-yellow-800">digitado</span>
                  ) : (
                    <span className="text-gray-500">importado · linha {r.linhaArquivo}</span>
                  )}
                </td>
                <td className="px-4 py-2 text-sm">
                  {r.obra ? (
                    <>
                      <span className="font-medium tabular-nums">{r.obra.codigo}</span>
                      <span className="ml-1 text-xs text-gray-500">{r.obra.nome}</span>
                    </>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-sm text-gray-600">{r.unidade ?? "—"}</td>
                <td className="px-4 py-2 text-sm text-gray-600">{r.linha ?? "—"}</td>
                {r.detalhes.map((x) => (
                  <td key={x.rotulo} className="px-4 py-2 text-sm text-gray-600">{x.valor ?? "—"}</td>
                ))}
                <td className="px-4 py-2 text-right text-sm tabular-nums text-gray-900">{quantidade(r.quantidade)}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  {r.origem === "DIGITADA" && !fechada ? (
                    <PermissionGuard permission="listas_operacionais:editar">
                      <Button type="button" variant="ghost" size="icon" aria-label="Editar" onClick={() => setEditando(r)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Excluir"
                        onClick={() => {
                          if (window.confirm("Excluir este registro?")) excluir.mutate(r.id);
                        }}
                      >
                        <Trash2 className="size-4 text-red-700" />
                      </Button>
                    </PermissionGuard>
                  ) : null}
                </td>
              </tr>
            )}
          />
        </div>
        {d && d.total > POR_PAGINA ? (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm text-gray-600">
            <span className="tabular-nums">
              {inteiro((pagina - 1) * POR_PAGINA + 1)}–{inteiro(Math.min(pagina * POR_PAGINA, d.total))} de {inteiro(d.total)}
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} className="rounded-sm">
                <ChevronLeft className="size-4" />
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)} className="rounded-sm">
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {editando !== undefined && def ? (
        <RegistroListaDialog
          key={editando?.id ?? "novo"}
          anoMes={anoMes}
          slug={slug}
          rotuloLista={def.rotulo}
          campos={def.campos}
          editando={editando}
          onFechar={() => setEditando(undefined)}
        />
      ) : null}
    </div>
  );
}
