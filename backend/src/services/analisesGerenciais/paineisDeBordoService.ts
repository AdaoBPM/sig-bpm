import { cp, rm } from "node:fs/promises";
import type { Readable } from "node:stream";

import { getPrismaClient } from "../../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { MarcacaoCenario, VisualizacaoPainel } from "../../generated/prisma/enums.js";
import { auditar, auditoriaEmSequencia } from "../auditoriaService.js";
import { carregarUsuariosAtivos, CODIGO_ADMINISTRADOR } from "../acesso/acesso.js";
import {
  arquivosDaPagina,
  arquivosDosSlides,
  comparacoesDas,
  competenciasFechadas,
  conferirVersao,
  dadosDosCards,
  limparArquivos,
  mudancaDasComparacoes,
  paginasCopiadas,
  paginasDe,
  pastaDaOrigem,
  pastaDosArquivos,
  resultadosDaTabela,
  rotuloMes,
  SlidesError,
  type PaginaDoRelatorio,
  type ProcessoDosSlides,
  type UsuarioDosSlides,
} from "./slides.js";

/**
 * Os Painéis de Bordo (31/10/2026, Análises Gerenciais; pedido do Adão): painéis com fins variados, feitos a partir dos
 * Relatórios Executivos — os mesmos blocos, a mesma edição, a mesma apresentação e as mesmas Configurações (slides.ts), para
 * as melhorias e as correções de um valerem no outro. Cada painel tem o nome, a visualização (Privado ou Público, como nos
 * cenários) e a competência, que é só mais um campo das Configurações (vários painéis por competência); e uma tela só,
 * Painel de Bordo, com as páginas (as abas). Como nos cenários, quem o criou (ou o Administrador) o altera e o exclui; desde
 * 01/11/2026 (pedido do Adão), também os editores que ele convida (o Compartilhar) o editam. A finalização (01/11/2026) é a
 * dos grupos dos relatórios: finalizado, o painel fica só para leitura; e o público só aparece para os demais que leem a
 * tela depois de finalizado.
 */

const PROCESSO: ProcessoDosSlides = "paineis-de-bordo";
const pastaDoPainel = (id: string) => pastaDosArquivos(PROCESSO, id);

/** A tela do painel (31/10/2026): a única, como um grupo dos relatórios; a chave é a da gravação e do Sumário. */
export const CHAVE_DA_TELA = "PAINEL";
const NOME_DA_TELA = "Painel de Bordo";

export const VISUALIZACOES_DO_PAINEL: Record<VisualizacaoPainel, string> = { PRIVADO: "Privado", PUBLICO: "Público" };

/** Os editores convidados do painel (01/11/2026), lidos junto com ele. */
const COM_EDITORES = { editores: { select: { usuarioId: true } } } satisfies Prisma.PainelDeBordoInclude;
type Painel = Prisma.PainelDeBordoGetPayload<{ include: typeof COM_EDITORES }>;
type Usuario = Pick<UsuarioDosSlides, "id" | "admin" | "edita">;

/** O dono do painel: quem o criou e o Administrador — o Geral das Configurações (o nome, a competência, a visualização e o Compartilhar) e a exclusão. */
export const donoDoPainel = (p: Pick<Painel, "criadoPorId">, u: Pick<Usuario, "id" | "admin">) => u.admin || p.criadoPorId === u.id;
/** Um editor convidado pelo dono (01/11/2026, o Compartilhar). */
export const editorDoPainel = (p: Pick<Painel, "editores">, u: Pick<Usuario, "id">) => p.editores.some((e) => e.usuarioId === u.id);
/**
 * Quem vê o painel: o dono e os editores convidados, sempre; os demais que leem a tela, só o público e finalizado
 * (01/11/2026; antes, o público em qualquer situação). A mesma regra na consulta: `visiveis`.
 */
