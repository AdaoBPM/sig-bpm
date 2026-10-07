"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/DataTable";
import { useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { atualizarCompetencia } from "@/lib/atualizarCompetencia";
import type { Coluna } from "@/lib/filtrosDeTabela";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { Abas } from "@/components/shared/Abas";
import { FaixaIndicadores } from "@/components/shared/FaixaIndicadores";
import { Paginacao } from "@/components/shared/Paginacao";
import { QuadroTabela } from "@/components/shared/QuadroTabela";

import { AvisoCongelado } from "../../../components/AvisoCongelado";
import { inteiro, lerAnoMes } from "../../utils/formatacao";
import { RegistroListaDialog } from "../components/RegistroListaDialog";
import { LISTAS, listasService, mensagemDeErro, type RegistroLista } from "../services/listasService";

const POR_PAGINA_INICIAL = 50;
/** A lista inteira vem de uma vez: o filtro e a ordem das colunas valem para todos os registros. */
const TODOS = 10000;

/** As quatro listas de produção, cada uma na sua aba, com nome curto. */
const ABA_PRODUCAO: Record<string, string> = {
  PRODUCAO: "Produção (Volume)",
  PRODUCAO_PISTA: "Produção (Pistas)",
  PRODUCAO_METALURGIA: "Metalurgia",
  PRODUCAO_ARMADURA: "Armadura",
};

/** Os detalhes numéricos vêm como decimal ("2006.010"); códigos de peça e textos ficam como estão. */
const ehDecimal = (v: string | null) => v !== null && /^-?\d+\.\d+$/.test(v);

const quantidade = (v: string) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

const detalhe = (r: RegistroLista, rotulo: string) => r.detalhes.find((x) => x.rotulo === rotulo)?.valor ?? null;

const ANTES_DOS_DETALHES: Coluna<RegistroLista>[] = [
  {
    chave: "obra",
    rotulo: "Obra",
    valor: (r) => r.obra?.codigo,
    texto: (r) => (r.obra ? (r.obra.nome !== r.obra.codigo ? `${r.obra.codigo} · ${r.obra.nome}` : r.obra.codigo) : null),
  },
  { chave: "unidade", rotulo: "Unidade", valor: (r) => r.unidade },
  { chave: "linha", rotulo: "Linha", valor: (r) => r.linha },
];
const DEPOIS_DOS_DETALHES: Coluna<RegistroLista>[] = [
  { chave: "quantidade", rotulo: "Quantidade", tipo: "numero", alinhamento: "direita", valor: (r) => Number(r.quantidade), texto: (r) => quantidade(r.quantidade) },
  { chave: "origem", rotulo: "Origem", valor: (r) => (r.origem === "DIGITADA" ? "Digitado" : "Importado"), classe: "w-px whitespace-nowrap" },
  { chave: "acoes", rotulo: "", semFiltro: true, classe: "w-px" },
];

/** Uma tela por lista: trocar de lista remonta a tabela, e os filtros dos rótulos recomeçam. */
export function ListaContent() {
  const { tipo } = useParams<{ tipo: string }>();
  return <Lista key={tipo} />;
}

function Lista() {
  const { user } = useAuth();
  const { anoMes, tipo: slug } = useParams<{ anoMes: string; tipo: string }>();
  useRegistrarAcessoTela(`/competencias/${anoMes}/listas/${slug}`);
  const periodo = lerAnoMes(anoMes);
  const lista = LISTAS.find((l) => l.slug === slug);
  const queryClient = useQueryClient();

  // undefined: diálogo fechado; null: novo; registro: edição.
  const [editando, setEditando] = useState<RegistroLista | null | undefined>(undefined);

  const definicoes = useQuery({ queryKey: ["listas", "campos"], queryFn: listasService.campos, staleTime: 30 * 60_000 });
  const dados = useQuery({
    queryKey: ["listas", anoMes, slug, TODOS],
    queryFn: () => listasService.listar(anoMes, slug, { pagina: 1, porPagina: TODOS }),
    enabled: periodo !== null && lista !== undefined,
    placeholderData: keepPreviousData,
  });

  // As colunas de detalhe vêm do primeiro registro; as de decimal filtram e ordenam como número.
  // A assinatura (rótulos e tipos em texto) mantém as colunas estáveis enquanto não mudam.
  const assinaturaDetalhes = useMemo(() => {
    const itens = dados.data?.itens ?? [];
    return JSON.stringify((itens[0]?.detalhes ?? []).map((x) => [x.rotulo, itens.some((r) => ehDecimal(detalhe(r, x.rotulo)))]));
  }, [dados.data]);
  const colunas = useMemo(() => {
    const detalhes = (JSON.parse(assinaturaDetalhes) as Array<[string, boolean]>).map(([rotulo, decimal]): Coluna<RegistroLista> =>
      decimal
        ? {
            chave: `detalhe:${rotulo}`,
            rotulo,
            tipo: "numero",
            alinhamento: "direita",
            valor: (r) => {
              const v = detalhe(r, rotulo);
              return ehDecimal(v) ? Number(v) : v;
            },
            texto: (r) => {
              const v = detalhe(r, rotulo);
              return ehDecimal(v) ? quantidade(v!) : v;
            },
          }
        : { chave: `detalhe:${rotulo}`, rotulo, valor: (r) => detalhe(r, rotulo) },
    );
    return [...ANTES_DOS_DETALHES, ...detalhes, ...DEPOIS_DOS_DETALHES];
  }, [assinaturaDetalhes]);
  const tabela = useTabelaFiltravel(dados.data?.itens, colunas, { porPaginaInicial: POR_PAGINA_INICIAL });

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
  const abas = visiveis.map((l) => ({
    chave: l.slug,
    rotulo: ABA_PRODUCAO[l.tipo] ?? definicoes.data?.[l.tipo]?.rotulo ?? l.tipo,
    href: `/competencias/${anoMes}/listas/${l.slug}`,
  }));

  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Listas Operacionais"
        selo={fechada ? <AvisoCongelado anoMes={anoMes} fechada oQue="das listas" /> : null}
        comoUsar={
          <ul>
            <li>Escolha a lista nas abas e use os filtros nos rótulos das colunas.</li>
            <li>Registros importados se corrigem no arquivo, reimportado em Importações.</li>
            <li>Use “Novo Registro” para incluir um registro digitado; o lápis e a lixeira editam e excluem os digitados.</li>
            <li>As listas formam os rateios, a receita prévia e o estoque: depois de alterá-las, reapure a competência na DRE.</li>
          </ul>
        }
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

      <Abas rotulo="Listas" ativa={slug} abas={abas} />

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
            <div className="ml-auto flex shrink-0 items-center gap-3">
              {tabela.ativos ? (
                <button type="button" onClick={tabela.limpar} className="text-xs font-medium text-gray-900 underline underline-offset-2">
                  Limpar Filtros
                </button>
              ) : null}
              <p className="text-xs text-gray-600">
                {d ? (tabela.ativos && tabela.total !== tabela.totalGeral ? `${inteiro(tabela.total)} de ${inteiro(tabela.totalGeral)} registro(s)` : `${inteiro(tabela.total)} registro(s)`) : ""}
              </p>
            </div>
          </>
        }
        rodape={d && tabela.total > 0 ? <Paginacao total={tabela.total} pagina={tabela.pagina} porPagina={tabela.porPagina} onPagina={tabela.setPagina} onPorPagina={tabela.setPorPagina} carregando={dados.isFetching} /> : null}
      >
          <DataTable<RegistroLista>
            data={tabela.visiveis}
            cabecalho={tabela.cabecalho}
            filtrosAtivos={tabela.ativos}
            onLimparFiltros={tabela.limpar}
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
                    <div className="flex max-w-60 items-baseline gap-1.5" title={r.obra.nome !== r.obra.codigo ? r.obra.nome : undefined}>
                      <span className="font-medium">{r.obra.codigo}</span>
                      {r.obra.nome !== r.obra.codigo ? <span className="truncate text-xs text-gray-500">{r.obra.nome}</span> : null}
                    </div>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-sm text-gray-600">{r.unidade ?? "—"}</td>
                <td className="px-4 py-2 text-sm text-gray-600">{r.linha ?? "—"}</td>
                {r.detalhes.map((x) => (
                  <td key={x.rotulo} className={`px-4 py-2 text-sm text-gray-600 ${ehDecimal(x.valor) ? "text-right" : ""}`}>
                    {ehDecimal(x.valor) ? quantidade(x.valor!) : (x.valor ?? "—")}
                  </td>
                ))}
                <td className="px-4 py-2 text-right text-sm text-gray-900">{quantidade(r.quantidade)}</td>
                <td className="px-4 text-xs whitespace-nowrap">
                  {r.origem === "DIGITADA" ? (
                    <span className="rounded-sm border border-yellow-200 bg-yellow-50 px-1.5 py-0.5 font-medium text-yellow-800">Digitado</span>
                  ) : (
                    <span className="text-gray-400" title={r.linhaArquivo ? `Linha ${r.linhaArquivo} do arquivo importado` : undefined}>
                      Importado
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
