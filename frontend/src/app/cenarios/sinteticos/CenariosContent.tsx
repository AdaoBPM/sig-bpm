"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Globe, Lock, Plus } from "lucide-react";

import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { DataTable } from "@/components/shared/DataTable";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { QuadroTabela } from "@/components/shared/QuadroTabela";
import { useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import { Button } from "@/components/ui/button";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import type { Coluna } from "@/lib/filtrosDeTabela";

import { formato } from "@/app/relatorios/services/relatoriosService";

import { botaoPrimario, CenarioDialog } from "../components/CenarioDialog";
import { cenariosService, rotuloMarcacao, rotuloVersao, ROTULO_VISUALIZACAO, type Cenario } from "../services/cenariosService";

const dataCurta = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : null);

const COLUNAS: Coluna<Cenario>[] = [
  // O nome com a versão (13/10/2026), para o filtro separar as revisões.
  { chave: "nome", rotulo: "Cenário", valor: (c) => `${c.nome} ${rotuloVersao(c.versao)}` },
  { chave: "ano", rotulo: "Exercício", tipo: "numero", valor: (c) => c.ano, texto: (c) => String(c.ano) },
  // Os resultados do exercício no Consolidado (13/10/2026): ordena e filtra pelo RL.
  { chave: "resultados", rotulo: "Resultados", tipo: "numero", valor: (c) => c.resultados?.rl.valor ?? null, texto: (c) => (c.resultados ? `RL ${reaisAbreviados(c.resultados.rl.valor)}` : null) },
  // Sem as colunas Conteúdo, Arquivo e Marcação e sem os ícones de ações (13/10/2026): a marcação é uma etiqueta na
  // coluna Cenário (muda em Configurações / Cenário), e a importação num cenário fica na aba Referência das Configurações.
];

type Dialogo = { tipo: "novo" } | null;

/** O valor em reais abreviado (13/10/2026): R$ 86,42M nos milhões, R$ 532,10 mil nos milhares. */
const reaisAbreviados = (v: number) => {
  const duas = (x: number) => x.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (Math.abs(v) >= 1e6) return `R$ ${duas(v / 1e6)}M`;
  if (Math.abs(v) >= 1e3) return `R$ ${duas(v / 1e3)} mil`;
  return `R$ ${duas(v)}`;
};

/** As linhas da coluna Resultados: a ROL em R$; o CPV, o EBITDA e o RL em R$ e em % (como no total da tela Resultados). */
const RESUMO: Array<{ chave: "rol" | "cpv" | "ebitda" | "rl"; rotulo: string; comPct: boolean }> = [
  { chave: "rol", rotulo: "ROL", comPct: false },
  { chave: "cpv", rotulo: "CPV", comPct: true },
  { chave: "ebitda", rotulo: "EBITDA", comPct: true },
  { chave: "rl", rotulo: "RL", comPct: true },
];
function Resumo({ c }: { c: Cenario }) {
  if (!c.resultados) return <span className="text-gray-400">—</span>;
  const r = c.resultados;
  // Concatenado, sem colunas (13/10/2026): "CPV R$ 86,42M (71,2%)".
  return (
    <div className="text-xs leading-5 whitespace-nowrap text-gray-700">
      {RESUMO.map((x) => (
        <div key={x.chave}>
          <span className="font-medium text-gray-900">{x.rotulo}</span> {reaisAbreviados(r[x.chave].valor)}
          {x.comPct && r[x.chave].pct !== null ? ` (${formato.pct(r[x.chave].pct!)})` : ""}
        </div>
      ))}
    </div>
  );
}

