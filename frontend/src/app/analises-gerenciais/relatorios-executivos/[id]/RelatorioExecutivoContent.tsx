"use client";

import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, ChevronDown, CircleCheck, ImagePlus, LayoutGrid, LockOpen, Plus, Presentation, Save, StickyNote, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Abas } from "@/components/shared/Abas";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { useAlteracoesPendentes } from "@/lib/alteracoesPendentes";

import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";
import { useCoresDoPainel } from "@/app/relatorios/painel/PainelContent";
import { useTipoGrafico } from "@/app/relatorios/components/GraficoRealizadoOrcado";
import { botaoPrimario, Erro } from "@/app/cenarios/components/CenarioDialog";

import { AdicionarCardsDialog } from "../components/AdicionarCardsDialog";
import { ApresentacaoDoRelatorio, entrarEmTelaInteira } from "../components/ApresentacaoDoRelatorio";
import { EtiquetaSituacao } from "../components/EtiquetaSituacao";
import { COLUNAS, GradeDoRelatorio, linhasDaFoto, tamanhoInicial } from "../components/GradeDoRelatorio";
import { relatoriosExecutivosService, type Bloco, type ConteudoDoBloco, type Relatorio } from "../services/relatoriosExecutivosService";

/** Um id para o bloco novo (sem o crypto.randomUUID, que o navegador só dá em https). */
const novoId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

/**
 * A foto para o relatório (16/10/2026): reduzida a até 1600 px no lado maior e gravada em JPEG (o fundo das partes
 * transparentes, branco), com a proporção dela (largura ÷ altura).
 */
async function prepararFoto(arquivo: File): Promise<{ foto: Blob; proporcao: number }> {
  const imagem = await createImageBitmap(arquivo).catch(() => {
    throw new Error("Não foi possível abrir a imagem: escolha uma foto em JPEG, PNG, WebP ou GIF.");
  });
  const escala = Math.min(1, 1600 / Math.max(imagem.width, imagem.height));
  const tela = document.createElement("canvas");
  tela.width = Math.max(1, Math.round(imagem.width * escala));
  tela.height = Math.max(1, Math.round(imagem.height * escala));
  const ctx = tela.getContext("2d")!;
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, tela.width, tela.height);
  ctx.drawImage(imagem, 0, 0, tela.width, tela.height);
  const foto = await new Promise<Blob>((ok, erro) => tela.toBlob((b) => (b ? ok(b) : erro(new Error("Não foi possível preparar a foto."))), "image/jpeg", 0.85));
  return { foto, proporcao: imagem.width / imagem.height };
}

