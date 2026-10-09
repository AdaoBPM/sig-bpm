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
import { ListaIndicadores } from "../components/ListaIndicadores";
import { useAbasDasListas } from "../components/useAbasDasListas";
import { RegistroListaDialog } from "../components/RegistroListaDialog";
import { LISTAS, LISTAS_INDICADORES, listasService, mensagemDeErro, type RegistroLista } from "../services/listasService";

const POR_PAGINA_INICIAL = 50;
/** A lista inteira vem de uma vez: o filtro e a ordem das colunas valem para todos os registros. */
const TODOS = 10000;

/** Os detalhes numéricos vêm como decimal ("2006.010"); códigos de peça e textos ficam como estão. */
const ehDecimal = (v: string | null) => v !== null && /^-?\d+\.\d+$/.test(v);

const quantidade = (v: string) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

const detalhe = (r: RegistroLista, rotulo: string) => r.detalhes.find((x) => x.rotulo === rotulo)?.valor ?? null;

/** As listas em matriz (armadura e metalurgia): sem obra, com a unidade de medida e o peso com duas casas. */
const EM_MATRIZ = new Set(["PRODUCAO_ARMADURA", "PRODUCAO_METALURGIA"]);
const MEDIDAS: Record<string, string> = { KG: "kg", M3: "m³", PISTA: "pistas", DIA: "dias" };
const medida = (r: RegistroLista) => (r.medida ? (MEDIDAS[r.medida] ?? r.medida.toLowerCase()) : null);
const duasCasas = (v: string) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const quantidadeDe = (tipo: string, v: string) => (EM_MATRIZ.has(tipo) ? duasCasas(v) : quantidade(v));
const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

type TotalDaLista = { codigo: string; rotulo: string; medida: string; quantidade: string };

/**
 * Os totalizadores da lista: a soma Total primeiro ("Projetos Liberados:
 * Total"), depois as somas por unidade ou linha, como na aba Totais. Só
 * quando há mais de uma soma, na mesma medida.
 */
function comTotal(totais: TotalDaLista[]): TotalDaLista[] {
  const itens = totais.map((t) => ({ ...t, rotulo: t.rotulo.replace(/^\([PS]\) /, "") }));
  if (itens.length < 2 || new Set(itens.map((t) => t.medida)).size > 1) return itens;
  const prefixos = new Set(itens.map((t) => t.rotulo.split(":")[0].trim()));
  const nome = prefixos.size === 1 ? [...prefixos][0] : null;
  const soma = itens.reduce((s, t) => s + Number(t.quantidade), 0);
  return [{ codigo: "TOTAL", rotulo: nome ? `${nome}: Total` : "Total", medida: itens[0].medida, quantidade: soma.toFixed(3) }, ...itens];
}

/**
 * As colunas antes dos detalhes: a obra (a coluna que fica com a largura que
 * sobra), ou a data nas pistas, ou nenhuma nas listas em matriz; depois a
 * unidade e a linha.
 */
function colunasAntes(tipo: string): Coluna<RegistroLista>[] {
  const unidadeELinha: Coluna<RegistroLista>[] = [
    { chave: "unidade", rotulo: "Unidade", valor: (r) => r.unidade, classe: "w-px" },
    { chave: "linha", rotulo: "Linha", valor: (r) => r.linha, classe: "w-px" },
  ];
  if (tipo === "PRODUCAO_PISTA") {
    return [{ chave: "data", rotulo: "Data", tipo: "data", valor: (r) => r.data, texto: (r) => (r.data ? dataBR(r.data) : null), classe: "w-px" }, ...unidadeELinha];
  }
  if (EM_MATRIZ.has(tipo)) return unidadeELinha;
  return [
    {
      chave: "obra",
      rotulo: "Obra",
      valor: (r) => r.obra?.codigo,
      texto: (r) => (r.obra ? (r.obra.nome !== r.obra.codigo ? `${r.obra.codigo} · ${r.obra.nome}` : r.obra.codigo) : null),
      classe: "w-full",
    },
    ...unidadeELinha,
  ];
}