export const vePainel = (p: Pick<Painel, "visualizacao" | "situacao" | "criadoPorId" | "editores">, u: Pick<Usuario, "id" | "admin">) =>
  donoDoPainel(p, u) || editorDoPainel(p, u) || (p.visualizacao === "PUBLICO" && p.situacao === "FINALIZADO");
/**
 * Quem edita o painel — as páginas, os Comparativos das Configurações, a finalização e a reabertura —: o dono e, desde
 * 01/11/2026, os editores convidados, com a permissão de editar a tela.
 */
export const alteraPainel = (p: Pick<Painel, "criadoPorId" | "editores">, u: Usuario) => u.edita && (donoDoPainel(p, u) || editorDoPainel(p, u));
/** Quem altera o Geral das Configurações (o nome, a competência, a visualização e o Compartilhar) e exclui o painel: só o dono. */
export const alteraGeral = (p: Pick<Painel, "criadoPorId">, u: Usuario) => u.edita && donoDoPainel(p, u);
/** O painel que aparece para os demais (os que não o criaram nem o editam): público e finalizado. */
export const VISIVEL_AOS_DEMAIS: Prisma.PainelDeBordoWhereInput = { visualizacao: "PUBLICO", situacao: "FINALIZADO" };
/** Os painéis que o usuário vê, na consulta. */
const visiveis = (u: UsuarioDosSlides): Prisma.PainelDeBordoWhereInput => (u.admin ? {} : { OR: [VISIVEL_AOS_DEMAIS, { criadoPorId: u.id }, { editores: { some: { usuarioId: u.id } } }] });

/** O painel que o usuário vê; o de outro usuário que ele não vê (privado ou em elaboração) fica como não encontrado. */
async function doPainel(id: string, u: UsuarioDosSlides) {
  const p = await getPrismaClient().painelDeBordo.findUnique({ where: { id }, include: COM_EDITORES });
  if (!p || !vePainel(p, u)) throw new SlidesError(404, "Painel não encontrado.");
  return p;
}

/** O painel que o usuário edita (o dono ou um editor convidado). */
async function painelAlteravel(id: string, u: UsuarioDosSlides) {
  const p = await doPainel(id, u);
  if (!alteraPainel(p, u)) throw new SlidesError(403, u.edita ? `O painel ${p.nome} é de ${p.criadoPorNome}: só quem o criou, os editores que ele convidou e o Administrador o alteram.` : "Seu perfil não edita os Painéis de Bordo.");
  return p;
}

/** O painel cujo Geral o usuário altera (só o dono: quem o criou ou o Administrador). */
async function painelDoDono(id: string, u: UsuarioDosSlides, oQue: string) {
  const p = await doPainel(id, u);
  if (!alteraGeral(p, u)) throw new SlidesError(403, u.edita ? `Só quem criou o painel ${p.nome} (${p.criadoPorNome}) ou o Administrador ${oQue}.` : "Seu perfil não edita os Painéis de Bordo.");
  return p;
}

/** A permissão que o convidado precisa ter: a de editar os Painéis de Bordo. */
const EDITA_OS_PAINEIS = "paineis_de_bordo:editar";

/** O painel em elaboração que o usuário altera (as páginas, a finalização e a exclusão): o finalizado se reabre antes. */
async function painelEmElaboracao(id: string, u: UsuarioDosSlides, acao: string) {
  const p = await painelAlteravel(id, u);
  if (p.situacao === "FINALIZADO") throw new SlidesError(409, `O painel ${p.nome} está finalizado: reabra-o para ${acao}.`);
  return p;
}

/** A competência do painel: uma das fechadas. */
async function exigirFechada(ano: number, mes: number) {
  const c = await getPrismaClient().competencia.findFirst({ where: { ano, mes }, select: { status: true } });
  if (c?.status !== "FECHADA") throw new SlidesError(400, `A competência ${rotuloMes(ano, mes)} não está fechada: os painéis são das competências fechadas.`);
}

