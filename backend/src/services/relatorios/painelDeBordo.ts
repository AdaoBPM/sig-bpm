/**
 * O Painel de Bordo, como as abas Painel (Resultados) e Painel (Performance)
 * do SIG BPM 2026 - INDICADORES DE RESULTADO: em cada quadro, os indicadores
 * do mês de referência e do acumulado do exercício, o realizado contra o
 * orçado (aba Metas) e o sinal do desvio.
 *
 * Cada item é uma conta sobre os indicadores do catálogo (os nomes da aba
 * Realizado (SIG)); a mesma conta sobre as metas dá o orçado, como nas
 * fórmulas do painel (o realizado vem da aba Realizado; o orçado, da Metas).
 * O acumulado é a conta sobre os acumulados (a coluna ACUM. de cada aba).
 */

/** O valor de um indicador do catálogo no período (o mês ou o acumulado), realizado ou orçado. */
export type Valor = (nome: string) => number | null;

/**
 * Os formatos das células do painel: R$ em milhões (M) ou em milhares (K),
 * volumes (m³, pistas), percentuais (sobre a receita líquida, /RL) e R$/m³.
 */
export type Formato = "MILHOES" | "MILHARES" | "M3" | "PISTAS" | "PCT" | "PCT_RL" | "RS_M3";

export type ItemPainel = {
  /** O nome do card, por extenso (13/10/2026; antes, abreviado como na planilha: "Receita Oper. Líquida"). */
  titulo: string;
  /** A sigla da linha de baixo do item, como no painel (▪ ROL). */
  sigla: string;
  /** ↑ quanto maior melhor; ↓ quanto menor melhor. */
  sentido: "↑" | "↓";
  formato: Formato;
  /** O formato do acumulado, quando é outro (o resultado financeiro e as despesas fixas: o mês em milhares, o acumulado em milhões). */
  formatoAcumulado?: Formato;
  conta: (x: Valor) => number | null;
  /** O percentual sob o realizado (▪ 48,4% (/RL)): a conta e a base que aparece no rótulo. */
  base?: { conta: (x: Valor) => number | null; rotulo: string; casas: 1 | 2 };
  /** Começa um novo bloco do quadro (o espaço entre as linhas da planilha). */
  separar?: boolean;
};

export type QuadroPainel = { titulo: string; itens: ItemPainel[] };

const div = (a: number | null, b: number | null) => (a === null || b === null || b === 0 ? null : a / b);
const mul = (...xs: Array<number | null>) => (xs.some((x) => x === null) ? null : xs.reduce<number>((p, x) => p * x!, 1));
const soma = (...xs: Array<number | null>) => (xs.some((x) => x === null) ? null : xs.reduce<number>((s, x) => s + x!, 0));

/** Os indicadores que o Painel usa, pelo nome (o nome não muda no cadastro Estrutura dos Indicadores). */
export const NOMES_DO_PAINEL = (): string[] => Object.values(N);