function colunasDepois(tipo: string): Coluna<RegistroLista>[] {
  return [
    ...(EM_MATRIZ.has(tipo) ? [{ chave: "medida", rotulo: "Und.", valor: medida, classe: "w-px" } as Coluna<RegistroLista>] : []),
    {
      chave: "quantidade",
      rotulo: "Quantidade",
      tipo: "numero",
      alinhamento: "direita",
      valor: (r) => Number(r.quantidade),
      texto: (r) => quantidadeDe(tipo, r.quantidade),
      classe: "w-px",
    },
    { chave: "origem", rotulo: "Origem", valor: (r) => (r.origem === "DIGITADA" ? "Digitado" : "Importado"), classe: "w-px whitespace-nowrap" },
    { chave: "acoes", rotulo: "", semFiltro: true, classe: "w-px" },
  ];
}

/** Uma tela por lista: trocar de lista remonta a tabela, e os filtros dos rótulos recomeçam. */
export function ListaContent() {
  const { tipo } = useParams<{ tipo: string }>();
  if (LISTAS_INDICADORES.some((l) => l.slug === tipo)) return <ListaIndicadores key={tipo} />;
  return <Lista key={tipo} />;
}

function Lista() {
  const { anoMes, tipo: slug } = useParams<{ anoMes: string; tipo: string }>();
  useRegistrarAcessoTela(`/competencias/${anoMes}/listas/${slug}`);
  const periodo = lerAnoMes(anoMes);
  const lista = LISTAS.find((l) => l.slug === slug);
  const tipoLista: string = lista?.tipo ?? "";
  const queryClient = useQueryClient();
  const abas = useAbasDasListas(anoMes);

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
        : { chave: `detalhe:${rotulo}`, rotulo, valor: (r) => detalhe(r, rotulo), classe: "w-px" },
    );
    return [...colunasAntes(tipoLista), ...detalhes, ...colunasDepois(tipoLista)];
  }, [assinaturaDetalhes, tipoLista]);
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
                Novo Registro
              </Button>
            </PermissionGuard>
          ) : null
        }
      />

      <Abas rotulo="Listas" ativa={slug} abas={abas} />

      {d && d.totais.length > 0 ? (
        <FaixaIndicadores
          itens={comTotal(d.totais).map((t) => ({
            rotulo: t.rotulo,
            rotuloAntes: true,
            valor: (
              <>
                {quantidadeDe(tipoLista, t.quantidade)} <span className="text-xs font-medium text-gray-500">{t.medida}</span>
              </>
            ),
          }))}
        />
      ) : null}

      <QuadroTabela
        barra={
          tabela.ativos ? (
            <button type="button" onClick={tabela.limpar} className="ml-auto text-xs font-medium text-gray-900 underline underline-offset-2">
              Limpar Filtros
            </button>
          ) : undefined
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
            columns={colunas.map((c) => c.rotulo)}
            renderRow={(r) => (
              <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                {tipoLista === "PRODUCAO_PISTA" ? (
                  <td className="px-4 py-2 text-sm whitespace-nowrap text-gray-600">{r.data ? dataBR(r.data) : "—"}</td>
                ) : EM_MATRIZ.has(tipoLista) ? null : (
                  // A obra fica com a largura que sobra das outras colunas (max-w-0 + w-full); o nome só se corta quando não cabe.
                  <td className="w-full max-w-0 px-4 text-sm">
                    {/* O nome só quando o cadastro tem um (a obra criada pela lista nasce com o código no nome). */}
                    {r.obra ? (
                      <div className="flex min-w-0 items-baseline gap-1.5" title={r.obra.nome !== r.obra.codigo ? r.obra.nome : undefined}>
                        <span className="shrink-0 font-medium">{r.obra.codigo}</span>
                        {r.obra.nome !== r.obra.codigo ? <span className="min-w-0 truncate text-xs text-gray-500">{r.obra.nome}</span> : null}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                )}
                <td className="px-4 py-2 text-sm whitespace-nowrap text-gray-600">{r.unidade ?? "—"}</td>
                <td className="px-4 py-2 text-sm whitespace-nowrap text-gray-600">{r.linha ?? "—"}</td>
                {r.detalhes.map((x) => (
                  <td key={x.rotulo} className={`px-4 py-2 text-sm whitespace-nowrap text-gray-600 ${ehDecimal(x.valor) ? "text-right" : ""}`}>
                    {ehDecimal(x.valor) ? quantidade(x.valor!) : (x.valor ?? "—")}
                  </td>
                ))}
                {EM_MATRIZ.has(tipoLista) ? <td className="px-4 py-2 text-sm whitespace-nowrap text-gray-600">{medida(r) ?? "—"}</td> : null}
                <td className="px-4 py-2 text-right text-sm whitespace-nowrap text-gray-600">{quantidadeDe(tipoLista, r.quantidade)}</td>
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
