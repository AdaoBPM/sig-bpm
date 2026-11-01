"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";

import { ExportarTabela } from "@/components/shared/ExportarTabela";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { DataTable } from "@/components/shared/DataTable";
import { QuadroTabela } from "@/components/shared/QuadroTabela";
import { useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/context/PermissionContext";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import type { Coluna } from "@/lib/filtrosDeTabela";

import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";
import { botaoPrimario, classeSelect, Erro } from "@/app/cenarios/components/CenarioDialog";
import type { VisualizacaoDoPainel } from "@/app/analises-gerenciais/relatorios-executivos/services/relatoriosExecutivosService";
import { EtiquetaSituacao, ROTULO_SITUACAO } from "@/app/analises-gerenciais/relatorios-executivos/components/EtiquetaSituacao";

import { CampoVisualizacaoDoPainel, RotuloDaVisualizacao } from "./components/VisualizacaoDoPainel";
import { paineisDeBordoService, ROTULO_DA_VISUALIZACAO, type ListaDePaineis, type ResumoDoPainel } from "./services/paineisDeBordoService";

const dataCurta = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

const COLUNAS: Coluna<ResumoDoPainel>[] = [
  { chave: "nome", rotulo: "Painel", classe: "!px-3", valor: (p) => p.nome },
  { chave: "competencia", rotulo: "Competência", classe: "!px-3", tipo: "numero", valor: (p) => p.ano * 100 + p.mes, texto: (p) => p.rotuloMes },
  { chave: "visualizacao", rotulo: "Visualização", classe: "!px-3", valor: (p) => ROTULO_DA_VISUALIZACAO[p.visualizacao] },
  // A situação (01/11/2026), como a dos relatórios: o público só aparece para os demais finalizado.
  { chave: "situacao", rotulo: "Situação", classe: "!px-3", valor: (p) => ROTULO_SITUACAO[p.situacao] },
  { chave: "criadoPor", rotulo: "Criado Por", classe: "!px-3", valor: (p) => p.criadoPor },
  { chave: "atualizadoEm", rotulo: "Atualizado em", classe: "!px-3", tipo: "data", valor: (p) => new Date(p.atualizadoEm).getTime(), texto: (p) => dataCurta(p.atualizadoEm) },
];

/**
 * A lista dos Painéis de Bordo (31/10/2026, Análises Gerenciais; pedido do Adão), como a dos Relatórios Executivos: os
 * painéis que o usuário vê (os seus e, desde 01/11/2026, os públicos finalizados; o Administrador, todos), com o nome, a
 * competência (vários painéis por competência), a visualização, a situação e quem o criou. Clicar na linha abre o painel; “Novo Painel” cria um.
 */
export function PaineisDeBordoContent() {
  useRegistrarAcessoTela("/analises-gerenciais/paineis-de-bordo");
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const pode = hasPermission("paineis_de_bordo:editar");
  const [criando, setCriando] = useState(false);
  const consulta = useQuery({ queryKey: ["paineis-de-bordo"], queryFn: () => paineisDeBordoService.listar() });
  const tabela = useTabelaFiltravel(consulta.data?.paineis, COLUNAS);
  const competencias = consulta.data?.competencias ?? [];
  const abrir = (p: ResumoDoPainel) => router.push(`/analises-gerenciais/paineis-de-bordo/${p.id}`);
  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Painéis de Bordo"
        exportar={<ExportarTabela titulo="Painéis de Bordo" colunas={COLUNAS} linhas={tabela.filtradas} />}
        acoes={
          pode ? (
            <Button type="button" className={botaoPrimario} disabled={!consulta.data || !competencias.length} title={consulta.data && !competencias.length ? "Nenhuma competência fechada" : undefined} onClick={() => setCriando(true)}>
              <Plus className="size-4" />
              Novo Painel
            </Button>
          ) : null
        }
        comoUsar={
          <ul>
            <li>Cada linha é um painel de bordo: o nome, a competência, a visualização, a situação e quem o criou. Clique na linha para abrir o painel.</li>
            <li>
              A Visualização é a dos cenários: Privado (só quem criou o painel e os Administradores o veem; os demais não o veem na lista) ou Público
              (todos os que leem os Painéis de Bordo o veem, depois de finalizado). A Situação é Em Elaboração ou Finalizado, como nos Relatórios
              Executivos: em elaboração, o painel só aparece para quem o criou, para os editores convidados e para os Administradores, mesmo o
              Público; finalizado, fica só para leitura. Quem criou o painel, os editores que ele convidou (Configurações / Geral / Compartilhar) e o
              Administrador o editam, o finalizam e o reabrem; a etiqueta Compartilhado, ao lado do nome, marca os painéis que você edita a convite de
              quem os criou. Nos públicos finalizados, os demais o veem, o apresentam e o exportam, só para leitura.
            </li>
            {pode ? (
              <li>
                “Novo Painel” cria um painel: o Nome, a Competência (uma das fechadas; vários painéis podem ser do mesmo mês) e a Visualização. Em Copiar
                de, escolha um painel de onde vêm as abas (os cards, com os dados da competência nova, as imagens, as anotações e as Imagens de Fundo) e as
                comparações das Configurações, ou Nenhum, para começar vazio; sem “Manter Imagens e Anotações”, só os cards e as Imagens de Fundo vêm do
                painel escolhido. O nome, a competência e a visualização mudam depois, nas Configurações do painel.
              </li>
            ) : null}
            <li>Use os filtros nos rótulos das colunas.</li>
          </ul>
        }
        sobre={
          <p>
            Os Painéis de Bordo são painéis com fins variados, feitos a partir dos Relatórios Executivos, com as mesmas ferramentas: cada um tem o nome, a
            visualização (Privado ou Público) e a competência, e uma tela, Painel de Bordo, com uma ou mais abas, onde entram os cards do Painel de Bordo e
            dos Indicadores, as tabelas de Resultados, as anotações, os textos, o sumário, as imagens e os vídeos; o painel se apresenta em tela inteira e
            se exporta em PDF. Os cards trazem só as competências fechadas, até a do painel. Quem cria o painel o monta e o finaliza; o Público só
            aparece para os demais depois de finalizado.
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
        <DataTable<ResumoDoPainel>
          data={tabela.visiveis}
          cabecalho={tabela.cabecalho}
          filtrosAtivos={tabela.ativos}
          onLimparFiltros={tabela.limpar}
          isLoading={consulta.isPending}
          error={consulta.isError ? mensagemDeErro(consulta.error, "Erro ao carregar os painéis.") : null}
          emptyMessage="Nenhum painel criado"
          emptyHint={pode ? "Use Novo Painel para criar um painel de bordo." : undefined}
          columns={COLUNAS.map((c) => c.rotulo)}
          renderRow={(p) => (
            <tr key={p.id} onClick={() => abrir(p)} className="cursor-pointer border-b border-gray-100 hover:bg-gray-50">
              <td className="px-3 py-2 text-sm font-bold text-gray-900">
                {p.nome}
                {/* Compartilhado com o usuário (01/11/2026): ele é um dos editores convidados. */}
                {p.compartilhado ? (
                  <span title="Compartilhado com você: você edita este painel" className="ml-2 inline-flex items-center gap-1 rounded-sm border border-gray-300 bg-white px-1.5 py-px align-middle text-xs font-medium whitespace-nowrap text-gray-700">
                    <Users className="size-3" />
                    Compartilhado
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2 text-sm whitespace-nowrap">{p.rotuloMes}</td>
              <td className="px-3 py-2 text-sm whitespace-nowrap">
                <RotuloDaVisualizacao visualizacao={p.visualizacao} />
              </td>
              <td className="px-3 py-2 text-sm">
                <EtiquetaSituacao situacao={p.situacao} />
              </td>
              <td className="px-3 py-2 text-sm whitespace-nowrap">
                {p.criadoPor}
                <div className="text-xs text-gray-500">em {dataCurta(p.criadoEm)}</div>
              </td>
              <td className="px-3 py-2 text-sm whitespace-nowrap text-gray-700">{dataHora(p.atualizadoEm)}</td>
            </tr>
          )}
        />
      </QuadroTabela>
      {criando && consulta.data ? <NovoPainelDialog dados={consulta.data} onFechar={() => setCriando(false)} /> : null}
    </div>
  );
}

/**
 * O modal Novo Painel (31/10/2026): o nome, a competência (uma das fechadas; de início, a mais recente), a visualização
 * (de início, Público, como nos cenários) e o painel de onde copiar as abas (de início, nenhum).
 */
function NovoPainelDialog({ dados, onFechar }: { dados: ListaDePaineis; onFechar: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [competencia, setCompetencia] = useState(dados.competencias[0] ? `${dados.competencias[0].ano}|${dados.competencias[0].mes}` : "");
  const [ano, mes] = competencia.split("|").map(Number);
  const [visualizacao, setVisualizacao] = useState<VisualizacaoDoPainel>("PUBLICO");
  const [copiarDe, setCopiarDe] = useState("");
  const [manter, setManter] = useState(true);
  const criar = useMutation({
    mutationFn: () => paineisDeBordoService.criar({ nome: nome.trim(), visualizacao, ano, mes, copiarDe: copiarDe || null, manterImagensEAnotacoes: manter }),
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ["paineis-de-bordo"] });
      toast.success(`Painel ${p.nome} criado.`);
      router.push(`/analises-gerenciais/paineis-de-bordo/${p.id}`);
    },
  });
  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent avisoAoSair className="rounded-sm sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Painel de Bordo</DialogTitle>
          <DialogDescription>
            Um painel com a tela Painel de Bordo, que você (e o Administrador) edita e finaliza; ele começa Em Elaboração, e o Público só aparece para os
            demais depois de finalizado. O nome, a competência e a visualização mudam depois, nas Configurações, onde você também convida outros
            usuários para editá-lo (Compartilhar).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="novo-painel-nome">Nome</Label>
          <Input id="novo-painel-nome" autoFocus value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Produção da Matriz" className="rounded-sm" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="novo-painel-competencia">Competência</Label>
          <select id="novo-painel-competencia" value={competencia} onChange={(e) => setCompetencia(e.target.value)} className={classeSelect}>
            {dados.competencias.map((c) => (
              <option key={`${c.ano}|${c.mes}`} value={`${c.ano}|${c.mes}`}>
                {c.rotulo}
              </option>
            ))}
          </select>
        </div>
        <CampoVisualizacaoDoPainel valor={visualizacao} onMudar={setVisualizacao} />
        <div className="space-y-1.5">
          <Label htmlFor="novo-painel-copiar">Copiar de</Label>
          <select id="novo-painel-copiar" value={copiarDe} onChange={(e) => setCopiarDe(e.target.value)} className={classeSelect}>
            <option value="">Nenhum (painel vazio)</option>
            {dados.paineis.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} · {p.rotuloMes}
              </option>
            ))}
          </select>
          {copiarDe ? (
            <>
              <p className="text-xs text-gray-500">
                {manter
                  ? "As abas do painel escolhido — os cards (com os dados da competência nova), as imagens, as anotações e as Imagens de Fundo — e as comparações das Configurações."
                  : "Só os cards (com os dados da competência nova) e as Imagens de Fundo das abas do painel escolhido, e as comparações das Configurações."}
              </p>
              <label className="flex items-center gap-2 pt-1 text-sm">
                <input type="checkbox" className="accent-black" checked={manter} onChange={(e) => setManter(e.target.checked)} />
                Manter Imagens e Anotações
              </label>
            </>
          ) : null}
        </div>
        <Erro erro={criar.isError ? mensagemDeErro(criar.error, "Não foi possível criar o painel.") : null} />
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" className={botaoPrimario} disabled={!nome.trim() || !competencia || criar.isPending} onClick={() => criar.mutate()}>
            {criar.isPending ? "Criando…" : "Criar Painel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