const N = {
  CPP_MATRIZ: "Custos de Produção: Matriz (CPP)",
  CPP_FILIAL: "Custos de Produção: Filial (CPP)",
  VOL_MATRIZ: "Produção (Vol.): Matriz",
  VOL_FILIAL: "Produção (Vol.): Filial",
  PISTAS: "Produção (Pistas): Filial",
  MO_MATRIZ: "Mão de Obra: Matriz",
  MO_FILIAL: "Mão de Obra: Filial",
  MP_MATRIZ: "Matérias Primas: Matriz",
  MP_FILIAL: "Matérias Primas: Filial",
  GG_MATRIZ: "Gastos Gerais: Matriz",
  GG_FILIAL: "Gastos Gerais: Filial",
  CSM: "Custos de Serviços: Montagem (CSM)",
  RENDIMENTO: "Rendimento: Montagem",
  MOD_MONTAGEM: "Mão de Obra Direta: Montagem",
  GUINDASTES: "Custos e Manutenção: Guindastes",
  FRETE_MATRIZ: "Custos de Frete: Matriz (DVV)",
  FRETE_FILIAL: "Custos de Frete: Filial (DVV)",
  FRETE_TOTAL: "Custos de Frete: Total (DVV)",
  DL: "Despesas de Logística (DL)",
  EXP_MATRIZ: "Expedição (Vol.): Matriz",
  EXP_FILIAL: "Expedição (Vol.): Filial",
  EXP_TOTAL: "Expedição (Vol.): Total",
  DT: "Despesas Técnicas (DT)",
  COMISSOES: "Comissões de Representantes e 3os (DVV)",
  DC: "Despesas Comerciais (DC)",
  VENDA: "Venda: Total",
  MC_VENDAS: "Margem de Contribuição: Total",
  DEMANDA_MATRIZ: "Demanda (Vol.): Matriz",
  DEMANDA_FILIAL: "Demanda (Vol.): Filial",
  DEMANDA_MONTAGEM: "Demanda (Vol.): Montagem",
  DA: "Despesas Administrativas (DA)",
  FCOL: "Fluxo de Caixa Operacional Líquido",
  RL_PROD_MATRIZ: "Receita Líquida: Produção Matriz",
  RL_PROD_FILIAL: "Receita Líquida: Produção Filial",
  RL_FRETE_MATRIZ: "Receita Líquida: Frete Matriz",
  RL_FRETE_FILIAL: "Receita Líquida: Frete Filial",
  RL_MONTAGEM: "Receita Líquida: Montagem",
  RL_SERVICOS: "Receita Líquida: Serviços",
  RL_TOTAL: "Receita Líquida: Total",
  CPV_MATRIZ: "Custo do Produto Vendido (CPV): Matriz",
  CPV_FILIAL: "Custo do Produto Vendido (CPV): Filial",
  CPV_SERVICOS: "Custo do Produto Vendido (CPV): Serviços",
  CPV_TOTAL: "Custo do Produto Vendido (CPV): Total",
  MB_MATRIZ: "Margem Bruta (MB): Matriz",
  MB_FILIAL: "Margem Bruta (MB): Filial",
  MB_SERVICOS: "Margem Bruta (MB): Serviços",
  MB_TOTAL: "Margem Bruta (MB): Total",
  MC: "Margem de Contribuição (MC): Total",
  EBITDA: "Lucro Operacional (EBITDA)",
  RF: "Resultado Financeiro (RF)",
  RL: "Resultado Líquido (RL)",
};

const ind = (nome: string) => (x: Valor) => x(nome);
/** Sobre a receita líquida (/RL). */
const sobre = (nome: string, base: string, casas: 1 | 2 = 1) => ({ conta: (x: Valor) => div(x(nome), x(base)), rotulo: "(/RL)", casas });
/** R$/m³: o valor sobre o volume. */
const porM3 = (nome: string, volume: string) => (x: Valor) => div(x(nome), x(volume));
/** O custo em R$/m³: o percentual do custo sobre a receita, vezes a receita, sobre o volume (como o painel). */
const custoPorM3 = (pct: string, receita: string, volume: string) => (x: Valor) => div(mul(x(pct), x(receita)), x(volume));
/** Despesa fixa em R$: o percentual sobre a receita líquida total, vezes ela. */
const despesa = (pct: string) => (x: Valor) => mul(x(pct), x(N.RL_TOTAL));

const receita = (nome: string): ItemPainel => ({ titulo: "Receita Operacional Líquida", sigla: "ROL", sentido: "↑", formato: "MILHOES", conta: ind(nome) });
/**
 * O Custo do Produto Vendido (13/10/2026), entre a receita e a margem bruta, como a planilha: "Custos de Produção", ▪ CPV,
 * ↓ (quanto menor, melhor), com o percentual sobre a receita líquida do quadro.
 */
const cpv = (nome: string, base: string): ItemPainel => ({ titulo: "Custos de Produção", sigla: "CPV", sentido: "↓", formato: "MILHOES", conta: ind(nome), base: sobre(nome, base) });
const margemBruta = (nome: string, base: string): ItemPainel => ({ titulo: "Margem Bruta", sigla: "MB", sentido: "↑", formato: "MILHOES", conta: ind(nome), base: sobre(nome, base) });
const volume = (titulo: string, sigla: string, nome: string, formato: Formato = "M3"): ItemPainel => ({ titulo, sigla, sentido: "↑", formato, conta: ind(nome) });
const fixa = (titulo: string, sigla: string, pct: string): ItemPainel => ({
  titulo,
  sigla,
  sentido: "↓",
  formato: "MILHARES",
  formatoAcumulado: "MILHOES",
  conta: despesa(pct),
  base: { conta: ind(pct), rotulo: "(/RL)", casas: 2 },
});
const unitario = (titulo: string, sigla: string, nome: string): ItemPainel => ({ titulo, sigla, sentido: "↓", formato: "RS_M3", conta: ind(nome) });

