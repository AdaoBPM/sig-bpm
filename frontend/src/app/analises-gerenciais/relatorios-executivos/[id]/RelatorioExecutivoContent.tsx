"use client";

import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, Crop, FilePlus2, FileX2, Image as Imagem, ImageOff, ImagePlus, ImageUp, LayoutGrid, ListOrdered, LockOpen, Pencil, Plus, Presentation, Save, StickyNote, Trash2, Type, Video } from "lucide-react";
import { toast } from "sonner";

import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { podeSair, useAlteracoesPendentes } from "@/lib/alteracoesPendentes";

import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";
import { useCoresDoPainel } from "@/app/relatorios/painel/PainelContent";
import { useTipoGrafico } from "@/app/relatorios/components/GraficoRealizadoOrcado";
import { botaoPrimario, Erro } from "@/app/cenarios/components/CenarioDialog";

import { AdicionarCardsDialog } from "../components/AdicionarCardsDialog";
import { ApresentacaoDoRelatorio, entrarEmTelaInteira, type Slide } from "../components/ApresentacaoDoRelatorio";
import { EtiquetaSituacao } from "../components/EtiquetaSituacao";
import { AjustarFundoDialog } from "../components/FundoDoSlide";
import { prepararFoto } from "../components/enviarImagem";
import { ConfigurarSumarioDialog } from "../components/SumarioDoRelatorio";
import { VideoDialog, type VideoEscolhido } from "../components/VideoDialog";
import { COLUNAS, GradeDoRelatorio, larguraDoSlide, linhasDaFoto, linhasDaPagina, tamanhoInicial } from "../components/GradeDoRelatorio";
import { ABAS_SEM_NUMERO, relatoriosExecutivosService, type Bloco, type ConteudoDoBloco, type Fundo, type Pagina, type Relatorio, type TelaDoSumario } from "../services/relatoriosExecutivosService";

/** Um id para o bloco novo (sem o crypto.randomUUID, que o navegador só dá em https). */
const novoId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

/** O nome da página: o escolhido ou, sem ele, "Página N". */
const nomeDaPagina = (p: Pagina, k: number) => p.nome?.trim() || `Página ${k + 1}`;

/** A aba e a página abertas. */
type Aberta = { chave: string; pagina: string | null };

/**
 * Um Relatório Executivo (15/10/2026): o de uma competência fechada, com as sete abas (17/10/2026: Introdução, Resultados,
 * Comercial, Produção, Serviços e Administrativo; 20/10/2026: a Capa, antes da Introdução; na barra do topo, como as etapas do
 * Fechamento Mensal) e, em cada uma, as
 * páginas (16/10/2026), cada página com a grade dos blocos. Quem edita a aba (Introdução e Resultados, todos os que editam a
 * tela; as performances, o gestor do departamento, pelo recorte) inclui e exclui páginas, adiciona cards (do Painel de Bordo, com ou sem
 * gráfico, e dos Indicadores), anotações (positivas, negativas e de atenção) e fotos, move, redimensiona e exclui os
 * blocos, grava e finaliza a aba; a aba finalizada todos a leem, e quem a edita (ou o Administrador) a reabre. A aba em
 * elaboração só aparece para quem a edita. Apresentar mostra as páginas como slides, em tela inteira.
 */
export function RelatorioExecutivoContent() {
  const { id } = useParams<{ id: string }>();
  useRegistrarAcessoTela("/analises-gerenciais/relatorios-executivos");
  const consulta = useQuery({ queryKey: ["relatorios-executivos", "relatorio", id], queryFn: () => relatoriosExecutivosService.obter(id) });
  // A aba e a página abertas ficam aqui, para não mudarem quando o editor remonta (ao gravar, finalizar ou reabrir).
  const [aberta, setAberta] = useState<Aberta | null>(null);
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
  const inicial = { chave: (abas.find((a) => a.podeEditar) ?? abas.find((a) => a.visivel) ?? abas[0])?.chave ?? "", pagina: null };
  return <Editor key={versao} relatorio={consulta.data} aberta={aberta ?? inicial} setAberta={setAberta} />;
}

