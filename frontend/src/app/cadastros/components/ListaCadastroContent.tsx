"use client";

import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { DataTable } from "@/components/shared/DataTable";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import type { Coluna } from "@/lib/filtrosDeTabela";

import { edicaoService, type Campo, type Registro } from "../services/edicaoService";
import { registroAtivo, useApenasAtivas } from "./ApenasAtivas";
import { CadastroShell } from "./CadastroShell";
import { useEdicaoCadastro } from "./EdicaoCadastro";

const POR_PAGINA_INICIAL = 50;

/** O texto da célula; sem valor, null (a célula mostra "—" e o filtro, vazias). */
function textoDoCampo(c: Campo, v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (c.tipo === "booleano") return v ? "Sim" : "Não";
  if (c.tipo === "opcao") return c.opcoes?.find((o) => o.valor === String(v))?.rotulo ?? String(v);
  // Os valores em reais com "R$" e duas casas (os preços da Tabela de Estacas, 12/10/2026).
  if (c.tipo === "decimal" && c.moeda) return `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (c.tipo === "decimal") return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  if (c.tipo === "data") return String(v).split("-").reverse().join("/");
  return String(v);
}

function formatar(c: Campo, v: unknown) {
  return textoDoCampo(c, v) ?? <span className="text-gray-400">—</span>;
}

/** O valor que ordena: número nos campos de número e data, o texto da célula nos demais. */
function valorDoCampo(c: Campo, v: unknown): string | number | null {
  if (v === null || v === undefined || v === "") return null;
  if (c.tipo === "inteiro" || c.tipo === "decimal") return Number(v);
  if (c.tipo === "data") {
    const t = new Date(String(v)).getTime();
    return Number.isNaN(t) ? null : t;
  }
  return textoDoCampo(c, v);
}

/** Os números à direita (12/10/2026), como nas demais tabelas: o rótulo e as células. */
const ehNumero = (c: Campo) => c.tipo === "inteiro" || c.tipo === "decimal";

function colunaDoCampo(c: Campo): Coluna<Registro> {
  return {
    chave: c.nome,
    rotulo: c.rotuloColuna ?? c.rotulo,
    valor: (r) => valorDoCampo(c, r[c.nome]),
    texto: (r) => textoDoCampo(c, r[c.nome]),
    tipo: ehNumero(c) ? "numero" : c.tipo === "data" ? "data" : "texto",
    ...(ehNumero(c) ? { alinhamento: "direita" as const } : {}),
  };
}

const EDITAR: Coluna<Registro> = { chave: "editar", rotulo: "", semFiltro: true };

type Props = {
  entidade: string;
  rota: string;
  titulo: string;
  descricao: string;
  comoUsar?: ReactNode;
  /** A caixa "Apenas Ativas" (as telas dos Cadastros da Controladoria). */
  apenasAtivas?: boolean;
};

/** Consulta e edição de um cadastro simples, com as colunas que a definição dele declara (Passo 25). */
export function ListaCadastroContent({ entidade, rota, titulo, descricao, comoUsar, apenasAtivas }: Props) {
  useRegistrarAcessoTela(rota);
  const def = useQuery({ queryKey: ["edicao", entidade, "definicao"], queryFn: () => edicaoService.definicao(entidade) });
  const lista = useQuery({ queryKey: ["edicao", entidade, "lista"], queryFn: () => edicaoService.listar(entidade) });
  const edicao = useEdicaoCadastro(entidade, { criar: def.data?.criar ?? false });

  // Na tabela, só os campos de mostrar (sem as listas múltiplas, as fórmulas em texto bruto e os só do formulário).
  const campos = useMemo(() => (def.data?.campos ?? []).filter((c) => c.tipo !== "multipla" && c.tipo !== "formula" && c.naTabela !== false), [def.data]);
  const colunas = useMemo(() => {
    const doCadastro = campos.map(colunaDoCampo);
    return edicao.pode ? [...doCadastro, EDITAR] : doCadastro;
  }, [campos, edicao.pode]);
  const ativas = useApenasAtivas(lista.data, registroAtivo);
  const tabela = useTabelaFiltravel(ativas.itens, colunas, { porPaginaInicial: POR_PAGINA_INICIAL });

  return (
    <CadastroShell
      titulo={titulo}
      descricao={descricao}
      comoUsar={comoUsar}
      acoes={edicao.botaoNovo}
      apenasAtivas={apenasAtivas ? ativas.controle : undefined}
      total={tabela.total}
      pagina={tabela.pagina}
      porPagina={tabela.porPagina}
      onPorPaginaChange={tabela.setPorPagina}
      onPaginaChange={tabela.setPagina}
      carregando={def.isPending || lista.isPending}
      filtros={{ totalGeral: tabela.totalGeral, ativos: tabela.ativos, onLimpar: tabela.limpar }}
    >
      <DataTable<Registro>
        data={tabela.visiveis}
        cabecalho={tabela.cabecalho}
        filtrosAtivos={tabela.ativos}
        onLimparFiltros={tabela.limpar}
        isLoading={def.isPending || lista.isPending}
        error={def.isError || lista.isError ? "Erro ao carregar o cadastro." : null}
        emptyMessage="Nenhum registro encontrado"
        emptyHint="Ajuste os filtros para ver outros registros."
        columns={[...campos.map((c) => c.rotuloColuna ?? c.rotulo), ...edicao.colunaEditar]}
        renderRow={(r) => (
          <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
            {campos.map((c) => (
              <td key={c.nome} className={`px-4 py-3 text-sm text-gray-900 ${ehNumero(c) ? "text-right whitespace-nowrap" : ""}`}>
                {formatar(c, r[c.nome])}
              </td>
            ))}
            {edicao.pode ? <td className="px-2 py-3">{edicao.botaoEditar(r.id)}</td> : null}
          </tr>
        )}
      />
      {edicao.dialogo}
    </CadastroShell>
  );
}
