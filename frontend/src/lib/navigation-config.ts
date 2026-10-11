import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  BadgeDollarSign,
  Building2,
  CalendarDays,
  ClipboardList,
  Columns3,
  Database,
  FileBarChart,
  Gauge,
  History,
  KeyRound,
  Landmark,
  LayoutDashboard,
  ListOrdered,
  ListTree,
  Percent,
  Rows3,
  Shuffle,
  Table2,
  UserCog,
  Users,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  /** Permissão para o item aparecer no menu (e para a tela abrir). */
  permission?: string;
  /**
   * Um grupo de telas da mesma finalidade: o menu mostra só o grupo, que abre
   * na primeira tela que o perfil alcança, e a barra no topo troca de tela.
   */
  telas?: NavItem[];
};

export type NavGrupo = { titulo: string; itens: NavItem[] };

export const navGrupos: NavGrupo[] = [
  {
    titulo: "Apuração dos Resultados",
    itens: [
      {
        title: "Resultados e Indicadores",
        href: "/relatorios/resultados",
        icon: FileBarChart,
        telas: [
          { title: "Resultados", href: "/relatorios/resultados", icon: ListOrdered, permission: "dre:ver" },
          { title: "Indicadores", href: "/relatorios/indicadores", icon: Gauge, permission: "dre:ver" },
          { title: "Painel de Bordo", href: "/relatorios/painel", icon: LayoutDashboard, permission: "dre:ver" },
        ],
      },
      { title: "Fechamento Mensal", href: "/competencias", icon: CalendarDays },
      {
        title: "Cadastros da Apuração",
        href: "/cadastros/reclassificacoes",
        icon: ClipboardList,
        telas: [
          { title: "Reclassificações", href: "/cadastros/reclassificacoes", icon: Shuffle, permission: "cadastros:ver" },
          { title: "Preços do Contrato", href: "/cadastros/precos-contrato", icon: BadgeDollarSign, permission: "cadastros:ver" },
          { title: "Tipos de Movimento", href: "/cadastros/tipos-movimento", icon: ArrowLeftRight, permission: "cadastros:ver" },
          { title: "Tabela de Estacas", href: "/cadastros/tabela-estacas", icon: Columns3, permission: "cadastros:ver" },
        ],
      },
    ],
  },
  {
    titulo: "Controladoria",
    itens: [
      {
        title: "Cadastros da Controladoria",
        href: "/cadastros/unidades",
        icon: Database,
        telas: [
          { title: "Unidades", href: "/cadastros/unidades", icon: Landmark, permission: "cadastros:ver" },
          { title: "Linhas", href: "/cadastros/linhas", icon: Rows3, permission: "cadastros:ver" },
          { title: "Centros de Custo", href: "/cadastros/centros-custo", icon: Building2, permission: "cadastros:ver" },
          { title: "Contas de Resultado", href: "/cadastros/contas-resultado", icon: Table2, permission: "cadastros:ver" },
          { title: "Estrutura dos Indicadores", href: "/cadastros/estrutura-indicadores", icon: Gauge, permission: "cadastros:ver" },
          { title: "Regras de Rateio", href: "/cadastros/regras-rateio", icon: Percent, permission: "cadastros:ver" },
          { title: "Estrutura da DRE", href: "/cadastros/estrutura-dre", icon: ListTree, permission: "cadastros:ver" },
        ],
      },
      {
        title: "Controle de Usuários",
        href: "/usuarios",
        icon: UserCog,
        telas: [
          { title: "Usuários", href: "/usuarios", icon: Users, permission: "usuarios:ver" },
          { title: "Perfis", href: "/perfis", icon: KeyRound, permission: "usuarios:ver" },
          { title: "Auditoria", href: "/auditoria", icon: History, permission: "auditoria:ver" },
        ],
      },
    ],
  },
];

const naTela = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/**
 * O item do menu com as telas que o perfil alcança: um grupo de telas abre na
 * primeira delas e some quando nenhuma é alcançada. Null: o item não aparece.
 */
export function itemPermitido(item: NavItem, pode: (p: string) => boolean): NavItem | null {
  if (!item.telas) return !item.permission || pode(item.permission) ? item : null;
  const telas = item.telas.filter((t) => !t.permission || pode(t.permission));
  return telas.length > 0 ? { ...item, href: telas[0].href, telas } : null;
}

