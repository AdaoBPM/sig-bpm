import type { AcaoPermissao, RecursoSistema } from "../../generated/prisma/enums.js";

/**
 * O catálogo das telas e das abas de cada grupo do menu lateral (14/10/2026): a matriz de permissões dos perfis é por
 * tela e por aba de conteúdo (Ler ou Editar), e não mais por grupo. O código da tela é a "área" que as rotas verificam
 * (`codigo:ler`, `codigo:editar`); o de uma aba, `tela.aba`. Ficam de fora as abas que só filtram a mesma lista
 * (Todos/Pendências da Classificação, Em Vigor/Histórico das Importações), as das Listas (que seguem o recorte por setor) e as de dentro dos modais.
 *
 * O grupo também dá uma área só de leitura (`cenarios:ler`, `resultados:ler`, `fechamento:ler`…), para o que é comum
 * às telas dele (a lista do menu, o cenário aberto na barra): vale quando o perfil lê alguma tela do grupo.
 */

export type AbaDoCatalogo = { codigo: string; nome: string };
export type TelaDoCatalogo = { codigo: string; nome: string; abas?: AbaDoCatalogo[] };
export type GrupoDoCatalogo = { recurso: RecursoSistema; nome: string; area: string; telas: TelaDoCatalogo[] };

const UNIDADES: AbaDoCatalogo[] = [
  { codigo: "consolidado", nome: "Consolidado" },
  { codigo: "matriz", nome: "Matriz" },
  { codigo: "filial", nome: "Filial" },
  { codigo: "servicos", nome: "Serviços" },
  { codigo: "despesas", nome: "Despesas e Extra" },
  { codigo: "rn", nome: "RN" },
];
const COM_CENTROS_E_OBRAS: AbaDoCatalogo[] = [...UNIDADES, { codigo: "centros", nome: "Centros de Custo" }, { codigo: "obras", nome: "Obras" }];
/** A aba de uma visão da DRE (0 Consolidado, 1 a 5 as unidades). */
export const ABA_DA_VISAO = ["consolidado", "matriz", "filial", "servicos", "despesas", "rn"] as const;
const PAINEL: AbaDoCatalogo[] = [
  { codigo: "resultados", nome: "Resultados" },
  { codigo: "performance", nome: "Performance" },
];

/** As telas de um cenário (sintético ou analítico), com o prefixo da área do tipo. */
function telasDoCenario(base: string, analitico: boolean): TelaDoCatalogo[] {
  return [
    { codigo: `${base}_lista`, nome: "Lista de Cenários" },
    {
      codigo: `${base}_configuracoes`,
      nome: "Configurações",
      abas: [
        { codigo: "cenario", nome: "Cenário" },
        { codigo: "referencia", nome: "Referência" },
        // Os Índices de Reajuste dos analíticos (19/10/2026), que o Comparativo deles usa no lugar da variação digitada.
        ...(analitico ? [{ codigo: "indices", nome: "Índices" }] : []),
        { codigo: "comparativo", nome: "Comparativo" },
        // Os Indicadores Manuais dos sintéticos (19/10/2026; antes, no Painel de Bordo); nos analíticos, nas Premissas.
        ...(analitico ? [] : [{ codigo: "manuais", nome: "Indicadores Manuais" }]),
      ],
    },
    ...(analitico
      ? [
          {
            codigo: `${base}_premissas`,
            nome: "Premissas",
            abas: [
              { codigo: "matriz", nome: "Matriz" },
              { codigo: "filial", nome: "Filial" },
              { codigo: "servicos", nome: "Serviços" },
              { codigo: "centros", nome: "Centros de Custo" },
              { codigo: "rateios", nome: "Rateios" },
              { codigo: "investimentos", nome: "Investimentos" },
              { codigo: "extra", nome: "Extra-Operacional" },
              { codigo: "manuais", nome: "Indicadores Manuais" },
            ],
          },
        ]
      : []),
    { codigo: `${base}_resultados`, nome: "Resultados", abas: UNIDADES },
    // A aba Indicadores no Painel de Bordo, depois de Performance (19/10/2026; antes, a tela Indicadores e, por um dia, a
    // aba Metas; a chave continua `metas`): todos os indicadores do cenário.
    { codigo: `${base}_painel`, nome: "Painel de Bordo", abas: [...PAINEL, { codigo: "metas", nome: "Indicadores" }] },
    {
      codigo: `${base}_reajustes`,
      // Nos analíticos, "Histórico", com a aba "Alterações" (19/10/2026); a chave não muda.
      nome: analitico ? "Histórico" : "Reajustes",
      abas: [
        { codigo: "historico", nome: analitico ? "Alterações" : "Histórico" },
        { codigo: "justificativas", nome: "Justificativas" },
      ],
    },
  ];
}

