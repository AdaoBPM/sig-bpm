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
        { codigo: "comparativo", nome: "Comparativo" },
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
    {
      codigo: `${base}_indicadores`,
      nome: "Indicadores",
      abas: [
        { codigo: "metas", nome: "Metas" },
        { codigo: "resultados", nome: "Indicadores de Resultados" },
        { codigo: "manuais", nome: "Indicadores Manuais" },
      ],
    },
    { codigo: `${base}_painel`, nome: "Painel de Bordo", abas: PAINEL },
    {
      codigo: `${base}_reajustes`,
      nome: "Reajustes",
      abas: [
        { codigo: "historico", nome: "Histórico" },
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
      // A aba Sem Centros de Custo (14/10/2026), só nos Resultados Empresariais.
      { codigo: "relatorio_resultados", nome: "Resultados", abas: [...COM_CENTROS_E_OBRAS.slice(0, 7), { codigo: "sem_centros", nome: "Sem Centros de Custo" }, COM_CENTROS_E_OBRAS[7]] },
      { codigo: "relatorio_indicadores", nome: "Indicadores" },
      { codigo: "relatorio_painel", nome: "Painel de Bordo", abas: PAINEL },
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
  {
    recurso: "CADASTROS_CONTROLADORIA",
    nome: "Cadastros da Controladoria",
    area: "cadastros_controladoria",
    telas: [
      { codigo: "cadastro_unidades", nome: "Unidades" },
      { codigo: "cadastro_linhas", nome: "Linhas" },
      { codigo: "cadastro_centros_custo", nome: "Centros de Custo" },
      { codigo: "cadastro_contas_resultado", nome: "Contas de Resultado" },
      { codigo: "cadastro_estrutura_indicadores", nome: "Estrutura dos Indicadores" },
      { codigo: "cadastro_regras_rateio", nome: "Regras de Rateio" },
      { codigo: "cadastro_estrutura_dre", nome: "Estrutura da DRE" },
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
