import { api } from "@/lib/api";

import { servicoDosSlides, type Situacao, type VisualizacaoDoPainel } from "@/app/analises-gerenciais/relatorios-executivos/services/relatoriosExecutivosService";

/**
 * Painéis e Apresentações (31/10/2026, Análises Gerenciais; pedido do Adão): painéis com fins variados, feitos a partir dos
 * Relatórios Executivos — as mesmas chamadas dos slides (servicoDosSlides), na rota dos painéis —, cada um com o nome, a
 * visualização (Privado ou Público, como nos cenários), a competência (vários painéis por competência) e, desde 01/11/2026,
 * a situação (Em Elaboração ou Finalizado, como os grupos dos relatórios).
 */
export type ResumoDoPainel = {
  id: string;
  nome: string;
  visualizacao: VisualizacaoDoPainel;
  /** Em Elaboração ou Finalizado (01/11/2026): o público só aparece para os demais finalizado. */
  situacao: Situacao;
  /** A competência: a do painel ou, no automático, a última fechada, a que ele mostra. */
  ano: number;
  mes: number;
  rotuloMes: string;
  /** A competência automática (03/11/2026): o painel mostra sempre a última competência fechada. */
  automatica: boolean;
  criadoPor: string;
  criadoEm: string;
  atualizadoEm: string;
  /** O painel é do usuário (quem o criou). */
  meu: boolean;
  /** Compartilhado com o usuário (01/11/2026): ele é um dos editores convidados. */
  compartilhado: boolean;
  /** O usuário o altera: quem o criou ou o Administrador, com a permissão de editar a tela. */
  podeAlterar: boolean;
};
export type ListaDePaineis = {
  paineis: ResumoDoPainel[];
  /** As competências fechadas, a mais recente primeiro (o Novo Painel). */
  competencias: Array<{ ano: number; mes: number; rotulo: string }>;
};

/**
 * O Compartilhar (01/11/2026, Configurações / Geral): os editores convidados — o perfil, quem convidou e quando e se ainda
 * editam (ativos e com a permissão de editar Painéis e Apresentações) — e, para quem muda o Geral (quem criou o painel, o
 * Administrador e, desde 03/11/2026, com o painel em elaboração, os editores convidados), os usuários que ele pode convidar.
 */
export type UsuarioDoCompartilhamento = { id: string; nome: string; email: string; perfil: string | null };
export type Compartilhamento = {
  podeCompartilhar: boolean;
  criadoPor: string;
  editores: Array<UsuarioDoCompartilhamento & { convidadoPor: string; convidadoEm: string; edita: boolean }>;
  candidatos: UsuarioDoCompartilhamento[];
};

/** O nome de cada visualização. */
export const ROTULO_DA_VISUALIZACAO: Record<VisualizacaoDoPainel, string> = { PRIVADO: "Privado", PUBLICO: "Público" };

/** A competência do painel na lista e na barra (03/11/2026): o mês ou, no automático, “Automática · Outubro/2026”. */
export const rotuloDaCompetencia = (p: { rotuloMes: string; automatica?: boolean }) => (p.automatica ? `Automática · ${p.rotuloMes}` : p.rotuloMes);

/** O valor da competência automática nas listas de escolha (o Novo Painel e as Configurações). */
export const AUTOMATICA = "automatica";

/** O que a competência automática faz (03/11/2026), no Novo Painel e nas Configurações. */
export const TEXTO_DA_AUTOMATICA =
  "O painel mostra sempre a última competência fechada: quando outra fechar, ela entra sozinha ao abrir ou recarregar o painel (se a última for reaberta, vale a anterior até ela fechar de novo). As anotações e os textos livres não mudam com a competência.";

const base = "/proxy/paineis-de-bordo";
export const paineisDeBordoService = {
  ...servicoDosSlides("paineis-de-bordo"),
  listar: async () => (await api.get<{ data: ListaDePaineis }>(base)).data.data,
  /**
   * Cria um painel numa competência fechada ou, com `automatica` (03/11/2026), na competência automática: vazio ou, com
   * `copiarDe`, com as páginas de outro painel (sem `manterImagensEAnotacoes`, como no Importar de dos relatórios: só os
   * cards e as Imagens de Fundo).
   */
  criar: async (
    dados: { nome: string; visualizacao: VisualizacaoDoPainel; copiarDe: string | null; manterImagensEAnotacoes: boolean } & ({ ano: number; mes: number } | { automatica: true }),
  ) =>
    (await api.post<{ data: { id: string; nome: string } }>(base, dados)).data.data,
  compartilhamento: async (id: string) => (await api.get<{ data: Compartilhamento }>(`${base}/${id}/compartilhamento`)).data.data,
  /** Convida os usuários para editar o painel (só quem o criou ou o Administrador). */
  compartilhar: async (id: string, usuarios: string[]) => (await api.post<{ data: Compartilhamento }>(`${base}/${id}/compartilhamento`, { usuarios })).data.data,
  /** Tira um editor do painel; o editor que tira a si mesmo deixa de vê-lo (`saiu`). */
  removerEditor: async (id: string, usuario: string) => (await api.delete<{ data: Compartilhamento | { saiu: true } }>(`${base}/${id}/compartilhamento/${usuario}`)).data.data,
};
