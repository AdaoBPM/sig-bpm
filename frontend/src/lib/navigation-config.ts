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
  Layers,
  LayoutDashboard,
  ListOrdered,
  ListTree,
  Percent,
  Rows3,
  Shuffle,
  Table2,
  UserCog,
  Users,
  Workflow,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  /** Permissão para o item aparecer no menu (e para a tela abrir). */
  permission?: string;
  /**
   * O grupo de permissão do item do menu lateral (o RecursoSistema do backend): cada item tem Ler e Editar
   * próprios no perfil (11/10/2026).
   */
  recurso?: string;
  /**
   * Um grupo de telas da mesma finalidade: o menu mostra só o grupo, que abre
   * na primeira tela que o perfil alcança, e a barra no topo troca de tela.
   */
  telas?: NavItem[];
};

export type NavGrupo = { titulo: string; itens: NavItem[] };

export const navGrupos: NavGrupo[] = [
  {
    // Criação de Cenários (11/10/2026): por enquanto, os sintéticos; os analíticos virão depois.
    titulo: "Criação de Cenários",
    itens: [
      { title: "Cenários Sintéticos", href: "/cenarios/sinteticos", icon: Layers, permission: "cenarios:ler", recurso: "CENARIOS_SINTETICOS" },
      { title: "Cenários Analíticos", href: "/cenarios/analiticos", icon: Workflow, permission: "cenarios_analiticos:ler", recurso: "CENARIOS_ANALITICOS" },
    ],
  },
  {
    titulo: "Apuração dos Resultados",
    itens: [
      {
        title: "Resultados Realizados",
        href: "/relatorios/resultados",
        icon: FileBarChart,
        recurso: "RESULTADOS_REALIZADOS",
        telas: [
          { title: "Resultados", href: "/relatorios/resultados", icon: ListOrdered, permission: "resultados:ler" },
          { title: "Indicadores", href: "/relatorios/indicadores", icon: Gauge, permission: "resultados:ler" },
          { title: "Painel de Bordo", href: "/relatorios/painel", icon: LayoutDashboard, permission: "resultados:ler" },
        ],
      },
      { title: "Fechamento Mensal", href: "/competencias", icon: CalendarDays, permission: "fechamento:ler", recurso: "FECHAMENTO_MENSAL" },
      {
        title: "Cadastros da Apuração",
        href: "/cadastros/reclassificacoes",
        icon: ClipboardList,
        recurso: "CADASTROS_APURACAO",
        telas: [
          { title: "Reclassificações", href: "/cadastros/reclassificacoes", icon: Shuffle, permission: "cadastros_apuracao:ler" },
          { title: "Preços do Contrato", href: "/cadastros/precos-contrato", icon: BadgeDollarSign, permission: "cadastros_apuracao:ler" },
          { title: "Tipos de Movimento", href: "/cadastros/tipos-movimento", icon: ArrowLeftRight, permission: "cadastros_apuracao:ler" },
          { title: "Tabela de Estacas", href: "/cadastros/tabela-estacas", icon: Columns3, permission: "cadastros_apuracao:ler" },
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
        recurso: "CADASTROS_CONTROLADORIA",
        telas: [
          { title: "Unidades", href: "/cadastros/unidades", icon: Landmark, permission: "cadastros_controladoria:ler" },
          { title: "Linhas", href: "/cadastros/linhas", icon: Rows3, permission: "cadastros_controladoria:ler" },
          { title: "Centros de Custo", href: "/cadastros/centros-custo", icon: Building2, permission: "cadastros_controladoria:ler" },
          { title: "Contas de Resultado", href: "/cadastros/contas-resultado", icon: Table2, permission: "cadastros_controladoria:ler" },
          { title: "Estrutura dos Indicadores", href: "/cadastros/estrutura-indicadores", icon: Gauge, permission: "cadastros_controladoria:ler" },
          { title: "Regras de Rateio", href: "/cadastros/regras-rateio", icon: Percent, permission: "cadastros_controladoria:ler" },
          { title: "Estrutura da DRE", href: "/cadastros/estrutura-dre", icon: ListTree, permission: "cadastros_controladoria:ler" },
        ],
      },
      {
        title: "Controle de Usuários",
        href: "/usuarios",
        icon: UserCog,
        recurso: "CONTROLE_USUARIOS",
        telas: [
          { title: "Usuários", href: "/usuarios", icon: Users, permission: "usuarios:ler" },
          { title: "Perfis", href: "/perfis", icon: KeyRound, permission: "usuarios:ler" },
          { title: "Auditoria", href: "/auditoria", icon: History, permission: "auditoria:ler" },
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
 * Permissão de cada tela (Passo 22; por grupo do menu desde 11/10/2026). O menu esconde o que o usuário não
 * alcança, e o layout recusa a tela aberta pela URL; a segurança de fato é a do backend, que recusa os dados.
 * As etapas do mês seguem as permissões que o backend deriva do Fechamento Mensal e dos recortes do perfil.
 * A primeira regra que casar vale.
 */
const PERMISSAO_DA_TELA: Array<[RegExp, string]> = [
  [/^\/cadastros\/(reclassificacoes|precos-contrato|tipos-movimento|tabela-estacas)(\/|$)/, "cadastros_apuracao:ler"],
  [/^\/cadastros(\/|$)/, "cadastros_controladoria:ler"],
  [/^\/(usuarios|perfis)(\/|$)/, "usuarios:ler"],
  [/^\/auditoria(\/|$)/, "auditoria:ler"],
  [/^\/divergencias(\/|$)/, "divergencia:ler"],
  [/^\/relatorios(\/|$)/, "resultados:ler"],
  [/^\/cenarios\/analiticos(\/|$)/, "cenarios_analiticos:ler"],
  [/^\/cenarios\/sinteticos\/[^/]+\/editar/, "cenarios:editar"],
  [/^\/cenarios(\/|$)/, "cenarios:ler"],
  [/^\/competencias\/[^/]+\/divergencias/, "divergencia:ler"],
  [/^\/competencias\/[^/]+\/importar/, "importacao:ler"],
  [/^\/competencias\/[^/]+\/classificacao/, "classificacao:ler"],
  [/^\/competencias\/[^/]+\/lancamentos-manuais/, "lancamentos_manuais:ler"],
  [/^\/competencias\/[^/]+\/listas/, "listas_operacionais:ler"],
  [/^\/competencias\/[^/]+\/(receita-previa|rateios|estoque|conferencia-planilha)/, "apuracao:ler"],
  [/^\/competencias\/[^/]+\/dre/, "dre:ler"],
  [/^\/competencias\/[^/]+\/indicadores/, "dre:ler"],
  [/^\/competencias(\/|$)/, "fechamento:ler"],
];

export function permissaoDaTela(pathname: string): string | null {
  return PERMISSAO_DA_TELA.find(([r]) => r.test(pathname))?.[1] ?? null;
}

/** A primeira tela do menu que o perfil alcança: o início de quem não tem o Fechamento Mensal. */
export function primeiraTelaPermitida(pode: (p: string) => boolean): string | null {
  for (const g of navGrupos) {
    for (const item of g.itens) {
      const permitido = itemPermitido(item, pode);
      if (permitido) return permitido.href;
    }
  }
  return null;
}

/** "unidades", "editar" → "cadastros_controladoria:editar": a permissão do grupo do menu de um cadastro. */
export function permissaoDoCadastro(entidade: string, acao: "ler" | "editar"): string {
  const tela = permissaoDaTela(`/cadastros/${entidade}`) ?? "cadastros_controladoria:ler";
  return tela.replace(/:ler$/, `:${acao}`);
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
  "/cenarios/sinteticos": "Cenários Gerados",
  "/cenarios/analiticos": "Cenários Analíticos",
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
  // As telas de um cenário: "Cenários Sintéticos › Resultados".
  const cenario = pathname.match(/^\/cenarios\/sinteticos\/[^/]+\/([^/]+)/);
  if (cenario) {
    const tela = cenario[1] === "indicadores" ? "Indicadores" : cenario[1] === "editar" ? "Editar" : "Resultados";
    return [{ rotulo: "Cenários Sintéticos", href: "/cenarios/sinteticos" }, { rotulo: tela }];
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
