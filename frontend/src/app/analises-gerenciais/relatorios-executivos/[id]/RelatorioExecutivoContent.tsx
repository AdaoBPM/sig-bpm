"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCheck, LayoutGrid, LockOpen, Save, StickyNote, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Abas } from "@/components/shared/Abas";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { podeSair, useAlteracoesPendentes } from "@/lib/alteracoesPendentes";

import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";
import { useCoresDoPainel } from "@/app/relatorios/painel/PainelContent";
import { useTipoGrafico } from "@/app/relatorios/components/GraficoRealizadoOrcado";
import { botaoPrimario, Erro } from "@/app/cenarios/components/CenarioDialog";

import { AdicionarCardsDialog } from "../components/AdicionarCardsDialog";
import { EtiquetaSituacao } from "../components/EtiquetaSituacao";
import { COLUNAS, GradeDoRelatorio, tamanhoInicial } from "../components/GradeDoRelatorio";
import { relatoriosExecutivosService, type Bloco, type Blocos, type ConteudoDoBloco, type Relatorio } from "../services/relatoriosExecutivosService";

/** Um id para o bloco novo (sem o crypto.randomUUID, que o navegador só dá em https). */
const novoId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * Um Relatório Executivo (15/10/2026): uma aba por departamento, cada uma com a grade dos blocos. O autor, com o
 * relatório em elaboração, adiciona cards (do Painel de Bordo, com ou sem gráfico, e dos Indicadores) e anotações
 * (positivas, negativas e de atenção), move, redimensiona e exclui os blocos, grava e finaliza; finalizado, o relatório
 * se lê, e o autor (ou o Administrador) pode reabri-lo.
 */
export function RelatorioExecutivoContent() {
  const { id } = useParams<{ id: string }>();
  useRegistrarAcessoTela("/analises-gerenciais/relatorios-executivos");
  const consulta = useQuery({ queryKey: ["relatorios-executivos", "relatorio", id], queryFn: () => relatoriosExecutivosService.obter(id) });
  if (consulta.isError) {
    return (
      <div className="space-y-6">
        <CabecalhoDaTela titulo="Relatório Executivo" />
        <Erro erro={mensagemDeErro(consulta.error, "Erro ao carregar o relatório.")} />
      </div>
    );
  }
  if (!consulta.data) return <div className="h-96 animate-pulse rounded-sm bg-gray-100" />;
  // Remonta ao trocar a versão gravada (gravar, finalizar, reabrir), com os blocos dela.
  return <Editor key={`${consulta.data.atualizadoEm}|${consulta.data.situacao}`} relatorio={consulta.data} />;
}

