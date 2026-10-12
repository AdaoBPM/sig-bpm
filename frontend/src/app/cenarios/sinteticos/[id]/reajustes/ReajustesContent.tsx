"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { DataTable } from "@/components/shared/DataTable";
import { QuadroTabela } from "@/components/shared/QuadroTabela";
import { useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import type { Coluna } from "@/lib/filtrosDeTabela";

import { formato } from "@/app/relatorios/services/relatoriosService";

import { cenariosService, type ReajusteDoCenario } from "../../../services/cenariosService";

const ABAS = ["Consolidado", "Matriz", "Filial", "Serviços", "Despesas e Extra", "RN"];
const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const comSinal = (v: number, texto: string) => (v > 0 ? `+${texto}` : texto);

/** O tipo: o reajuste dos marcados, a edição de um valor (replicada ou não) ou a carga de uma referência. */
const tipoDe = (r: ReajusteDoCenario) =>
  r.tipo === "MARCADOS" ? "Reajuste dos Marcados" : r.tipo === "REFERENCIA" ? "Referência Carregada" : r.replicado ? "Edição de Valor (Replicada)" : "Edição de Valor";
/** O reajuste informado: +5,00%, +1.000 ou o valor digitado direto. */
const reajusteDe = (r: ReajusteDoCenario) => {
  if (r.tipo === "REFERENCIA") return null;
  if (r.modo === "DIGITADO" || r.reajuste === null) return "Valor digitado";
  return r.modo === "PERCENTUAL" ? `${comSinal(r.reajuste, formato.valor(r.reajuste))}%` : comSinal(r.reajuste, formato.valor(r.reajuste));
};
/** Os meses: JAN, ou JAN a MAR quando seguidos, ou a lista. */
const mesesDe = (ms: number[]) => {
  if (!ms.length) return null;
  const seguidos = ms.every((m, k) => k === 0 || m === ms[k - 1] + 1);
  return ms.length === 1 ? MESES[ms[0] - 1] : seguidos ? `${MESES[ms[0] - 1]} a ${MESES[ms[ms.length - 1] - 1]}` : ms.map((m) => MESES[m - 1]).join(", ");
};
const contasDe = (r: ReajusteDoCenario) =>
  r.tipo === "REFERENCIA" ? r.descricao : r.contas.length === 1 ? r.contas[0].descricao : `${r.contas.length} contas: ${r.contas.map((c) => c.descricao).join(", ")}`;
const diferenca = (r: ReajusteDoCenario) => (r.somaAntes === null || r.somaDepois === null ? null : r.somaDepois - r.somaAntes);

const COLUNAS: Coluna<ReajusteDoCenario>[] = [
  { chave: "data", rotulo: "Data", tipo: "data", valor: (r) => new Date(r.criadoEm).getTime(), texto: (r) => dataHora(r.criadoEm) },
  { chave: "usuario", rotulo: "Usuário", valor: (r) => r.usuarioNome },
  { chave: "tipo", rotulo: "Tipo", valor: tipoDe },
  { chave: "aba", rotulo: "Aba", valor: (r) => (r.visao === null ? null : ABAS[r.visao]) },
  { chave: "reajuste", rotulo: "Reajuste", valor: reajusteDe },
  { chave: "contas", rotulo: "Contas", valor: contasDe },
  { chave: "meses", rotulo: "Meses", valor: (r) => mesesDe(r.meses) },
  { chave: "valores", rotulo: "Valores", tipo: "numero", alinhamento: "direita", valor: (r) => (r.tipo === "REFERENCIA" ? null : r.valores), texto: (r) => (r.tipo === "REFERENCIA" ? null : String(r.valores)) },
  { chave: "antes", rotulo: "Soma Antes", tipo: "numero", alinhamento: "direita", valor: (r) => r.somaAntes, texto: (r) => (r.somaAntes === null ? null : formato.valor(r.somaAntes)) },
  { chave: "depois", rotulo: "Soma Depois", tipo: "numero", alinhamento: "direita", valor: (r) => r.somaDepois, texto: (r) => (r.somaDepois === null ? null : formato.valor(r.somaDepois)) },
  {
    chave: "diferenca",
    rotulo: "Diferença",
    tipo: "numero",
    alinhamento: "direita",
    valor: diferenca,
    texto: (r) => {
      const d = diferenca(r);
      return d === null ? null : comSinal(Math.round(d * 100) / 100, formato.valor(d));
    },
  },
];

/**
 * O histórico de reajustes de um cenário (12/10/2026), como um log: cada gravação de valores da DRE (o reajuste dos
 * marcados ou a edição de um valor) e cada carga de referência, do mais recente ao mais antigo.
 */
export function ReajustesContent() {
  const { id } = useParams<{ id: string }>();
  useRegistrarAcessoTela(`/cenarios/sinteticos/${id}/reajustes`);
  const { data, isPending, isError } = useQuery({ queryKey: ["cenarios", id, "reajustes"], queryFn: () => cenariosService.reajustes(id) });
  const tabela = useTabelaFiltravel(data, COLUNAS);
  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Reajustes"
        comoUsar={
          <ul>
            <li>Cada linha é uma gravação na DRE do cenário (tela Resultados) ou a carga de uma referência (tela Configurações), do mais recente ao mais antigo.</li>
            <li>Tipo: Reajuste dos Marcados (o reajuste aplicado às contas e meses marcados), Edição de Valor (um valor clicado; Replicada quando copiado aos meses seguintes) ou Referência Carregada (um arquivo ou o resultado realizado, que substitui a DRE).</li>
            <li>Reajuste: o percentual ou o valor informado; “Valor digitado” quando o valor recalculado foi digitado direto. As somas são as dos valores alterados, antes e depois.</li>
            <li>Passe o mouse sobre as contas para ler a lista inteira. Use os filtros nos rótulos das colunas.</li>
          </ul>
        }
        sobre={<p>O histórico dos reajustes do cenário: quem, quando, em que aba, que contas e meses, o reajuste e o efeito nas somas dos valores alterados.</p>}
      />
      <QuadroTabela
        barra={
          tabela.ativos ? (
            <button type="button" onClick={tabela.limpar} className="ml-auto text-xs font-medium text-gray-900 underline underline-offset-2">
              Limpar Filtros
            </button>
          ) : undefined
        }
      >
        <DataTable<ReajusteDoCenario>
          data={tabela.visiveis}
          cabecalho={tabela.cabecalho}
          filtrosAtivos={tabela.ativos}
          onLimparFiltros={tabela.limpar}
          isLoading={isPending}
          error={isError ? "Erro ao carregar o histórico de reajustes." : null}
          emptyMessage="Nenhum reajuste ainda"
          emptyHint="Os reajustes feitos na tela Resultados e as cargas de referência aparecem aqui."
          columns={COLUNAS.map((c) => c.rotulo)}
          renderRow={(r) => (
            <tr key={r.id} className="border-b border-gray-100 align-top">
              {COLUNAS.map((c) => {
                const texto = c.texto ? c.texto(r) : c.valor?.(r);
                return (
                  <td
                    key={c.chave}
                    className={`px-4 py-2 text-sm ${c.alinhamento === "direita" ? "text-right whitespace-nowrap" : ""} ${c.chave === "data" ? "whitespace-nowrap" : ""} ${c.chave === "contas" ? "max-w-80" : ""}`}
                    title={c.chave === "contas" && texto ? String(texto) : undefined}
                  >
                    {c.chave === "contas" ? <span className="line-clamp-2">{texto}</span> : (texto ?? <span className="text-gray-400">—</span>)}
                  </td>
                );
              })}
            </tr>
          )}
        />
      </QuadroTabela>
    </div>
  );
}