export const CATALOGO_DE_TELAS: GrupoDoCatalogo[] = [
  // As Análises Gerenciais (15/10/2026): os Relatórios Executivos; os demais processos do grupo ainda em desenvolvimento.
  { recurso: "ANALISES_GERENCIAIS", nome: "Análises Gerenciais", area: "analises_gerenciais", telas: [{ codigo: "relatorios_executivos", nome: "Relatórios Executivos" }] },
  { recurso: "CENARIOS_SINTETICOS", nome: "Cenários Sintéticos", area: "cenarios", telas: telasDoCenario("cenarios", false) },
  { recurso: "CENARIOS_ANALITICOS", nome: "Cenários Analíticos", area: "cenarios_analiticos", telas: telasDoCenario("cenarios_analiticos", true) },
  {
    recurso: "RESULTADOS_REALIZADOS",
    nome: "Resultados Empresariais",
    area: "resultados",
    telas: [
      // A aba Sem Centros de Custo (14/10/2026), só nos Resultados Empresariais; as abas Linhas e Rateios por Obras (26/10/2026),
      // antes de Obras.
      {
        codigo: "relatorio_resultados",
        nome: "Resultados",
        abas: [
          ...COM_CENTROS_E_OBRAS.slice(0, 7),
          { codigo: "sem_centros", nome: "Sem Centros de Custo" },
          { codigo: "linhas", nome: "Linhas" },
          { codigo: "rateios_obras", nome: "Rateios por Obras" },
          COM_CENTROS_E_OBRAS[7],
        ],
      },
      // Os Indicadores são uma aba do Painel de Bordo (19/10/2026; antes, uma tela).
      { codigo: "relatorio_painel", nome: "Painel de Bordo", abas: [...PAINEL, { codigo: "indicadores", nome: "Indicadores" }] },
    ],
  },
  {
    recurso: "FECHAMENTO_MENSAL",
    nome: "Fechamento Mensal",
    area: "fechamento",
    telas: [
      { codigo: "competencias", nome: "Competências" },
      { codigo: "importacao", nome: "Importações" },
      { codigo: "classificacao", nome: "Classificação" },
      { codigo: "lancamentos_manuais", nome: "Lançamentos" },
      { codigo: "listas_operacionais", nome: "Listas" },
      { codigo: "indicadores_mes", nome: "Indicadores" },
      { codigo: "receita", nome: "Receita" },
      { codigo: "rateios", nome: "Rateios" },
      { codigo: "estoque", nome: "Estoque" },
      // A aba Sem Centros de Custo também na DRE do mês (15/10/2026), antes de Obras.
      { codigo: "dre", nome: "DRE", abas: [...COM_CENTROS_E_OBRAS.slice(0, 7), { codigo: "sem_centros", nome: "Sem Centros de Custo" }, COM_CENTROS_E_OBRAS[7]] },
      // A etapa Linhas (26/10/2026): a DRE de cada unidade dividida entre as linhas, gravada na apuração. Editar grava as
      // linhas de uma competência fechada antes dela.
      { codigo: "linhas_mes", nome: "Linhas" },
      { codigo: "conferencia", nome: "Conferência", abas: UNIDADES },
      { codigo: "divergencia", nome: "Divergências" },
    ],
  },
  {
    recurso: "CADASTROS_APURACAO",
    nome: "Cadastros da Apuração",
    area: "cadastros_apuracao",
    telas: [
      { codigo: "cadastro_reclassificacoes", nome: "Reclassificações" },
      { codigo: "cadastro_precos_contrato", nome: "Preços do Contrato" },
      { codigo: "cadastro_tipos_movimento", nome: "Tipos de Movimento" },
      { codigo: "cadastro_tabela_estacas", nome: "Tabela de Estacas" },
    ],
  },
  // A Central de Conectividade (24/10/2026), antes da Controladoria (26/10/2026), como no menu: a Biblioteca de APIs — Ler
  // usa as APIs e vê os próprios acessos; Editar vê os de todos e bloqueia APIs, usuários e endereços. As Integrações, em
  // desenvolvimento, ficam fora.
  { recurso: "CENTRAL_CONECTIVIDADE", nome: "Central de Conectividade", area: "conectividade", telas: [{ codigo: "biblioteca_apis", nome: "Biblioteca de APIs" }] },
  {
    recurso: "CADASTROS_CONTROLADORIA",
    nome: "Cadastros da Controladoria",
    area: "cadastros_controladoria",
    // Três telas com abas (17/10/2026; antes, uma tela por cadastro): Contábil, Controladoria e Analítico.
    telas: [
      {
        codigo: "cadastro_contabil",
        nome: "Contábil",
        abas: [
          { codigo: "unidades", nome: "Unidades" },
          { codigo: "centros_custo", nome: "Centros de Custo" },
          { codigo: "contas_resultado", nome: "Contas de Resultado" },
        ],
      },
      {
        codigo: "cadastro_controladoria",
        nome: "Controladoria",
        abas: [
          { codigo: "linhas", nome: "Linhas" },
          { codigo: "estrutura_dre", nome: "Estrutura da DRE" },
          { codigo: "regras_rateio", nome: "Regras de Rateio" },
          // A Alocação nas Linhas (26/10/2026): os custos sem tarefa nas linhas, para a etapa Linhas da apuração.
          { codigo: "alocacao_linhas", nome: "Alocação nas Linhas" },
        ],
      },
      {
        codigo: "cadastro_analitico",
        nome: "Analítico",
        abas: [
          // O cadastro dos itens do Painel de Bordo (17/10/2026); antes dos Indicadores desde 19/10/2026.
          { codigo: "painel_bordo", nome: "Painel de Bordo" },
          // "Indicadores" desde 18/10/2026 (antes, Estrutura dos Indicadores); a chave não muda.
          { codigo: "estrutura_indicadores", nome: "Indicadores" },
        ],
      },
    ],
  },
  {
    recurso: "CONTROLE_USUARIOS",
    nome: "Controle de Usuários",
    area: "controle_usuarios",
    telas: [
      { codigo: "usuarios", nome: "Usuários" },
      { codigo: "perfis", nome: "Perfis" },
      { codigo: "auditoria", nome: "Auditoria" },
    ],
  },
];