const nomeValido = (nome: string) => {
  const n = nome.trim();
  if (!n) throw new SlidesError(400, "Dê um nome ao painel.");
  return n;
};

export const paineisDeBordoService = {
  /**
   * Os painéis que o usuário vê (a competência mais recente primeiro e, nela, pelo nome), com a visualização, a situação e
   * quem o criou; e as competências fechadas (o Novo Painel).
   */
  async listar(usuario: UsuarioDosSlides) {
    const [paineis, competencias] = await Promise.all([
      getPrismaClient().painelDeBordo.findMany({ where: visiveis(usuario), orderBy: [{ ano: "desc" }, { mes: "desc" }, { nome: "asc" }], omit: { paginas: true }, include: COM_EDITORES }),
      competenciasFechadas(),
    ]);
    return {
      paineis: paineis.map((p) => ({
        id: p.id,
        nome: p.nome,
        visualizacao: p.visualizacao,
        situacao: p.situacao,
        ano: p.ano,
        mes: p.mes,
        rotuloMes: rotuloMes(p.ano, p.mes),
        criadoPor: p.criadoPorNome,
        criadoEm: p.criadoEm,
        atualizadoEm: p.atualizadoEm,
        meu: p.criadoPorId === usuario.id,
        // Compartilhado com o usuário (01/11/2026): ele é um dos editores convidados.
        compartilhado: editorDoPainel(p, usuario),
        podeAlterar: alteraPainel(p, usuario),
      })),
      competencias,
    };
  },

  /**
   * Cria um painel (quem edita a tela) numa competência fechada: vazio ou, com `copiarDe`, com as páginas de outro painel
   * que o usuário vê — os cards (com os dados da competência nova), as fotos (copiadas para a pasta do painel novo), as
   * anotações e as comparações das Configurações; sem "Manter Imagens e Anotações", como no Importar de dos relatórios.
   */
  async criar(dados: { nome: string; visualizacao: VisualizacaoPainel; ano: number; mes: number; copiarDe?: string | null; manterImagensEAnotacoes?: boolean }, usuario: UsuarioDosSlides) {
    if (!usuario.edita) throw new SlidesError(403, "Seu perfil não cria Painéis de Bordo.");
    const nome = nomeValido(dados.nome);
    await exigirFechada(dados.ano, dados.mes);
    const origem = dados.copiarDe ? await doPainel(dados.copiarDe, usuario) : null;
    const manter = dados.manterImagensEAnotacoes !== false;
    const paginas = origem ? paginasCopiadas(paginasDe(origem.paginas), manter) : paginasDe([]);
    const p = await getPrismaClient().painelDeBordo.create({
      data: {
        nome,
        visualizacao: dados.visualizacao,
        ano: dados.ano,
        mes: dados.mes,
        paginas: paginas as Prisma.InputJsonValue,
        paginasPor: origem ? usuario.nome : null,
        criadoPorId: usuario.id,
        criadoPorNome: usuario.nome,
        // As comparações da origem, como no Importar de dos relatórios: o cenário de comparação no mesmo exercício e a
        // Comparação PROVA (as marcações) de qualquer um.
        cenarioComparadoId: origem && origem.ano === dados.ano ? origem.cenarioComparadoId : null,
        comparacaoProva: origem?.comparacaoProva ?? [],
      },
    });
    // As fotos da origem vão para a pasta do painel novo (a origem pode ser excluída depois).
    if (origem && paginas.some((x) => arquivosDaPagina(x).length)) await cp(pastaDoPainel(origem.id), pastaDoPainel(p.id), { recursive: true }).catch(() => undefined);
    await auditar({
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      acao: "CRIACAO",
      entidade: "painel_de_bordo",
      entidadeId: p.id,
      metadados: { nome, mes: rotuloMes(p.ano, p.mes), visualizacao: VISUALIZACOES_DO_PAINEL[p.visualizacao], copiadoDe: origem?.nome ?? null, imagensEAnotacoes: origem ? manter : null },
    });
    return { id: p.id, nome };
  },

  /**
   * O painel, no formato de um relatório com uma aba só (a tela Painel de Bordo; o título dela, o dos slides, é o nome do
   * painel), para a mesma edição: as páginas, a situação e o que o usuário pode fazer (finalizado, só reabrir).
   */
  async obter(id: string, usuario: UsuarioDosSlides) {
    const p = await doPainel(id, usuario);
    const podeAlterar = alteraPainel(p, usuario);
    const emElaboracao = p.situacao === "EM_ELABORACAO";
    return {
      id: p.id,
      nome: p.nome,
      visualizacao: p.visualizacao,
      ano: p.ano,
      mes: p.mes,
      rotuloMes: rotuloMes(p.ano, p.mes),
      situacao: p.situacao,
      criadoPor: p.criadoPorNome,
      criadoEm: p.criadoEm,
      abas: [
        {
          chave: CHAVE_DA_TELA,
          nome: NOME_DA_TELA,
          titulo: p.nome,
          situacao: p.situacao,
          visivel: true,
          paginas: paginasDe(p.paginas),
          podeEditar: podeAlterar && emElaboracao,
          podeReabrir: podeAlterar && !emElaboracao,
          atualizadoPor: p.paginasPor,
          atualizadoEm: p.paginasEm,
          finalizadoPor: p.finalizadoPor,
          finalizadoEm: p.finalizadoEm,
        },
      ],
      // Como nos relatórios, o finalizado não se exclui: reabre-se antes. Só o dono o exclui (01/11/2026).
      podeExcluir: alteraGeral(p, usuario) && emElaboracao,
      podeAlterar,
    };
  },

  /** Os dados dos cards (veja dadosDosCards, nos slides), até o mês do painel. */
  async dados(id: string, usuario: UsuarioDosSlides) {
    return dadosDosCards(await doPainel(id, usuario));
  },

  /** A tabela de Resultados de uma visão, para os blocos de tabela (veja resultadosDaTabela, nos slides). */
  async resultados(id: string, visao: 0 | 1 | 2 | 3 | 4 | 5, usuario: UsuarioDosSlides) {
    return resultadosDaTabela(await doPainel(id, usuario), visao);
  },

  /**
   * As Configurações do painel: o nome, a visualização e a competência (com as competências fechadas, e a do painel, se ela
   * foi reaberta), a Comparação Padrão e a Comparação PROVA (as dos relatórios) e se o usuário as altera.
   */
  async configuracoes(id: string, usuario: UsuarioDosSlides) {
    const p = await doPainel(id, usuario);
    const [comparacoes, fechadas] = await Promise.all([comparacoesDas(p), competenciasFechadas()]);
    const competencias = fechadas.some((c) => c.ano === p.ano && c.mes === p.mes) ? fechadas : [{ ano: p.ano, mes: p.mes, rotulo: `${rotuloMes(p.ano, p.mes)} (reaberta)` }, ...fechadas];
    // Os Comparativos, quem edita o painel (os editores convidados também); o Geral, só o dono (01/11/2026).
    return { ...comparacoes, nome: p.nome, visualizacao: p.visualizacao, mes: p.mes, competencias, criadoPor: p.criadoPorNome, podeEditar: alteraPainel(p, usuario), podeEditarGeral: alteraGeral(p, usuario) };
  },

  /**
   * Grava as Configurações: o nome, a visualização e a competência (uma fechada), do Geral, só o dono; as comparações (os
   * Comparativos), também os editores convidados (01/11/2026). O que não vier fica como está.
   */
  async gravarConfiguracoes(
    id: string,
    dados: { nome?: string; visualizacao?: VisualizacaoPainel; ano?: number; mes?: number; cenarioComparadoId?: string | null; comparacaoProva?: MarcacaoCenario[] },
    usuario: UsuarioDosSlides,
  ) {
    const p = await painelAlteravel(id, usuario);
    if ((dados.nome !== undefined || dados.visualizacao !== undefined || dados.ano !== undefined) && !alteraGeral(p, usuario)) {
      throw new SlidesError(403, `Só quem criou o painel ${p.nome} (${p.criadoPorNome}) ou o Administrador muda o nome, a competência e a visualização dele.`);
    }
    if (dados.ano !== undefined && dados.mes !== undefined && (dados.ano !== p.ano || dados.mes !== p.mes)) await exigirFechada(dados.ano, dados.mes);
    const muda = {
      ...(dados.nome !== undefined ? { nome: nomeValido(dados.nome) } : {}),
      ...(dados.visualizacao !== undefined ? { visualizacao: dados.visualizacao } : {}),
      ...(dados.ano !== undefined && dados.mes !== undefined ? { ano: dados.ano, mes: dados.mes } : {}),
      ...(await mudancaDasComparacoes(dados)),
    };
    await getPrismaClient().painelDeBordo.update({ where: { id }, data: muda });
    await auditar({
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      acao: "ALTERACAO",
      entidade: "painel_de_bordo",
      entidadeId: id,
      antes: Object.fromEntries(Object.keys(muda).map((k) => [k, p[k as keyof typeof muda]])),
      depois: muda,
      metadados: { nome: muda.nome ?? p.nome, mes: rotuloMes(muda.ano ?? p.ano, muda.mes ?? p.mes), configuracoes: true },
    });
    return this.configuracoes(id, usuario);
  },

  /**
   * Grava as páginas da tela Painel de Bordo, com a conferência da versão dos relatórios (23/10/2026): se outro gravou
   * depois que o usuário abriu o painel, recusa (409 CONFLITO), a não ser com `forcar`.
   */
  async gravarPaginas(id: string, paginas: PaginaDoRelatorio[], usuario: UsuarioDosSlides, opcoes: { versao?: string; forcar?: boolean } = {}) {
    const p = await painelEmElaboracao(id, usuario, "alterar");
    conferirVersao({ em: p.paginasEm, por: p.paginasPor }, opcoes, { chave: CHAVE_DA_TELA, nome: NOME_DA_TELA }, "o painel");
    const gravadas = paginas.length ? paginas : paginasDe([]);
    await getPrismaClient().painelDeBordo.update({ where: { id }, data: { paginas: gravadas as Prisma.InputJsonValue, paginasPor: usuario.nome, paginasEm: new Date() } });
    // Na Auditoria, como nos relatórios: as gravações seguidas da mesma pessoa numa entrada só, a mais recente.
    auditoriaEmSequencia.registrar(`${id}|${CHAVE_DA_TELA}`, {
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      acao: "GRAVACAO_PAINEL",
      entidade: "painel_de_bordo",
      entidadeId: id,
      metadados: { nome: p.nome, mes: rotuloMes(p.ano, p.mes), paginas: paginas.length, ...(opcoes.forcar ? { porCima: true } : {}) },
    });
    await limparArquivos(pastaDoPainel(id), gravadas);
    return this.obter(id, usuario);
  },

  /**
   * Finaliza o painel (01/11/2026, pedido do Adão; como um grupo dos relatórios): fica só para leitura, e o público aparece
   * para os demais que leem a tela. Ou o reabre: volta à elaboração, e some de novo para os demais. Quem o criou ou o
   * Administrador.
   */
  async mudarSituacao(id: string, acao: "finalizar" | "reabrir", usuario: UsuarioDosSlides) {
    const p = await painelAlteravel(id, usuario);
    if (acao === "finalizar" && p.situacao === "FINALIZADO") throw new SlidesError(409, `O painel ${p.nome} já está finalizado.`);
    if (acao === "reabrir" && p.situacao !== "FINALIZADO") throw new SlidesError(409, `O painel ${p.nome} não está finalizado.`);
    // As gravações em sequência do painel entram na Auditoria antes.
    await auditoriaEmSequencia.encerrar(`${id}|`);
    await getPrismaClient().painelDeBordo.update({
      where: { id },
      data: acao === "finalizar" ? { situacao: "FINALIZADO", finalizadoPor: usuario.nome, finalizadoEm: new Date() } : { situacao: "EM_ELABORACAO", finalizadoPor: null, finalizadoEm: null },
    });
    await auditar({
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      acao: acao === "finalizar" ? "FINALIZACAO_PAINEL" : "REABERTURA_PAINEL",
      entidade: "painel_de_bordo",
      entidadeId: id,
      metadados: { nome: p.nome, mes: rotuloMes(p.ano, p.mes), visualizacao: VISUALIZACOES_DO_PAINEL[p.visualizacao] },
    });
    return this.obter(id, usuario);
  },

  /** Guarda uma foto do painel (quem o altera; até 10 MB, JPEG, PNG, WebP ou GIF) e devolve o nome do arquivo. */
  async salvarFoto(id: string, conteudo: Buffer, tipo: string, usuario: UsuarioDosSlides) {
    await painelAlteravel(id, usuario);
    return arquivosDosSlides.salvarFoto(pastaDoPainel(id), conteudo, tipo);
  },

  async lerFoto(id: string, arquivo: string, usuario: UsuarioDosSlides) {
    await doPainel(id, usuario);
    return arquivosDosSlides.lerFoto(pastaDoPainel(id), arquivo);
  },

  /** Guarda um vídeo do painel (quem o altera; até 200 MB), gravado no disco enquanto chega, e devolve o nome do arquivo. */
  async salvarVideo(id: string, corpo: Readable, tipo: string, tamanho: number | null, usuario: UsuarioDosSlides) {
    await painelAlteravel(id, usuario);
    return arquivosDosSlides.salvarVideo(pastaDoPainel(id), corpo, tipo, tamanho);
  },

  async lerVideo(id: string, arquivo: string, usuario: UsuarioDosSlides) {
    await doPainel(id, usuario);
    return arquivosDosSlides.lerVideo(pastaDoPainel(id), arquivo);
  },

  /** Copia fotos e vídeos de outro documento (um painel ou um relatório executivo) para a pasta deste, ao colar blocos dele. */
  async copiarArquivos(id: string, origem: { processo: ProcessoDosSlides; id: string }, arquivos: string[], usuario: UsuarioDosSlides) {
    await painelAlteravel(id, usuario);
    return arquivosDosSlides.copiar(pastaDoPainel(id), await pastaDaOrigem(origem.processo, origem.id, usuario), arquivos);
  },

  /**
   * O Compartilhar (01/11/2026, pedido do Adão; Configurações / Geral): os editores convidados — com o perfil, quem convidou
   * e quando e se ainda editam (ativos e com a permissão de editar os Painéis de Bordo) — e, para o dono, os usuários que ele
   * pode convidar: os ativos com essa permissão, menos quem criou o painel, os Administradores (que já editam todos) e os já
   * convidados.
   */
  async compartilhamento(id: string, usuario: UsuarioDosSlides) {
    const p = await doPainel(id, usuario);
    const podeCompartilhar = alteraGeral(p, usuario);
    const [editores, ativos] = await Promise.all([
      getPrismaClient().painelDeBordoEditor.findMany({ where: { painelId: id }, include: { usuario: { select: { nome: true, email: true } } }, orderBy: { convidadoEm: "asc" } }),
      carregarUsuariosAtivos(),
    ]);
    const doId = new Map(ativos.map((a) => [a.sub, a]));
    const convidados = new Set(editores.map((e) => e.usuarioId));
    return {
      podeCompartilhar,
      criadoPor: p.criadoPorNome,
      editores: editores.map((e) => {
        const a = doId.get(e.usuarioId);
        return { id: e.usuarioId, nome: e.usuario.nome, email: e.usuario.email, perfil: a?.perfil.nome ?? null, convidadoPor: e.convidadoPor, convidadoEm: e.convidadoEm, edita: !!a?.permissions.includes(EDITA_OS_PAINEIS) };
      }),
      candidatos: podeCompartilhar
        ? ativos
            .filter((a) => a.permissions.includes(EDITA_OS_PAINEIS) && a.perfil.codigo !== CODIGO_ADMINISTRADOR && a.sub !== p.criadoPorId && !convidados.has(a.sub))
            .map((a) => ({ id: a.sub, nome: a.nome, email: a.email, perfil: a.perfil.nome }))
            .sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"))
        : [],
    };
  },

  /** Convida usuários para editar o painel (só o dono): os da lista de candidatos do Compartilhar. */
  async compartilhar(id: string, usuarios: string[], usuario: UsuarioDosSlides) {
    const p = await painelDoDono(id, usuario, "compartilha o painel");
    const { candidatos } = await this.compartilhamento(id, usuario);
    const validos = candidatos.filter((c) => usuarios.includes(c.id));
    if (validos.length !== new Set(usuarios).size) throw new SlidesError(400, "Convide só usuários ativos com a permissão de editar os Painéis de Bordo (e que ainda não editam o painel).");
    await getPrismaClient().painelDeBordoEditor.createMany({ data: validos.map((c) => ({ painelId: id, usuarioId: c.id, convidadoPor: usuario.nome })), skipDuplicates: true });
    await auditar({
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      acao: "COMPARTILHAMENTO_PAINEL",
      entidade: "painel_de_bordo",
      entidadeId: id,
      metadados: { nome: p.nome, mes: rotuloMes(p.ano, p.mes), usuarios: validos.map((c) => c.nome) },
    });
    return this.compartilhamento(id, usuario);
  },

  /** Tira um editor convidado do painel (só o dono): ele deixa de editá-lo (e de vê-lo, se o painel não aparece aos demais). */
  async removerEditor(id: string, editorId: string, usuario: UsuarioDosSlides) {
    const p = await painelDoDono(id, usuario, "muda o compartilhamento do painel");
    const chave = { painelId_usuarioId: { painelId: id, usuarioId: editorId } };
    const e = await getPrismaClient().painelDeBordoEditor.findUnique({ where: chave, include: { usuario: { select: { nome: true } } } });
    if (!e) throw new SlidesError(404, "O usuário não é editor do painel.");
    await getPrismaClient().painelDeBordoEditor.delete({ where: chave });
    await auditar({
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      acao: "REMOCAO_EDITOR_PAINEL",
      entidade: "painel_de_bordo",
      entidadeId: id,
      metadados: { nome: p.nome, mes: rotuloMes(p.ano, p.mes), usuarios: [e.usuario.nome] },
    });
    return this.compartilhamento(id, usuario);
  },

  /** Exclui o painel (quem o criou ou o Administrador), em elaboração, com as fotos e os vídeos dele. */
  async excluir(id: string, usuario: UsuarioDosSlides) {
    const p = await painelDoDono(id, usuario, "exclui o painel");
    if (p.situacao === "FINALIZADO") throw new SlidesError(409, `O painel ${p.nome} está finalizado: reabra-o para excluir.`);
    await auditoriaEmSequencia.encerrar(`${id}|`);
    await getPrismaClient().painelDeBordo.delete({ where: { id } });
    await rm(pastaDoPainel(id), { recursive: true, force: true });
    await auditar({ usuarioId: usuario.id, usuarioNome: usuario.nome, acao: "EXCLUSAO", entidade: "painel_de_bordo", entidadeId: id, metadados: { nome: p.nome, mes: rotuloMes(p.ano, p.mes) } });
    return { excluido: true };
  },
};
