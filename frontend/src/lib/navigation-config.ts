import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  BadgeDollarSign,
  Building2,
  Cable,
  Calculator,
  CalendarCheck,
  ChartPie,
  SlidersHorizontal,
  Factory,
  FileSpreadsheet,
  HandCoins,
  HardHat,
  PackageCheck,
  ShieldCheck,
  Target,
  TrendingUp,
  Columns3,
  Database,
  Gauge,
  History,
  KeyRound,
  Landmark,
  Layers,
  LayoutDashboard,
  Library,
  ListOrdered,
  ListTree,
  Percent,
  PanelsTopLeft,
  Presentation,
  Rows3,
  Scale,
  Shuffle,
  Split,
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
  /**
   * As abas de uma tela (17/10/2026: os Cadastros da Controladoria), cada uma com o endereço e a permissão dela: a tela
   * abre na primeira aba que o perfil alcança, e as abas ficam logo abaixo do título (`AbasDaTela`).
   */
  abas?: NavItem[];
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
      // Os Relatórios Executivos (15/10/2026): as apresentações mensais dos gestores. O recurso (16/10/2026) põe o grupo
      // Análises Gerenciais na matriz de permissões dos tipos de usuário.
      {
        title: "Relatórios Executivos",
        href: "/analises-gerenciais/relatorios-executivos",
        icon: Presentation,
        permission: "relatorios_executivos:ler",
        recurso: "ANALISES_GERENCIAIS",
      },
      { title: "Resultados ROVA", href: "/analises-gerenciais/resultados-rova", icon: TrendingUp, emDesenvolvimento: true },
      { title: "Indicadores VPR", href: "/analises-gerenciais/indicadores-vpr", icon: Target, emDesenvolvimento: true },
      // Custos Operacionais (15/10/2026), em desenvolvimento.
      { title: "Custos Operacionais", href: "/analises-gerenciais/custos-operacionais", icon: Calculator, emDesenvolvimento: true },
      // Painéis de Bordo (27/10/2026), em desenvolvimento.
      { title: "Painéis de Bordo", href: "/analises-gerenciais/paineis-de-bordo", icon: PanelsTopLeft, emDesenvolvimento: true },
      // Demonstrativos Financeiros (27/10/2026), em desenvolvimento.
      { title: "Demonstrativos Financeiros", href: "/analises-gerenciais/demonstrativos-financeiros", icon: FileSpreadsheet, emDesenvolvimento: true },
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
      // O Balanço Patrimonial (27/10/2026), em desenvolvimento.
      { title: "Balanço Patrimonial", href: "/balanco-patrimonial", icon: Scale, emDesenvolvimento: true },
      // Os Resultados por Linha (26/10/2026) não são um processo: a etapa Linhas do Fechamento Mensal e a aba Linhas dos
      // Resultados Empresariais (os Rateios das Linhas, guardados para os Resultados por Obra).
      {
        // Antes, Resultados Realizados (renomeado em 14/10/2026).
        title: "Resultados Empresariais",
        href: "/relatorios/resultados",
        // Ícones de formas diferentes nos processos prontos da Apuração (14/10/2026; antes, documento, calendário e prancheta).
        icon: ChartPie,
        recurso: "RESULTADOS_REALIZADOS",
        telas: [
          { title: "Resultados", href: "/relatorios/resultados", icon: ListOrdered, permission: "relatorio_resultados:ler" },
          // Os Indicadores são uma aba do Painel de Bordo desde 19/10/2026.
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
    // A Central de Conectividade (24/10/2026; antes da Controladoria desde 26/10/2026): a Biblioteca de APIs, que abre os
    // dados do SIG a outros aplicativos, e as Integrações, ainda em desenvolvimento.
    titulo: "Central de Conectividade",
    itens: [
      { title: "Integrações", href: "/central-de-conectividade/integracoes", icon: Cable, emDesenvolvimento: true },
      {
        title: "Biblioteca de APIs",
        href: "/central-de-conectividade/biblioteca-de-apis",
        icon: Library,
        permission: "biblioteca_apis:ler",
        recurso: "CENTRAL_CONECTIVIDADE",
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
          // Três telas com abas (17/10/2026; antes, uma tela por cadastro). Os endereços dos cadastros continuam os mesmos.
          {
            title: "Contábil",
            href: "/cadastros/unidades",
            icon: Landmark,
            permission: "cadastro_contabil:ler",
            abas: [
              { title: "Unidades", href: "/cadastros/unidades", icon: Landmark, permission: "cadastro_contabil.unidades:ler" },
              { title: "Centros de Custo", href: "/cadastros/centros-custo", icon: Building2, permission: "cadastro_contabil.centros_custo:ler" },
              { title: "Contas de Resultado", href: "/cadastros/contas-resultado", icon: Table2, permission: "cadastro_contabil.contas_resultado:ler" },
            ],
          },
          {
            title: "Controladoria",
            href: "/cadastros/linhas",
            icon: Rows3,
            permission: "cadastro_controladoria:ler",
            abas: [
              { title: "Linhas", href: "/cadastros/linhas", icon: Rows3, permission: "cadastro_controladoria.linhas:ler" },
              { title: "Estrutura da DRE", href: "/cadastros/estrutura-dre", icon: ListTree, permission: "cadastro_controladoria.estrutura_dre:ler" },
              { title: "Regras de Rateio", href: "/cadastros/regras-rateio", icon: Percent, permission: "cadastro_controladoria.regras_rateio:ler" },
              // Os custos sem tarefa nas linhas, para a etapa Linhas da apuração (26/10/2026).
              { title: "Alocação nas Linhas", href: "/cadastros/alocacao-linhas", icon: Split, permission: "cadastro_controladoria.alocacao_linhas:ler" },
            ],
          },
          {
            title: "Analítico",
            href: "/cadastros/estrutura-indicadores",
            icon: Gauge,
            permission: "cadastro_analitico:ler",
            // O Painel de Bordo antes dos Indicadores (19/10/2026).
            abas: [
              { title: "Painel de Bordo", href: "/cadastros/painel-bordo", icon: Gauge, permission: "cadastro_analitico.painel_bordo:ler" },
              { title: "Indicadores", href: "/cadastros/estrutura-indicadores", icon: Gauge, permission: "cadastro_analitico.estrutura_indicadores:ler" },
            ],
          },
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
/** A tela aberta: a do endereço ou, numa tela com abas, a de uma das abas. */
const naTelaOuAba = (pathname: string, t: NavItem) => (t.abas ? t.abas.some((a) => naTela(pathname, a.href)) : naTela(pathname, t.href));

/** A tela com as abas que o perfil alcança (abre na primeira); sem nenhuma, a tela some. */
function telaPermitida(t: NavItem, pode: (p: string) => boolean): NavItem | null {
  if (t.permission && !pode(t.permission)) return null;
  if (!t.abas) return t;
  const abas = t.abas.filter((a) => !a.permission || pode(a.permission));
  return abas.length ? { ...t, href: abas[0].href, abas } : null;
}

/**
 * O item do menu com as telas que o perfil alcança: um grupo de telas abre na
 * primeira delas e some quando nenhuma é alcançada. Null: o item não aparece.
 */
export function itemPermitido(item: NavItem, pode: (p: string) => boolean): NavItem | null {
  if (!item.telas) return !item.permission || pode(item.permission) ? item : null;
  const telas = item.telas.map((t) => telaPermitida(t, pode)).filter((t): t is NavItem => t !== null);
  return telas.length > 0 ? { ...item, href: telas[0].href, telas } : null;
}

/** O grupo de telas da tela aberta, com a tela (e a aba, nas telas com abas): a barra no topo e o caminho usam os três. */
export function grupoDaTela(pathname: string): { grupo: NavItem; tela: NavItem; aba: NavItem | null } | null {
  for (const g of navGrupos) {
    for (const item of g.itens) {
      const tela = item.telas?.find((t) => naTelaOuAba(pathname, t));
      if (tela) return { grupo: item, tela, aba: tela.abas?.find((a) => naTela(pathname, a.href)) ?? null };
    }
  }
  return null;
}

/** As abas da tela aberta que o perfil alcança (17/10/2026), com a aberta; null fora das telas com abas. */
export function abasDaTela(pathname: string, pode: (p: string) => boolean): { titulo: string; abas: NavItem[]; ativa: string } | null {
  const doGrupo = grupoDaTela(pathname);
  if (!doGrupo?.tela.abas || !doGrupo.aba) return null;
  return { titulo: doGrupo.tela.title, abas: doGrupo.tela.abas.filter((a) => !a.permission || pode(a.permission)), ativa: doGrupo.aba.href };
}

/** O item do menu aceso: o da tela, ou o grupo de telas que a contém. */
export function itemAtivo(pathname: string, item: NavItem): boolean {
  return item.telas ? item.telas.some((t) => naTelaOuAba(pathname, t)) : naTela(pathname, item.href);
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
  [/^\/cadastros\/unidades(\/|$)/, "cadastro_contabil.unidades:ler"],
  [/^\/cadastros\/linhas(\/|$)/, "cadastro_controladoria.linhas:ler"],
  [/^\/cadastros\/centros-custo(\/|$)/, "cadastro_contabil.centros_custo:ler"],
  [/^\/cadastros\/contas-resultado(\/|$)/, "cadastro_contabil.contas_resultado:ler"],
  [/^\/cadastros\/estrutura-indicadores(\/|$)/, "cadastro_analitico.estrutura_indicadores:ler"],
  [/^\/cadastros\/painel-bordo(\/|$)/, "cadastro_analitico.painel_bordo:ler"],
  [/^\/cadastros\/regras-rateio(\/|$)/, "cadastro_controladoria.regras_rateio:ler"],
  [/^\/cadastros\/alocacao-linhas(\/|$)/, "cadastro_controladoria.alocacao_linhas:ler"],
  [/^\/cadastros\/estrutura-dre(\/|$)/, "cadastro_controladoria.estrutura_dre:ler"],
  [/^\/cadastros(\/|$)/, "cadastros_controladoria:ler"],
  [/^\/usuarios(\/|$)/, "usuarios:ler"],
  [/^\/perfis(\/|$)/, "perfis:ler"],
  [/^\/auditoria(\/|$)/, "auditoria:ler"],
  [/^\/divergencias(\/|$)/, "divergencia:ler"],
  [/^\/analises-gerenciais\/relatorios-executivos(\/|$)/, "relatorios_executivos:ler"],
  [/^\/central-de-conectividade\/biblioteca-de-apis(\/|$)/, "biblioteca_apis:ler"],
  [/^\/relatorios\/resultados(\/|$)/, "relatorio_resultados:ler"],
  // A antiga tela Indicadores leva à aba Indicadores do Painel de Bordo (19/10/2026).
  [/^\/relatorios\/indicadores(\/|$)/, "relatorio_painel:ler"],
  [/^\/relatorios\/painel(\/|$)/, "relatorio_painel:ler"],
  [/^\/relatorios(\/|$)/, "resultados:ler"],
  // As telas de um cenário: a de cada uma (cenarios_resultados, cenarios_analiticos_premissas…); a lista, a dela.
  ...(["cenarios_analiticos", "cenarios"] as const).flatMap((base): Array<[RegExp, string]> => {
    const pasta = base === "cenarios" ? "sinteticos" : "analiticos";
    return [
      // A antiga tela Indicadores leva à aba Indicadores do Painel de Bordo (19/10/2026).
      [new RegExp(`^/cenarios/${pasta}/[^/]+/indicadores`), `${base}_painel:ler`],
      [new RegExp(`^/cenarios/${pasta}/[^/]+/(configuracoes|premissas|resultados|painel|reajustes)`), `${base}_$1:ler`],
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
  // As abas das telas Totais e Prévias (27/10/2026).
  [/^\/competencias\/[^/]+\/receita-previa/, "previas.receita:ler"],
  [/^\/competencias\/[^/]+\/rateios/, "totais.rateios:ler"],
  [/^\/competencias\/[^/]+\/estoque/, "previas.estoque:ler"],
  [/^\/competencias\/[^/]+\/conferencia-planilha/, "conferencia:ler"],
  [/^\/competencias\/[^/]+\/dre/, "dre:ler"],
  [/^\/competencias\/[^/]+\/linhas/, "linhas_mes:ler"],
  [/^\/competencias\/[^/]+\/indicadores/, "totais.indicadores:ler"],
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
      // As telas em desenvolvimento (Resultados ROVA…) não são início de ninguém (17/10/2026).
      if (item.emDesenvolvimento) continue;
      const permitido = itemPermitido(item, pode);
      if (permitido) return permitido.href;
    }
  }
  return null;
}

/** "unidades", "editar" → "cadastro_contabil.unidades:editar": a permissão da tela (ou da aba) de um cadastro (14/10/2026; antes, do grupo). */
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
  "/cadastros/estrutura-indicadores": "Indicadores",
  "/cadastros/regras-rateio": "Regras de Rateio",
  "/cadastros/alocacao-linhas": "Alocação nas Linhas",
  "/cadastros/tipos-movimento": "Tipos de Movimento",
  "/cadastros/tabela-estacas": "Tabela de Estacas",
  "/usuarios": "Usuários",
  "/perfis": "Perfis de Usuário",
  "/auditoria": "Auditoria",
  "/divergencias": "Divergências",
  "/relatorios/resultados": "Resultados",
  "/relatorios/painel": "Painel de Bordo",
  "/cenarios/sinteticos": "Cenários Sintéticos",
  "/cenarios/analiticos": "Cenários Analíticos",
  "/central-de-conectividade/biblioteca-de-apis": "Biblioteca de APIs",
};

/** Uma parte do caminho no topo da tela; sem href, é a tela atual. */
export type Migalha = { rotulo: string; href?: string };

/**
 * O caminho no topo (G2 do levantamento de layout): "Fechamento Mensal › 08/2026 ›
 * Classificação" nas telas do mês; "Grupo de telas › Tela" nas demais.
 */
export function migalhas(pathname: string, rotuloDaEtapa: (chave: string) => string[] | null, rotuloDoRelatorio?: string | null): Migalha[] {
  const mes = pathname.match(/^\/competencias\/(\d{4})-(\d{2})(?:\/([^/]+))?/);
  if (mes) {
    // Nas etapas com abas (Totais e Prévias, 27/10/2026), a etapa e a aba: "08/2026 › Totais › Rateios".
    const etapa = mes[3] ? (rotuloDaEtapa(mes[3]) ?? [getPageTitle(pathname)]) : [];
    return [{ rotulo: "Fechamento Mensal", href: "/competencias" }, { rotulo: `${mes[2]}/${mes[1]}` }, ...etapa.map((rotulo) => ({ rotulo }))];
  }
  // As telas de um cenário: "Cenários Sintéticos › Resultados" (ou "Cenários Analíticos › Resultados", 13/10/2026).
  const cenario = pathname.match(/^\/cenarios\/(sinteticos|analiticos)\/[^/]+\/([^/]+)/);
  if (cenario) {
    const tela = cenario[2] === "premissas" ? "Premissas" : cenario[2] === "indicadores" ? "Indicadores" : cenario[2] === "configuracoes" ? "Configurações" : cenario[2] === "reajustes" ? (cenario[1] === "analiticos" ? "Histórico" : "Reajustes") : cenario[2] === "painel" ? "Painel de Bordo" : "Resultados";
    const lista = cenario[1] === "analiticos" ? "Cenários Analíticos" : "Cenários Sintéticos";
    return [{ rotulo: lista, href: `/cenarios/${cenario[1]}` }, { rotulo: tela }];
  }
  // Um relatório executivo (16/10/2026): "Relatórios Executivos › Agosto/2026"; o mês vem do relatório (`rotuloDoRelatorio`).
  if (/^\/analises-gerenciais\/relatorios-executivos\/[^/]+/.test(pathname)) {
    return [{ rotulo: "Relatórios Executivos", href: "/analises-gerenciais/relatorios-executivos" }, { rotulo: rotuloDoRelatorio ?? "Relatório" }];
  }
  const doGrupo = grupoDaTela(pathname);
  if (doGrupo) return [{ rotulo: doGrupo.grupo.title, href: doGrupo.grupo.href }, { rotulo: doGrupo.tela.title }, ...(doGrupo.aba ? [{ rotulo: doGrupo.aba.title }] : [])];
  return [{ rotulo: getPageTitle(pathname) }];
}

export function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];

  const match = Object.entries(pageTitles).find(([path]) => pathname.startsWith(`${path}/`));
  if (match) return match[1];
  // Os processos do menu sem título próprio (como os em desenvolvimento, 14/10/2026): o nome no menu.
  return navGrupos.flatMap((g) => g.itens).find((i) => naTela(pathname, i.href))?.title ?? "Área restrita";
}
