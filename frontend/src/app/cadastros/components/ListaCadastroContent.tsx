"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { DataTable } from "@/components/shared/DataTable";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { edicaoService, type Campo, type Registro } from "../services/edicaoService";
import { CadastroShell } from "./CadastroShell";
import { useEdicaoCadastro } from "./EdicaoCadastro";

const POR_PAGINA = 50;

function formatar(c: Campo, v: unknown) {
  if (v === null || v === undefined || v === "") return <span className="text-gray-400">—</span>;
  if (c.tipo === "booleano") return v ? "Sim" : "Não";
  if (c.tipo === "opcao") return c.opcoes?.find((o) => o.valor === String(v))?.rotulo ?? String(v);
  if (c.tipo === "decimal") return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  if (c.tipo === "data") return String(v).split("-").reverse().join("/");
  return String(v);
}

type Props = { entidade: string; rota: string; titulo: string; descricao: string };

/** Consulta e edição de um cadastro simples, com as colunas que a definição dele declara (Passo 25). */
export function ListaCadastroContent({ entidade, rota, titulo, descricao }: Props) {
  useRegistrarAcessoTela(rota);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const def = useQuery({ queryKey: ["edicao", entidade, "definicao"], queryFn: () => edicaoService.definicao(entidade) });
  const lista = useQuery({ queryKey: ["edicao", entidade, "lista"], queryFn: () => edicaoService.listar(entidade) });
  const edicao = useEdicaoCadastro(entidade, { criar: def.data?.criar ?? false });

  const campos = (def.data?.campos ?? []).filter((c) => c.tipo !== "multipla");
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const todos = lista.data ?? [];
    return termo ? todos.filter((r) => campos.some((c) => String(r[c.nome] ?? "").toLowerCase().includes(termo))) : todos;
  }, [lista.data, busca, campos]);
  const pagina_ = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  return (
    <CadastroShell
      titulo={titulo}
      descricao={descricao}
      acoes={edicao.botaoNovo}
      busca={busca}
      onBuscaChange={(v) => {
        setBusca(v);
        setPagina(1);
      }}
      placeholderBusca="Buscar…"
      total={filtrados.length}
      pagina={pagina}
      porPagina={POR_PAGINA}
      onPaginaChange={setPagina}
      carregando={def.isPending || lista.isPending}
    >
      <DataTable<Registro>
        data={pagina_}
        isLoading={def.isPending || lista.isPending}
        error={def.isError || lista.isError ? "Erro ao carregar o cadastro." : null}
        emptyMessage="Nenhum registro encontrado"
        emptyHint="Ajuste a busca para ver outros registros."
        columns={[...campos.map((c) => c.rotulo), ...edicao.colunaEditar]}
        renderRow={(r) => (
          <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
            {campos.map((c) => (
              <td key={c.nome} className={`px-4 py-3 text-sm text-gray-900 ${c.tipo === "decimal" || c.tipo === "inteiro" ? "tabular-nums" : ""}`}>
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