/** Aba Painel (Resultados). */
export const PAINEL_RESULTADOS: QuadroPainel[] = [
  {
    titulo: "Consolidado",
    itens: [
      receita(N.RL_TOTAL),
      cpv(N.CPV_TOTAL, N.RL_TOTAL),
      // A planilha traz "▪ MC" na linha de baixo da Margem Bruta (C12); é a MB.
      margemBruta(N.MB_TOTAL, N.RL_TOTAL),
      { titulo: "Margem de Contribuição", sigla: "MC", sentido: "↑", formato: "MILHOES", conta: ind(N.MC), base: sobre(N.MC, N.RL_TOTAL) },
      { titulo: "Lucro Operacional", sigla: "EBITDA", sentido: "↑", formato: "MILHOES", conta: ind(N.EBITDA), base: sobre(N.EBITDA, N.RL_TOTAL) },
      // O percentual é sobre a receita líquida (/RL), como os demais (13/10/2026; antes, sobre a Margem de Contribuição, I19/I13 na planilha).
      {
        titulo: "Resultado Financeiro",
        sigla: "RF",
        sentido: "↑",
        formato: "MILHARES",
        formatoAcumulado: "MILHOES",
        conta: ind(N.RF),
        base: sobre(N.RF, N.RL_TOTAL),
      },
      { titulo: "Resultado Líquido", sigla: "RL", sentido: "↑", formato: "MILHOES", conta: ind(N.RL), base: sobre(N.RL, N.RL_TOTAL) },
      { titulo: "FCO Líquido", sigla: "FCOL", sentido: "↑", formato: "MILHOES", conta: ind(N.FCOL), base: sobre(N.FCOL, N.RL_TOTAL) },
    ],
  },
  {
    titulo: "Produção: Matriz",
    itens: [volume("Volume Produzido", "V (P)", N.VOL_MATRIZ), receita(N.RL_PROD_MATRIZ), cpv(N.CPV_MATRIZ, N.RL_PROD_MATRIZ), margemBruta(N.MB_MATRIZ, N.RL_PROD_MATRIZ)],
  },
  {
    titulo: "Produção: Filial",
    itens: [
      volume("Volume Produzido", "V (P)", N.VOL_FILIAL),
      volume("Pistas Produzidas", "P", N.PISTAS, "PISTAS"),
      receita(N.RL_PROD_FILIAL),
      cpv(N.CPV_FILIAL, N.RL_PROD_FILIAL),
      margemBruta(N.MB_FILIAL, N.RL_PROD_FILIAL),
    ],
  },
  {
    titulo: "Despesas Variáveis de Venda",
    itens: [
      volume("Volume Expedido", "V (E)", N.EXP_TOTAL),
      {
        titulo: "Custos de Frete",
        sigla: "CF (%RL Frete)",
        sentido: "↓",
        formato: "PCT_RL",
        conta: (x) => div(x(N.FRETE_TOTAL), soma(x(N.RL_FRETE_MATRIZ), x(N.RL_FRETE_FILIAL))),
      },
      { titulo: "Comissões", sigla: "C (%RL Total)", sentido: "↓", formato: "PCT_RL", conta: (x) => div(x(N.COMISSOES), x(N.RL_TOTAL)) },
    ],
  },
  {
    titulo: "Serviços",
    itens: [volume("Volume Montado", "V (M)", N.RENDIMENTO), receita(N.RL_SERVICOS), cpv(N.CPV_SERVICOS, N.RL_SERVICOS), margemBruta(N.MB_SERVICOS, N.RL_SERVICOS)],
  },
  {
    titulo: "Despesas Fixas Operacionais",
    itens: [fixa("Logística", "DL", N.DL), fixa("Técnico", "DT", N.DT), fixa("Comercial", "DC", N.DC), fixa("Administrativo", "DA", N.DA)],
  },
];

