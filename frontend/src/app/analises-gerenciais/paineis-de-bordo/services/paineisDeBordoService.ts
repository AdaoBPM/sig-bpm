import { api } from "@/lib/api";

import { servicoDosSlides, type Situacao, type VisualizacaoDoPainel } from "@/app/analises-gerenciais/relatorios-executivos/services/relatoriosExecutivosService";

/**
 * Os Painéis de Bordo (31/10/2026, Análises Gerenciais; pedido do Adão): painéis com fins variados, feitos a partir dos
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
  ano: number;
  mes: number;
  rotuloMes: string;
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
 * editam (ativos e com a permissão de editar os Painéis de Bordo) — e, para quem criou o painel (ou o Administrador), os
 * usuários que ele pode convidar.
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

const base = "/proxy/paineis-de-bordo";
export const paineisDeBordoService = {
  ...servicoDosSlides("paineis-de-bordo"),
  listar: async () => (await api.get<{ data: ListaDePaineis }>(base)).data.data,
  /**
   * Cria um painel numa competência fechada: vazio ou, com `copiarDe`, com as páginas de outro painel (sem
   * `manterImagensEAnotacoes`, como no Importar de dos relatórios: só os cards e as Imagens de Fundo).
   */
  criar: async (dados: { nome: string; visualizacao: VisualizacaoDoPainel; ano: number; mes: number; copiarDe: string | null; manterImagensEAnotacoes: boolean }) =>
    (await api.post<{ data: { id: string; nome: string } }>(base, dados)).data.data,
  compartilhamento: async (id: string) => (await api.get<{ data: Compartilhamento }>(`${base}/${id}/compartilhamento`)).data.data,
  /** Convida os usuários para editar o painel (só quem o criou ou o Administrador). */
  compartilhar: async (id: string, usuarios: string[]) => (await api.post<{ data: Compartilhamento }>(`${base}/${id}/compartilhamento`, { usuarios })).data.data,
  removerEditor: async (id: string, usuario: string) => (await api.delete<{ data: Compartilhamento }>(`${base}/${id}/compartilhamento/${usuario}`)).data.data,
};
