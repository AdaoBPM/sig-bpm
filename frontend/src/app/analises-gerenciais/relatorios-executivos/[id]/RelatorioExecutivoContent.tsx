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
import { plural } from "@/lib/texto";

import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";
import { useCoresDoPainel } from "@/app/relatorios/painel/PainelContent";
import { useTipoGrafico } from "@/app/relatorios/components/GraficoRealizadoOrcado";
import { botaoPrimario, Erro } from "@/app/cenarios/components/CenarioDialog";

import { AdicionarCardsDialog } from "../components/AdicionarCardsDialog";
import { EtiquetaSituacao } from "../components/EtiquetaSituacao";
import { COLUNAS, GradeDoRelatorio, tamanhoInicial } from "../components/GradeDoRelatorio";
import { relatoriosExecutivosService, type Bloco, type ConteudoDoBloco, type Relatorio } from "../services/relatoriosExecutivosService";

/** Um id para o bloco novo (sem o crypto.randomUUID, que o navegador só dá em https). */
const novoId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

/**
 * Um Relatório Executivo (15/10/2026): o de uma competência fechada, com uma aba por departamento, cada uma com a grade
 * dos blocos. Quem edita a aba (o gestor do departamento, pelo recorte) adiciona cards (do Painel de Bordo, com ou sem
 * gráfico, e dos Indicadores) e anotações (positivas, negativas e de atenção), move, redimensiona e exclui os blocos,
 * grava e finaliza a aba; a aba finalizada todos a leem, e quem a edita (ou o Administrador) a reabre. A aba em
 * elaboração só aparece para quem a edita.
 */
export function RelatorioExecutivoContent() {
  const { id } = useParams<{ id: string }>();
  useRegistrarAcessoTela("/analises-gerenciais/relatorios-executivos");
  const consulta = useQuery({ queryKey: ["relatorios-executivos", "relatorio", id], queryFn: () => relatoriosExecutivosService.obter(id) });
  // A aba aberta fica aqui, para não mudar quando o editor remonta (ao gravar, finalizar ou reabrir).
  const [chave, setChave] = useState<string | null>(null);
  if (consulta.isError) {
    return (
      <div className="space-y-6">
        <CabecalhoDaTela titulo="Relatório Executivo" />
        <Erro erro={mensagemDeErro(consulta.error, "Erro ao carregar o relatório.")} />
      </div>
    );
  }
  if (!consulta.data) return <div className="h-96 animate-pulse rounded-sm bg-gray-100" />;
  // Remonta ao gravar, finalizar ou reabrir uma aba, com o que o servidor devolveu.
  const versao = consulta.data.abas.map((a) => `${a.situacao}|${a.atualizadoEm}`).join(";");
  // De início, a primeira aba que o usuário edita; sem nenhuma, a primeira que ele vê.
  const abas = consulta.data.abas;
  const aberta = chave ?? (abas.find((a) => a.podeEditar) ?? abas.find((a) => a.visivel) ?? abas[0])?.chave ?? "";
  return <Editor key={versao} relatorio={consulta.data} chave={aberta} setChave={setChave} />;
}

