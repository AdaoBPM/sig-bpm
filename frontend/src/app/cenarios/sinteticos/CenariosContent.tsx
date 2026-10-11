"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { DataTable } from "@/components/shared/DataTable";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { QuadroTabela } from "@/components/shared/QuadroTabela";
import { useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/context/PermissionContext";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import type { Coluna } from "@/lib/filtrosDeTabela";

import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

import { botaoPrimario, CenarioDialog, ExcluirCenarioDialog } from "../components/CenarioDialog";
import { ImportarCenarioDialog } from "../components/ImportarCenarioDialog";
import { cenariosService, MARCACOES, rotuloMarcacao, type Cenario, type MarcacaoCenario } from "../services/cenariosService";

const dataCurta = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : null);

/** O que o cenário tem: as visões da DRE (das seis) e os indicadores com meta. */
const conteudoDe = (c: Cenario) => (c.visoes.length === 0 && c.indicadores === 0 ? "Vazio" : `DRE: ${c.visoes.length}/6 · Metas: ${c.indicadores}`);

const COLUNAS: Coluna<Cenario>[] = [
  { chave: "nome", rotulo: "Cenário", valor: (c) => c.nome },
  { chave: "ano", rotulo: "Exercício", tipo: "numero", valor: (c) => c.ano, texto: (c) => String(c.ano) },
  { chave: "marcacao", rotulo: "Marcação", valor: (c) => rotuloMarcacao(c.marcacao) },
  { chave: "conteudo", rotulo: "Conteúdo", valor: conteudoDe },
  // O arquivo e, embaixo, quando foi importado (uma coluna só, para a tabela caber na largura da tela).
  { chave: "arquivo", rotulo: "Arquivo", valor: (c) => c.nomeArquivo },
  { chave: "acoes", rotulo: "", semFiltro: true },
];

/** A marcação do cenário: quem edita escolhe na lista; uma marcação vale para um cenário só por exercício. */
function Marcacao({ c, pode }: { c: Cenario; pode: boolean }) {
  const queryClient = useQueryClient();
  const marcar = useMutation({
    mutationFn: (m: MarcacaoCenario | null) => cenariosService.marcar(c.id, m),
    onSuccess: (r, m) => {
      queryClient.invalidateQueries({ queryKey: ["cenarios"] });
      // O orçado de Resultados Realizados muda com o Orçamento Empresarial.
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
      toast.success(
        m ? `${c.nome} marcado como ${rotuloMarcacao(m)}.${r.desmarcado ? ` ${r.desmarcado} deixou de ser.` : ""}` : `${c.nome} ficou sem marcação.`,
      );
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível marcar o cenário.")),
  });
  if (!pode) return <span className={c.marcacao ? "font-medium text-gray-900" : "text-gray-400"}>{rotuloMarcacao(c.marcacao) ?? "—"}</span>;
  return (
    <select
      aria-label={`Marcação de ${c.nome}`}
      value={c.marcacao ?? ""}
      disabled={marcar.isPending}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => marcar.mutate((e.target.value || null) as MarcacaoCenario | null)}
      className={`h-8 w-40 rounded-sm border border-gray-300 bg-white px-2 text-sm ${c.marcacao ? "font-medium text-gray-900" : "text-gray-500"}`}
    >
      <option value="">Sem Marcação</option>
      {MARCACOES.map((m) => (
        <option key={m.valor} value={m.valor}>
          {m.rotulo}
        </option>
      ))}
    </select>
  );
}

type Dialogo = { tipo: "novo" } | { tipo: "editar"; c: Cenario } | { tipo: "excluir"; c: Cenario } | { tipo: "importar"; c: Cenario | null } | null;

