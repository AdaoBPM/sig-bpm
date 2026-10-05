"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/DataTable";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { atualizarCompetencia } from "@/lib/atualizarCompetencia";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { Abas } from "@/components/shared/Abas";
import { FaixaIndicadores } from "@/components/shared/FaixaIndicadores";
import { CampoBusca } from "@/components/shared/Filtros";
import { Paginacao } from "@/components/shared/Paginacao";
import { QuadroTabela } from "@/components/shared/QuadroTabela";

import { AvisoCongelado } from "../../../components/AvisoCongelado";
import { inteiro, lerAnoMes } from "../../utils/formatacao";
import { RegistroListaDialog } from "../components/RegistroListaDialog";
import { LISTAS, listasService, mensagemDeErro, type RegistroLista } from "../services/listasService";

const POR_PAGINA_INICIAL = 50;

/** As quatro listas de produção ficam numa aba só, com a escolha entre elas logo abaixo (E6 do levantamento de layout). */
const PRODUCAO: Record<string, string> = { PRODUCAO: "m³", PRODUCAO_PISTA: "pistas", PRODUCAO_METALURGIA: "metalurgia", PRODUCAO_ARMADURA: "armadura" };

/** Os detalhes numéricos vêm como decimal ("2006.010"); códigos de peça e textos ficam como estão. */
const ehDecimal = (v: string | null) => v !== null && /^-?\d+\.\d+$/.test(v);

const quantidade = (v: string) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