function Editor({ relatorio, chave, setChave }: { relatorio: Relatorio; chave: string; setChave: (c: string) => void }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const dados = useQuery({ queryKey: ["relatorios-executivos", "dados", relatorio.id], queryFn: () => relatoriosExecutivosService.dados(relatorio.id) });
  const [cores] = useCoresDoPainel();
  const [tipo] = useTipoGrafico();
  const gravados = Object.fromEntries(relatorio.abas.map((a) => [a.chave, a.blocos]));
  const [blocos, setBlocos] = useState<Record<string, Bloco[]>>(gravados);
  const [adicionando, setAdicionando] = useState(false);
  const [confirmar, setConfirmar] = useState<"finalizar" | "excluir" | null>(null);
  const aba = relatorio.abas.find((a) => a.chave === chave);
  const mudadas = relatorio.abas.filter((a) => a.podeEditar && JSON.stringify(blocos[a.chave] ?? []) !== JSON.stringify(gravados[a.chave] ?? []));
  const mudouAba = mudadas.some((a) => a.chave === chave);
  useAlteracoesPendentes(mudadas.length > 0);
  const daAba = blocos[chave] ?? [];
  const mudarAba = (lista: Bloco[]) => setBlocos((b) => ({ ...b, [chave]: lista }));
  // O bloco novo entra no fim da aba (a grade o encosta em cima); a anotação, ao lado do último bloco, se couber na linha.
  const fim = daAba.reduce((m, b) => Math.max(m, b.y + b.h), 0);
  const ultimo = daAba.reduce<Bloco | null>((u, b) => (!u || b.y > u.y || (b.y === u.y && b.x > u.x) ? b : u), null);
  const posicao = (n: ConteudoDoBloco, k: number) => {
    const t = tamanhoInicial(n as Bloco);
    if (n.tipo === "ANOTACAO" && ultimo && ultimo.x + ultimo.w + t.w <= COLUNAS) return { x: ultimo.x + ultimo.w, y: ultimo.y, ...t, h: Math.max(t.h, ultimo.h) };
    return { x: 0, y: fim + k, ...t };
  };
  const incluir = (novos: ConteudoDoBloco[]) => mudarAba([...daAba, ...novos.map((n, k) => ({ ...n, id: novoId(), ...posicao(n, k) }) as Bloco)]);
  const atualizar = (r: Relatorio) => {
    queryClient.setQueryData(["relatorios-executivos", "relatorio", relatorio.id], r);
    queryClient.invalidateQueries({ queryKey: ["relatorios-executivos"], exact: true });
  };
  // Gravar: as abas alteradas (as que o usuário edita), uma a uma.
  const gravar = useMutation({
    mutationFn: async () => {
      let r = relatorio;
      for (const a of mudadas) r = await relatoriosExecutivosService.gravarAba(relatorio.id, a.chave, blocos[a.chave] ?? []);
      return r;
    },
    onSuccess: (r) => {
      atualizar(r);
      toast.success(mudadas.length === 1 ? `Aba ${mudadas[0].nome} gravada.` : `${mudadas.length} abas gravadas.`);
    },
  });
  const situacao = useMutation({
    mutationFn: async (acao: "finalizar" | "reabrir") => {
      if (acao === "finalizar" && mudouAba) await relatoriosExecutivosService.gravarAba(relatorio.id, chave, daAba);
      return acao === "finalizar" ? relatoriosExecutivosService.finalizarAba(relatorio.id, chave) : relatoriosExecutivosService.reabrirAba(relatorio.id, chave);
    },
    onSuccess: (r, acao) => {
      setConfirmar(null);
      atualizar(r);
      toast.success(acao === "finalizar" ? `Aba ${aba?.nome} finalizada: agora todos a veem.` : `Aba ${aba?.nome} reaberta: só quem a edita a vê até finalizar de novo.`);
    },
  });
  const excluir = useMutation({
    mutationFn: () => relatoriosExecutivosService.excluir(relatorio.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["relatorios-executivos"] });
      toast.success("Relatório excluído.");
      router.push("/analises-gerenciais/relatorios-executivos");
    },
  });
  const editavel = aba?.podeEditar ?? false;
  const finalizadas = relatorio.abas.filter((a) => a.situacao === "FINALIZADO").length;
  const emConfirmacao = confirmar === "finalizar" ? situacao : excluir;
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
              </>
            ) : null}
            {mudadas.length ? (
              <Button type="button" className={botaoPrimario} disabled={gravar.isPending} onClick={() => gravar.mutate()}>
                <Save className="size-4" />
                {gravar.isPending ? "Gravando…" : "Gravar"}
              </Button>
            ) : null}
            {editavel ? (
              <Button type="button" className={botaoPrimario} onClick={() => setConfirmar("finalizar")}>
                <CheckCheck className="size-4" />
                Finalizar Aba
              </Button>
            ) : null}
            {aba?.podeReabrir ? (
              <Button type="button" className={botaoPrimario} disabled={situacao.isPending} onClick={() => situacao.mutate("reabrir")}>
                <LockOpen className="size-4" />
                Reabrir Aba
              </Button>
            ) : null}
          </div>
        }
        comoUsar={
          <ul>
            <li>
              Cada aba é um departamento. Você edita as abas do seu recorte de departamentos (Controle de Usuários); as dos outros aparecem quando o gestor
              delas as finaliza. A marca ✓ no nome da aba diz que ela está finalizada.
            </li>
            <li>
              Na sua aba, “Adicionar Cards” abre a lista dos cards do Painel de Bordo (com ou sem o gráfico) e dos Indicadores (o card de destaque, com o valor
              do mês, o acumulado e o orçado): marque os que quiser; eles entram no fim da aba. Os cards trazem só as competências fechadas, até o mês do
              relatório.
            </li>
            <li>
              “Anotação” inclui um bloco de texto ao lado do último bloco; no canto dele, escolha Positivo (verde; azul nas cores Acessíveis do Painel),
              Negativo (vermelho) ou Atenção (amarelo).
            </li>
            <li>
              Passe o mouse num bloco para ver os botões dele: a alça (arraste para mover), o gráfico (com ou sem, nos cards do Painel), a nota (nas
              anotações) e excluir. O canto de baixo, à direita, redimensiona o bloco.
            </li>
            <li>
              “Gravar” guarda as abas alteradas (sair sem gravar pergunta antes). “Finalizar Aba” grava a aba e a torna pública, só para leitura; “Reabrir
              Aba” a devolve à elaboração. O relatório fica Finalizado quando todas as abas estão finalizadas.
            </li>
          </ul>
        }
        sobre={
          <p>
            O relatório executivo de {relatorio.rotuloMes}: em cada departamento, os cards do Painel de Bordo e dos Indicadores de Resultados Empresariais
            escolhidos pelo gestor, com as anotações dos pontos positivos, negativos e de atenção. Criado por {relatorio.criadoPor}.
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
          {finalizadas} de {relatorio.abas.length} {plural(relatorio.abas.length, "aba finalizada", "abas finalizadas")}
        </span>
      </div>
      <Abas
        rotulo="Departamentos do relatório"
        ativa={chave}
        onMudar={setChave}
        abas={relatorio.abas.map((a) => ({ chave: a.chave, rotulo: `${a.nome}${a.situacao === "FINALIZADO" ? " ✓" : ""}` }))}
      />
      {aba ? (
        <p className="-mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600">
          <EtiquetaSituacao situacao={aba.situacao} />
          {aba.situacao === "FINALIZADO" && aba.finalizadoEm
            ? `Finalizada por ${aba.finalizadoPor ?? "—"} em ${dataHora(aba.finalizadoEm)}.`
            : aba.atualizadoPor
              ? `Editada por ${aba.atualizadoPor} em ${dataHora(aba.atualizadoEm)}.`
              : "Ainda sem conteúdo."}
          {editavel ? " Você edita esta aba." : ""}
        </p>
      ) : null}
      {dados.isError ? <Erro erro={mensagemDeErro(dados.error, "Erro ao carregar os dados dos cards.")} /> : null}
      {!aba?.visivel ? (
        <p className="rounded-sm border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
          A aba {aba?.nome} está em elaboração: aparece quando o gestor dela a finalizar.
        </p>
      ) : daAba.length === 0 ? (
        <p className="rounded-sm border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
          {editavel ? "A aba está vazia: use “Adicionar Cards” e “Anotação”, na linha do título." : "Nada nesta aba."}
        </p>
      ) : (
        <GradeDoRelatorio blocos={daAba} dados={dados.data} editavel={editavel} cores={cores} tipo={tipo} onMudar={mudarAba} />
      )}
      {relatorio.podeExcluir ? (
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
              <DialogTitle>{confirmar === "finalizar" ? `Finalizar a Aba ${aba?.nome ?? ""}` : "Excluir Relatório"}</DialogTitle>
              <DialogDescription>
                {confirmar === "finalizar"
                  ? `A aba ${aba?.nome} de ${relatorio.rotuloMes} fica visível, só para leitura, para todos os que leem a tela.${mudouAba ? " As alterações ainda não gravadas são gravadas antes." : ""}${daAba.length ? "" : " A aba está vazia."} Você pode reabri-la depois.`
                  : `O relatório de ${relatorio.rotuloMes}, com todas as abas, é excluído.`}
              </DialogDescription>
            </DialogHeader>
            <Erro erro={emConfirmacao.isError ? mensagemDeErro(emConfirmacao.error, "Não foi possível concluir.") : null} />
            <DialogFooter>
              <Button type="button" variant="outline" className="rounded-sm" onClick={() => setConfirmar(null)}>
                Cancelar
              </Button>
              {confirmar === "finalizar" ? (
                <Button type="button" className={botaoPrimario} disabled={situacao.isPending} onClick={() => situacao.mutate("finalizar")}>
                  {situacao.isPending ? "Finalizando…" : "Finalizar Aba"}
                </Button>
              ) : (
                <Button type="button" variant="outline" className="rounded-sm border-red-300 text-red-700 hover:bg-red-50" disabled={excluir.isPending} onClick={() => excluir.mutate()}>
                  {excluir.isPending ? "Excluindo…" : "Excluir"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
