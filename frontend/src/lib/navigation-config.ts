import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  BadgeDollarSign,
  Building2,
  Calculator,
  CalendarCheck,
  ChartPie,
  SlidersHorizontal,
  Factory,
  HandCoins,
  HardHat,
  PackageCheck,
  ShieldCheck,
  Target,
  TrendingUp,
  ChartColumn,
  Columns3,
  Database,
  Gauge,
  History,
  KeyRound,
  Landmark,
  Layers,
  LayoutDashboard,
  ListOrdered,
  ListTree,
  Percent,
  Presentation,
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
  /** Um processo ainda por fazer (14/10/2026): a tela diz "Tela em desenvolvimento." e o menu o mostra em cinza. */
  emDesenvolvimento?: boolean;
};

export type NavGrupo = { titulo: string; itens: NavItem[] };

/**
 * Os grupos do menu lateral e os processos (os links) de cada um (14/10/2026: "processo" é o termo para os links do
 * menu). Os processos em desenvolvimento abrem a tela "Tela em desenvolvimento." e ficam em cinza no menu.
 */
export const navGrupos: NavGrupo[] = [
  {
    titulo: "Análises Gerenciais",
    itens: [
      // Os Relatórios Executivos (15/10/2026): as apresentações mensais dos gestores.
      { title: "Relatórios Executivos", href: "/analises-gerenciais/relatorios-executivos", icon: Presentation, permission: "relatorios_executivos:ler" },
      { title: "Resultados ROVA", href: "/analises-gerenciais/resultados-rova", icon: TrendingUp, emDesenvolvimento: true },
      { title: "Indicadores VPR", href: "/analises-gerenciais/indicadores-vpr", icon: Target, emDesenvolvimento: true },
      // Custos Operacionais (15/10/2026), em desenvolvimento.
      { title: "Custos Operacionais", href: "/analises-gerenciais/custos-operacionais", icon: Calculator, emDesenvolvimento: true },
    ],
  },
  {
    titulo: "Gestão do Patrimônio",
    itens: [
      { title: "Auditoria de Investimentos", href: "/gestao-do-patrimonio/auditoria-de-investimentos", icon: ShieldCheck, emDesenvolvimento: true },
      // Inventários e Cíclicas (15/10/2026; antes, Inventário de Prod. Acabados).
      { title: "Inventários e Cíclicas", href: "/gestao-do-patrimonio/inventarios-e-ciclicas", icon: PackageCheck, emDesenvolvimento: true },
      { title: "Ociosidade do Maquinário", href: "/gestao-do-patrimonio/ociosidade-do-maquinario", icon: Factory, emDesenvolvimento: true },
    ],
  },
  {
    // Criação de Cenários (11/10/2026); os Resultados Vendidos no alto e os analíticos acima dos sintéticos (14/10/2026).
    titulo: "Criação de Cenários",
    itens: [
      { title: "Resultados Vendidos", href: "/resultados-vendidos", icon: HandCoins, emDesenvolvimento: true },
      { title: "Cenários Analíticos", href: "/cenarios/analiticos", icon: Workflow, permission: "cenarios_analiticos_lista:ler", recurso: "CENARIOS_ANALITICOS" },
      { title: "Cenários Sintéticos", href: "/cenarios/sinteticos", icon: Layers, permission: "cenarios_lista:ler", recurso: "CENARIOS_SINTETICOS" },
    ],
  },
  {
    titulo: "Apuração dos Resultados",
    itens: [
      { title: "Resultados por Obra", href: "/resultados-por-obra", icon: HardHat, emDesenvolvimento: true },
      { title: "Resultados por Linha", href: "/resultados-por-linha", icon: ChartColumn, emDesenvolvimento: true },
      {
        // Antes, Resultados Realizados (renomeado em 14/10/2026).
        title: "Resultados Empresariais",
        href: "/relatorios/resultados",
        // Ícones de formas diferentes nos processos prontos da Apuração (14/10/2026; antes, documento, calendário e prancheta).
        icon: ChartPie,
        recurso: "RESULTADOS_REALIZADOS",
        telas: [
          { title: "Resultados", href: "/relatorios/resultados", icon: ListOrdered, permission: "relatorio_resultados:ler" },
          { title: "Indicadores", href: "/relatorios/indicadores", icon: Gauge, permission: "relatorio_indicadores:ler" },
          { title: "Painel de Bordo", href: "/relatorios/painel", icon: LayoutDashboard, permission: "relatorio_painel:ler" },
        ],
      },
      { title: "Fechamento Mensal", href: "/competencias", icon: CalendarCheck, permission: "fechamento:ler", recurso: "FECHAMENTO_MENSAL" },
      {
        title: "Cadastros da Apuração",
        href: "/cadastros/reclassificacoes",
        icon: SlidersHorizontal,
        recurso: "CADASTROS_APURACAO",
        telas: [
          { title: "Reclassificações", href: "/cadastros/reclassificacoes", icon: Shuffle, permission: "cadastro_reclassificacoes:ler" },
          { title: "Preços do Contrato", href: "/cadastros/precos-contrato", icon: BadgeDollarSign, permission: "cadastro_precos_contrato:ler" },
          { title: "Tipos de Movimento", href: "/cadastros/tipos-movimento", icon: ArrowLeftRight, permission: "cadastro_tipos_movimento:ler" },
          { title: "Tabela de Estacas", href: "/cadastros/tabela-estacas", icon: Columns3, permission: "cadastro_tabela_estacas:ler" },
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
          { title: "Unidades", href: "/cadastros/unidades", icon: Landmark, permission: "cadastro_unidades:ler" },
          { title: "Linhas", href: "/cadastros/linhas", icon: Rows3, permission: "cadastro_linhas:ler" },
          { title: "Centros de Custo", href: "/cadastros/centros-custo", icon: Building2, permission: "cadastro_centros_custo:ler" },
          { title: "Contas de Resultado", href: "/cadastros/contas-resultado", icon: Table2, permission: "cadastro_contas_resultado:ler" },
          { title: "Estrutura dos Indicadores", href: "/cadastros/estrutura-indicadores", icon: Gauge, permission: "cadastro_estrutura_indicadores:ler" },
          { title: "Regras de Rateio", href: "/cadastros/regras-rateio", icon: Percent, permission: "cadastro_regras_rateio:ler" },
          { title: "Estrutura da DRE", href: "/cadastros/estrutura-dre", icon: ListTree, permission: "cadastro_estrutura_dre:ler" },
        ],
      },
      {
        title: "Controle de Usuários",
        href: "/usuarios",
        icon: UserCog,
        recurso: "CONTROLE_USUARIOS",
        telas: [
          { title: "Usuários", href: "/usuarios", icon: Users, permission: "usuarios:ler" },
          { title: "Perfis", href: "/perfis", icon: KeyRound, permission: "perfis:ler" },
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
 * Permissão de cada tela (Passo 22; por grupo do menu desde 11/10/2026; por tela desde 14/10/2026). O menu esconde o que o usuário não
 * alcança, e o layout recusa a tela aberta pela URL; a segurança de fato é a do backend, que recusa os dados.
 * As etapas do mês seguem as permissões que o backend deriva do Fechamento Mensal e dos recortes do perfil.
 * A primeira regra que casar vale.
 */
const PERMISSAO_DA_TELA: Array<[RegExp, string]> = [
  [/^\/cadastros\/reclassificacoes(\/|$)/, "cadastro_reclassificacoes:ler"],
  [/^\/cadastros\/precos-contrato(\/|$)/, "cadastro_precos_contrato:ler"],
  [/^\/cadastros\/tipos-movimento(\/|$)/, "cadastro_tipos_movimento:ler"],
  [/^\/cadastros\/tabela-estacas(\/|$)/, "cadastro_tabela_estacas:ler"],
  [/^\/cadastros\/unidades(\/|$)/, "cadastro_unidades:ler"],
  [/^\/cadastros\/linhas(\/|$)/, "cadastro_linhas:ler"],
  [/^\/cadastros\/centros-custo(\/|$)/, "cadastro_centros_custo:ler"],
  [/^\/cadastros\/contas-resultado(\/|$)/, "cadastro_contas_resultado:ler"],
  [/^\/cadastros\/estrutura-indicadores(\/|$)/, "cadastro_estrutura_indicadores:ler"],
  [/^\/cadastros\/regras-rateio(\/|$)/, "cadastro_regras_rateio:ler"],
  [/^\/cadastros\/estrutura-dre(\/|$)/, "cadastro_estrutura_dre:ler"],
  [/^\/cadastros(\/|$)/, "cadastros_controladoria:ler"],
  [/^\/usuarios(\/|$)/, "usuarios:ler"],
  [/^\/perfis(\/|$)/, "perfis:ler"],
  [/^\/auditoria(\/|$)/, "auditoria:ler"],
  [/^\/divergencias(\/|$)/, "divergencia:ler"],
  [/^\/analises-gerenciais\/relatorios-executivos(\/|$)/, "relatorios_executivos:ler"],
  [/^\/relatorios\/resultados(\/|$)/, "relatorio_resultados:ler"],
  [/^\/relatorios\/indicadores(\/|$)/, "relatorio_indicadores:ler"],
  [/^\/relatorios\/painel(\/|$)/, "relatorio_painel:ler"],
  [/^\/relatorios(\/|$)/, "resultados:ler"],
  // As telas de um cenário: a de cada uma (cenarios_resultados, cenarios_analiticos_premissas…); a lista, a dela.
  ...(["cenarios_analiticos", "cenarios"] as const).flatMap((base): Array<[RegExp, string]> => {
    const pasta = base === "cenarios" ? "sinteticos" : "analiticos";
    return [
      [new RegExp(`^/cenarios/${pasta}/[^/]+/(configuracoes|premissas|resultados|indicadores|painel|reajustes)`), `${base}_$1:ler`],
      [new RegExp(`^/cenarios/${pasta}/?$`), `${base}_lista:ler`],
      [new RegExp(`^/cenarios/${pasta}(/|$)`), `${base}:ler`],
    ];
  }),
  [/^\/cenarios(\/|$)/, "cenarios:ler"],
  [/^\/competencias\/[^/]+\/divergencias/, "divergencia:ler"],
  [/^\/competencias\/[^/]+\/importar/, "importacao:ler"],
  [/^\/competencias\/[^/]+\/classificacao/, "classificacao:ler"],
  [/^\/competencias\/[^/]+\/lancamentos-manuais/, "lancamentos_manuais:ler"],
  [/^\/competencias\/[^/]+\/listas/, "listas_operacionais:ler"],
  [/^\/competencias\/[^/]+\/receita-previa/, "receita:ler"],
  [/^\/competencias\/[^/]+\/rateios/, "rateios:ler"],
  [/^\/competencias\/[^/]+\/estoque/, "estoque:ler"],
  [/^\/competencias\/[^/]+\/conferencia-planilha/, "conferencia:ler"],
  [/^\/competencias\/[^/]+\/dre/, "dre:ler"],
  [/^\/competencias\/[^/]+\/indicadores/, "indicadores_mes:ler"],
  [/^\/competencias(\/|$)/, "fechamento:ler"],
];

export function permissaoDaTela(pathname: string): string | null {
  const regra = PERMISSAO_DA_TELA.find(([r]) => r.test(pathname));
  // As das telas dos cenários levam o nome da tela no lugar de $1.
  return regra ? regra[1].replace("$1", regra[0].exec(pathname)?.[1] ?? "") : null;
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

/** "unidades", "editar" → "cadastro_unidades:editar": a permissão da tela de um cadastro (14/10/2026; antes, do grupo). */
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
  "/cenarios/sinteticos": "Cenários Sintéticos",
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
  // As telas de um cenário: "Cenários Sintéticos › Resultados" (ou "Cenários Analíticos › Resultados", 13/10/2026).
  const cenario = pathname.match(/^\/cenarios\/(sinteticos|analiticos)\/[^/]+\/([^/]+)/);
  if (cenario) {
    const tela = cenario[2] === "premissas" ? "Premissas" : cenario[2] === "indicadores" ? "Indicadores" : cenario[2] === "configuracoes" ? "Configurações" : cenario[2] === "reajustes" ? "Reajustes" : cenario[2] === "painel" ? "Painel de Bordo" : "Resultados";
    const lista = cenario[1] === "analiticos" ? "Cenários Analíticos" : "Cenários Sintéticos";
    return [{ rotulo: lista, href: `/cenarios/${cenario[1]}` }, { rotulo: tela }];
  }
  const doGrupo = grupoDaTela(pathname);
  if (doGrupo) return [{ rotulo: doGrupo.grupo.title, href: doGrupo.grupo.href }, { rotulo: doGrupo.tela.title }];
  return [{ rotulo: getPageTitle(pathname) }];
}

export function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];

  const match = Object.entries(pageTitles).find(([path]) => pathname.startsWith(`${path}/`));
  if (match) return match[1];
  // Os processos do menu sem título próprio (como os em desenvolvimento, 14/10/2026): o nome no menu.
  return navGrupos.flatMap((g) => g.itens).find((i) => naTela(pathname, i.href))?.title ?? "Área restrita";
}
