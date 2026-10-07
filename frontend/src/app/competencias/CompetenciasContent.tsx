"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, ChevronDown, Circle } from "lucide-react";

import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { etapasDoMes, type Etapa } from "@/lib/etapasDoMes";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { QuadroTabela } from "@/components/shared/QuadroTabela";
import { SeletorFiltro } from "@/components/shared/Filtros";
import { useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import type { Coluna } from "@/lib/filtrosDeTabela";

import { AbrirCompetenciaDialog } from "./components/AbrirCompetenciaDialog";
import { rotuloStatus, StatusCompetenciaBadge } from "./components/StatusCompetenciaBadge";
import { competenciasService, type Competencia } from "./services/competenciasService";

const TODOS = "todos";

function dataCurta(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const anoMesDe = (c: { ano: number; mes: number }) => `${c.ano}-${String(c.mes).padStart(2, "0")}`;

/** O mês seguinte ao mais recente já aberto (o mês atual, se não houver nenhum). */
function proximoMes(itens: Competencia[]) {
  const ultimo = itens.reduce<Competencia | null>((m, c) => (!m || c.ano * 12 + c.mes > m.ano * 12 + m.mes ? c : m), null);
  if (!ultimo) {
    const hoje = new Date();
    return { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
  }
  return ultimo.mes === 12 ? { ano: ultimo.ano + 1, mes: 1 } : { ano: ultimo.ano, mes: ultimo.mes + 1 };
}

type Passo = { rotulo: string; estado: "feito" | "atencao" | "falta"; dica: string; etapa?: string };

/** O andamento do mês em quatro passos: importado, classificado, apurado, fechado. */
function passosDe(c: Competencia): Passo[] {
  const a = c.andamento;
  if (!a) return [];
  const pendentes = a.pendencias + a.semClassificacao;
  return [
    a.balancete
      ? { rotulo: "Importado", estado: "feito", dica: "Balancete importado.", etapa: "importar" }
      : { rotulo: "Importado", estado: "falta", dica: "O balancete ainda não foi importado.", etapa: "importar" },
    a.lancamentos === 0
      ? { rotulo: "Classificado", estado: "falta", dica: "Nenhum lançamento para classificar.", etapa: "classificacao" }
      : pendentes > 0
        ? { rotulo: `Classificado · ${pendentes}`, estado: "atencao", dica: `${pendentes} lançamento(s) com pendência ou sem classificação.`, etapa: "classificacao" }
        : { rotulo: "Classificado", estado: "feito", dica: `${a.lancamentos.toLocaleString("pt-BR")} lançamentos classificados.`, etapa: "classificacao" },
    c.apuracoes === 0
      ? { rotulo: "Apurado", estado: "falta", dica: "Ainda não apurada.", etapa: "dre" }
      : a.desatualizada
        ? { rotulo: "Reapurar", estado: "atencao", dica: "As entradas mudaram depois da apuração: reapure.", etapa: "dre" }
        : { rotulo: "Apurado", estado: "feito", dica: `Apurada ${c.apuracoes}× · a última em ${dataCurta(c.apuradaEm)}${c.usuarioApuracao ? ` por ${c.usuarioApuracao.nome}` : ""}.`, etapa: "dre" },
    c.status === "FECHADA"
      ? { rotulo: "Fechado", estado: "feito", dica: `Fechada em ${dataCurta(c.fechadaEm)}${c.usuarioFechamento ? ` por ${c.usuarioFechamento.nome}` : ""}.`, etapa: "dre" }
      : { rotulo: "Fechado", estado: "falta", dica: "Ainda não fechada.", etapa: "dre" },
  ];
}

const ESTILO_PASSO = {
  feito: { classe: "text-green-700", Icone: Check },
  atencao: { classe: "bg-yellow-50 text-yellow-800 border-yellow-200", Icone: AlertTriangle },
  falta: { classe: "text-gray-400", Icone: Circle },
} as const;

/** O que falta no mês, em poucas palavras (o primeiro passo não feito), para filtrar a coluna Andamento. */
const A_FAZER = ["A importar", "A classificar", "A apurar", "A fechar"];

function andamentoResumido(c: Competencia) {
  const passos = passosDe(c);
  if (passos.length === 0) return null;
  const i = passos.findIndex((p) => p.estado !== "feito");
  if (i < 0) return "Fechado";
  return i === 2 && passos[i].estado === "atencao" ? "A reapurar" : A_FAZER[i];
}

/** Os rótulos do StatusCompetenciaBadge, para o filtro da coluna Estado. */
const instante = (iso: string | null) => (iso ? new Date(iso).getTime() : null);

const COLUNAS: Coluna<Competencia>[] = [
  { chave: "competencia", rotulo: "Competência", tipo: "data", valor: (c) => c.ano * 12 + c.mes, texto: (c) => `${String(c.mes).padStart(2, "0")}/${c.ano}` },
  { chave: "estado", rotulo: "Estado", valor: (c) => rotuloStatus(c.status) },
  { chave: "andamento", rotulo: "Andamento", valor: andamentoResumido },
  {
    chave: "divergencias",
    rotulo: "Divergências",
    tipo: "numero",
    valor: (c) => c._count.divergencias,
    texto: (c) => (c._count.divergencias > 0 ? `${c._count.divergencias} aberta(s)` : null),
  },
  {
    chave: "apuracao",
    rotulo: "Apurada em",
    tipo: "data",
    valor: (c) => (c.apuracoes === 0 ? null : instante(c.apuradaEm)),
    texto: (c) => (c.apuracoes === 0 || !c.apuradaEm ? null : dataCurta(c.apuradaEm)),
  },
  { chave: "fechadaEm", rotulo: "Fechada em", tipo: "data", valor: (c) => instante(c.fechadaEm), texto: (c) => (c.fechadaEm ? dataCurta(c.fechadaEm) : null) },
  { chave: "abrir", rotulo: "", semFiltro: true },
];

function Andamento({ c, etapas }: { c: Competencia; etapas: Etapa[] }) {
  return (
    <ol className="flex items-center gap-1" aria-label="Andamento do mês">
      {passosDe(c).map((p) => {
        const { classe, Icone } = ESTILO_PASSO[p.estado];
        const etapa = etapas.find((e) => e.chave === p.etapa);
        const conteudo = (
          <>
            <Icone className={p.estado === "falta" ? "size-2.5" : "size-3.5"} strokeWidth={p.estado === "feito" ? 3 : 2} />
            {p.rotulo}
          </>
        );
        const base = `inline-flex items-center gap-1 rounded-sm border border-transparent px-1 py-0.5 text-xs whitespace-nowrap ${classe}`;
        return (
          <li key={p.rotulo} title={p.dica}>
            {etapa ? (
              <Link href={`/competencias/${anoMesDe(c)}/${etapa.caminho}`} onClick={(e) => e.stopPropagation()} className={`${base} hover:border-gray-300`}>
                {conteudo}
              </Link>
            ) : (
              <span className={base}>{conteudo}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function CompetenciasContent() {
  const router = useRouter();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  useRegistrarAcessoTela("/competencias");

  const [ano, setAno] = useState<string>(TODOS);

  const { data, isPending, isError } = useQuery({
    queryKey: ["competencias", ano, "andamento"],
    queryFn: () => competenciasService.listar(ano === TODOS ? undefined : Number(ano), true),
  });
  // Todas as competências (a mesma consulta do menu lateral), para sugerir o próximo mês.
  const todas = useQuery({ queryKey: ["competencias", "todos"], queryFn: () => competenciasService.listar() });

  const tabela = useTabelaFiltravel(data?.itens, COLUNAS);

  // As telas de cada mês que o perfil do usuário alcança (Passo 22), na ordem do fechamento.
  const etapas = etapasDoMes(hasPermission, user?.acesso);
  const abrirMes = (c: Competencia) => {
    if (etapas[0]) router.push(`/competencias/${anoMesDe(c)}/${etapas[0].caminho}`);
  };

  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Competências"
        sobre={
          <p>
            Cada mês do fechamento, o estado em que ele se encontra e o andamento das etapas. Clique na linha para abrir o mês, ou num passo do
            andamento para ir direto à etapa.
          </p>
        }
        acoes={
          todas.data ? (
            <PermissionGuard permission="competencia:editar">
              <AbrirCompetenciaDialog sugestao={proximoMes(todas.data.itens)} />
            </PermissionGuard>
          ) : null
        }
      />

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
            <div className="flex shrink-0 items-center gap-3">
              {tabela.ativos ? (
                <button type="button" onClick={tabela.limpar} className="text-xs font-medium text-gray-900 underline underline-offset-2">
                  Limpar Filtros
                </button>
              ) : null}
              <span className="text-xs text-gray-600">
                {isPending ? "" : tabela.total !== tabela.totalGeral ? `${tabela.total} de ${tabela.totalGeral} competência(s)` : `${tabela.total} competência(s)`}
              </span>
            </div>
          </>
        }
      >
        <DataTable<Competencia>
          data={tabela.visiveis}
          cabecalho={tabela.cabecalho}
          filtrosAtivos={tabela.ativos}
          onLimparFiltros={tabela.limpar}
          isLoading={isPending}
          error={isError ? "Erro ao carregar as competências." : null}
          emptyMessage="Nenhuma competência aberta"
          emptyHint="Use o botão Abrir competência para abrir o primeiro mês."
          columns={["Competência", "Estado", "Andamento", "Divergências", "Apurada em", "Fechada em", ""]}
          renderRow={(c) => (
            <tr key={c.id} onClick={() => abrirMes(c)} className="cursor-pointer border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 text-sm whitespace-nowrap">
                {etapas[0] ? (
                  <Link href={`/competencias/${anoMesDe(c)}/${etapas[0].caminho}`} onClick={(e) => e.stopPropagation()} className="font-bold text-gray-900 tabular-nums hover:underline">
                    {String(c.mes).padStart(2, "0")}/{c.ano}
                  </Link>
                ) : (
                  <span className="font-bold text-gray-900 tabular-nums">
                    {String(c.mes).padStart(2, "0")}/{c.ano}
                  </span>
                )}
                <span className="ml-2 text-xs text-gray-500">{c.nomeMes}</span>
              </td>
              <td className="px-4">
                <StatusCompetenciaBadge status={c.status} />
              </td>
              <td className="px-4">
                <Andamento c={c} etapas={etapas} />
              </td>
              <td className="px-4 text-sm tabular-nums">
                {c._count.divergencias > 0 ? (
                  <span className="font-medium text-yellow-800" title="Divergências abertas">
                    {c._count.divergencias} aberta(s)
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-4 text-sm whitespace-nowrap text-gray-600 tabular-nums" title={c.apuracoes ? `${c.apuracoes} apuração(ões)${c.usuarioApuracao ? ` · a última por ${c.usuarioApuracao.nome}` : ""}` : undefined}>
                {c.apuracoes === 0 ? <span className="text-gray-400">—</span> : dataCurta(c.apuradaEm)}
              </td>
              <td className="px-4 text-sm whitespace-nowrap text-gray-600 tabular-nums">
                {dataCurta(c.fechadaEm)}
                {c._count.historicoReaberturas > 0 ? (
                  <span className="ml-1.5 text-xs text-yellow-800" title="Vezes em que foi reaberta depois de fechada">
                    reaberta {c._count.historicoReaberturas}×
                  </span>
                ) : null}
              </td>
              <td className="px-4" onClick={(e) => e.stopPropagation()}>
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
                        <DropdownMenuItem key={e.chave} render={<Link href={`/competencias/${anoMesDe(c)}/${e.caminho}`} />}>
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