/**
 * Um Relatório Executivo (15/10/2026): o de uma competência fechada, com uma aba por departamento, cada uma com a grade
 * dos blocos. Quem edita a aba (o gestor do departamento, pelo recorte) adiciona cards (do Painel de Bordo, com ou sem
 * gráfico, e dos Indicadores), anotações (positivas, negativas e de atenção) e fotos, move, redimensiona e exclui os
 * blocos, grava e finaliza a aba; a aba finalizada todos a leem, e quem a edita (ou o Administrador) a reabre. A aba em
 * elaboração só aparece para quem a edita. Apresentar mostra as abas como slides, em tela inteira.
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
  const [apresentando, setApresentando] = useState<number | null>(null);
  const seletorDeFoto = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLDivElement>(null);
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
  // A foto (16/10/2026): reduzida no navegador, enviada ao servidor e incluída como as anotações, na altura da proporção dela.
  const foto = useMutation({
    mutationFn: async (arquivo: File) => {
      const { foto: conteudo, proporcao } = await prepararFoto(arquivo);
      const { arquivo: nome } = await relatoriosExecutivosService.enviarFoto(relatorio.id, conteudo);
      return { nome, proporcao };
    },
    onSuccess: ({ nome, proporcao }) => {
      const t = tamanhoInicial({ tipo: "FOTO" });
      // A grade tem 24 px a mais que a área (as margens de fora dos blocos).
      const h = linhasDaFoto(t.w, proporcao, (area.current?.offsetWidth ?? 1200) + 24);
      const p = ultimo && ultimo.x + ultimo.w + t.w <= COLUNAS ? { x: ultimo.x + ultimo.w, y: ultimo.y } : { x: 0, y: fim };
      mudarAba([...daAba, { tipo: "FOTO", arquivo: nome, legenda: "", proporcao, id: novoId(), ...p, w: t.w, h }]);
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível enviar a foto.")),
  });
  // Os slides da apresentação: as abas que o usuário vê, com algum bloco (o que está na tela, gravado ou não).
  const slides = relatorio.abas.filter((a) => a.visivel && (blocos[a.chave] ?? []).length).map((a) => ({ chave: a.chave, nome: a.nome, blocos: blocos[a.chave] ?? [] }));
  const apresentar = () => {
    entrarEmTelaInteira();
    setApresentando(Math.max(0, slides.findIndex((s) => s.chave === chave)));
  };
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
  const emConfirmacao = confirmar === "finalizar" ? situacao : excluir;
  return (
    // A largura da área (a da grade, menos as margens de fora), para a altura da foto nova.
    <div ref={area} className="space-y-6">
      <CabecalhoDaTela
        titulo={`RE - ${relatorio.rotuloMes}`}
        selo={<EtiquetaSituacao situacao={relatorio.situacao} />}
        acoes={
          <div className="flex flex-wrap items-center gap-2">
            {editavel ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button type="button" className={botaoPrimario} disabled={foto.isPending}>
                      <Plus className="size-4" />
                      {foto.isPending ? "Enviando…" : "Adicionar"}
                      <ChevronDown className="size-4" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="min-w-40">
                  <DropdownMenuItem disabled={!dados.data} onClick={() => setAdicionando(true)}>
                    <LayoutGrid className="size-4" />
                    Cards
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => incluir([{ tipo: "ANOTACAO", nota: "POSITIVO", texto: "" }])}>
                    <StickyNote className="size-4" />
                    Anotação
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => seletorDeFoto.current?.click()}>
                    <ImagePlus className="size-4" />
                    Foto
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
            <Button type="button" className={botaoPrimario} disabled={!slides.length} title={slides.length ? "Apresentar as abas em tela inteira" : "Nenhuma aba com blocos para apresentar"} onClick={apresentar}>
              <Presentation className="size-4" />
              Apresentar
            </Button>
            <input
              ref={seletorDeFoto}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                e.target.value = "";
                if (arquivo) foto.mutate(arquivo);
              }}
            />
          </div>
        }
        comoUsar={
          <ul>
            <li>
              Cada aba é um departamento. Você edita as abas do seu recorte de departamentos (Controle de Usuários); as dos outros aparecem quando o gestor
              delas as finaliza. O ícone de check ao lado do nome diz que a aba está finalizada (a dica dele mostra quem a finalizou e quando).
            </li>
            <li>
              Na sua aba, “Adicionar” traz três opções. Cards abre a lista dos cards do Painel de Bordo (com ou sem o gráfico) e dos Indicadores (o card de
              destaque, com o valor do mês, o acumulado e o orçado): marque os que quiser; eles entram no fim da aba. Os cards trazem só as competências
              fechadas, até o mês do relatório.
            </li>
            <li>
              Anotação inclui um bloco de texto ao lado do último bloco; no canto dele, escolha Positivo (verde; azul nas cores Acessíveis do Painel),
              Negativo (vermelho) ou Atenção (amarelo). O título (de início, o nome da nota) se edita clicando nele.
            </li>
            <li>
              Foto envia uma imagem (JPEG, PNG, WebP ou GIF; reduzida a até 1600 px) e a inclui com a legenda embaixo, no destaque amarelo-ouro. A foto aumenta e
              diminui sempre na mesma proporção.
            </li>
            <li>
              Passe o mouse num bloco para ver os botões dele: a alça (arraste para mover), o gráfico (com ou sem, nos cards do Painel; sem ele, o card fica
              mais estreito e o restante igual), as opções do gráfico (os rótulos, o tipo e as cores, neste card ou em toda a aba), a nota (nas anotações) e
              excluir. O canto de baixo, à direita, redimensiona o bloco, até um tamanho mínimo, para as informações não se amontoarem.
            </li>
            <li>
              “Apresentar” mostra as abas com blocos como slides, em tela inteira e sem o menu lateral, a partir da aba aberta: os botões na base esquerda (ou
              as setas do teclado) recuam e avançam; Esc encerra.
            </li>
            <li>
              “Gravar” guarda as abas alteradas (sair sem gravar pergunta antes). “Finalizar Aba” grava a aba e a torna pública, só para leitura; “Reabrir
              Aba” a devolve à elaboração. O relatório fica Finalizado quando todas as abas estão finalizadas.
            </li>
          </ul>
        }
        sobre={
          <p>
            O relatório executivo (RE) de {relatorio.rotuloMes}: em cada departamento, os cards do Painel de Bordo e dos Indicadores de Resultados
            Empresariais escolhidos pelo gestor, com as anotações dos pontos positivos, negativos e de atenção e as fotos. Criado por {relatorio.criadoPor}.
          </p>
        }
      />
      {/* O ícone de check nas abas finalizadas (16/10/2026; antes, a linha da situação abaixo das abas), com quem finalizou na dica. */}
      <Abas
        rotulo="Departamentos do relatório"
        ativa={chave}
        onMudar={setChave}
        abas={relatorio.abas.map((a) => ({
          chave: a.chave,
          rotulo: (
            <span className="inline-flex items-center gap-1.5">
              {a.nome}
              {a.situacao === "FINALIZADO" ? (
                <span title={`Aba finalizada${a.finalizadoPor ? ` por ${a.finalizadoPor}` : ""}${a.finalizadoEm ? ` em ${dataHora(a.finalizadoEm)}` : ""}`}>
                  <CircleCheck className="size-4 text-green-700" aria-label="Aba finalizada" />
                </span>
              ) : null}
            </span>
          ),
        }))}
      />
      {dados.isError ? <Erro erro={mensagemDeErro(dados.error, "Erro ao carregar os dados dos cards.")} /> : null}
      {!aba?.visivel ? (
        <p className="rounded-sm border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
          A aba {aba?.nome} está em elaboração: aparece quando o gestor dela a finalizar.
        </p>
      ) : daAba.length === 0 ? (
        <p className="rounded-sm border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
          {editavel ? "A aba está vazia: use “Adicionar”, na linha do título." : "Nada nesta aba."}
        </p>
      ) : (
        <GradeDoRelatorio relatorioId={relatorio.id} blocos={daAba} dados={dados.data} editavel={editavel} cores={cores} tipo={tipo} onMudar={mudarAba} />
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
      {apresentando !== null ? (
        <ApresentacaoDoRelatorio
          relatorioId={relatorio.id}
          titulo={`RE - ${relatorio.rotuloMes}`}
          slides={slides}
          inicial={apresentando}
          dados={dados.data}
          cores={cores}
          tipo={tipo}
          onSair={() => setApresentando(null)}
        />
      ) : null}
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