const producaoUnitaria = (u: "Matriz" | "Filial"): ItemPainel[] => {
  const m = u === "Matriz";
  const vol = m ? N.VOL_MATRIZ : N.VOL_FILIAL;
  const rl = m ? N.RL_PROD_MATRIZ : N.RL_PROD_FILIAL;
  const cpp = m ? N.CPP_MATRIZ : N.CPP_FILIAL;
  const mb = m ? N.MB_MATRIZ : N.MB_FILIAL;
  return [
    volume("Volume Produzido", "V (P)", vol),
    ...(m ? [] : [volume("Pistas Produzidas", "P", N.PISTAS, "PISTAS")]),
    { titulo: "Receita Líquida de Produção", sigla: "ROL (P)", sentido: "↑", formato: "RS_M3", conta: porM3(rl, vol) },
    { titulo: "Custos de Produção", sigla: "CP", sentido: "↓", formato: "RS_M3", conta: custoPorM3(cpp, rl, vol), base: { conta: ind(cpp), rotulo: "(/RL)", casas: 1 } },
    { titulo: "Margem Bruta", sigla: "MB", sentido: "↑", formato: "RS_M3", conta: porM3(mb, vol), base: sobre(mb, rl) },
    { ...unitario(m ? "Mão de Obra +Formas" : "Mão de Obra", m ? "MO+F" : "MO", m ? N.MO_MATRIZ : N.MO_FILIAL), separar: true },
    unitario("Matérias Primas", "MP", m ? N.MP_MATRIZ : N.MP_FILIAL),
    unitario("Gastos Gerais", "GG", m ? N.GG_MATRIZ : N.GG_FILIAL),
  ];
};

/** Aba Painel (Performance): os unitários. */
export const PAINEL_PERFORMANCE: QuadroPainel[] = [
  {
    titulo: "Vendas",
    itens: [
      { titulo: "Venda Total", sigla: "VT", sentido: "↑", formato: "MILHOES", conta: ind(N.VENDA) },
      { titulo: "Margem de Contribuição Vendida", sigla: "MC (V)", sentido: "↑", formato: "PCT", conta: ind(N.MC_VENDAS) },
      volume("Demanda: Matriz", "D (M)", N.DEMANDA_MATRIZ),
      volume("Demanda: Filial", "D (F)", N.DEMANDA_FILIAL),
      volume("Demanda: Montagem", "D (S)", N.DEMANDA_MONTAGEM),
    ],
  },
  { titulo: "Produção: Matriz", itens: producaoUnitaria("Matriz") },
  { titulo: "Produção: Filial", itens: producaoUnitaria("Filial") },
  {
    titulo: "Despesas Variáveis de Venda",
    itens: [
      volume("Volume Expedido: Matriz", "V (E,M)", N.EXP_MATRIZ),
      volume("Volume Expedido: Filial", "V (E,F)", N.EXP_FILIAL),
      { titulo: "Custos de Frete: Matriz", sigla: "CF (M)", sentido: "↓", formato: "PCT_RL", conta: (x) => div(x(N.FRETE_MATRIZ), x(N.RL_FRETE_MATRIZ)) },
      { titulo: "Custos de Frete: Filial", sigla: "CF (F)", sentido: "↓", formato: "PCT_RL", conta: (x) => div(x(N.FRETE_FILIAL), x(N.RL_FRETE_FILIAL)) },
    ],
  },
  {
    titulo: "Serviços",
    itens: [
      volume("Volume Montado", "V (M)", N.RENDIMENTO),
      { titulo: "Receita Operacional Líquida", sigla: "ROL", sentido: "↑", formato: "RS_M3", conta: porM3(N.RL_MONTAGEM, N.RENDIMENTO) },
      {
        titulo: "Custos de Montagem",
        sigla: "CSM",
        sentido: "↓",
        formato: "RS_M3",
        conta: custoPorM3(N.CSM, N.RL_MONTAGEM, N.RENDIMENTO),
        base: { conta: ind(N.CSM), rotulo: "(/RL)", casas: 1 },
      },
      { titulo: "Margem Bruta", sigla: "MB", sentido: "↑", formato: "RS_M3", conta: porM3(N.MB_SERVICOS, N.RENDIMENTO), base: sobre(N.MB_SERVICOS, N.RL_MONTAGEM) },
      { ...unitario("Mão de Obra Direta + Terceiros", "MOD+3os", N.MOD_MONTAGEM), separar: true },
      unitario("Manutenção + Locação", "M+L", N.GUINDASTES),
    ],
  },
];

/** O desvio contra o orçado; com o orçado negativo, o sinal se inverte (como o painel faz no resultado financeiro e no líquido). */
export function vsOrcado(realizado: number | null, orcado: number | null): number | null {
  if (realizado === null || orcado === null || orcado === 0) return null;
  return (realizado / orcado - 1) * (orcado < 0 ? -1 : 1);
}

