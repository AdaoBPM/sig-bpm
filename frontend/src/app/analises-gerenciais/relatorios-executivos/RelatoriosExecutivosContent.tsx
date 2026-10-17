"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { DataTable } from "@/components/shared/DataTable";
import { QuadroTabela } from "@/components/shared/QuadroTabela";
import { useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/context/PermissionContext";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import type { Coluna } from "@/lib/filtrosDeTabela";

import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";
import { botaoPrimario, classeSelect, Erro } from "@/app/cenarios/components/CenarioDialog";

import { EtiquetaSituacao, ROTULO_SITUACAO } from "./components/EtiquetaSituacao";
import { relatoriosExecutivosService, type ListaDeRelatorios, type ResumoDoRelatorio } from "./services/relatoriosExecutivosService";

const dataCurta = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

const COLUNAS: Coluna<ResumoDoRelatorio>[] = [
  { chave: "competencia", rotulo: "Competência", classe: "!px-3", tipo: "numero", valor: (r) => r.ano * 100 + r.mes, texto: (r) => r.rotuloMes },
  { chave: "situacao", rotulo: "Situação", classe: "!px-3", valor: (r) => ROTULO_SITUACAO[r.situacao] },
  { chave: "andamento", rotulo: "Abas Finalizadas", classe: "!px-3", tipo: "numero", valor: (r) => r.finalizadas, texto: (r) => `${r.finalizadas} de ${r.total}` },
  { chave: "minhas", rotulo: "Suas Abas", classe: "!px-3", valor: (r) => (r.minhas.length && r.minhas.length === r.total ? "Todas" : r.minhas.map((m) => `${m.nome}: ${ROTULO_SITUACAO[m.situacao]}`).join(", ") || "—") },
  { chave: "criadoPor", rotulo: "Criado Por", classe: "!px-3", valor: (r) => r.criadoPor },
  { chave: "atualizadoEm", rotulo: "Atualizado em", classe: "!px-3", tipo: "data", valor: (r) => new Date(r.atualizadoEm).getTime(), texto: (r) => dataCurta(r.atualizadoEm) },
];

/**
 * A lista dos Relatórios Executivos (15/10/2026, Análises Gerenciais), como as listas das competências e dos cenários:
 * um relatório por competência fechada, com a situação (finalizado quando todas as abas estão), as abas finalizadas, as
 * abas do usuário (as do recorte dele) e quem o criou. Clicar na linha abre o relatório; “Novo Relatório” cria o de uma
 * competência fechada que ainda não tem.
 */
export function RelatoriosExecutivosContent() {
  useRegistrarAcessoTela("/analises-gerenciais/relatorios-executivos");
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const pode = hasPermission("relatorios_executivos:editar");
  const [criando, setCriando] = useState(false);
  const consulta = useQuery({ queryKey: ["relatorios-executivos"], queryFn: () => relatoriosExecutivosService.listar() });
  const tabela = useTabelaFiltravel(consulta.data?.relatorios, COLUNAS);
  const livres = consulta.data?.livres ?? [];
  const abrir = (r: ResumoDoRelatorio) => router.push(`/analises-gerenciais/relatorios-executivos/${r.id}`);
  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Relatórios Executivos"
        acoes={
          pode ? (
            <Button type="button" className={botaoPrimario} disabled={!consulta.data || !livres.length} title={consulta.data && !livres.length ? "Todas as competências fechadas já têm relatório" : undefined} onClick={() => setCriando(true)}>
              <Plus className="size-4" />
              Novo Relatório
            </Button>
          ) : null
        }
        comoUsar={
          <ul>
            <li>Cada linha é o relatório de uma competência fechada (um por competência). Clique na linha para abrir o relatório.</li>
            <li>
              A Situação é Finalizado quando todas as abas (as seis: Introdução, Resultados, Comercial, Produção, Serviços e Administrativo) estão finalizadas;
              antes, Em Elaboração. A coluna Abas Finalizadas mostra o andamento, e Suas Abas, as abas que você edita e a situação de cada uma (Fatos e
              Resultados são de todos os que editam a tela; as performances seguem o seu recorte de departamentos, em Controle de Usuários; sem recorte, Todas).
            </li>
            {pode ? (
              <li>
                “Novo Relatório” cria o relatório de uma competência fechada que ainda não tem. Em Importar de, escolha o relatório de onde vêm os cards (com
                os dados da competência nova), as fotos e as anotações das abas (de início, o mais recente), ou Nenhum, para começar com as abas vazias; sem
                “Manter Imagens e Anotações”, só os cards vêm do relatório escolhido; depois,
                cada gestor ajusta as abas dele.
              </li>
            ) : null}
            <li>Use os filtros nos rótulos das colunas.</li>
          </ul>
        }
        sobre={
          <p>
            Os Relatórios Executivos são as apresentações mensais dos gestores: um relatório por competência fechada, com seis abas — Introdução,
            Demonstrativo de Resultados e as performances Comercial, da Produção, de Serviços e Administrativa —, onde cada gestor escolhe os cards do Painel de Bordo e dos Indicadores e escreve as anotações dos pontos positivos, negativos e de atenção, com fotos. Os cards
            trazem só as competências fechadas, até o mês do relatório. Cada aba em elaboração só aparece para quem a edita; finalizada, todos a veem.
          </p>
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
        <DataTable<ResumoDoRelatorio>
          data={tabela.visiveis}
          cabecalho={tabela.cabecalho}
          filtrosAtivos={tabela.ativos}
          onLimparFiltros={tabela.limpar}
          isLoading={consulta.isPending}
          error={consulta.isError ? mensagemDeErro(consulta.error, "Erro ao carregar os relatórios.") : null}
          emptyMessage="Nenhum relatório criado"
          emptyHint={pode ? "Use Novo Relatório para criar o da competência fechada." : undefined}
          columns={COLUNAS.map((c) => c.rotulo)}
          renderRow={(r) => (
            <tr key={r.id} onClick={() => abrir(r)} className="cursor-pointer border-b border-gray-100 hover:bg-gray-50">
              <td className="px-3 py-2 text-sm font-bold whitespace-nowrap text-gray-900">{r.rotuloMes}</td>
              <td className="px-3 py-2 text-sm">
                <EtiquetaSituacao situacao={r.situacao} />
              </td>
              <td className="px-3 py-2 text-sm whitespace-nowrap">
                {r.finalizadas} de {r.total}
              </td>
              <td className="px-3 py-2 text-sm">
                {/* Quem edita todas (sem recorte): "Todas"; o andamento está na coluna ao lado. */}
                {r.minhas.length && r.minhas.length === r.total ? (
                  <span className="text-gray-700">Todas</span>
                ) : r.minhas.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {r.minhas.map((m) => (
                      <span key={m.chave} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        {m.nome}
                        <EtiquetaSituacao situacao={m.situacao} />
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-sm whitespace-nowrap">
                {r.criadoPor}
                <div className="text-xs text-gray-500">em {dataCurta(r.criadoEm)}</div>
              </td>
              <td className="px-3 py-2 text-sm whitespace-nowrap text-gray-700">{dataHora(r.atualizadoEm)}</td>
            </tr>
          )}
        />
      </QuadroTabela>
      {criando && consulta.data ? <NovoRelatorioDialog dados={consulta.data} onFechar={() => setCriando(false)} /> : null}
    </div>
  );
}

/**
 * O modal Novo Relatório: a competência (fechada, ainda sem relatório) e, desde 16/10/2026, o relatório de onde importar
 * os cards, as fotos e as anotações das abas (de início, o mais recente; ou nenhum, para começar com as abas vazias).
 */
function NovoRelatorioDialog({ dados, onFechar }: { dados: ListaDeRelatorios; onFechar: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [escolhida, setEscolhida] = useState(dados.livres[0] ? `${dados.livres[0].ano}|${dados.livres[0].mes}` : "");
  const [ano, mes] = escolhida.split("|").map(Number);
  const [importarDe, setImportarDe] = useState(dados.relatorios[0]?.id ?? "");
  const [manter, setManter] = useState(true);
  const criar = useMutation({
    mutationFn: () => relatoriosExecutivosService.criar(ano, mes, importarDe || null, manter),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["relatorios-executivos"] });
      toast.success(`Relatório de ${r.rotuloMes} criado.`);
      router.push(`/analises-gerenciais/relatorios-executivos/${r.id}`);
    },
  });
  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent className="rounded-sm sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Relatório Executivo</DialogTitle>
          <DialogDescription>
            O relatório da competência, com as seis abas: Introdução e Resultados, de todos, e as performances, de cada gestor pelo seu recorte
            {dados.meusDepartamentos.length && dados.meusDepartamentos.length < 6 ? ` (as suas: ${dados.meusDepartamentos.map((d) => d.nome).join(", ")})` : ""}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="novo-competencia">Competência</Label>
          <select id="novo-competencia" value={escolhida} onChange={(e) => setEscolhida(e.target.value)} className={classeSelect}>
            {dados.livres.map((c) => (
              <option key={`${c.ano}|${c.mes}`} value={`${c.ano}|${c.mes}`}>
                {c.rotulo}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="novo-importar">Importar de</Label>
          <select id="novo-importar" value={importarDe} onChange={(e) => setImportarDe(e.target.value)} className={classeSelect}>
            {dados.relatorios.map((r) => (
              <option key={r.id} value={r.id}>
                {r.rotuloMes}
              </option>
            ))}
            <option value="">Nenhum (abas vazias)</option>
          </select>
          <p className="text-xs text-gray-500">
            {manter || !importarDe
              ? "Os cards (com os dados da competência nova), as fotos e as anotações das abas do relatório escolhido."
              : "Só os cards (com os dados da competência nova) das abas do relatório escolhido."}
          </p>
          {/* Manter as fotos e as anotações da origem (17/10/2026); sem a marca, só os cards. */}
          {importarDe ? (
            <label className="flex items-center gap-2 pt-1 text-sm">
              <input type="checkbox" className="accent-black" checked={manter} onChange={(e) => setManter(e.target.checked)} />
              Manter Imagens e Anotações
            </label>
          ) : null}
        </div>
        <Erro erro={criar.isError ? mensagemDeErro(criar.error, "Não foi possível criar o relatório.") : null} />
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" className={botaoPrimario} disabled={!escolhida || criar.isPending} onClick={() => criar.mutate()}>
            {criar.isPending ? "Criando…" : "Criar Relatório"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