export function ListaContent() {
  const { user } = useAuth();
  const { anoMes, tipo: slug } = useParams<{ anoMes: string; tipo: string }>();
  useRegistrarAcessoTela(`/competencias/${anoMes}/listas/${slug}`);
  const periodo = lerAnoMes(anoMes);
  const lista = LISTAS.find((l) => l.slug === slug);
  const queryClient = useQueryClient();

  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(POR_PAGINA_INICIAL);
  const buscaDebounced = useDebounce(busca, 300);
  // undefined: diálogo fechado; null: novo; registro: edição.
  const [editando, setEditando] = useState<RegistroLista | null | undefined>(undefined);

  const definicoes = useQuery({ queryKey: ["listas", "campos"], queryFn: listasService.campos, staleTime: 30 * 60_000 });
  const dados = useQuery({
    queryKey: ["listas", anoMes, slug, buscaDebounced, pagina, porPagina],
    queryFn: () => listasService.listar(anoMes, slug, { busca: buscaDebounced || undefined, pagina, porPagina }),
    enabled: periodo !== null && lista !== undefined,
    placeholderData: keepPreviousData,
  });

  const excluir = useMutation({
    mutationFn: (id: string) => listasService.excluir(anoMes, slug, id),
    onSuccess: () => {
      toast.success("Registro excluído.");
      atualizarCompetencia(queryClient, anoMes);
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
  const visiveis = LISTAS.filter((l) => !user?.acesso.recorteSetor || user.acesso.setores.includes(l.tipo));
  const producoes = visiveis.filter((l) => l.tipo in PRODUCAO);
  const naProducao = lista.tipo in PRODUCAO;
  // As abas: as listas avulsas e, no lugar da primeira de produção, o grupo.
  const abas = visiveis.flatMap((l) => {
    if (!(l.tipo in PRODUCAO)) {
      return [{ chave: l.slug, rotulo: definicoes.data?.[l.tipo]?.rotulo ?? l.tipo, href: `/competencias/${anoMes}/listas/${l.slug}` }];
    }
    if (l !== producoes[0]) return [];
    return [{ chave: "producao-grupo", rotulo: "Produção", href: `/competencias/${anoMes}/listas/${l.slug}` }];
  });

  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Listas Operacionais"
        selo={fechada ? <AvisoCongelado anoMes={anoMes} fechada oQue="das listas" /> : null}
        sobre={<p>Os volumes físicos de que saem os rateios. Registros importados se corrigem no arquivo; os digitados, aqui.</p>}
        acoes={
          !fechada && def ? (
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
          ) : null
        }
      />

      <div className="space-y-3">
        <Abas rotulo="Listas" ativa={naProducao ? "producao-grupo" : slug} abas={abas} />
        {naProducao && producoes.length > 1 ? (
          <nav aria-label="Listas de produção" className="inline-flex rounded-sm border border-gray-300 bg-white p-0.5">
            {producoes.map((l) => (
              <Link
                key={l.slug}
                href={`/competencias/${anoMes}/listas/${l.slug}`}
                aria-current={l.slug === slug ? "page" : undefined}
                className={`rounded-sm px-3 py-1 text-sm ${l.slug === slug ? "bg-black font-bold text-white" : "text-gray-700 hover:bg-gray-100"}`}
              >
                {PRODUCAO[l.tipo]}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>

      {d && d.totais.length > 0 ? (
        <FaixaIndicadores
          itens={d.totais.map((t) => ({
            rotulo: t.rotulo.replace(/^\([PS]\) /, ""),
            rotuloAntes: true,
            valor: (
              <>
                {quantidade(t.quantidade)} <span className="text-xs font-medium text-gray-500">{t.medida}</span>
              </>
            ),
          }))}
        />
      ) : null}

      <QuadroTabela
        barra={
          <>
            <CampoBusca
              rotulo="Buscar registros"
              valor={busca}
              onMudar={(v) => {
                setBusca(v);
                setPagina(1);
              }}
              placeholder="Obra (sigla ou nome)…"
            />
            <p className="text-xs text-gray-600">{d ? `${inteiro(d.total)} registro(s)` : ""}</p>
          </>
        }
        rodape={d && d.total > 0 ? <Paginacao total={d.total} pagina={pagina} porPagina={porPagina} onPagina={setPagina} onPorPagina={setPorPagina} carregando={dados.isFetching} /> : null}
      >
          <DataTable<RegistroLista>
            data={d?.itens ?? []}
            isLoading={dados.isPending}
            error={dados.isError ? mensagemDeErro(dados.error, "Erro ao carregar a lista.") : null}
            emptyMessage="Nenhum registro nesta competência"
            emptyHint="Importe a lista em Importações ou inclua um registro."
            columns={["Obra", "Unidade", "Linha", ...colunasDetalhe, "Quantidade", "Origem", ""]}
            renderRow={(r) => (
              <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 text-sm">
                  {/* O nome só quando o cadastro tem um (a obra criada pela lista nasce com o código no nome). */}
                  {r.obra ? (
                    <div className="flex max-w-80 items-baseline gap-1.5" title={r.obra.nome !== r.obra.codigo ? r.obra.nome : undefined}>
                      <span className="font-medium tabular-nums">{r.obra.codigo}</span>
                      {r.obra.nome !== r.obra.codigo ? <span className="truncate text-xs text-gray-500">{r.obra.nome}</span> : null}
                    </div>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-sm text-gray-600">{r.unidade ?? "—"}</td>
                <td className="px-4 py-2 text-sm text-gray-600">{r.linha ?? "—"}</td>
                {r.detalhes.map((x) => (
                  <td key={x.rotulo} className={`px-4 py-2 text-sm text-gray-600 ${ehDecimal(x.valor) ? "text-right tabular-nums" : ""}`}>
                    {ehDecimal(x.valor) ? quantidade(x.valor!) : (x.valor ?? "—")}
                  </td>
                ))}
                <td className="px-4 py-2 text-right text-sm tabular-nums text-gray-900">{quantidade(r.quantidade)}</td>
                <td className="px-4 text-xs whitespace-nowrap">
                  {r.origem === "DIGITADA" ? (
                    <span className="rounded-sm border border-yellow-200 bg-yellow-50 px-1.5 py-0.5 font-medium text-yellow-800">digitado</span>
                  ) : (
                    <span className="text-gray-400" title={r.linhaArquivo ? `Linha ${r.linhaArquivo} do arquivo importado` : undefined}>
                      importado
                    </span>
                  )}
                </td>
                <td className="px-4 py-0 text-right whitespace-nowrap">
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
      </QuadroTabela>

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
