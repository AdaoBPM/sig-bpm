"use client";

import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, FilePlus2, FileX2, ImagePlus, LayoutGrid, LockOpen, Pencil, Plus, Presentation, Save, StickyNote, Trash2 } from "lucide-react";
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
import { ApresentacaoDoRelatorio, entrarEmTelaInteira } from "../components/ApresentacaoDoRelatorio";
import { EtiquetaSituacao } from "../components/EtiquetaSituacao";
import { COLUNAS, GradeDoRelatorio, linhasDaFoto, linhasDaPagina, tamanhoInicial } from "../components/GradeDoRelatorio";
import { relatoriosExecutivosService, type Bloco, type ConteudoDoBloco, type Pagina, type Relatorio } from "../services/relatoriosExecutivosService";

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

/** O nome da página: o escolhido ou, sem ele, "Página N". */
const nomeDaPagina = (p: Pagina, k: number) => p.nome?.trim() || `Página ${k + 1}`;

/** A aba (departamento) e a página abertas. */
type Aberta = { chave: string; pagina: string | null };

/**
 * Um Relatório Executivo (15/10/2026): o de uma competência fechada, com uma aba por departamento (na barra do topo, como
 * as etapas do Fechamento Mensal) e, em cada uma, as páginas (16/10/2026), cada página com a grade dos blocos. Quem edita
 * a aba (o gestor do departamento, pelo recorte) inclui e exclui páginas, adiciona cards (do Painel de Bordo, com ou sem
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
  const [apresentando, setApresentando] = useState<number | null>(null);
  const [confirmar, setConfirmar] = useState<"finalizar" | "excluir" | "excluirPagina" | null>(null);
  // A página com o nome em edição (16/10/2026), na própria aba dela.
  const [renomeando, setRenomeando] = useState<string | null>(null);
  const seletorDeFoto = useRef<HTMLInputElement>(null);
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
  // O bloco novo entra no fim da página (a grade o encosta em cima); a anotação e a foto, ao lado do último bloco, se couberem na linha.
  const fim = daPagina.reduce((m, b) => Math.max(m, b.y + b.h), 0);
  const ultimo = daPagina.reduce<Bloco | null>((u, b) => (!u || b.y > u.y || (b.y === u.y && b.x > u.x) ? b : u), null);
  const posicao = (n: ConteudoDoBloco, k: number) => {
    const t = tamanhoInicial(n as Bloco);
    if (n.tipo === "ANOTACAO" && ultimo && ultimo.x + ultimo.w + t.w <= COLUNAS) return { x: ultimo.x + ultimo.w, y: ultimo.y, ...t, h: Math.max(t.h, ultimo.h) };
    return { x: 0, y: fim + k, ...t };
  };
  const incluir = (novos: ConteudoDoBloco[]) => mudarPagina([...daPagina, ...novos.map((n, k) => ({ ...n, id: novoId(), ...posicao(n, k) }) as Bloco)]);
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
      mudarPagina([...daPagina, { tipo: "FOTO", arquivo: nome, legenda: "", proporcao, id: novoId(), ...p, w: t.w, h }]);
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível enviar a foto.")),
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
  // Os slides da apresentação: as páginas com algum bloco das abas que o usuário vê (o que está na tela, gravado ou não).
  const slides = relatorio.abas.flatMap((a) => {
    const ps = a.visivel ? (paginas[a.chave] ?? []) : [];
    return ps.flatMap((p, k) => (p.blocos.length ? [{ chave: `${a.chave}|${p.id}`, nome: a.nome, pagina: nomeDaPagina(p, k), blocos: p.blocos }] : []));
  });
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
        titulo={`RE - ${relatorio.rotuloMes}`}
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
                if (arquivo) foto.mutate(arquivo);
              }}
            />
          </div>
        }
        comoUsar={
          <ul>
            <li>
              A barra do topo mostra o mês (clique nele para ir a outro relatório), a situação do relatório e os departamentos: cada departamento é uma aba.
              Você edita as abas do seu recorte de departamentos (Controle de Usuários); as dos outros aparecem quando o gestor delas as finaliza. O ícone de
              check ao lado do nome diz que a aba está finalizada (a dica dele mostra quem a finalizou e quando).
            </li>
            <li>
              Cada aba tem uma ou mais páginas, logo abaixo do título. O nome da página é o do slide na apresentação (de início, “Página 1”): na sua aba,
              dois cliques nele (ou o lápis) o editam. Os outros botões ao lado delas incluem uma página nova (depois da aberta), excluem a página aberta (com
              blocos, pede confirmação; a única página não se exclui) e recuam ou avançam pelas páginas, passando de um departamento para o outro.
              A página tem o tamanho do que cabe na tela inteira (o contorno tracejado): os blocos não passam dele.
            </li>
            <li>
              Na sua aba, “Adicionar” traz três opções, que entram na página aberta. Cards abre a lista dos cards do Painel de Bordo (com ou sem o gráfico) e
              dos Indicadores (o card de destaque, com o valor do mês, o acumulado e o orçado): marque os que quiser; eles entram no fim da página. Os cards
              trazem só as competências fechadas, até o mês do relatório.
            </li>
            <li>
              Anotação inclui um bloco de texto ao lado do último bloco, no formato dos cards do Painel: o título em cima (de início, o nome da nota; clique
              nele para mudar) e o texto no card com o destaque da cor. No canto do bloco, escolha Positivo (verde; azul com a Acessibilidade Daltonismo, no menu do usuário),
              Negativo (vermelho) ou Atenção (laranja). A anotação pode ficar baixa a ponto de mostrar uma linha só do texto.
            </li>
            <li>
              Foto envia uma imagem (JPEG, PNG, WebP ou GIF; reduzida a até 1600 px) e a inclui com a legenda embaixo, no destaque amarelo-ouro. A foto aumenta e
              diminui sempre na mesma proporção.
            </li>
            <li>
              Passe o mouse num bloco para ver os botões dele: a alça (arraste para mover), o gráfico (com ou sem, nos cards do Painel; sem ele, o card fica
              mais estreito e o restante igual), as opções do gráfico (os rótulos e o tipo, neste card ou em toda a aba; as cores seguem a Acessibilidade), a nota (nas anotações) e
              excluir. O canto de baixo, à direita, redimensiona o bloco, até um tamanho mínimo, para as informações não se amontoarem. Ao mover ou
              redimensionar, a grade aparece no fundo, bem clara, para alinhar os blocos.
            </li>
            <li>
              “Apresentar” mostra as páginas com blocos como slides, em tela inteira e sem o menu lateral, a partir da página aberta, com o departamento e o
              nome do slide (o da página) à esquerda do topo e o relatório e a logo da BPM à direita. Mova o mouse para ver os botões, no centro da base:
              recuar, avançar e sair (as setas do teclado também mudam o slide; Esc encerra). Passe o mouse num bloco para destacá-lo; clique nele para
              ampliá-lo na tela, com o fundo escurecido (um clique em qualquer lugar fecha). Num card do Painel, o clique no gráfico amplia só o gráfico, e
              na parte antes dele, só essa parte (o nome e os valores, como num card sem gráfico). Na apresentação, os textos não se selecionam.
            </li>
            <li>
              “Gravar” guarda as abas alteradas, com as páginas (sair sem gravar pergunta antes). “Finalizar Aba” grava a aba e a torna pública, só para
              leitura; “Reabrir Aba” a devolve à elaboração. O relatório fica Finalizado quando todas as abas estão finalizadas.
            </li>
          </ul>
        }
        sobre={
          <p>
            O relatório executivo (RE) de {relatorio.rotuloMes}: em cada departamento, as páginas com os cards do Painel de Bordo e dos Indicadores de
            Resultados Empresariais escolhidos pelo gestor, com as anotações dos pontos positivos, negativos e de atenção e as fotos. Criado por{" "}
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
          <div role="tablist" aria-label={`Páginas de ${aba.nome}`} className="flex min-w-0 flex-1 gap-1 overflow-x-auto overflow-y-hidden border-b border-gray-200">
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
                  title={editavel ? "Dois cliques para mudar o nome (o do slide)" : undefined}
                  className={classe}
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
      ) : daPagina.length === 0 ? (
        <p className="rounded-sm border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
          {editavel ? "A página está vazia: use “Adicionar”, na linha do título." : "Nada nesta página."}
        </p>
      ) : (
        <GradeDoRelatorio key={pagina?.id} relatorioId={relatorio.id} blocos={daPagina} dados={dados.data} editavel={editavel} cores={cores} tipo={tipo} linhas={linhasDaPagina()} onMudar={mudarPagina} />
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
 * amarelo-ouro (o menu dele leva aos outros relatórios), a situação do relatório e os departamentos, com o ícone de check
 * nos finalizados (a dica diz quem finalizou e quando).
 */
function BarraDoRelatorio({ relatorio, chave, onMudar }: { relatorio: Relatorio; chave: string; onMudar: (chave: string) => void }) {
  const router = useRouter();
  const lista = useQuery({ queryKey: ["relatorios-executivos"], queryFn: () => relatoriosExecutivosService.listar() });
  return (
    <nav aria-label="Departamentos do relatório" className="flex min-w-0 flex-col gap-1 rounded-sm border border-gray-200 bg-white px-2 py-1.5 xl:flex-row xl:items-center">
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