/** O grupo de telas da tela aberta, com a tela: a barra no topo e o caminho usam os dois. */
export function grupoDaTela(pathname: string): { grupo: NavItem; tela: NavItem } | null {
  for (const g of navGrupos) {
    for (const item of g.itens) {
      const tela = item.telas?.find((t) => naTela(pathname, t.href));
      if (tela) return { grupo: item, tela };
    }
  }
  return null;
}

/** O item do menu aceso: o da tela, ou o grupo de telas que a contém. */
export function itemAtivo(pathname: string, item: NavItem): boolean {
  return item.telas ? item.telas.some((t) => naTela(pathname, t.href)) : naTela(pathname, item.href);
}

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
  [/^\/relatorios(\/|$)/, "dre:ver"],
  [/^\/competencias\/[^/]+\/divergencias/, "divergencia:ver"],
  [/^\/competencias\/[^/]+\/importar/, "importacao:ver"],
  [/^\/competencias\/[^/]+\/classificacao/, "classificacao:ver"],
  [/^\/competencias\/[^/]+\/lancamentos-manuais/, "lancamentos_manuais:ver"],
  [/^\/competencias\/[^/]+\/listas/, "listas_operacionais:ver"],
  [/^\/competencias\/[^/]+\/(receita-previa|rateios|estoque|conferencia-planilha)/, "apuracao:ver"],
  [/^\/competencias\/[^/]+\/dre/, "dre:ver"],
  [/^\/competencias\/[^/]+\/indicadores/, "dre:ver"],
];

export function permissaoDaTela(pathname: string): string | null {
  return PERMISSAO_DA_TELA.find(([r]) => r.test(pathname))?.[1] ?? null;
}

export const pageTitles: Record<string, string> = {
  "/competencias": "Fechamento Mensal",
  "/cadastros/centros-custo": "Centros de Custo",
  "/cadastros/contas-resultado": "Contas de Resultado",
  "/cadastros/estrutura-dre": "Estrutura da DRE",
  "/cadastros/reclassificacoes": "Reclassificações de Conta",
  "/cadastros/precos-contrato": "Preços do Contrato",
  "/cadastros/unidades": "Unidades de Negócio",
  "/cadastros/linhas": "Linhas",
  "/cadastros/estrutura-indicadores": "Estrutura dos Indicadores",
  "/cadastros/regras-rateio": "Regras de Rateio",
  "/cadastros/tipos-movimento": "Tipos de Movimento",
  "/cadastros/tabela-estacas": "Tabela de Estacas",
  "/usuarios": "Usuários",
  "/perfis": "Perfis de Usuário",
  "/auditoria": "Auditoria",
  "/divergencias": "Divergências",
  "/relatorios/resultados": "Resultados",
  "/relatorios/indicadores": "Indicadores",
  "/relatorios/painel": "Painel de Bordo",
};

/** Uma parte do caminho no topo da tela; sem href, é a tela atual. */
export type Migalha = { rotulo: string; href?: string };

/**
 * O caminho no topo (G2 do levantamento de layout): "Fechamento Mensal › 08/2026 ›
 * Classificação" nas telas do mês; "Grupo de telas › Tela" nas demais.
 */
export function migalhas(pathname: string, rotuloDaEtapa: (chave: string) => string | null): Migalha[] {
  const mes = pathname.match(/^\/competencias\/(\d{4})-(\d{2})(?:\/([^/]+))?/);
  if (mes) {
    const etapa = mes[3] ? (rotuloDaEtapa(mes[3]) ?? getPageTitle(pathname)) : null;
    return [{ rotulo: "Fechamento Mensal", href: "/competencias" }, { rotulo: `${mes[2]}/${mes[1]}` }, ...(etapa ? [{ rotulo: etapa }] : [])];
  }
  const doGrupo = grupoDaTela(pathname);
  if (doGrupo) return [{ rotulo: doGrupo.grupo.title, href: doGrupo.grupo.href }, { rotulo: doGrupo.tela.title }];
  return [{ rotulo: getPageTitle(pathname) }];
}

export function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];

  const match = Object.entries(pageTitles).find(([path]) => pathname.startsWith(`${path}/`));
  return match?.[1] ?? "Área restrita";
}