function Editor({ relatorio, aberta, setAberta }: { relatorio: Relatorio; aberta: Aberta; setAberta: (a: Aberta) => void }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const dados = useQuery({ queryKey: ["relatorios-executivos", "dados", relatorio.id], queryFn: () => relatoriosExecutivosService.dados(relatorio.id) });
  const [cores] = useCoresDoPainel();
  const [tipo] = useTipoGrafico();
  const gravadas = Object.fromEntries(relatorio.abas.map((a) => [a.chave, a.paginas]));
  const [paginas, setPaginas] = useState<Record<string, Pagina[]>>(gravadas);
  const [adicionando, setAdicionando] = useState(false);
  // O Adicionar Vídeo (20/10/2026): "novo" (um bloco novo) ou o id do quadro de vídeo vazio que recebe o vídeo.
  const [escolhendoVideo, setEscolhendoVideo] = useState<string | null>(null);
  // O andamento do envio do vídeo (0 a 1), no botão Adicionar.
  const [enviando, setEnviando] = useState<number | null>(null);
  const [apresentando, setApresentando] = useState<number | null>(null);
  // A Imagem de Fundo em ajuste (20/10/2026) e o Adicionar Sumário aberto.
  const [ajustandoFundo, setAjustandoFundo] = useState<Fundo | null>(null);
  const [adicionandoSumario, setAdicionandoSumario] = useState(false);
  const [confirmar, setConfirmar] = useState<"finalizar" | "excluir" | "excluirPagina" | null>(null);
  // A página com o nome em edição (16/10/2026), na própria aba dela.
  const [renomeando, setRenomeando] = useState<string | null>(null);
  // A página arrastada para trocar de lugar (17/10/2026) e a aba sobre a qual ela está.
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const moverPagina = (de: string, para: string) => {
    const origem = daAba.findIndex((x) => x.id === de);
    const destino = daAba.findIndex((x) => x.id === para);
    if (origem < 0 || destino < 0 || origem === destino) return;
    const lista = [...daAba];
    const [movida] = lista.splice(origem, 1);
    lista.splice(destino, 0, movida);
    mudarPaginas(lista);
  };
  const seletorDeFoto = useRef<HTMLInputElement>(null);
  const seletorDeImagem = useRef<HTMLInputElement>(null);
  const seletorDeFundo = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const chave = aberta.chave;
  const aba = relatorio.abas.find((a) => a.chave === chave);
  const daAba = paginas[chave] ?? [];
  // A página aberta: a escolhida, se ainda existe; senão, a primeira da aba.
  const pagina = daAba.find((p) => p.id === aberta.pagina) ?? daAba[0];
  const nPagina = pagina ? daAba.indexOf(pagina) : -1;
  const mudadas = relatorio.abas.filter((a) => a.podeEditar && JSON.stringify(paginas[a.chave] ?? []) !== JSON.stringify(gravadas[a.chave] ?? []));
  const mudouAba = mudadas.some((a) => a.chave === chave);
  useAlteracoesPendentes(mudadas.length > 0);
  const daPagina = pagina?.blocos ?? [];
  const mudarPaginas = (lista: Pagina[]) => setPaginas((p) => ({ ...p, [chave]: lista }));
  const mudarPagina = (blocos: Bloco[]) => mudarPaginas(daAba.map((p) => (p.id === pagina?.id ? { ...p, blocos } : p)));
  // A Imagem de Fundo da página aberta (20/10/2026); sem ela, a página fica sem fundo.
  const mudarFundo = (fundo: Fundo | undefined) => mudarPaginas(daAba.map((p) => (p.id === pagina?.id ? { ...p, fundo } : p)));
  // O bloco novo entra logo abaixo do último bloco da página; a anotação e a foto, ao lado do último bloco, se couberem na linha.
  const fim = daPagina.reduce((m, b) => Math.max(m, b.y + b.h), 0);
  const ultimo = daPagina.reduce<Bloco | null>((u, b) => (!u || b.y > u.y || (b.y === u.y && b.x > u.x) ? b : u), null);
  const posicao = (n: ConteudoDoBloco, k: number) => {
    const t = tamanhoInicial(n as Bloco);
    if (n.tipo === "ANOTACAO" && ultimo && ultimo.x + ultimo.w + t.w <= COLUNAS) return { x: ultimo.x + ultimo.w, y: ultimo.y, ...t, h: Math.max(t.h, ultimo.h) };
    return { x: 0, y: fim + k, ...t };
  };
  const incluir = (novos: ConteudoDoBloco[]) => mudarPagina([...daPagina, ...novos.map((n, k) => ({ ...n, id: novoId(), ...posicao(n, k) }) as Bloco)]);
  // A foto (16/10/2026): reduzida no navegador, enviada ao servidor e incluída como as anotações, na altura da proporção dela.
  // A Imagem Livre (21/10/2026) é a foto com `livre`: só a imagem, sem a legenda (a altura, só a da imagem).
  const foto = useMutation({
    mutationFn: async ({ arquivo }: { arquivo: File; livre: boolean }) => {
      const { foto: conteudo, proporcao } = await prepararFoto(arquivo);
      const { arquivo: nome } = await relatoriosExecutivosService.enviarFoto(relatorio.id, conteudo);
      return { nome, proporcao };
    },
    onSuccess: ({ nome, proporcao }, { livre }) => {
      const t = tamanhoInicial({ tipo: "FOTO" });
      // A grade tem 24 px a mais que a área (as margens de fora dos blocos).
      const h = linhasDaFoto(t.w, proporcao, larguraDoSlide(), livre);
      const p = ultimo && ultimo.x + ultimo.w + t.w <= COLUNAS ? { x: ultimo.x + ultimo.w, y: ultimo.y } : { x: 0, y: fim };
      mudarPagina([...daPagina, { tipo: "FOTO", arquivo: nome, legenda: "", proporcao, ...(livre ? { livre: true } : {}), id: novoId(), ...p, w: t.w, h }]);
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível enviar a foto.")),
  });
  // A imagem de um quadro de foto vazio (17/10/2026: o relatório importado sem as imagens): entra no próprio bloco, que
  // fica com a altura da proporção dela.
  const imagemNoQuadro = useMutation({
    mutationFn: async ({ arquivo }: { id: string; arquivo: File }) => {
      const { foto: conteudo, proporcao } = await prepararFoto(arquivo);
      const { arquivo: nome } = await relatoriosExecutivosService.enviarFoto(relatorio.id, conteudo);
      return { nome, proporcao };
    },
    onSuccess: ({ nome, proporcao }, { id }) => {
      const largura = larguraDoSlide();
      mudarPagina(daPagina.map((b) => (b.id === id && b.tipo === "FOTO" ? { ...b, arquivo: nome, proporcao, h: linhasDaFoto(b.w, proporcao, largura, !!b.livre) } : b)));
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível enviar a foto.")),
  });
  // O vídeo (20/10/2026): o arquivo vai ao servidor (com o andamento no botão); o link entra direto. O bloco novo entra como a
  // foto, ao lado do último bloco, se couber na linha, na altura da proporção dele; o quadro vazio recebe o vídeo no lugar.
  const video = useMutation({
    mutationFn: async ({ v }: { v: VideoEscolhido; quadro: string | null }) => {
      if (v.origem === "LINK") return { origem: "LINK" as const, arquivo: "", url: v.url, proporcao: v.proporcao };
      setEnviando(0);
      try {
        const { arquivo } = await relatoriosExecutivosService.enviarVideo(relatorio.id, v.arquivo, setEnviando);
        return { origem: "ARQUIVO" as const, arquivo, url: "", proporcao: v.proporcao };
      } finally {
        setEnviando(null);
      }
    },
    onSuccess: (m, { quadro }) => {
      const largura = larguraDoSlide();
      if (quadro) {
        mudarPagina(daPagina.map((b) => (b.id === quadro && b.tipo === "VIDEO" ? { ...b, ...m, h: linhasDaFoto(b.w, m.proporcao, largura) } : b)));
        return;
      }
      const t = tamanhoInicial({ tipo: "VIDEO" });
      const h = linhasDaFoto(t.w, m.proporcao, largura);
      const p = ultimo && ultimo.x + ultimo.w + t.w <= COLUNAS ? { x: ultimo.x + ultimo.w, y: ultimo.y } : { x: 0, y: fim };
      mudarPagina([...daPagina, { tipo: "VIDEO", ...m, legenda: "", id: novoId(), ...p, w: t.w, h }]);
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível enviar o vídeo.")),
  });
  // A Imagem de Fundo (20/10/2026): enviada como as fotos (até 2560 px) e logo ajustada no modal; só entra na página no Aplicar.
  const imagemDeFundo = useMutation({
    mutationFn: async (arquivo: File) => {
      const { foto: conteudo, proporcao } = await prepararFoto(arquivo, 2560);
      const { arquivo: nome } = await relatoriosExecutivosService.enviarFoto(relatorio.id, conteudo);
      return { arquivo: nome, proporcao, zoom: 1, x: 0.5, y: 0.5 };
    },
    onSuccess: (f) => setAjustandoFundo(f),
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível enviar a imagem.")),
  });
  // As páginas (16/10/2026): a nova entra depois da aberta; excluir pede confirmação quando a página tem blocos.
  const novaPagina = () => {
    const nova = { id: novoId(), blocos: [] };
    mudarPaginas([...daAba.slice(0, nPagina + 1), nova, ...daAba.slice(nPagina + 1)]);
    setAberta({ chave, pagina: nova.id });
  };
  const excluirPagina = () => {
    const resto = daAba.filter((p) => p.id !== pagina?.id);
    mudarPaginas(resto);
    setAberta({ chave, pagina: resto[Math.max(0, nPagina - 1)]?.id ?? null });
    setConfirmar(null);
  };
  // Recuar e avançar: pelas páginas de todas as abas, na ordem (a aba que o usuário não vê conta como uma página).
  const sequencia = relatorio.abas.flatMap((a) => (a.visivel ? (paginas[a.chave] ?? []).map((p) => ({ chave: a.chave, pagina: p.id as string | null })) : [{ chave: a.chave, pagina: null }]));
  const aqui = sequencia.findIndex((s) => s.chave === chave && (s.pagina === null || s.pagina === pagina?.id));
  const ir = (d: number) => {
    const s = sequencia[aqui + d];
    if (s) setAberta(s);
  };
  // Os slides da apresentação: as páginas com algum bloco ou com a Imagem de Fundo (20/10/2026) das abas que o usuário vê
  // (o que está na tela, gravado ou não). A contagem (o contador do topo dos slides e os números do Sumário) começa na
  // Introdução: os slides da Capa e do Encerramento (20/10/2026) não contam.
  const comConteudo = relatorio.abas.flatMap((a) => {
    const ps = a.visivel ? (paginas[a.chave] ?? []) : [];
    return ps.flatMap((p, k) => (p.blocos.length || p.fundo ? [{ aba: a.chave, chave: `${a.chave}|${p.id}`, nome: a.titulo, pagina: nomeDaPagina(p, k), blocos: p.blocos, fundo: p.fundo }] : []));
  });
  const contados = comConteudo.filter((x) => !ABAS_SEM_NUMERO.has(x.aba)).length;
  let contagem = 0;
  const slides: Array<Slide & { aba: string }> = comConteudo.map((x) => ({ ...x, numero: ABAS_SEM_NUMERO.has(x.aba) ? null : ++contagem, total: contados }));
  // O Sumário (20/10/2026): as telas da Introdução às performances (sem a Capa e o Encerramento), com os slides e os números de cada uma.
  const sumario: TelaDoSumario[] = relatorio.abas
    .filter((a) => !ABAS_SEM_NUMERO.has(a.chave))
    .map((a) => ({ chave: a.chave, titulo: a.titulo, slides: slides.filter((x) => x.aba === a.chave).map((x) => ({ nome: x.pagina, numero: x.numero ?? 0 })) }));
  const apresentar = () => {
    entrarEmTelaInteira();
    setApresentando(Math.max(0, slides.findIndex((s) => s.chave === `${chave}|${pagina?.id}`)));
  };
  const atualizar = (r: Relatorio) => {
    queryClient.setQueryData(["relatorios-executivos", "relatorio", relatorio.id], r);
    queryClient.invalidateQueries({ queryKey: ["relatorios-executivos"], exact: true });
  };
  // Gravar: as abas alteradas (as que o usuário edita), uma a uma.
  const gravar = useMutation({
    mutationFn: async () => {
      let r = relatorio;
      for (const a of mudadas) r = await relatoriosExecutivosService.gravarAba(relatorio.id, a.chave, paginas[a.chave] ?? []);
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
  const vazia = daAba.every((p) => p.blocos.length === 0);
  const botaoIcone = "inline-flex size-8 items-center justify-center rounded-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:pointer-events-none disabled:opacity-40";
  return (
    // A largura da área (a da grade, menos as margens de fora), para a altura da foto nova.
    <div ref={area} className="space-y-6">
      <BarraDoRelatorio relatorio={relatorio} chave={chave} onMudar={(c) => setAberta({ chave: c, pagina: null })} />
      <CabecalhoDaTela
        // O título da tela é o da aba aberta (17/10/2026: Introdução, Performance da Produção…); o mês fica na barra do topo.
        titulo={aba?.titulo ?? `RE - ${relatorio.rotuloMes}`}
        acoes={
          <div className="flex flex-wrap items-center gap-2">
            {editavel ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button type="button" className={botaoPrimario} disabled={foto.isPending || video.isPending || imagemDeFundo.isPending}>
                      <Plus className="size-4" />
                      {enviando !== null ? `Enviando… ${Math.round(enviando * 100)}%` : foto.isPending || video.isPending || imagemDeFundo.isPending ? "Enviando…" : "Adicionar"}
                      <ChevronDown className="size-4" />
                    </Button>
                  }
                />
                {/* Na largura das opções, sem quebrar linha (22/10/2026: "Imagem com Legenda" quebrava). */}
                <DropdownMenuContent align="end" className="w-max min-w-44 [&_[role=menuitem]]:whitespace-nowrap">
                  <DropdownMenuItem disabled={!dados.data} onClick={() => setAdicionando(true)}>
                    <LayoutGrid className="size-4" />
                    Cards
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => incluir([{ tipo: "ANOTACAO", nota: "POSITIVO", texto: "" }])}>
                    <StickyNote className="size-4" />
                    Anotação
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => incluir([{ tipo: "TEXTO", texto: "" }])}>
                    <Type className="size-4" />
                    Texto Livre
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAdicionandoSumario(true)}>
                    <ListOrdered className="size-4" />
                    Sumário
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => seletorDeFoto.current?.click()}>
                    <ImagePlus className="size-4" />
                    Imagem com Legenda
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => seletorDeImagem.current?.click()}>
                    <Imagem className="size-4" />
                    Imagem Livre
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => seletorDeFundo.current?.click()}>
                    <ImageUp className="size-4" />
                    Imagem de Fundo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setEscolhendoVideo("novo")}>
                    <Video className="size-4" />
                    Vídeo
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
            <Button type="button" className={botaoPrimario} disabled={!slides.length} title={slides.length ? "Apresentar as páginas em tela inteira" : "Nenhuma página com blocos para apresentar"} onClick={apresentar}>
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
                if (arquivo) foto.mutate({ arquivo, livre: false });
              }}
            />
            <input
              ref={seletorDeImagem}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                e.target.value = "";
                if (arquivo) foto.mutate({ arquivo, livre: true });
              }}
            />
            <input
              ref={seletorDeFundo}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                e.target.value = "";
                if (arquivo) imagemDeFundo.mutate(arquivo);
              }}
            />
          </div>
        }
        comoUsar={
          <ul>
            <li>
              A barra do topo mostra o mês (clique nele para ir a outro relatório), a situação do relatório e as oito abas: Capa, Introdução,
              Resultados (Demonstrativo de Resultados), Comercial (Performance Comercial), Produção (Performance da Produção), Serviços (Performance de
              Serviços), Administrativo (Performance Administrativa) e Encerramento. Capa, Introdução, Resultados e Encerramento são gerais: todos os que
              editam a tela os editam. Os slides da Capa abrem a apresentação e os do Encerramento a fecham; os dois têm os blocos onde se põem e não entram
              na contagem dos slides nem no Sumário (o contador do topo e os números do Sumário começam na Introdução). As performances
              seguem o recorte de departamentos do seu usuário (Controle de Usuários): você edita as do seu recorte (sem recorte, todas); as dos outros
              aparecem quando o gestor delas as finaliza. O ícone de check ao lado do nome diz que a aba está finalizada (a dica dele mostra quem a
              finalizou e quando).
            </li>
            <li>
              Cada aba tem uma ou mais páginas, logo abaixo do título. O nome da página é o do slide na apresentação (de início, “Página 1”): na sua aba,
              dois cliques nele (ou o lápis) o editam, e arrastar a aba de uma página para outra posição a troca de lugar (a ordem dos slides acompanha). Os outros botões ao lado delas incluem uma página nova (depois da aberta), excluem a página aberta (com
              blocos, pede confirmação; a única página não se exclui) e recuam ou avançam pelas páginas, passando de uma aba para a outra.
              A página tem o tamanho do que cabe na tela inteira (o contorno tracejado): os blocos não passam dele.
            </li>
            <li>
              Na sua aba, “Adicionar” traz oito opções, que entram na página aberta. Cards abre a lista dos cards do Painel de Bordo e
              dos Indicadores (o card de destaque, com o valor do mês e o acumulado, cada um com o orçado num quadro cinza e a faixa de melhor ou pior, como no Painel), com ou sem o gráfico (a caixa Com Gráfico): marque os que quiser; eles entram no fim da página, os do
              Painel e os dos Indicadores com os rótulos e em barras (o Configurar Gráfico do card muda). Os cards trazem só as competências fechadas, até o mês do relatório.
            </li>
            <li>
              Anotação inclui um bloco de texto ao lado do último bloco, no formato dos cards do Painel: o título em cima (de início, o nome da nota; clique
              nele para mudar) e o texto no card com o destaque da cor. Na barra do bloco (logo acima dele, com o mouse sobre ele ou escrevendo nele), a formatação do
              texto da anotação e da legenda da foto: negrito, itálico, sublinhado, aumentar e diminuir a fonte, a cor (Padrão — a cor do tema —, cinza, ouro,
              verde, azul, amarelo, laranja, vermelho e branco) e os marcadores (quadrado, seta, check e erro, o “x”); o tamanho da fonte é o botão com o número (clique nele para escolher, de 10 a 144; o padrão, 14, tem asterisco). Nas anotações e no Texto Livre, também a fonte (o botão Aa: Padrão, Arial, Calibri, Segoe UI, Verdana, Georgia e as abertas Roboto, Open Sans, Montserrat, Lato e Poppins; a fonte do texto onde está o cursor fica destacada na lista, em negrito e com o fundo cinza) e o espaçamento entre as linhas (de 0,50 a 2,00, para o texto todo do bloco; 1,00 é o simples, e Padrão volta ao de antes). Ela vale para o trecho selecionado (diminuir ou voltar ao padrão vale também para parte de um trecho aumentado); sem seleção,
              para todo o texto. Com o cursor no título da anotação, o botão do tamanho muda o do título (de 12 a 32; o padrão, 18), e o da fonte, a dele. No canto do bloco, escolha Positivo (verde; azul com a Acessibilidade Daltonismo, no menu do usuário),
              Negativo (vermelho) ou Atenção (laranja). A anotação pode ficar baixa a ponto de mostrar uma linha só do texto.
            </li>
            <li>
              Texto Livre inclui um texto com a formatação das anotações, com a fonte e o espaçamento entre as linhas (na barra do bloco; o tamanho até 144 e o
              branco servem aos textos sobre a Imagem de Fundo), mas sem o destaque lateral, o título, o ícone e o fundo: na edição, o contorno tracejado aparece com o mouse
              sobre ele. Na apresentação, ele não se destaca nem se amplia.
            </li>
            <li>
              Sumário abre o modal Adicionar Sumário: listar as Telas (cada uma com o número do primeiro slide dela) ou as Telas e Slides (abaixo de cada
              tela, os slides, com os números), e as telas que entram (da Introdução em diante; de início, todas). A lista se monta sozinha, com os slides de
              agora (as páginas com algum bloco ou com a Imagem de Fundo): os números são a contagem dos slides a partir da Introdução, a mesma do contador
              do topo dos slides; a tela marcada sem slides não aparece. O Sublinhado (Pontos, Traços, Linha ou Nenhum) é a linha entre o nome e o número, na cor
              do texto. A engrenagem do bloco muda as opções. Na barra do bloco, a formatação do texto (sem os marcadores): negrito, itálico, sublinhado, o
              tamanho, a cor e a fonte, que valem para todas as telas ou para todos os slides — em Telas e Slides, o botão Telas | Slides escolhe qual nível
              ela muda (de início, as telas em negrito, com 16, e os slides com 14).
            </li>
            <li>
              Imagem com Legenda (antes, Foto) envia uma imagem (JPEG, PNG, WebP ou GIF; reduzida a até 1600 px; as partes transparentes continuam transparentes) e a inclui com a legenda embaixo, no destaque
              amarelo-ouro. A imagem aumenta e diminui sempre na mesma proporção. Nas imagens (com legenda, livres e de fundo), o botão de ajustes da barra do
              bloco (ou o modal da Imagem de Fundo) muda o Brilho, a Matiz, a Saturação, o Desfoque e a Transparência; nas com legenda e nas livres, também a Borda (a
              espessura e a cor) e o Sombreamento centralizado (a intensidade e o desfoque). “Restaurar Ajustes” volta à imagem como veio, e “Trocar
              Imagem” põe outra imagem no lugar, com os ajustes de agora (o bloco fica na proporção da nova).
            </li>
            <li>
              Imagem Livre envia uma imagem como a Imagem com Legenda, mas a inclui sozinha: sem a legenda e sem o fundo (um PNG transparente fica transparente sobre o
              slide). Ela aumenta e diminui na mesma proporção e, na apresentação, como as demais imagens, se destaca sob o mouse e se amplia ao clicar.
            </li>
            <li>
              Vídeo abre o modal Adicionar Vídeo: um arquivo do computador (MP4, WebM, MOV, M4V ou OGG, até 200 MB; o botão Adicionar mostra o andamento do
              envio) ou o link de um vídeo público do YouTube, do Instagram, do Facebook ou do LinkedIn (o endereço ou o código “incorporar” da
              plataforma). Ele entra como a foto, com a legenda embaixo; o do computador e o do YouTube aumentam e diminuem na proporção do vídeo. Na edição
              e na leitura, o vídeo tem os controles do player.
            </li>
            <li>
              Imagem de Fundo envia uma imagem (reduzida a até 2560 px) e abre o modal Imagem de Fundo, com a miniatura da tela inteira: arraste a imagem
              para posicioná-la e use o Tamanho (ou a roda do mouse sobre ela) para aumentá-la; Restaurar a centraliza no tamanho que cobre a tela. Ela
              ocupa o fundo do slide inteiro, por cima do cabeçalho (a faixa tracejada da miniatura) e atrás dos blocos; cada página tem uma. Na página, ela
              aparece atrás da grade; os botões ao lado das páginas a ajustam e a removem. Uma página só com a Imagem de Fundo já é um slide.
            </li>
            <li>
              Passe o mouse num bloco para ver os botões dele: a alça (arraste para mover), o gráfico (nos cards do Painel e dos Indicadores, em ciclo: os meses e o acumulado →
              só o acumulado, com o “A” no ícone → sem gráfico; o card muda de largura na proporção), as opções do gráfico (os rótulos e o tipo, neste card ou em todos os cards da aba; as cores seguem a Acessibilidade), a nota (nas anotações) e
              excluir. O canto de baixo, à direita, redimensiona o bloco, até um tamanho mínimo, para as informações não se amontoarem. Ao mover ou
              redimensionar, a grade aparece no fundo, bem clara, para alinhar os blocos. O bloco arrastado sobre outro o empurra; se você continua
              arrastando e sai de cima dele, o empurrado volta ao lugar.
            </li>
            <li>
              “Apresentar” mostra as páginas com blocos como slides, em tela inteira e sem o menu lateral, a partir da página aberta, com o grupo (o título da aba:
              Introdução, Performance da Produção…), em cinza, a seta e o nome do slide (o da página), em preto, à esquerda do topo, e “Relatório Executivo”, em
              cinza, a seta, o período, em preto, e a logo da BPM à direita; embaixo, o rodapé, com o separador igual ao do cabeçalho: à esquerda, a legenda dos cards (nos slides
              com cards do Painel ou dos Indicadores), e, à direita, o contador dos slides (“1/10”: o slide em preto e negrito e o total, contados da
              Introdução em diante; nos slides da Capa e do Encerramento, sem ele). Mova o mouse para ver os botões, no centro da base:
              o grupo anterior (a aba), recuar, avançar, o próximo grupo e sair (as setas do teclado também mudam o slide; Esc encerra). Passe o mouse num bloco para destacá-lo; clique nele para
              ampliá-lo na tela, com o fundo escurecido (um clique em qualquer lugar fecha). Num card do Painel, o clique no gráfico amplia só o gráfico, e
              na parte antes dele, só essa parte (o nome e os valores, como num card sem gráfico). Num vídeo, o mouse sobre ele mostra, no centro de baixo,
              Reproduzir (Pausar, tocando), Parar e Mudo; o clique o amplia, continuando de onde estava, com os controles do player (a barra para avançar
              e recuar, o volume e a tela cheia; um clique fora do vídeo ou o Esc fecha, e o vídeo da página fica no ponto em que parou). No Instagram, no
              Facebook e no LinkedIn, que não aceitam os botões da página, o vídeo toca ampliado, nos controles da plataforma. Na apresentação, os textos
              não se selecionam.
            </li>
            <li>
              “Gravar” guarda as abas alteradas, com as páginas (sair sem gravar pergunta antes). “Finalizar Aba” grava a aba e a torna pública, só para
              leitura; “Reabrir Aba” a devolve à elaboração. O relatório fica Finalizado quando todas as abas estão finalizadas.
            </li>
          </ul>
        }
        sobre={
          <p>
            O relatório executivo (RE) de {relatorio.rotuloMes}: em cada aba (a Capa, a Introdução, o Demonstrativo de Resultados, as performances
            Comercial, da Produção, de Serviços e Administrativa e o Encerramento), as páginas com os cards do Painel de Bordo e dos Indicadores de Resultados
            Empresariais escolhidos pelos gestores, com as anotações dos pontos positivos, negativos e de atenção, os textos, o sumário, as fotos, os
            vídeos e as imagens de fundo. Criado por{" "}
            {relatorio.criadoPor}.
          </p>
        }
      />
      {/*
        As páginas da aba (16/10/2026), no formato das abas das telas, com o nome de cada uma (o do slide; na sua aba, dois
        cliques ou o lápis o editam) e, na altura delas, os botões só com ícones: renomear, incluir, excluir, recuar e avançar.
      */}
      {aba?.visivel ? (
        <div className="flex items-end">
          <div role="tablist" aria-label={`Páginas de ${aba.nome}`} data-tour="abas" className="flex min-w-0 flex-1 gap-1 overflow-x-auto overflow-y-hidden border-b border-gray-200">
            {daAba.map((p, k) => {
              const atual = p.id === pagina?.id;
              const classe = `-mb-px inline-flex shrink-0 items-center border-b-2 px-3 py-2 text-sm whitespace-nowrap ${atual ? "border-black font-bold text-gray-900" : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900"}`;
              return renomeando === p.id ? (
                <input
                  key={p.id}
                  autoFocus
                  defaultValue={p.nome ?? ""}
                  placeholder={`Página ${k + 1}`}
                  maxLength={60}
                  aria-label="Nome da página"
                  onFocus={(e) => e.target.select()}
                  onBlur={(e) => {
                    const nome = e.target.value.trim();
                    mudarPaginas(daAba.map((x) => (x.id === p.id ? { ...x, nome: nome || undefined } : x)));
                    setRenomeando(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") {
                      e.currentTarget.value = p.nome ?? "";
                      e.currentTarget.blur();
                    }
                  }}
                  className={`${classe} w-48 rounded-t-sm bg-white outline-none`}
                />
              ) : (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={atual}
                  onClick={() => setAberta({ chave, pagina: p.id })}
                  onDoubleClick={() => (editavel ? setRenomeando(p.id) : undefined)}
                  title={editavel ? "Dois cliques para mudar o nome (o do slide); arraste para trocar de lugar" : undefined}
                  // Arrastar a aba para trocar a página de lugar (17/10/2026), na aba que se edita.
                  draggable={editavel}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", p.id);
                    e.dataTransfer.effectAllowed = "move";
                    setArrastando(p.id);
                  }}
                  onDragOver={(e) => {
                    if (!arrastando || arrastando === p.id) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setSobre(p.id);
                  }}
                  onDragLeave={() => setSobre((s) => (s === p.id ? null : s))}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (arrastando) moverPagina(arrastando, p.id);
                    setArrastando(null);
                    setSobre(null);
                  }}
                  onDragEnd={() => {
                    setArrastando(null);
                    setSobre(null);
                  }}
                  className={`${classe} ${editavel ? "cursor-grab active:cursor-grabbing" : ""} ${sobre === p.id ? "rounded-t-sm bg-gray-100" : ""} ${arrastando === p.id ? "opacity-50" : ""}`}
                >
                  {nomeDaPagina(p, k)}
                </button>
              );
            })}
          </div>
          <div className="flex shrink-0 items-center gap-0.5 border-b border-gray-200 pb-0.5 pl-2">
            {editavel ? (
              <>
                <button type="button" className={botaoIcone} disabled={!pagina} onClick={() => pagina && setRenomeando(pagina.id)} title="Mudar o nome da página (o do slide)" aria-label="Mudar o nome da página">
                  <Pencil className="size-4" />
                </button>
                <button type="button" className={botaoIcone} onClick={novaPagina} title="Nova página (depois da aberta)" aria-label="Nova página">
                  <FilePlus2 className="size-4" />
                </button>
                <button
                  type="button"
                  className={`${botaoIcone} hover:text-red-700`}
                  disabled={daAba.length <= 1}
                  onClick={() => (daPagina.length ? setConfirmar("excluirPagina") : excluirPagina())}
                  title={daAba.length <= 1 ? "A única página da aba não se exclui" : "Excluir a página aberta"}
                  aria-label="Excluir a página"
                >
                  <FileX2 className="size-4" />
                </button>
                {/* A Imagem de Fundo da página (20/10/2026): ajustar e remover, quando ela tem uma. */}
                {pagina?.fundo ? (
                  <>
                    <button type="button" className={botaoIcone} onClick={() => setAjustandoFundo(pagina.fundo ?? null)} title="Ajustar a Imagem de Fundo da página" aria-label="Ajustar a Imagem de Fundo">
                      <Crop className="size-4" />
                    </button>
                    <button type="button" className={`${botaoIcone} hover:text-red-700`} onClick={() => mudarFundo(undefined)} title="Remover a Imagem de Fundo da página" aria-label="Remover a Imagem de Fundo">
                      <ImageOff className="size-4" />
                    </button>
                  </>
                ) : null}
                <span className="mx-1 h-5 w-px bg-gray-200" />
              </>
            ) : null}
            <button type="button" className={botaoIcone} disabled={aqui <= 0} onClick={() => ir(-1)} title="Página anterior" aria-label="Página anterior">
              <ChevronLeft className="size-4" />
            </button>
            <button type="button" className={botaoIcone} disabled={aqui < 0 || aqui >= sequencia.length - 1} onClick={() => ir(1)} title="Próxima página" aria-label="Próxima página">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
      {dados.isError ? <Erro erro={mensagemDeErro(dados.error, "Erro ao carregar os dados dos cards.")} /> : null}
      {!aba?.visivel ? (
        <p className="rounded-sm border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
          A aba {aba?.nome} está em elaboração: aparece quando o gestor dela a finalizar.
        </p>
      ) : daPagina.length === 0 && !pagina?.fundo ? (
        <p className="rounded-sm border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
          {editavel ? "A página está vazia: use “Adicionar”, na linha do título." : "Nada nesta página."}
        </p>
      ) : (
        <GradeDoRelatorio
          key={pagina?.id}
          relatorioId={relatorio.id}
          blocos={daPagina}
          sumario={sumario}
          fundo={pagina?.fundo}
          dados={dados.data}
          editavel={editavel}
          cores={cores}
          tipo={tipo}
          linhas={linhasDaPagina()}
          onCarregarImagem={(id, arquivo) => imagemNoQuadro.mutate({ id, arquivo })}
          onEscolherVideo={(id) => setEscolhendoVideo(id)}
          onMudar={mudarPagina}
        />
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
          periodo={relatorio.rotuloMes}
          slides={slides}
          sumario={sumario}
          inicial={apresentando}
          dados={dados.data}
          cores={cores}
          tipo={tipo}
          onSair={() => setApresentando(null)}
        />
      ) : null}
      {ajustandoFundo ? (
        <AjustarFundoDialog
          relatorioId={relatorio.id}
          fundo={ajustandoFundo}
          onFechar={() => setAjustandoFundo(null)}
          onAplicar={(f) => {
            mudarFundo(f);
            setAjustandoFundo(null);
          }}
        />
      ) : null}
      {adicionandoSumario ? (
        <ConfigurarSumarioDialog
          titulo="Adicionar Sumário"
          sumario={sumario}
          onFechar={() => setAdicionandoSumario(false)}
          onAplicar={(o) => {
            incluir([{ tipo: "SUMARIO", ...o }]);
            setAdicionandoSumario(false);
          }}
        />
      ) : null}
      {escolhendoVideo ? (
        <VideoDialog
          titulo={escolhendoVideo === "novo" ? "Adicionar Vídeo" : "Carregar Vídeo"}
          onFechar={() => setEscolhendoVideo(null)}
          onEscolher={(v) => {
            video.mutate({ v, quadro: escolhendoVideo === "novo" ? null : escolhendoVideo });
            setEscolhendoVideo(null);
          }}
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
      {confirmar === "excluirPagina" ? (
        <Dialog open onOpenChange={(o) => (!o ? setConfirmar(null) : undefined)}>
          <DialogContent className="rounded-sm sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Excluir a Página {pagina ? nomeDaPagina(pagina, nPagina) : ""}</DialogTitle>
              <DialogDescription>
                A página {pagina ? nomeDaPagina(pagina, nPagina) : ""} da aba {aba?.nome} sai com os blocos dela. A exclusão vale ao gravar (antes disso, sair sem gravar a desfaz).
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" className="rounded-sm" onClick={() => setConfirmar(null)}>
                Cancelar
              </Button>
              <Button type="button" variant="outline" className="rounded-sm border-red-300 text-red-700 hover:bg-red-50" onClick={excluirPagina}>
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : confirmar ? (
        <Dialog open onOpenChange={(o) => (!o ? setConfirmar(null) : undefined)}>
          <DialogContent className="rounded-sm sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{confirmar === "finalizar" ? `Finalizar a Aba ${aba?.nome ?? ""}` : "Excluir Relatório"}</DialogTitle>
              <DialogDescription>
                {confirmar === "finalizar"
                  ? `A aba ${aba?.nome} de ${relatorio.rotuloMes} fica visível, só para leitura, para todos os que leem a tela.${mudouAba ? " As alterações ainda não gravadas são gravadas antes." : ""}${vazia ? " A aba está vazia." : ""} Você pode reabri-la depois.`
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

/**
 * A barra do relatório (16/10/2026), no topo da tela, no formato da barra de etapas do Fechamento Mensal: o mês em
 * amarelo-ouro (o menu dele leva aos outros relatórios), a situação do relatório e as abas (o nome curto; o título na dica), com o ícone de check
 * nos finalizados (a dica diz quem finalizou e quando).
 */
function BarraDoRelatorio({ relatorio, chave, onMudar }: { relatorio: Relatorio; chave: string; onMudar: (chave: string) => void }) {
  const router = useRouter();
  const lista = useQuery({ queryKey: ["relatorios-executivos"], queryFn: () => relatoriosExecutivosService.listar() });
  return (
    <nav aria-label="Abas do relatório" data-tour="barra-de-atividades" className="flex min-w-0 flex-col gap-1 rounded-sm border border-gray-200 bg-white px-2 py-1.5 xl:flex-row xl:items-center">
      <div className="flex shrink-0 items-center gap-1.5 px-1">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button type="button" className="bg-bpm-primary hover:bg-bpm-primary-hover inline-flex items-center gap-1 rounded-sm px-2.5 py-1 text-sm font-bold text-black">
                RE · {relatorio.rotuloMes}
                <ChevronDown className="size-3.5 text-black/70" />
              </button>
            }
          />
          <DropdownMenuContent align="start" className="max-h-80 w-56 overflow-y-auto">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-gray-500">Ir para outro relatório</DropdownMenuLabel>
              {(lista.data?.relatorios ?? []).map((r) => (
                <DropdownMenuItem
                  key={r.id}
                  onClick={() => r.id !== relatorio.id && podeSair() && router.push(`/analises-gerenciais/relatorios-executivos/${r.id}`)}
                  className={r.id === relatorio.id ? "font-bold" : ""}
                >
                  {r.rotuloMes}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <EtiquetaSituacao situacao={relatorio.situacao} />
      </div>
      {/* Quebra em duas linhas quando falta largura, sem rolar a página. */}
      <ol className="flex min-w-0 flex-wrap items-center gap-y-1 xl:ml-2">
        {relatorio.abas.map((a) => {
          const ativa = a.chave === chave;
          return (
            <li key={a.chave} className="flex shrink-0 items-center">
              <button
                type="button"
                aria-current={ativa ? "page" : undefined}
                title={a.titulo}
                onClick={() => onMudar(a.chave)}
                className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-sm whitespace-nowrap ${ativa ? "bg-black font-bold text-white" : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"}`}
              >
                {a.nome}
                {a.situacao === "FINALIZADO" ? (
                  <span title={`Aba finalizada${a.finalizadoPor ? ` por ${a.finalizadoPor}` : ""}${a.finalizadoEm ? ` em ${dataHora(a.finalizadoEm)}` : ""}`}>
                    <CircleCheck className={`size-4 ${ativa ? "text-green-400" : "text-green-700"}`} aria-label="Aba finalizada" />
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