/** Todas as chaves da matriz: as telas e as abas (`tela.aba`), com o grupo de cada uma. */
export const CHAVES_DA_MATRIZ: Array<{ chave: string; recurso: RecursoSistema; tela: string; aba: string | null }> = CATALOGO_DE_TELAS.flatMap((g) =>
  g.telas.flatMap((t) => [
    { chave: t.codigo, recurso: g.recurso, tela: t.codigo, aba: null },
    ...(t.abas ?? []).map((a) => ({ chave: `${t.codigo}.${a.codigo}`, recurso: g.recurso, tela: t.codigo, aba: a.codigo })),
  ]),
);
const CHAVES = new Set(CHAVES_DA_MATRIZ.map((c) => c.chave));
export const chaveValida = (c: string) => CHAVES.has(c);

/**
 * A matriz gravada (chave × ação) → as áreas das rotas ("área:acao"): Editar implica Ler; a aba só vale com a tela
 * lida; o grupo ganha a área de leitura quando alguma tela dele é lida. `fora` tira áreas (os recortes por dado).
 */
export function areasDaMatriz(permissoes: Array<{ chave: string; acao: AcaoPermissao }>, fora: (area: string, acao: AcaoPermissao) => boolean = () => false) {
  const nivel = new Map<string, number>();
  for (const p of permissoes) nivel.set(p.chave, Math.max(nivel.get(p.chave) ?? 0, p.acao === "EDITAR" ? 2 : 1));
  const lista = new Set<string>();
  const dar = (area: string, n: number) => {
    if (n >= 1 && !fora(area, "LER")) lista.add(`${area}:ler`);
    if (n >= 2 && !fora(area, "EDITAR")) lista.add(`${area}:editar`);
  };
  for (const g of CATALOGO_DE_TELAS) {
    let algumaTela = false;
    for (const t of g.telas) {
      const nt = nivel.get(t.codigo) ?? 0;
      if (!nt || fora(t.codigo, "LER")) continue;
      algumaTela = true;
      dar(t.codigo, nt);
      for (const a of t.abas ?? []) dar(`${t.codigo}.${a.codigo}`, nivel.get(`${t.codigo}.${a.codigo}`) ?? 0);
    }
    if (algumaTela) lista.add(`${g.area}:ler`);
  }
  return [...lista];
}

/** A matriz inteira com Editar (o Administrador). */
export const MATRIZ_COMPLETA = CHAVES_DA_MATRIZ.map((c) => ({ chave: c.chave, acao: "EDITAR" as AcaoPermissao }));
