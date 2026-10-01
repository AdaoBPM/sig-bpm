import type { LucideIcon } from "lucide-react";
import { ArrowLeftRight, BadgeDollarSign, Building2, CalendarDays, Columns3, GitCompareArrows, History, KeyRound, Landmark, ListTree, Percent, Shuffle, Table2, Users } from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  /** Permissão para o item aparecer no menu (e para a tela abrir). */
  permission?: string;
};

export type NavGrupo = { titulo: string; itens: NavItem[] };

export const navGrupos: NavGrupo[] = [
  {
    titulo: "Operação",
    itens: [
      { title: "Competências", href: "/competencias", icon: CalendarDays },
      { title: "Divergências", href: "/divergencias", icon: GitCompareArrows, permission: "divergencia:ver" },
    ],
  },
  {
    titulo: "Cadastros",
    itens: [
      { title: "Centros de custo", href: "/cadastros/centros-custo", icon: Building2, permission: "cadastros:ver" },
      { title: "Contas de resultado", href: "/cadastros/contas-resultado", icon: Table2, permission: "cadastros:ver" },
      { title: "Estrutura da DRE", href: "/cadastros/estrutura-dre", icon: ListTree, permission: "cadastros:ver" },
      { title: "Reclassificações", href: "/cadastros/reclassificacoes", icon: Shuffle, permission: "cadastros:ver" },
      { title: "Preços do contrato", href: "/cadastros/precos-contrato", icon: BadgeDollarSign, permission: "cadastros:ver" },
      { title: "Unidades", href: "/cadastros/unidades", icon: Landmark, permission: "cadastros:ver" },
      { title: "Regras de rateio", href: "/cadastros/regras-rateio", icon: Percent, permission: "cadastros:ver" },
      { title: "Tipos de movimento", href: "/cadastros/tipos-movimento", icon: ArrowLeftRight, permission: "cadastros:ver" },
      { title: "Tabela de estacas", href: "/cadastros/tabela-estacas", icon: Columns3, permission: "cadastros:ver" },
    ],
  },
  {
    titulo: "Administração",
    itens: [
      { title: "Usuários", href: "/usuarios", icon: Users, permission: "usuarios:ver" },
      { title: "Perfis", href: "/perfis", icon: KeyRound, permission: "usuarios:ver" },
      { title: "Auditoria", href: "/auditoria", icon: History, permission: "auditoria:ver" },
    ],
  },
];

/**
 * Permissão de cada tela (Passo 22). O menu esconde o que o usuário não
 * alcança, e o layout recusa a tela aberta pela URL; a segurança de fato é a
 * do backend, que recusa os dados. A primeira regra que casar vale.
 */
const PERMISSAO_DA_TELA: Array<[RegExp, string]> = [
  [/^\/cadastros(\/|$)/, "cadastros:ver"],
  [/^\/(usuarios|perfis)(\/|$)/, "usuarios:ver"],
  [/^\/auditoria(\/|$)/, "auditoria:ver"],
  [/^\/divergencias(\/|$)/, "divergencia:ver"],
  [/^\/competencias\/[^/]+\/importar/, "importacao:ver"],
  [/^\/competencias\/[^/]+\/classificacao/, "classificacao:ver"],
  [/^\/competencias\/[^/]+\/lancamentos-manuais/, "lancamentos_manuais:ver"],
  [/^\/competencias\/[^/]+\/listas/, "listas_operacionais:ver"],
  [/^\/competencias\/[^/]+\/(receita-previa|rateios|estoque|conferencia-planilha)/, "apuracao:ver"],
  [/^\/competencias\/[^/]+\/dre/, "dre:ver"],
  // Telas de demonstração herdadas do molde: fora do SIG, ninguém tem a permissão.
  [/^\/(dashboard|pedidos)(\/|$)/, "molde:ver"],
];

export function permissaoDaTela(pathname: string): string | null {
  return PERMISSAO_DA_TELA.find(([r]) => r.test(pathname))?.[1] ?? null;
}

export const pageTitles: Record<string, string> = {
  "/competencias": "Competências",
  "/cadastros/centros-custo": "Centros de custo",
  "/cadastros/contas-resultado": "Contas de resultado",
  "/cadastros/estrutura-dre": "Estrutura da DRE",
  "/cadastros/reclassificacoes": "Reclassificações de conta",
  "/cadastros/precos-contrato": "Preços do contrato",
  "/cadastros/unidades": "Unidades de negócio",
  "/cadastros/regras-rateio": "Regras de rateio",
  "/cadastros/tipos-movimento": "Tipos de movimento",
  "/cadastros/tabela-estacas": "Tabela de estacas",
  "/usuarios": "Usuários",
  "/perfis": "Perfis de usuário",
  "/auditoria": "Auditoria",
  "/divergencias": "Divergências",
};

export function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];

  const match = Object.entries(pageTitles).find(([path]) => pathname.startsWith(`${path}/`));
  return match?.[1] ?? "Área restrita";
}