export function CenariosContent() {
  useRegistrarAcessoTela("/cenarios/sinteticos");
  const router = useRouter();
  const { data, isPending, isError } = useQuery({ queryKey: ["cenarios"], queryFn: () => cenariosService.listar() });
  const tabela = useTabelaFiltravel(data, COLUNAS);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const abrir = (c: Cenario) => router.push(`/cenarios/sinteticos/${c.id}/resultados`);

  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Cenários Sintéticos"
        comoUsar={
          <ul>
            <li>
              Use “Novo Cenário” para um cenário vazio ou a cópia de outro. Para partir de uma planilha, crie o cenário e importe o arquivo em
              Configurações / Referência: a ferramenta lê e confere as abas e mostra, aba por aba, o que vai entrar e o que muda no cenário antes de
              gravar.
            </li>
            <li>
              A coluna Resultados traz o total do exercício no Consolidado: a ROL em R$ e o CPV, o EBITDA e o RL em R$ e em % (os mesmos % da coluna do
              total da tela Resultados), com os reais abreviados (R$ 86,42M nos milhões, R$ 532,10 mil nos milhares). A coluna ordena e filtra pelo RL.
            </li>
            <li>
              Ao lado do nome, a versão do cenário (VER00, VER01…), com o cadeado quando salva. As versões se salvam e se revisam na tela Resultados de
              cada cenário (Salvar Versão e Criar Revisão); cada revisão é um cenário próprio na lista, com o mesmo nome e a versão seguinte.
            </li>
            <li>Clique na linha para abrir o cenário, com as telas Configurações (para quem edita), Resultados, Indicadores e Reajustes.</li>
            <li>
              Embaixo da visualização, a etiqueta da marcação diz se o cenário é o Orçamento Empresarial, os Resultados Anteriores ou os Resultados Vendidos. Para marcar, excluir,
              importar um arquivo no cenário ou mudar o nome, a descrição, a visualização, a referência e o comparativo, abra o cenário e vá em
              Configurações. Cada marcação fica ativa em um cenário só: marcar outro tira a marcação do anterior.
            </li>
            <li>O cenário marcado como Orçamento Empresarial dá o orçado das telas Indicadores e Painel de Bordo de Resultados Realizados.</li>
            <li>A DRE do cenário se edita na tela Resultados dele, sem precisar de planilha. Um cenário marcado não se exclui nem se edita (a DRE, os indicadores manuais e a referência; o nome e a descrição, sim): tire a marcação (ou marque outro cenário) antes.</li>
            <li>
              Ao criar (Novo Cenário) ou editar um cenário, escolha a Visualização: Particular (só você, que criou, e o Administrador
              têm acesso; os demais não veem o cenário na lista) ou Pública (todos os usuários com permissão nos Cenários Sintéticos). Embaixo do nome, a
              lista mostra a de cada cenário. Só quem criou o cenário ou o Administrador muda a visualização, e um cenário marcado fica sempre público
              (a marcação vale para todos).
            </li>
            <li>Use os filtros nos rótulos das colunas.</li>
          </ul>
        }
        sobre={
          <>
            <p>
              Os cenários sintéticos: cada um é uma DRE por unidade (Consolidado, Matriz, Filial, Serviços, Despesas e Extra e RN), mês a mês no
              exercício, com as metas dos indicadores — como o ORÇAMENTO BPM 2026 - CENÁRIO ADOTADO e a aba Metas do INDICADORES DE RESULTADO.
            </p>
            <p>
              A importação lê as abas pelo nome (o nome do arquivo não importa): Consolidado, Matriz, Filial, Serviços, Desp.+Extra e RN (ou Extra
              RN), com a descrição na coluna A e os meses JAN a DEZ no rótulo, e a aba Metas (ou Metas (Orçamento)), com o INDICADOR e os meses.
              Cada linha da DRE se liga à da Estrutura da DRE pela descrição, na ordem.
            </p>
            <p>Os cenários analíticos (montados pelas premissas) ficam em Cenários Analíticos.</p>
          </>
        }
        acoes={
          <PermissionGuard permission="cenarios:editar">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" className={botaoPrimario} onClick={() => setDialogo({ tipo: "novo" })}>
                <Plus className="size-4" />
                Novo Cenário
              </Button>
            </div>
          </PermissionGuard>
        }
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
        <DataTable<Cenario>
          data={tabela.visiveis}
          cabecalho={tabela.cabecalho}
          filtrosAtivos={tabela.ativos}
          onLimparFiltros={tabela.limpar}
          isLoading={isPending}
          error={isError ? "Erro ao carregar os cenários." : null}
          emptyMessage="Nenhum cenário gerado"
          emptyHint="Use Novo Cenário para criar o primeiro."
          columns={["Cenário", "Exercício", "Resultados"]}
          renderRow={(c) => (
            <tr key={c.id} onClick={() => abrir(c)} className="cursor-pointer border-b border-gray-100 hover:bg-gray-50">
              <td className="min-w-48 px-4 py-2 text-sm">
                <Link href={`/cenarios/sinteticos/${c.id}/resultados`} onClick={(e) => e.stopPropagation()} className="font-bold text-gray-900">
                  {c.nome}
                </Link>
                {/* A versão (13/10/2026), com o cadeado quando salva. */}
                <span
                  className="ml-2 inline-flex items-center gap-1 rounded-sm border border-gray-300 px-1.5 py-px align-middle text-xs font-medium text-gray-700"
                  title={c.versaoSalvaEm ? "Versão salva: os dados não se editam" : "Versão aberta para edição"}
                >
                  {c.versaoSalvaEm ? <Lock className="size-3" /> : null}
                  {rotuloVersao(c.versao)}
                </span>
                {c.descricao ? <div className="text-xs text-gray-500">{c.descricao}</div> : null}
                {/* Quando e por quem foi criado, embaixo do nome (sem coluna própria, para a tabela caber na largura da tela). */}
                <div className="text-xs text-gray-400">
                  Criado em {dataCurta(c.criadoEm)}
                  {c.criadoPor ? ` por ${c.criadoPor}` : ""}
                </div>
                {/* A visualização: particular (só quem criou e o Administrador) ou pública. */}
                <div className={`inline-flex items-center gap-1 text-xs ${c.visualizacao === "PARTICULAR" ? "font-medium text-gray-700" : "text-gray-400"}`}>
                  {c.visualizacao === "PARTICULAR" ? <Lock className="size-3" /> : <Globe className="size-3" />}
                  {ROTULO_VISUALIZACAO[c.visualizacao]}
                </div>
                {/* A marcação (13/10/2026; antes, uma coluna): uma etiqueta embaixo da visualização. */}
                {c.marcacao ? (
                  <div className="mt-1">
                    <span className="rounded-sm border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-900">{rotuloMarcacao(c.marcacao)}</span>
                  </div>
                ) : null}
              </td>
              <td className="px-4 text-sm">{c.ano}</td>
              <td className="px-4 py-2">
                <Resumo c={c} />
              </td>
            </tr>
          )}
        />
      </QuadroTabela>

      {dialogo?.tipo === "novo" ? <CenarioDialog cenario={null} cenarios={data ?? []} onFechar={() => setDialogo(null)} /> : null}
    </div>
  );
}