/** O sinal do painel: 0 com desvio de até 5%; senão 1 quando o realizado está do lado bom do orçado, −1 do outro. */
export function sinal(item: Pick<ItemPainel, "sentido">, realizado: number | null, orcado: number | null): -1 | 0 | 1 | null {
  const vs = vsOrcado(realizado, orcado);
  if (vs === null) return null;
  if (Math.abs(vs) <= 0.05) return 0;
  const pior = item.sentido === "↑" ? realizado! < orcado! : realizado! > orcado!;
  return pior ? -1 : 1;
}

/**
 * Os modelos de apuração dos itens do Painel de Bordo (17/10/2026: o cadastro Analítico / Painel de Bordo): cada item
 * do painel de antes virou um modelo — a conta, a base (/RL), os formatos e o espaço antes dele —, e o cadastro escolhe
 * o modelo e dá o nome, a abreviação, o comportamento, o grupo e o quadro. O nome do modelo diz o item e o quadro de
 * origem ("Receita Operacional Líquida (ROL - Consolidado)"); a chave não muda.
 */
export type GrupoPainel = "RESULTADOS" | "PERFORMANCE";
export type ModeloPainel = Omit<ItemPainel, "titulo" | "sigla" | "sentido"> & {
  chave: string;
  nome: string;
  /** Os valores do item de origem (o cadastro começou com eles). */
  padrao: { grupo: GrupoPainel; quadro: string; titulo: string; sigla: string; sentido: "↑" | "↓" };
};

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");
const chaveDoModelo = (grupo: GrupoPainel, quadro: string, sigla: string) =>
  `${grupo.toLowerCase()}.${semAcento(`${quadro}.${sigla}`).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;

export const MODELOS_DO_PAINEL: ModeloPainel[] = (() => {
  const lista = ([["RESULTADOS", PAINEL_RESULTADOS], ["PERFORMANCE", PAINEL_PERFORMANCE]] as const).flatMap(([grupo, quadros]) =>
    quadros.flatMap((q) =>
      q.itens.map(({ titulo, sigla, sentido, ...conta }) => ({
        ...conta,
        chave: chaveDoModelo(grupo, q.titulo, sigla),
        nome: `${titulo} (${sigla} - ${q.titulo})`,
        padrao: { grupo, quadro: q.titulo, titulo, sigla, sentido },
      })),
    ),
  );
  // O mesmo item e quadro nas duas abas (o Volume Produzido, por exemplo): o grupo entra no nome do modelo.
  const repetidos = new Set(lista.filter((m, k) => lista.findIndex((x) => x.nome === m.nome) !== k).map((m) => m.nome));
  return lista.map((m) => (repetidos.has(m.nome) ? { ...m, nome: `${m.nome.slice(0, -1)}, ${m.padrao.grupo === "RESULTADOS" ? "Resultados" : "Performance"})` } : m));
})();
export const MODELO_DO_PAINEL = new Map(MODELOS_DO_PAINEL.map((m) => [m.chave, m]));

/** Um item do cadastro do Painel de Bordo (o que a tabela painel_itens guarda). */
export type ItemDoCadastroPainel = { grupo: string; quadro: string; nome: string; sigla: string; sentido: string; modelo: string };

/**
 * Os quadros de cada aba a partir dos itens do cadastro (ativos, já na ordem): o item usa a conta do modelo e o nome, a
 * abreviação e o comportamento do cadastro; os quadros seguem a ordem do primeiro item de cada um. Item com modelo
 * desconhecido fica de fora.
 */
export function quadrosDoCadastro(itens: ItemDoCadastroPainel[]): Record<"resultados" | "performance", QuadroPainel[]> {
  const r: Record<"resultados" | "performance", QuadroPainel[]> = { resultados: [], performance: [] };
  for (const i of itens) {
    const m = MODELO_DO_PAINEL.get(i.modelo);
    if (!m) continue;
    const { chave: _c, nome: _n, padrao: _p, ...conta } = m;
    const quadros = r[i.grupo === "PERFORMANCE" ? "performance" : "resultados"];
    let q = quadros.find((x) => x.titulo === i.quadro);
    if (!q) quadros.push((q = { titulo: i.quadro, itens: [] }));
    q.itens.push({ ...conta, titulo: i.nome, sigla: i.sigla, sentido: i.sentido === "↓" ? "↓" : "↑" });
  }
  return r;
}