export function CenariosContent() {
  useRegistrarAcessoTela("/cenarios/sinteticos");
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const podeEditar = hasPermission("cenarios:editar");
  const { data, isPending, isError } = useQuery({ queryKey: ["cenarios"], queryFn: () => cenariosService.listar() });
  const tabela = useTabelaFiltravel(data, COLUNAS);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const abrir = (c: Cenario) => router.push(`/cenarios/sinteticos/${c.id}/resultados`);
  const acao = "inline-flex size-8 items-center justify-center rounded-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900";

  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Cenários Gerados"
        comoUsar={
          <ul>
            <li>Use “Importar Cenário” para criar um cenário a partir de uma planilha (com o nome, o exercício e a descrição), ou “Novo Cenário” para um cenário vazio ou a cópia de outro.</li>
            <li>
              Na importação, escolha o arquivo: a ferramenta lê e confere as abas e mostra, aba por aba, o que vai entrar e o que muda no cenário
              (valores novos, alterados e removidos; “Sem mudança” quando é igual). Nada é gravado antes de você clicar em “Importar”.
            </li>
            <li>Clique na linha para abrir o cenário, com as telas Resultados e Indicadores.</li>
            <li>
              Na coluna Marcação, escolha o papel do cenário no exercício: Orçamento Empresarial, Resultados Anteriores ou Resultados Vendidos. Cada
              marcação vale para um cenário só por exercício: marcar outro tira a marcação do anterior.
            </li>
            <li>O cenário marcado como Orçamento Empresarial dá o orçado das telas Indicadores e Painel de Bordo de Resultados Realizados.</li>
            <li>Nos ícones da linha: importar um arquivo no cenário (substitui as abas que o arquivo tiver), editar o nome e a descrição, e excluir.</li>
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
              <Button type="button" className={botaoPrimario} onClick={() => setDialogo({ tipo: "importar", c: null })}>
                <Upload className="size-4" />
                Importar Cenário
              </Button>
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
          emptyHint="Use Importar Cenário ou Novo Cenário para criar o primeiro."
          columns={["Cenário", "Exercício", "Marcação", "Conteúdo", "Arquivo", ""]}
          renderRow={(c) => (
            <tr key={c.id} onClick={() => abrir(c)} className="cursor-pointer border-b border-gray-100 hover:bg-gray-50">
              <td className="min-w-48 px-4 py-2 text-sm">
                <Link href={`/cenarios/sinteticos/${c.id}/resultados`} onClick={(e) => e.stopPropagation()} className="font-bold text-gray-900">
                  {c.nome}
                </Link>
                {c.descricao ? <div className="text-xs text-gray-500">{c.descricao}</div> : null}
                {/* Quando e por quem foi criado, embaixo do nome (sem coluna própria, para a tabela caber na largura da tela). */}
                <div className="text-xs text-gray-400">
                  Criado em {dataCurta(c.criadoEm)}
                  {c.criadoPor ? ` por ${c.criadoPor}` : ""}
                </div>
              </td>
              <td className="px-4 text-sm">{c.ano}</td>
              <td className="px-4 text-sm">
                <Marcacao c={c} pode={podeEditar} />
              </td>
              <td className="px-4 text-sm whitespace-nowrap">
                {c.visoes.length === 0 && c.indicadores === 0 ? (
                  "Vazio"
                ) : (
                  <>
                    <div>DRE: {c.visoes.length}/6</div>
                    <div>Metas: {c.indicadores}</div>
                  </>
                )}
              </td>
              <td className="max-w-44 px-4 text-sm" title={c.nomeArquivo ?? undefined}>
                <div className="truncate">{c.nomeArquivo ?? "—"}</div>
                {c.importadoEm ? <div className="text-xs whitespace-nowrap text-gray-500">Importado em {dataCurta(c.importadoEm)}</div> : null}
              </td>
              <td className="px-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                {podeEditar ? (
                  <>
                    <button type="button" className={acao} title="Importar um arquivo neste cenário" aria-label={`Importar arquivo em ${c.nome}`} onClick={() => setDialogo({ tipo: "importar", c })}>
                      <Upload className="size-4" />
                    </button>
                    <button type="button" className={acao} title="Editar o nome e a descrição" aria-label={`Editar ${c.nome}`} onClick={() => setDialogo({ tipo: "editar", c })}>
                      <Pencil className="size-4" />
                    </button>
                    <button type="button" className={acao} title="Excluir o cenário" aria-label={`Excluir ${c.nome}`} onClick={() => setDialogo({ tipo: "excluir", c })}>
                      <Trash2 className="size-4" />
                    </button>
                  </>
                ) : null}
              </td>
            </tr>
          )}
        />
      </QuadroTabela>

      {dialogo?.tipo === "novo" ? <CenarioDialog cenario={null} cenarios={data ?? []} onFechar={() => setDialogo(null)} /> : null}
      {dialogo?.tipo === "editar" ? <CenarioDialog cenario={dialogo.c} cenarios={data ?? []} onFechar={() => setDialogo(null)} /> : null}
      {dialogo?.tipo === "excluir" ? <ExcluirCenarioDialog cenario={dialogo.c} onFechar={() => setDialogo(null)} /> : null}
      {dialogo?.tipo === "importar" ? <ImportarCenarioDialog cenario={dialogo.c} onFechar={() => setDialogo(null)} /> : null}
    </div>
  );
}