function Editor({ relatorio }: { relatorio: Relatorio }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const dados = useQuery({ queryKey: ["relatorios-executivos", "dados", relatorio.id], queryFn: () => relatoriosExecutivosService.dados(relatorio.id) });
  const [cores] = useCoresDoPainel();
  const [tipo] = useTipoGrafico();
  const [blocos, setBlocos] = useState<Blocos>(relatorio.blocos);
  const [aba, setAba] = useState(relatorio.departamentos[0]?.chave ?? "");
  const [adicionando, setAdicionando] = useState(false);
  const [confirmar, setConfirmar] = useState<"finalizar" | "excluir" | null>(null);
  const mudou = JSON.stringify(blocos) !== JSON.stringify(relatorio.blocos);
  useAlteracoesPendentes(mudou);
  const daAba = blocos[aba] ?? [];
  const mudarAba = (lista: Bloco[]) => setBlocos((b) => ({ ...b, [aba]: lista }));
  // O bloco novo entra no fim da aba (a grade o encosta em cima).
  const fim = daAba.reduce((m, b) => Math.max(m, b.y + b.h), 0);
  // A anotação entra ao lado do último bloco da aba (o mais embaixo), se couber na linha; os cards, no fim.
  const ultimo = daAba.reduce<Bloco | null>((u, b) => (!u || b.y > u.y || (b.y === u.y && b.x > u.x) ? b : u), null);
  const posicao = (n: ConteudoDoBloco, k: number) => {
    const t = tamanhoInicial(n as Bloco);
    if (n.tipo === "ANOTACAO" && ultimo && ultimo.x + ultimo.w + t.w <= COLUNAS) return { x: ultimo.x + ultimo.w, y: ultimo.y, ...t, h: Math.max(t.h, ultimo.h) };
    return { x: 0, y: fim + k, ...t };
  };
  const incluir = (novos: ConteudoDoBloco[]) => mudarAba([...daAba, ...novos.map((n, k) => ({ ...n, id: novoId(), ...posicao(n, k) }) as Bloco)]);
  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["relatorios-executivos"] });
  const gravar = useMutation({
    mutationFn: () => relatoriosExecutivosService.gravar(relatorio.id, blocos),
    onSuccess: () => {
      invalidar();
      toast.success("Relatório gravado.");
    },
  });
  const situacao = useMutation({
    mutationFn: async (acao: "finalizar" | "reabrir" | "excluir") => {
      if (acao === "excluir") return relatoriosExecutivosService.excluir(relatorio.id);
      if (acao === "finalizar" && mudou) await relatoriosExecutivosService.gravar(relatorio.id, blocos);
      return acao === "finalizar" ? relatoriosExecutivosService.finalizar(relatorio.id) : relatoriosExecutivosService.reabrir(relatorio.id);
    },
    onSuccess: (_, acao) => {
      invalidar();
      setConfirmar(null);
      toast.success(acao === "excluir" ? "Relatório excluído." : acao === "finalizar" ? "Relatório finalizado: agora todos o veem." : "Relatório reaberto: só você o vê até finalizar de novo.");
      if (acao === "excluir") router.push("/analises-gerenciais/relatorios-executivos");
    },
  });
  const editavel = relatorio.podeEditar;
  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo={`Relatório Executivo · ${relatorio.rotuloMes}`}
        selo={<EtiquetaSituacao situacao={relatorio.situacao} />}
        acoes={
          <div className="flex flex-wrap items-center gap-2">
            {editavel ? (
              <>
                <Button type="button" className={botaoPrimario} disabled={!dados.data} onClick={() => setAdicionando(true)}>
                  <LayoutGrid className="size-4" />
                  Adicionar Cards
                </Button>
                <Button type="button" className={botaoPrimario} onClick={() => incluir([{ tipo: "ANOTACAO", nota: "POSITIVO", texto: "" }])}>
                  <StickyNote className="size-4" />
                  Anotação
                </Button>
                <Button type="button" className={botaoPrimario} disabled={!mudou || gravar.isPending} onClick={() => gravar.mutate()}>
                  <Save className="size-4" />
                  {gravar.isPending ? "Gravando…" : "Gravar"}
                </Button>
                <Button type="button" className={botaoPrimario} onClick={() => setConfirmar("finalizar")}>
                  <CheckCheck className="size-4" />
                  Finalizar
                </Button>
              </>
            ) : null}
            {relatorio.podeReabrir ? (
              <Button type="button" className={botaoPrimario} disabled={situacao.isPending} onClick={() => situacao.mutate("reabrir")}>
                <LockOpen className="size-4" />
                Reabrir
              </Button>
            ) : null}
          </div>
        }
        comoUsar={
          <ul>
            <li>Cada aba é um departamento do relatório. Os cards trazem as competências fechadas, até o mês do relatório.</li>
            {editavel ? (
              <>
                <li>
                  “Adicionar Cards” abre a lista dos cards do Painel de Bordo (com ou sem o gráfico) e dos Indicadores (o card de destaque, com o valor do mês, o
                  acumulado e o orçado): marque os que quiser; eles entram no fim da aba.
                </li>
                <li>
                  “Anotação” inclui um bloco de texto; no canto dele, escolha Positivo (verde; azul nas cores Acessíveis do Painel), Negativo (vermelho) ou
                  Atenção (amarelo), e coloque-o ao lado do card a que se refere.
                </li>
                <li>
                  Passe o mouse num bloco para ver os botões dele: a alça (arraste para mover), o gráfico (com ou sem, nos cards do Painel), a nota (nas
                  anotações) e excluir. O canto de baixo, à direita, redimensiona o bloco.
                </li>
                <li>
                  “Gravar” guarda o relatório (sair sem gravar pergunta antes). “Finalizar” grava e torna o relatório público, só para leitura; você pode
                  reabri-lo depois. Para excluir o relatório, use o botão no fim da tela.
                </li>
              </>
            ) : (
              <li>{relatorio.situacao === "FINALIZADO" ? "O relatório está finalizado: só se lê." : "O relatório está em elaboração."}</li>
            )}
          </ul>
        }
        sobre={
          <p>
            O relatório executivo de {relatorio.autorNome} sobre {relatorio.departamentos.map((d) => d.nome).join(", ")}, em {relatorio.rotuloMes}: os cards do
            Painel de Bordo e dos Indicadores de Resultados Empresariais escolhidos, com as anotações dos pontos positivos, negativos e de atenção.
          </p>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
        <Link
          href="/analises-gerenciais/relatorios-executivos"
          onClick={(e) => {
            if (!podeSair()) e.preventDefault();
          }}
          className="inline-flex items-center gap-1.5 hover:text-gray-900"
        >
          <ArrowLeft className="size-4" />
          Relatórios Executivos
        </Link>
        <span>
          Autor: <span className="font-medium text-gray-900">{relatorio.autorNome}</span>
          {relatorio.finalizadoEm ? ` · finalizado em ${new Date(relatorio.finalizadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}` : ""}
        </span>
      </div>
      <Abas rotulo="Departamentos do relatório" ativa={aba} onMudar={setAba} abas={relatorio.departamentos.map((d) => ({ chave: d.chave, rotulo: d.nome }))} />
      {dados.isError ? <Erro erro={mensagemDeErro(dados.error, "Erro ao carregar os dados dos cards.")} /> : null}
      {daAba.length === 0 ? (
        <p className="rounded-sm border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
          {editavel ? "A aba está vazia: use “Adicionar Cards” e “Anotação”, na linha do título." : "Nada nesta aba."}
        </p>
      ) : (
        <GradeDoRelatorio blocos={daAba} dados={dados.data} editavel={editavel} cores={cores} tipo={tipo} onMudar={mudarAba} />
      )}
      {editavel ? (
        <div className="flex justify-end">
          <Button type="button" variant="outline" className="rounded-sm border-red-300 text-red-700 hover:bg-red-50" onClick={() => setConfirmar("excluir")}>
            <Trash2 className="size-4" />
            Excluir Relatório
          </Button>
        </div>
      ) : null}
      <Erro erro={gravar.isError ? mensagemDeErro(gravar.error, "Não foi possível gravar.") : null} />
      {adicionando && dados.data ? (
        <AdicionarCardsDialog
          dados={dados.data}
          onFechar={() => setAdicionando(false)}
          onAdicionar={(novos) => {
            incluir(novos);
            setAdicionando(false);
          }}
        />
      ) : null}
      {confirmar ? (
        <Dialog open onOpenChange={(o) => (!o ? setConfirmar(null) : undefined)}>
          <DialogContent className="rounded-sm sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{confirmar === "finalizar" ? "Finalizar Relatório" : "Excluir Relatório"}</DialogTitle>
              <DialogDescription>
                {confirmar === "finalizar"
                  ? `O relatório de ${relatorio.rotuloMes} fica visível, só para leitura, para todos os que leem a tela.${mudou ? " As alterações ainda não gravadas são gravadas antes." : ""} Você pode reabri-lo depois.`
                  : `O relatório de ${relatorio.rotuloMes}, com todas as abas, é excluído.`}
              </DialogDescription>
            </DialogHeader>
            <Erro erro={situacao.isError ? mensagemDeErro(situacao.error, "Não foi possível concluir.") : null} />
            <DialogFooter>
              <Button type="button" variant="outline" className="rounded-sm" onClick={() => setConfirmar(null)}>
                Cancelar
              </Button>
              {confirmar === "finalizar" ? (
                <Button type="button" className={botaoPrimario} disabled={situacao.isPending} onClick={() => situacao.mutate("finalizar")}>
                  {situacao.isPending ? "Finalizando…" : "Finalizar"}
                </Button>
              ) : (
                <Button type="button" variant="outline" className="rounded-sm border-red-300 text-red-700 hover:bg-red-50" disabled={situacao.isPending} onClick={() => situacao.mutate("excluir")}>
                  {situacao.isPending ? "Excluindo…" : "Excluir"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
