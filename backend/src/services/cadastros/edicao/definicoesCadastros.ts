import { getPrismaClient } from "../../../config/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { avaliarExpressao, codigosDaExpressao } from "../../dre/expressao.js";
import { chaveDaLinha } from "../../../lib/linhas.js";
import { LINHAS_TOTAIS } from "../../volumes/totaisOperacao.js";
import { formulasPorExtenso, INDICADORES_DAS_LISTAS, TOTALIZADORES_DAS_LISTAS } from "../../relatorios/catalogoIndicadores.js";
import { compilarFormula, FormulaInvalidaError } from "../../relatorios/formulaIndicador.js";
import { CALCULOS_SISTEMA } from "../../relatorios/indicadores.js";
import { NOMES_DO_PAINEL } from "../../relatorios/painelDeBordo.js";

/**
 * Cadastros editáveis pela tela (Passo 25, RF002 e RF003). Cada cadastro
 * declara os campos que a tela mostra e o que pode ser alterado, como validar,
 * o que é derivado de outro campo e o que impede a exclusão — registro usado
 * por lançamento ou apuração só se inativa.
 */

const Decimal = Prisma.Decimal;
type Db = ReturnType<typeof getPrismaClient>;
export type Valores = Record<string, unknown>;

export class RegraCadastroError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

/** Uma opção de lista; `grupos`: os valores do campo `filtradoPor` em que ela aparece. */
export type Opcao = { valor: string; rotulo: string; grupos?: string[] };
export type Campo = {
  nome: string;
  rotulo: string;
  /** O rótulo curto no cabeçalho da tabela, quando o do formulário é longo demais. */
  rotuloColuna?: string;
  /** "formula": a fórmula de um indicador, montada na tela com os itens das opções (Estrutura dos Indicadores). */
  tipo: "texto" | "inteiro" | "decimal" | "booleano" | "data" | "opcao" | "multipla" | "formula";
  obrigatorio?: boolean;
  /** Só na criação: a chave natural não muda depois (código RM, reduzido, código da linha). */
  somenteNaCriacao?: boolean;
  /** Calculado pelo sistema; a tela mostra, não edita. */
  derivado?: boolean;
  /**
   * Informação-chave, que liga o cadastro a outras telas (o código do balancete, o nome com que as planilhas citam a
   * linha…): não muda quando o registro já tem movimentos (11/10/2026).
   */
  travaComMovimento?: boolean;
  /** A lista mostra só as opções do valor escolhido neste outro campo (as Linhas dos Totais da Chave, nas regras de rateio). */
  filtradoPor?: string;
  /** Ocupa as duas colunas do formulário de edição. */
  larguraInteira?: boolean;
  /** Um valor em reais: a tabela mostra "R$" e duas casas, e o formulário, duas casas (12/10/2026). */
  moeda?: boolean;
  /** Fora da tabela (só no formulário) ou fora do formulário (só na tabela). */
  naTabela?: boolean;
  noFormulario?: boolean;
  /** No formulário, só aparece com um destes valores no outro campo (o peso, na média ponderada). */
  visivelSe?: { campo: string; valores: string[] };
  ajuda?: string;
  opcoes?: (db: Db) => Promise<Opcao[]>;
};

export type DefinicaoCadastro = {
  entidade: string;
  titulo: string;
  /** Entidade no log de auditoria. */
  auditoria: string;
  campos: Campo[];
  /** Pode criar e excluir (as unidades de negócio, por exemplo, são fixas). */
  criar: boolean;
  excluir: boolean;
  /** O cadastro muda a classificação dos lançamentos: reclassifica as competências não apuradas. */
  reclassifica?: boolean;
  listar: (db: Db, busca?: string) => Promise<Valores[]>;
  ler: (db: Db, id: string) => Promise<Valores | null>;
  /** Normaliza, valida e completa os derivados; devolve os dados para gravar. */
  preparar: (db: Db, v: Valores, id: string | null) => Promise<Record<string, unknown>>;
  gravar: (db: Db, dados: Record<string, unknown>, id: string | null) => Promise<string>;
  /** Por que não pode ser excluído (nulo se pode). */
  impedimentoExclusao?: (db: Db, id: string) => Promise<string | null>;
  /**
   * Os movimentos do registro (lançamentos, valores apurados, registros das listas…), em texto, ou nulo sem nenhum.
   * Com movimentos, os campos travaComMovimento não mudam e a exclusão é recusada.
   */
  movimentos?: (db: Db, id: string) => Promise<string | null>;
  remover?: (db: Db, id: string) => Promise<void>;
};

// --------------------------------------------------------------- utilitários
const texto = (v: unknown) => (v === undefined || v === null ? null : String(v).trim() || null);
const exigir = (v: unknown, rotulo: string) => {
  const t = texto(v);
  if (!t) throw new RegraCadastroError(400, `${rotulo} é obrigatório.`);
  return t;
};
const inteiro = (v: unknown, rotulo: string, obrigatorio = false) => {
  const t = texto(v);
  if (t === null) {
    if (obrigatorio) throw new RegraCadastroError(400, `${rotulo} é obrigatório.`);
    return null;
  }
  const n = Number(t);
  if (!Number.isInteger(n)) throw new RegraCadastroError(400, `${rotulo} precisa ser um número inteiro.`);
  return n;
};
const decimal = (v: unknown, rotulo: string) => {
  // Aceita "1298.19", "1298,19", "1.298,19" e "1.298": com vírgula, ou só com
  // pontos de milhar (grupos de três), o ponto é de milhar; senão, decimal.
  const bruto = texto(v);
  const t = bruto && (bruto.includes(",") || /^-?[1-9]\d{0,2}(\.\d{3})+$/.test(bruto)) ? bruto.replace(/\./g, "").replace(",", ".") : bruto;
  if (!t || Number.isNaN(Number(t))) throw new RegraCadastroError(400, `${rotulo} precisa ser um número.`);
  return new Decimal(t);
};
const data = (v: unknown, rotulo: string, obrigatorio = false) => {
  const t = texto(v);
  if (!t) {
    if (obrigatorio) throw new RegraCadastroError(400, `${rotulo} é obrigatória.`);
    return null;
  }
  const d = new Date(`${t.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new RegraCadastroError(400, `${rotulo} não é uma data válida.`);
  return d;
};
const booleano = (v: unknown) => v === true || v === "true" || v === 1 || v === "1";
const opcoesFixas = (pares: Array<[string, string]>) => async () => pares.map(([valor, rotulo]) => ({ valor, rotulo }));
const dia = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const contem = (busca: string | undefined, ...xs: Array<string | null | undefined>) =>
  !busca || xs.some((x) => (x ?? "").toLowerCase().includes(busca.toLowerCase()));

/** Baldes de alocação: as chaves de rateio e os baldes diretos (a coluna RATEIO da planilha). */
const BALDES: Array<[string, string]> = [
  ["UNIDADE", "UNIDADE — direto na unidade do lançamento"],
  ["PROJETO", "PROJETO — rateio por projetos"],
  ["PRODUCAO", "PRODUCAO — rateio pela produção"],
  ["METALURGIA", "METALURGIA — rateio pela metalurgia"],
  ["ARMADURA", "ARMADURA — rateio pela armadura"],
  ["ACOMPANHAMENTO", "ACOMPANHAMENTO — rateio pelos acompanhamentos"],
  ["MATRIZ", "MATRIZ"],
  ["FILIAL", "FILIAL"],
  ["OBRAS", "OBRAS"],
  ["COMPLEMENTAR", "COMPLEMENTAR"],
  ["DESPESAS", "DESPESAS"],
  ["EXTRA", "EXTRA"],
  ["RN", "RN"],
  ["LEBEN", "LEBEN (em desuso)"],
];
const opcaoBalde = (v: unknown) => {
  const t = texto(v);
  if (t && !BALDES.some(([b]) => b === t)) throw new RegraCadastroError(400, `Rateio ${t} desconhecido.`);
  return t;
};

/** Departamentos que um centro pode ter: os dos cadastros e os grupos da DRE, com a sigla de cada um. */
async function departamentos(db: Db) {
  const [centros, linhas] = await Promise.all([
    db.centroCusto.groupBy({ by: ["departamento", "departamentoSigla"], where: { departamento: { not: null } } }),
    db.linhaDRE.findMany({ where: { tipo: "ITEM" }, select: { grupo: true, grupoSigla: true }, distinct: ["grupo"] }),
  ]);
  const sigla = new Map<string, string | null>();
  for (const l of linhas) if (/\(/.test(l.grupo)) sigla.set(l.grupo, l.grupoSigla);
  for (const c of centros) if (!sigla.get(c.departamento!) && c.departamentoSigla) sigla.set(c.departamento!, c.departamentoSigla);
  for (const c of centros) if (!sigla.has(c.departamento!)) sigla.set(c.departamento!, null);
  return sigla;
}

async function linhaPorId(db: Db, id: string) {
  const l = await db.linhaDRE.findUnique({ where: { id }, select: { id: true, tipo: true, grupo: true, atribuicao: true, ativo: true } });
  if (!l) throw new RegraCadastroError(400, "Linha da DRE inexistente.");
  return l;
}

// ----------------------------------------------------------- centros de custo
const centros: DefinicaoCadastro = {
  entidade: "centros-custo",
  titulo: "Centro de custo",
  auditoria: "centro_custo",
  criar: true,
  excluir: true,
  reclassifica: true,
  campos: [
    { nome: "codigoRM", rotulo: "Código RM", tipo: "texto", travaComMovimento: true, ajuda: "A chave do balancete. Vazio só para centros mantidos fora do RM." },
    { nome: "coligada", rotulo: "Coligada", tipo: "inteiro" },
    { nome: "nomeRM", rotulo: "Nome no RM", tipo: "texto", obrigatorio: true },
    { nome: "nomeControladoria", rotulo: "Centro de custo (controladoria)", tipo: "texto", travaComMovimento: true, ajuda: "Agrupa os centros na visão por centro de custo (DRE e Resultados)." },
    {
      nome: "departamento",
      rotulo: "Departamento",
      tipo: "opcao",
      opcoes: async (db) => [...(await departamentos(db)).keys()].sort().map((d) => ({ valor: d, rotulo: d })),
    },
    { nome: "departamentoSigla", rotulo: "Sigla do departamento", tipo: "texto", derivado: true },
    { nome: "atribuicao", rotulo: "Atribuição", tipo: "opcao", opcoes: opcoesFixas([["DIRETA", "DIRETA"], ["INDIRETA", "INDIRETA"]]) },
    { nome: "balde", rotulo: "Rateio", tipo: "opcao", opcoes: opcoesFixas(BALDES) },
    {
      nome: "unidadeNegocioId",
      rotulo: "Unidade dedicada",
      tipo: "opcao",
      opcoes: async (db) => (await db.unidadeNegocio.findMany({ orderBy: { codigo: "asc" } })).map((u) => ({ valor: u.id, rotulo: `${u.codigo} · ${u.nome}` })),
    },
    { nome: "ativo", rotulo: "Ativo", tipo: "booleano" },
  ],
  async listar(db, busca) {
    const cs = await db.centroCusto.findMany({ orderBy: [{ ordem: "asc" }, { codigoRM: "asc" }] });
    return cs.filter((c) => contem(busca, c.codigoRM, c.nomeRM, c.nomeControladoria));
  },
  ler: (db, id) => db.centroCusto.findUnique({ where: { id } }),
  async preparar(db, v, id) {
    const codigoRM = texto(v.codigoRM);
    if (codigoRM) {
      const outro = await db.centroCusto.findUnique({ where: { codigoRM }, select: { id: true } });
      if (outro && outro.id !== id) throw new RegraCadastroError(409, `Já existe um centro com o código ${codigoRM}.`);
    }
    const departamento = texto(v.departamento);
    const atribuicao = texto(v.atribuicao);
    if (atribuicao && !["DIRETA", "INDIRETA"].includes(atribuicao)) throw new RegraCadastroError(400, "Atribuição deve ser DIRETA ou INDIRETA.");
    const unidadeNegocioId = texto(v.unidadeNegocioId);
    if (unidadeNegocioId && !(await db.unidadeNegocio.findUnique({ where: { id: unidadeNegocioId } }))) throw new RegraCadastroError(400, "Unidade inexistente.");
    return {
      codigoRM,
      coligada: inteiro(v.coligada, "Coligada"),
      nomeRM: exigir(v.nomeRM, "O nome no RM"),
      nomeControladoria: texto(v.nomeControladoria),
      departamento,
      departamentoSigla: departamento ? ((await departamentos(db)).get(departamento) ?? null) : null,
      atribuicao,
      atribuicaoSigla: atribuicao ? atribuicao.slice(0, 3) : null,
      balde: opcaoBalde(v.balde),
      unidadeNegocioId,
      ativo: v.ativo === undefined ? true : booleano(v.ativo),
    };
  },
  async gravar(db, d, id) {
    const dados = d as Prisma.CentroCustoUncheckedCreateInput;
    return id ? (await db.centroCusto.update({ where: { id }, data: dados })).id : (await db.centroCusto.create({ data: { ...dados, ordem: (await db.centroCusto.count()) + 1 } })).id;
  },
  async movimentos(db, id) {
    const [l, m, r] = await Promise.all([
      db.lancamentoContabil.count({ where: { centroCustoId: id } }),
      db.lancamentoManual.count({ where: { centroCustoId: id } }),
      db.resultadoApurado.count({ where: { centroCustoId: id } }),
    ]);
    return l + m + r > 0 ? `O centro tem ${l} lançamento(s) do balancete, ${m} manual(is) e ${r} valor(es) apurado(s).` : null;
  },
  async impedimentoExclusao(db, id) {
    const m = await this.movimentos!(db, id);
    return m ? `${m} Inative-o em vez de excluir.` : null;
  },
  remover: async (db, id) => void (await db.centroCusto.delete({ where: { id } })),
};

// --------------------------------------------------------- contas de resultado
const contas: DefinicaoCadastro = {
  entidade: "contas-resultado",
  titulo: "Conta de resultado",
  auditoria: "conta_resultado",
  criar: true,
  excluir: true,
  reclassifica: true,
  campos: [
    { nome: "reduzido", rotulo: "Reduzido", tipo: "texto", obrigatorio: true, somenteNaCriacao: true, travaComMovimento: true, ajuda: "A chave do balancete." },
    { nome: "conta", rotulo: "Conta", tipo: "texto", obrigatorio: true },
    { nome: "descricao", rotulo: "Descrição", tipo: "texto", obrigatorio: true },
    { nome: "tipoConta", rotulo: "Tipo", tipo: "opcao", obrigatorio: true, opcoes: opcoesFixas([["ANALITICA", "Analítica"], ["SINTETICA", "Sintética"]]) },
    {
      nome: "linhaDREId",
      rotulo: "Linha da DRE",
      tipo: "opcao",
      ajuda: "O destino na DRE. O departamento e a atribuição da conta saem da linha.",
      opcoes: async (db) =>
        (await db.linhaDRE.findMany({ where: { tipo: { in: ["ITEM", "TOTAL"] }, ativo: true }, orderBy: { ordem: "asc" } })).map((l) => ({
          valor: l.id,
          rotulo: `${l.grupoSigla} › ${l.atribuicao ?? "—"} › ${l.descricao}`,
        })),
    },
    { nome: "departamento", rotulo: "Departamento", tipo: "texto", derivado: true },
    { nome: "atribuicao", rotulo: "Atribuição", tipo: "texto", derivado: true },
    { nome: "balde", rotulo: "Rateio", tipo: "opcao", opcoes: opcoesFixas(BALDES) },
    { nome: "ativo", rotulo: "Ativa", tipo: "booleano" },
  ],
  async listar(db, busca) {
    const cs = await db.contaResultado.findMany({ orderBy: [{ conta: "asc" }] });
    return cs.filter((c) => contem(busca, c.reduzido, c.conta, c.descricao));
  },
  ler: (db, id) => db.contaResultado.findUnique({ where: { id } }),
  async preparar(db, v, id) {
    const reduzido = exigir(v.reduzido, "O reduzido");
    const outro = await db.contaResultado.findUnique({ where: { reduzido }, select: { id: true } });
    if (outro && outro.id !== id) throw new RegraCadastroError(409, `Já existe uma conta com o reduzido ${reduzido}.`);
    const tipoConta = exigir(v.tipoConta, "O tipo");
    if (!["ANALITICA", "SINTETICA"].includes(tipoConta)) throw new RegraCadastroError(400, "Tipo deve ser analítica ou sintética.");
    const linhaDREId = texto(v.linhaDREId);
    const linha = linhaDREId ? await linhaPorId(db, linhaDREId) : null;
    if (linha && linha.tipo !== "ITEM" && linha.tipo !== "TOTAL") throw new RegraCadastroError(400, "A conta só aponta para linha de item (ou para os impostos operacionais).");
    if (linha && tipoConta === "SINTETICA") throw new RegraCadastroError(400, "Conta sintética não classifica: deixe a linha da DRE vazia.");
    return {
      reduzido,
      conta: exigir(v.conta, "A conta"),
      descricao: exigir(v.descricao, "A descrição"),
      tipoConta,
      linhaDREId,
      departamento: linha?.grupo ?? null,
      atribuicao: linha?.atribuicao ?? null,
      balde: opcaoBalde(v.balde),
      ativo: v.ativo === undefined ? true : booleano(v.ativo),
    };
  },
  async gravar(db, d, id) {
    const dados = d as Prisma.ContaResultadoUncheckedCreateInput;
    if (id) {
      const { reduzido: _, ...resto } = dados;
      return (await db.contaResultado.update({ where: { id }, data: resto })).id;
    }
    return (await db.contaResultado.create({ data: { ...dados, ordem: (await db.contaResultado.count()) + 1 } })).id;
  },
  async impedimentoExclusao(db, id) {
    const [l, a, m, r] = await Promise.all([
      db.lancamentoContabil.count({ where: { contaResultadoId: id } }),
      db.lancamentoContabil.count({ where: { contaAdotadaId: id } }),
      db.lancamentoManual.count({ where: { contaResultadoId: id } }),
      db.reclassificacaoConta.count({ where: { OR: [{ contaOrigemId: id }, { contaDestinoId: id }] } }),
    ]);
    return l + a + m + r > 0 ? `A conta é usada por ${l + a} lançamento(s) do balancete, ${m} manual(is) e ${r} reclassificação(ões): inative-a em vez de excluir.` : null;
  },
  async movimentos(db, id) {
    const [l, a, m] = await Promise.all([
      db.lancamentoContabil.count({ where: { contaResultadoId: id } }),
      db.lancamentoContabil.count({ where: { contaAdotadaId: id } }),
      db.lancamentoManual.count({ where: { contaResultadoId: id } }),
    ]);
    return l + a + m > 0 ? `A conta é usada por ${l + a} lançamento(s) do balancete e ${m} manual(is).` : null;
  },
  remover: async (db, id) => void (await db.contaResultado.delete({ where: { id } })),
};

// --------------------------------------------------------- reclassificações
const reclassificacoes: DefinicaoCadastro = {
  entidade: "reclassificacoes",
  titulo: "Reclassificação de conta",
  auditoria: "reclassificacao",
  criar: true,
  excluir: true,
  reclassifica: true,
  campos: [
    { nome: "codigoCentroCusto", rotulo: "Centro de custo (código RM)", tipo: "texto", obrigatorio: true, ajuda: "Centro do cadastro ou de obra (1.98, 1.99)." },
    { nome: "contaOrigemId", rotulo: "Conta em que o RM lançou", tipo: "opcao", obrigatorio: true, opcoes: async (db) => opcoesContas(db) },
    { nome: "contaDestinoId", rotulo: "Conta que vale na DRE", tipo: "opcao", obrigatorio: true, opcoes: async (db) => opcoesContas(db) },
    { nome: "motivo", rotulo: "Motivo", tipo: "texto" },
    { nome: "ativo", rotulo: "Ativa", tipo: "booleano" },
  ],
  async listar(db, busca) {
    const rs = await db.reclassificacaoConta.findMany({
      orderBy: [{ codigoCentroCusto: "asc" }],
      include: { contaOrigem: { select: { reduzido: true, descricao: true } }, contaDestino: { select: { reduzido: true, descricao: true } } },
    });
    return rs.filter((r) => contem(busca, r.codigoCentroCusto, r.contaOrigem.reduzido, r.contaDestino.reduzido, r.motivo));
  },
  ler: (db, id) => db.reclassificacaoConta.findUnique({ where: { id } }),
  async preparar(db, v, id) {
    const codigoCentroCusto = exigir(v.codigoCentroCusto, "O centro de custo");
    const contaOrigemId = exigir(v.contaOrigemId, "A conta de origem");
    const contaDestinoId = exigir(v.contaDestinoId, "A conta de destino");
    if (contaOrigemId === contaDestinoId) throw new RegraCadastroError(400, "A conta de destino precisa ser diferente da de origem.");
    const destino = await db.contaResultado.findUnique({ where: { id: contaDestinoId }, select: { tipoConta: true, linhaDREId: true } });
    if (!destino || !(await db.contaResultado.findUnique({ where: { id: contaOrigemId } }))) throw new RegraCadastroError(400, "Conta inexistente.");
    if (destino.tipoConta !== "ANALITICA" || !destino.linhaDREId) throw new RegraCadastroError(400, "A conta de destino precisa ser analítica e ter linha na DRE.");
    const outra = await db.reclassificacaoConta.findUnique({ where: { codigoCentroCusto_contaOrigemId: { codigoCentroCusto, contaOrigemId } }, select: { id: true } });
    if (outra && outra.id !== id) throw new RegraCadastroError(409, "Já existe uma reclassificação para este centro e esta conta.");
    return { codigoCentroCusto, contaOrigemId, contaDestinoId, motivo: texto(v.motivo), ativo: v.ativo === undefined ? true : booleano(v.ativo) };
  },
  async gravar(db, d, id) {
    const dados = d as Prisma.ReclassificacaoContaUncheckedCreateInput;
    return id
      ? (await db.reclassificacaoConta.update({ where: { id }, data: dados })).id
      : (await db.reclassificacaoConta.create({ data: { ...dados, ordem: (await db.reclassificacaoConta.count()) + 1 } })).id;
  },
  // A reclassificação não é referenciada: o lançamento guarda a conta adotada, congelada na apuração.
  remover: async (db, id) => void (await db.reclassificacaoConta.delete({ where: { id } })),
};
async function opcoesContas(db: Db) {
  return (await db.contaResultado.findMany({ where: { tipoConta: "ANALITICA" }, orderBy: { reduzido: "asc" }, select: { id: true, reduzido: true, descricao: true } })).map((c) => ({
    valor: c.id,
    rotulo: `${c.reduzido} · ${c.descricao}`,
  }));
}

// --------------------------------------------------------- estrutura da DRE
const estrutura: DefinicaoCadastro = {
  entidade: "estrutura-dre",
  titulo: "Linha da DRE",
  auditoria: "linha_dre",
  criar: true,
  excluir: true,
  campos: [
    { nome: "codigo", rotulo: "Código", tipo: "texto", obrigatorio: true, somenteNaCriacao: true, ajuda: "Referência estável nas expressões (ex.: CPP.MOD.REMUNERACOES_CLT)." },
    { nome: "ordem", rotulo: "Ordem", tipo: "inteiro", obrigatorio: true },
    { nome: "tipo", rotulo: "Tipo", tipo: "opcao", obrigatorio: true, travaComMovimento: true, opcoes: opcoesFixas([["SECAO", "Seção"], ["ITEM", "Item"], ["SUBTOTAL", "Subtotal"], ["TOTAL", "Total"]]) },
    { nome: "grupo", rotulo: "Grupo", tipo: "texto", obrigatorio: true, travaComMovimento: true },
    { nome: "grupoSigla", rotulo: "Sigla do grupo", tipo: "texto", obrigatorio: true, travaComMovimento: true },
    { nome: "atribuicao", rotulo: "Atribuição", tipo: "texto", travaComMovimento: true },
    { nome: "atribuicaoSigla", rotulo: "Sigla da atribuição", tipo: "texto", travaComMovimento: true },
    { nome: "descricao", rotulo: "Descrição", tipo: "texto", obrigatorio: true, travaComMovimento: true },
    { nome: "expressao", rotulo: "Expressão", tipo: "texto", ajuda: "Subtotal e total: códigos de outras linhas com + e −, parênteses e SUM(a, b)." },
    {
      nome: "unidades",
      rotulo: "Unidades em que aparece",
      tipo: "multipla",
      travaComMovimento: true,
      opcoes: async (db) => (await db.unidadeNegocio.findMany({ orderBy: { codigo: "asc" } })).map((u) => ({ valor: String(u.codigo), rotulo: u.nome })),
    },
    { nome: "definicao", rotulo: "O que a linha significa", tipo: "texto" },
    { nome: "ativo", rotulo: "Ativa", tipo: "booleano" },
  ],
  async listar(db, busca) {
    const ls = await db.linhaDRE.findMany({ orderBy: { ordem: "asc" }, include: { unidades: { select: { unidadeNegocio: { select: { codigo: true } } } } } });
    return ls.filter((l) => contem(busca, l.codigo, l.descricao, l.grupo, l.atribuicao)).map(({ unidades, ...l }) => ({ ...l, unidades: unidades.map((u) => String(u.unidadeNegocio.codigo)) }));
  },
  async ler(db, id) {
    const l = await db.linhaDRE.findUnique({ where: { id }, include: { unidades: { select: { unidadeNegocio: { select: { codigo: true } } } } } });
    return l ? { ...l, unidades: l.unidades.map((u) => String(u.unidadeNegocio.codigo)) } : null;
  },
  async preparar(db, v, id) {
    const codigo = exigir(v.codigo, "O código").toUpperCase();
    const outra = await db.linhaDRE.findUnique({ where: { codigo }, select: { id: true } });
    if (outra && outra.id !== id) throw new RegraCadastroError(409, `Já existe uma linha com o código ${codigo}.`);
    const tipo = exigir(v.tipo, "O tipo");
    if (!["SECAO", "ITEM", "SUBTOTAL", "TOTAL"].includes(tipo)) throw new RegraCadastroError(400, "Tipo inválido.");
    const expressao = texto(v.expressao);
    const ativo = v.ativo === undefined ? true : booleano(v.ativo);
    if ((tipo === "SUBTOTAL" || tipo === "TOTAL") && !expressao) throw new RegraCadastroError(400, "Subtotal e total precisam de expressão.");
    if ((tipo === "ITEM" || tipo === "SECAO") && expressao) throw new RegraCadastroError(400, "Item e seção não têm expressão: o valor vem das contas.");
    if (expressao) await validarExpressao(db, codigo, expressao);
    if (id && !ativo) await validarInativacao(db, id, codigo);
    const unidades = Array.isArray(v.unidades) ? v.unidades.map(String) : [];
    return {
      codigo,
      ordem: inteiro(v.ordem, "A ordem", true),
      tipo,
      grupo: exigir(v.grupo, "O grupo"),
      grupoSigla: exigir(v.grupoSigla, "A sigla do grupo"),
      atribuicao: texto(v.atribuicao),
      atribuicaoSigla: texto(v.atribuicaoSigla),
      descricao: exigir(v.descricao, "A descrição"),
      expressao,
      definicao: texto(v.definicao),
      ativo,
      unidades,
    };
  },
  async gravar(db, d, id) {
    const { unidades, ...dados } = d as { unidades: string[] } & Prisma.LinhaDREUncheckedCreateInput;
    const ids = (await db.unidadeNegocio.findMany({ where: { codigo: { in: unidades.map(Number) } }, select: { id: true } })).map((u) => u.id);
    return db.$transaction(async (tx) => {
      const linha = id ? await tx.linhaDRE.update({ where: { id }, data: dados }) : await tx.linhaDRE.create({ data: dados });
      await tx.linhaDREUnidade.deleteMany({ where: { linhaDREId: linha.id } });
      if (ids.length) await tx.linhaDREUnidade.createMany({ data: ids.map((unidadeNegocioId) => ({ linhaDREId: linha.id, unidadeNegocioId })) });
      return linha.id;
    });
  },
  async movimentos(db, id) {
    const [contasN, resultados, manuais, lancamentos] = await Promise.all([
      db.contaResultado.count({ where: { linhaDREId: id } }),
      db.resultadoApurado.count({ where: { linhaDREId: id } }),
      db.lancamentoManual.count({ where: { linhaDREId: id } }),
      db.lancamentoContabil.count({ where: { linhaDREId: id } }),
    ]);
    return contasN + resultados + manuais + lancamentos > 0
      ? `A linha tem ${contasN} conta(s) vinculada(s), ${lancamentos} lançamento(s) do balancete, ${manuais} manual(is) e ${resultados} valor(es) apurado(s).`
      : null;
  },
  async impedimentoExclusao(db, id) {
    const l = await db.linhaDRE.findUniqueOrThrow({ where: { id }, select: { codigo: true } });
    const [contasN, resultados, manuais, lancamentos] = await Promise.all([
      db.contaResultado.count({ where: { linhaDREId: id } }),
      db.resultadoApurado.count({ where: { linhaDREId: id } }),
      db.lancamentoManual.count({ where: { linhaDREId: id } }),
      db.lancamentoContabil.count({ where: { linhaDREId: id } }),
    ]);
    const referencias = await quemReferencia(db, l.codigo);
    if (contasN + resultados + manuais + lancamentos + referencias.length > 0) {
      return `A linha é usada (${contasN} conta(s), ${lancamentos + manuais} lançamento(s), ${resultados} valor(es) apurado(s)${referencias.length ? `, nas expressões de ${referencias.join(", ")}` : ""}): inative-a em vez de excluir.`;
    }
    return null;
  },
  remover: async (db, id) => void (await db.linhaDRE.delete({ where: { id } })),
};

/** As linhas ativas cuja expressão cita o código. */
async function quemReferencia(db: Db, codigo: string) {
  const ls = await db.linhaDRE.findMany({ where: { expressao: { not: null }, ativo: true }, select: { codigo: true, expressao: true } });
  return ls.filter((l) => codigosDaExpressao(l.expressao!).includes(codigo)).map((l) => l.codigo);
}

/** A expressão precisa ser válida, citar só linhas ativas existentes e não fechar ciclo. */
async function validarExpressao(db: Db, codigo: string, expressao: string) {
  let citados: string[];
  try {
    avaliarExpressao(expressao, () => new Decimal(0)); // a sintaxe
    citados = codigosDaExpressao(expressao);
  } catch (e) {
    throw new RegraCadastroError(400, /^Express/.test((e as Error).message) ? (e as Error).message : `Expressão inválida: ${(e as Error).message}`);
  }
  if (citados.length === 0) throw new RegraCadastroError(400, "A expressão não cita nenhuma linha.");
  const linhas = await db.linhaDRE.findMany({ select: { codigo: true, expressao: true, ativo: true } });
  const porCodigo = new Map(linhas.map((l) => [l.codigo, l]));
  const faltam = citados.filter((c) => !porCodigo.get(c)?.ativo);
  if (faltam.length) throw new RegraCadastroError(400, `A expressão cita linha(s) inexistente(s) ou inativa(s): ${faltam.join(", ")}.`);
  // Ciclo: a partir das linhas citadas, alguma chega de volta a esta?
  const grafo = new Map(linhas.map((l) => [l.codigo, l.expressao ? codigosDaExpressao(l.expressao) : []]));
  grafo.set(codigo, citados);
  const visitados = new Set<string>();
  const caminho: string[] = [];
  const temCiclo = (c: string): boolean => {
    if (c === codigo && caminho.length > 0) return true;
    if (visitados.has(c)) return false;
    visitados.add(c);
    caminho.push(c);
    for (const p of grafo.get(c) ?? []) if (temCiclo(p)) return true;
    caminho.pop();
    return false;
  };
  for (const c of citados) {
    caminho.length = 0;
    caminho.push(codigo);
    visitados.clear();
    if (temCiclo(c)) throw new RegraCadastroError(400, `A expressão é circular: ${[...caminho, codigo].join(" → ")}.`);
  }
}

/** Inativar exige que nenhuma linha ativa a cite e que nenhuma competência fechada a tenha apurada (RF003). */
async function validarInativacao(db: Db, id: string, codigo: string) {
  const referencias = await quemReferencia(db, codigo);
  if (referencias.length) throw new RegraCadastroError(409, `A linha é citada nas expressões de ${referencias.join(", ")}: ajuste-as antes de inativá-la.`);
  const fechadas = await db.resultadoApurado.findMany({ where: { linhaDREId: id, competencia: { status: "FECHADA" } }, select: { competencia: { select: { ano: true, mes: true } } }, distinct: ["competenciaId"] });
  if (fechadas.length) {
    throw new RegraCadastroError(
      409,
      `A linha tem valores apurados em competência fechada (${fechadas.map((f) => `${String(f.competencia.mes).padStart(2, "0")}/${f.competencia.ano}`).join(", ")}): a estrutura de competência fechada não muda.`,
    );
  }
}

// ------------------------------------------------------- unidades de negócio
const unidades: DefinicaoCadastro = {
  entidade: "unidades",
  titulo: "Unidade de negócio",
  auditoria: "unidade_negocio",
  // As cinco unidades são fixas: cada uma é apurada por uma regra própria. O Tipo saiu do cadastro (09/10/2026):
  // a unidade é identificada pelo código e, onde a planilha a cita (as abas Realizado (…)), pelo nome.
  criar: false,
  excluir: false,
  campos: [
    { nome: "ordem", rotulo: "Ordem", tipo: "inteiro" },
    { nome: "codigo", rotulo: "Código", tipo: "inteiro", derivado: true },
    { nome: "nome", rotulo: "Nome", tipo: "texto", obrigatorio: true, travaComMovimento: true },
    { nome: "ativo", rotulo: "Ativa", tipo: "booleano" },
  ],
  listar: async (db) => db.unidadeNegocio.findMany({ orderBy: { codigo: "asc" } }),
  // O nome identifica a unidade na carga da Estrutura da DRE (as abas Realizado (…)): com movimentos, não muda.
  async movimentos(db, id) {
    const u = await db.unidadeNegocio.findUnique({
      where: { id },
      select: { _count: { select: { resultadosApurados: true, receitasPrevias: true, volumesOperacionais: true, projetos: true, producoes: true, expedicoes: true, montagens: true, acompanhamentos: true, medicoes: true, devolucoes: true, saidas: true } } },
    });
    const n = u ? Object.values(u._count).reduce((s, x) => s + x, 0) : 0;
    return n ? `A unidade tem ${n} registro(s) nas listas, nos rateios, na receita prévia e na DRE apurada.` : null;
  },
  ler: (db, id) => db.unidadeNegocio.findUnique({ where: { id } }),
  async preparar(_db, v) {
    return { nome: exigir(v.nome, "O nome"), ordem: inteiro(v.ordem, "A ordem") ?? 0, ativo: v.ativo === undefined ? true : booleano(v.ativo) };
  },
  gravar: async (db, d, id) => (await db.unidadeNegocio.update({ where: { id: id! }, data: d as Prisma.UnidadeNegocioUpdateInput })).id,
};

// ---------------------------------------------------------------------- linhas
/**
 * As linhas por unidade (10/10/2026): os produtos (Estrutura, Metalúrgica, Alveolares, Estacas) na Matriz ou na Filial
 * e as linhas de obra (Montagem, Fundação, Capeamento…) em Serviços. É o cadastro que as Listas usam: elas acham a
 * linha pelo código (o texto das planilhas, em maiúsculas), que não muda depois de criada. As linhas de faturamento
 * (das medições) ficam fora da tela.
 */
const UNIDADES_DAS_LINHAS = [1, 2, 3];
const tipoDaLinha = (codigoUnidade: number) => (codigoUnidade === 3 ? "OBRA" : "PRODUTO");
const linhas: DefinicaoCadastro = {
  entidade: "linhas",
  titulo: "Linha",
  auditoria: "linha",
  criar: true,
  excluir: true,
  campos: [
    { nome: "ordem", rotulo: "Ordem", tipo: "inteiro" },
    {
      nome: "unidadeNegocioId",
      rotulo: "Unidade",
      tipo: "opcao",
      obrigatorio: true,
      ajuda: "Matriz ou Filial para os produtos; Serviços para as linhas de obra.",
      travaComMovimento: true,
      opcoes: async (db) =>
        (await db.unidadeNegocio.findMany({ where: { codigo: { in: UNIDADES_DAS_LINHAS } }, orderBy: { codigo: "asc" } })).map((u) => ({ valor: u.id, rotulo: u.nome })),
    },
    { nome: "nome", rotulo: "Linha", tipo: "texto", obrigatorio: true, travaComMovimento: true, ajuda: "O nome com que as planilhas das Listas citam a linha (sem diferença de maiúsculas)." },
    { nome: "ativo", rotulo: "Ativa", tipo: "booleano" },
  ],
  listar: async (db, busca) =>
    (
      await db.linha.findMany({
        where: { tipo: { in: ["PRODUTO", "OBRA"] } },
        include: { unidadeNegocio: { select: { codigo: true, nome: true } } },
        orderBy: { ordem: "asc" },
      })
    )
      .sort((a, b) => (a.unidadeNegocio?.codigo ?? 9) - (b.unidadeNegocio?.codigo ?? 9) || a.ordem - b.ordem)
      .filter((l) => contem(busca, l.nome, l.codigo, l.unidadeNegocio?.nome))
      .map(({ unidadeNegocio: _u, ...l }) => l),
  ler: (db, id) => db.linha.findUnique({ where: { id } }),
  async preparar(db, v, id) {
    const unidade = await db.unidadeNegocio.findUnique({ where: { id: exigir(v.unidadeNegocioId, "A unidade") } });
    if (!unidade || !UNIDADES_DAS_LINHAS.includes(unidade.codigo)) throw new RegraCadastroError(400, "A unidade precisa ser Matriz, Filial ou Serviços.");
    const nome = exigir(v.nome, "A linha");
    const tipo = tipoDaLinha(unidade.codigo);
    if (id) {
      const atual = await db.linha.findUnique({ where: { id }, select: { tipo: true } });
      if (!atual) throw new RegraCadastroError(404, "Linha não encontrada.");
      // O tipo (produto ou obra) vem da unidade e faz parte da chave com que as telas acham a linha: não muda.
      if (atual.tipo !== tipo) {
        throw new RegraCadastroError(400, atual.tipo === "OBRA" ? "Linha de obra fica em Serviços." : "Linha de produto fica na Matriz ou na Filial.");
      }
    }
    // As telas e as importações acham a linha pelo Nome (11/10/2026); o código interno o acompanha, em maiúsculas.
    const codigo = chaveDaLinha(nome);
    const mesmoNome = (await db.linha.findMany({ where: { tipo }, select: { id: true, nome: true } })).find((l) => l.id !== id && chaveDaLinha(l.nome) === codigo);
    if (mesmoNome) throw new RegraCadastroError(409, `Já existe a linha ${mesmoNome.nome}.`);
    return {
      tipo,
      codigo,
      nome,
      unidadeNegocioId: unidade.id,
      ordem: inteiro(v.ordem, "A ordem") ?? undefined,
      ativo: v.ativo === undefined ? true : booleano(v.ativo),
    };
  },
  async gravar(db, d, id) {
    const dados = d as Prisma.LinhaUncheckedCreateInput;
    if (id) {
      const { tipo: _t, ...editaveis } = dados;
      return (await db.linha.update({ where: { id }, data: editaveis })).id;
    }
    return (await db.linha.create({ data: { ...dados, ordem: dados.ordem ?? (await db.linha.count({ where: { tipo: { in: ["PRODUTO", "OBRA"] } } })) + 1 } })).id;
  },
  async movimentos(db, id) {
    const l = await db.linha.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            obras: true, precosContrato: true, estoqueSaldos: true, estoqueIniciais: true, projetos: true, producoes: true,
            producoesPista: true, producoesArmadura: true, producoesMetalurgia: true, expedicoes: true, montagens: true,
            acompanhamentos: true, medicoes: true, devolucoes: true, saidas: true,
          },
        },
      },
    });
    const n = l ? Object.values(l._count).reduce((s, x) => s + x, 0) : 0;
    return n ? `A linha está em ${n} registro(s) das listas, do estoque, dos preços ou das obras.` : null;
  },
  async impedimentoExclusao(db, id) {
    const m = await this.movimentos!(db, id);
    return m ? `${m} Inative-a em vez de excluir.` : null;
  },
  remover: async (db, id) => void (await db.linha.delete({ where: { id } })),
};

// --------------------------------------------------------- estrutura dos indicadores
/**
 * A Estrutura dos Indicadores (11/10/2026): os indicadores de resultado, com a fórmula (Metodologia) que os calcula —
 * itens da DRE (qualquer linha, por unidade), totalizadores das Listas, indicadores do Comercial e do Administrativo
 * e metas do orçamento, com + − × ÷ e parênteses. O nome identifica o indicador nas metas importadas, nos valores
 * digitados e no Painel de Bordo: com eles, não muda.
 */
const GRUPOS_DE_INDICADORES = ["Produção", "Serviços", "Logística", "Técnico", "Comercial", "Administrativo", "Geral", "GME"];
const SENTIDOS: Array<[string, string]> = [["↑", "↑ Maior, melhor"], ["↓", "↓ Menor, melhor"], ["=", "= Acompanhamento"], ["-", "- Sem sentido"]];
// As unidades que as telas sabem mostrar (formatação dos valores).
const UNIDADES_DE_INDICADOR = ["%", "R$", "R$/m³", "R$ (K)/colab.", "m³", "m³/colab.", "pistas", "colab.", "ocorr."];
const MODOS_DO_ACUMULADO: Array<[string, string]> = [["SOMA", "Soma dos meses"], ["MEDIA_PONDERADA", "Média ponderada"], ["ULTIMO", "Último mês"], ["SISTEMA", "Cálculo do sistema"]];

/** Os itens que a fórmula pode usar (as opções do montador): valor "TIPO|chave", grupo pelo tipo do item. */
async function itensDaFormula(db: Db): Promise<Opcao[]> {
  const linhas = await db.linhaDRE.findMany({ where: { tipo: { not: "SECAO" }, ativo: true }, orderBy: { ordem: "asc" }, select: { codigo: true, descricao: true, grupoSigla: true, tipo: true } });
  const nomes = (await db.indicadorEstrutura.findMany({ orderBy: { ordem: "asc" }, select: { nome: true } })).map((i) => i.nome);
  return [
    ...linhas.map((l) => ({ valor: `DRE|${l.codigo}`, rotulo: `${l.grupoSigla} › ${l.descricao}${l.tipo === "ITEM" ? "" : " (total)"}`, grupos: ["DRE"] })),
    ...TOTALIZADORES_DAS_LISTAS.map((t) => ({ valor: `LISTA|${t.codigo}`, rotulo: t.rotulo, grupos: ["LISTA"] })),
    ...INDICADORES_DAS_LISTAS.map((n) => ({ valor: `IND|${n}`, rotulo: n, grupos: ["IND"] })),
    ...nomes.map((n) => ({ valor: `META|${n}`, rotulo: n, grupos: ["META"] })),
  ];
}

/** Valida a fórmula: a escrita e os itens (linhas que existem na DRE, totalizadores, indicadores e metas conhecidos). */
async function validarFormula(db: Db, formula: string, rotulo: string, nomesDoCatalogo: string[]) {
  let compilada: ReturnType<typeof compilarFormula>;
  try {
    compilada = compilarFormula(formula);
  } catch (e) {
    throw new RegraCadastroError(400, `${rotulo}: ${e instanceof FormulaInvalidaError ? e.message : "fórmula inválida."}`);
  }
  const codigos = new Set((await db.linhaDRE.findMany({ select: { codigo: true } })).map((l) => l.codigo));
  const listas = new Set(TOTALIZADORES_DAS_LISTAS.map((t) => t.codigo));
  const indicadores = new Set(INDICADORES_DAS_LISTAS);
  const metas = new Set(nomesDoCatalogo);
  for (const i of compilada.itens.values()) {
    const ok = i.tipo === "DRE" ? codigos.has(i.codigo) : i.tipo === "LISTA" ? listas.has(i.codigo) : i.tipo === "IND" ? indicadores.has(i.nome) : metas.has(i.nome);
    if (!ok) throw new RegraCadastroError(400, `${rotulo}: o item ${i.tipo === "DRE" ? i.codigo : i.tipo === "LISTA" ? i.codigo : i.nome} não existe.`);
  }
}

const estruturaIndicadores: DefinicaoCadastro = {
  entidade: "estrutura-indicadores",
  titulo: "Indicador",
  auditoria: "indicador_estrutura",
  criar: true,
  excluir: true,
  campos: [
    { nome: "ordem", rotulo: "Ordem", tipo: "inteiro" },
    { nome: "grupo", rotulo: "Grupo", tipo: "opcao", obrigatorio: true, opcoes: opcoesFixas(GRUPOS_DE_INDICADORES.map((g) => [g, g])) },
    { nome: "numero", rotulo: "Numeração", rotuloColuna: "Nº", tipo: "texto", ajuda: "Vazia nos indicadores principais do grupo." },
    { nome: "nome", rotulo: "Nome", tipo: "texto", obrigatorio: true, travaComMovimento: true },
    { nome: "sentido", rotulo: "Comportamento", rotuloColuna: "Comp.", tipo: "opcao", obrigatorio: true, opcoes: opcoesFixas(SENTIDOS) },
    { nome: "unidade", rotulo: "Unidade de Medida", rotuloColuna: "Und.", tipo: "opcao", obrigatorio: true, opcoes: opcoesFixas(UNIDADES_DE_INDICADOR.map((u) => [u, u])) },
    { nome: "descricao", rotulo: "Descrição", tipo: "texto", larguraInteira: true, naTabela: false, ajuda: "O texto que a tela Indicadores mostra sob o nome." },
    { nome: "formula", rotulo: "Metodologia", tipo: "formula", larguraInteira: true, naTabela: false, opcoes: itensDaFormula },
    { nome: "metodologiaTexto", rotulo: "Metodologia", tipo: "texto", derivado: true, noFormulario: false },
    { nome: "modo", rotulo: "Acumulado", tipo: "opcao", obrigatorio: true, opcoes: opcoesFixas(MODOS_DO_ACUMULADO) },
    { nome: "peso", rotulo: "Peso da Média", tipo: "formula", larguraInteira: true, naTabela: false, visivelSe: { campo: "modo", valores: ["MEDIA_PONDERADA"] }, opcoes: itensDaFormula },
    { nome: "ativo", rotulo: "Ativo", tipo: "booleano" },
  ],
  async listar(db, busca) {
    const r = (await db.indicadorEstrutura.findMany({ orderBy: { ordem: "asc" } })).filter((i) => contem(busca, i.grupo, i.nome, i.numero));
    const textos = await formulasPorExtenso(r.map((i) => i.formula));
    return r.map((i, k) => ({ ...i, metodologiaTexto: i.modo === "SISTEMA" ? "Cálculo do sistema" : textos[k] }));
  },
  async ler(db, id) {
    const i = await db.indicadorEstrutura.findUnique({ where: { id } });
    if (!i) return null;
    return { ...i, metodologiaTexto: i.modo === "SISTEMA" ? "Cálculo do sistema" : (await formulasPorExtenso([i.formula]))[0] };
  },
  async preparar(db, v, id) {
    const nome = exigir(v.nome, "O nome");
    const outro = await db.indicadorEstrutura.findUnique({ where: { nome }, select: { id: true } });
    if (outro && outro.id !== id) throw new RegraCadastroError(409, `Já existe o indicador ${nome}.`);
    const grupo = exigir(v.grupo, "O grupo");
    if (!GRUPOS_DE_INDICADORES.includes(grupo)) throw new RegraCadastroError(400, "Grupo inválido.");
    const sentido = exigir(v.sentido, "O comportamento");
    if (!SENTIDOS.some(([s]) => s === sentido)) throw new RegraCadastroError(400, "Comportamento inválido.");
    const unidade = exigir(v.unidade, "A unidade de medida");
    if (!UNIDADES_DE_INDICADOR.includes(unidade)) throw new RegraCadastroError(400, "Unidade de medida inválida.");
    const modo = exigir(v.modo, "O acumulado");
    if (!MODOS_DO_ACUMULADO.some(([m]) => m === modo)) throw new RegraCadastroError(400, "Acumulado inválido.");
    const nomes = (await db.indicadorEstrutura.findMany({ select: { nome: true } })).map((i) => i.nome).concat(nome);
    let formula = texto(v.formula);
    let peso = texto(v.peso);
    if (modo === "SISTEMA") {
      // Só os que têm a conta no código; a fórmula não vale para eles.
      if (!CALCULOS_SISTEMA[nome]) throw new RegraCadastroError(400, "O cálculo do sistema só vale para os indicadores que já o têm; monte a Metodologia.");
      formula = null;
      peso = null;
    } else {
      if (!formula) throw new RegraCadastroError(400, "Monte a Metodologia (a fórmula do indicador).");
      await validarFormula(db, formula, "Metodologia", nomes);
      if (modo === "MEDIA_PONDERADA") {
        if (!peso) throw new RegraCadastroError(400, "Na média ponderada, monte o Peso da Média.");
        await validarFormula(db, peso, "Peso da Média", nomes);
      } else {
        peso = null;
      }
    }
    return {
      ordem: inteiro(v.ordem, "A ordem") ?? undefined,
      grupo,
      numero: texto(v.numero) ?? "",
      nome,
      sentido,
      unidade,
      descricao: texto(v.descricao),
      formula,
      modo,
      peso,
      ativo: v.ativo === undefined ? true : booleano(v.ativo),
    };
  },
  async gravar(db, d, id) {
    const dados = d as Prisma.IndicadorEstruturaUncheckedCreateInput;
    if (id) return (await db.indicadorEstrutura.update({ where: { id }, data: dados })).id;
    return (await db.indicadorEstrutura.create({ data: { ...dados, ordem: dados.ordem ?? (await db.indicadorEstrutura.count()) + 1 } })).id;
  },
  // O nome liga o indicador às metas dos cenários, aos valores importados e digitados e ao Painel de Bordo.
  async movimentos(db, id) {
    const i = await db.indicadorEstrutura.findUnique({ where: { id }, select: { nome: true } });
    if (!i) return null;
    const [metas, digitados, importados] = await Promise.all([
      db.cenarioIndicador.count({ where: { nome: i.nome } }),
      db.indicadorDigitado.count({ where: { nome: i.nome } }),
      db.indicadorImportado.count({ where: { nome: i.nome } }),
    ]);
    const noPainel = NOMES_DO_PAINEL().includes(i.nome);
    if (!metas && !digitados && !importados && !noPainel) return null;
    const partes = [metas ? `${metas} meta(s) de cenários` : null, importados + digitados ? `${importados + digitados} valor(es) importado(s) ou digitado(s)` : null, noPainel ? "o Painel de Bordo" : null].filter(Boolean);
    return `O indicador é usado por ${partes.join(", ")}.`;
  },
  async impedimentoExclusao(db, id) {
    const m = await this.movimentos!(db, id);
    return m ? `${m} Inative-o em vez de excluir.` : null;
  },
  remover: async (db, id) => void (await db.indicadorEstrutura.delete({ where: { id } })),
};

// ------------------------------------------------------------ regras de rateio
/** As chaves de rateio de cada lista dos Totais (a Expedição e a Montagem não são base de nenhuma). */
const CHAVES_DA_LISTA: Record<string, string[]> = {
  PROJETO: ["PROJETO"],
  PRODUCAO: ["PRODUCAO"],
  PRODUCAO_PISTA: ["PRODUCAO"],
  PRODUCAO_METALURGIA: ["METALURGIA"],
  PRODUCAO_ARMADURA: ["ARMADURA"],
  ACOMPANHAMENTO: ["ACOMPANHAMENTO"],
};
/** A base física pela medida do total. */
const BASE_DA_MEDIDA: Record<string, string> = { "m³": "M3", kg: "KG", und: "PISTA", d: "DIA" };
/** O destino de cada linha dos Totais (11/10/2026): o da unidade ou do serviço que ela mede (as pistas são da Filial). */
const DESTINO_DO_TOTAL: Record<string, string> = {
  PROJETOS_MATRIZ: "MATRIZ",
  PROJETOS_FILIAL: "FILIAL",
  PREFABRICADO_MATRIZ: "MATRIZ",
  PREFABRICADO_FILIAL: "FILIAL",
  PREFABRICADO_PISTAS: "FILIAL",
  METALURGIA_MATRIZ: "MATRIZ",
  METALURGIA_FILIAL: "FILIAL",
  METALURGIA_MONTAGEM: "MONTAGEM",
  METALURGIA_COMPLEMENTAR: "COMPLEMENTAR",
  ARMADURA_MATRIZ: "MATRIZ",
  ARMADURA_FILIAL: "FILIAL",
  ARMADURA_MONTAGEM: "MONTAGEM",
  ARMADURA_COMPLEMENTAR: "COMPLEMENTAR",
  EXPEDICAO_MATRIZ: "MATRIZ",
  EXPEDICAO_FILIAL: "FILIAL",
  MONTAGEM: "MONTAGEM",
  ACOMPANHAMENTO_MONTAGEM: "MONTAGEM",
  ACOMPANHAMENTO_COMPLEMENTAR: "COMPLEMENTAR",
};
/** A unidade que recebe pelo destino (11/10/2026): Matriz, Filial, ou Serviços para a Montagem e a Complementar. */
const UNIDADE_DO_DESTINO: Record<string, number> = { MATRIZ: 1, FILIAL: 2, MONTAGEM: 3, COMPLEMENTAR: 3 };
/** Os totais das Listas (a faixa acima de cada lista), com o rótulo como lá: sem o "(P)" ou "(S)" e com a medida. */
const TOTAIS_DAS_LISTAS = LINHAS_TOTAIS.map((t) => ({
  codigo: t.codigo as string,
  rotulo: `${t.rotulo.replace(/^\([PS]\) /, "")} (${t.medida})`,
  chaves: CHAVES_DA_LISTA[t.tipo] ?? [],
  base: BASE_DA_MEDIDA[t.medida],
  destino: DESTINO_DO_TOTAL[t.codigo],
}));
const totalDaRegra = (v: unknown, chave: string) => {
  const t = TOTAIS_DAS_LISTAS.find((x) => x.codigo === exigir(v, "O destino"));
  if (!t) throw new RegraCadastroError(400, "Escolha o destino na lista (os totais das Listas Operacionais).");
  if (!t.chaves.includes(chave)) throw new RegraCadastroError(400, `O destino ${t.rotulo} não é da chave ${chave}.`);
  return t;
};

const regras: DefinicaoCadastro = {
  entidade: "regras-rateio",
  titulo: "Regra de rateio",
  auditoria: "regra_rateio",
  criar: true,
  excluir: true,
  // O Rótulo na primeira coluna e a Chave no lugar dele (11/10/2026).
  campos: [
    // O Destino saiu da tela (11/10/2026): é o da Linha dos Totais escolhida.
    { nome: "rotulo", rotulo: "Rótulo", tipo: "texto", obrigatorio: true, larguraInteira: true },
    { nome: "chave", rotulo: "Chave", tipo: "opcao", obrigatorio: true, somenteNaCriacao: true, opcoes: opcoesFixas(BALDES.slice(1, 6)) },
    {
      nome: "origemDoVolume",
      // O campo da linha dos Totais, com o rótulo Destino (11/10/2026): é ela que dá o destino, a unidade e a base física.
      rotulo: "Destino",
      // Uma lista com os totais destacados na faixa das Listas Operacionais, só os da Chave escolhida (11/10/2026).
      tipo: "opcao",
      obrigatorio: true,
      travaComMovimento: true,
      filtradoPor: "chave",
      opcoes: async () => TOTAIS_DAS_LISTAS.map((t) => ({ valor: t.codigo, rotulo: t.rotulo, grupos: t.chaves })),
    },
    { nome: "vigenciaInicio", rotulo: "Vigência: início", rotuloColuna: "Início", tipo: "data", obrigatorio: true },
    { nome: "vigenciaFim", rotulo: "Vigência: fim", rotuloColuna: "Fim", tipo: "data" },
  ],
  listar: async (db) => db.regraRateio.findMany({ orderBy: [{ ordem: "asc" }, { chave: "asc" }] }),
  ler: (db, id) => db.regraRateio.findUnique({ where: { id } }),
  async preparar(db, v, id) {
    const inicio = data(v.vigenciaInicio, "A vigência inicial", true)!;
    const fim = data(v.vigenciaFim, "A vigência final");
    if (fim && fim < inicio) throw new RegraCadastroError(400, "A vigência final é anterior à inicial.");
    const chave = exigir(v.chave, "A chave");
    const total = totalDaRegra(v.origemDoVolume, chave);
    const destino = total.destino;
    const unidade = await db.unidadeNegocio.findUnique({ where: { codigo: UNIDADE_DO_DESTINO[destino] ?? -1 }, select: { id: true } });
    if (!unidade) throw new RegraCadastroError(400, "Destino inválido.");
    const outra = await db.regraRateio.findFirst({ where: { chave: chave as never, destino: destino as never, vigenciaInicio: inicio }, select: { id: true } });
    if (outra && outra.id !== id) throw new RegraCadastroError(409, "Já existe uma regra desta chave e deste destino com a mesma vigência.");
    return {
      chave,
      destino,
      // A unidade sai do destino e a base física, da medida da linha dos Totais (os campos saíram da tela em 11/10/2026).
      unidadeDestinoId: unidade.id,
      rotulo: exigir(v.rotulo, "O rótulo"),
      baseFisica: total.base,
      origemDoVolume: total.codigo,
      vigenciaInicio: inicio,
      vigenciaFim: fim,
    };
  },
  async gravar(db, d, id) {
    const dados = d as Prisma.RegraRateioUncheckedCreateInput;
    if (id) {
      // A chave não muda; o destino acompanha a Linha dos Totais (que, com apurações, não muda).
      const { chave: _c, ...resto } = dados;
      return (await db.regraRateio.update({ where: { id }, data: resto })).id;
    }
    return (await db.regraRateio.create({ data: { ...dados, ordem: (await db.regraRateio.count()) + 1 } })).id;
  },
  async movimentos(db, id) {
    const n = await db.volumeOperacional.count({ where: { regraRateioId: id } });
    return n ? `A regra já foi usada em ${n} apuração(ões) de rateio.` : null;
  },
  async impedimentoExclusao(db, id) {
    const m = await this.movimentos!(db, id);
    return m ? `${m} Encerre a vigência em vez de excluir.` : null;
  },
  remover: async (db, id) => void (await db.regraRateio.delete({ where: { id } })),
};

// --------------------------------------------------------- tipos de movimento
const tipos: DefinicaoCadastro = {
  entidade: "tipos-movimento",
  titulo: "Tipo de movimento",
  auditoria: "tipo_movimento",
  criar: true,
  excluir: true,
  campos: [
    { nome: "codigo", rotulo: "Código", tipo: "texto", obrigatorio: true, ajuda: "Ex.: 1.2.18." },
    { nome: "descricao", rotulo: "Descrição", tipo: "texto", obrigatorio: true },
    { nome: "retornaEstoque", rotulo: "Devolve a peça ao estoque", tipo: "booleano" },
    { nome: "ativo", rotulo: "Ativo", tipo: "booleano" },
  ],
  listar: async (db, busca) => (await db.tipoMovimento.findMany({ orderBy: { codigo: "asc" } })).filter((t) => contem(busca, t.codigo, t.descricao)),
  ler: (db, id) => db.tipoMovimento.findUnique({ where: { id } }),
  async preparar(db, v, id) {
    const codigo = exigir(v.codigo, "O código");
    const outro = await db.tipoMovimento.findUnique({ where: { codigo }, select: { id: true } });
    if (outro && outro.id !== id) throw new RegraCadastroError(409, `Já existe o tipo de movimento ${codigo}.`);
    return { codigo, descricao: exigir(v.descricao, "A descrição"), retornaEstoque: booleano(v.retornaEstoque), ativo: v.ativo === undefined ? true : booleano(v.ativo) };
  },
  async gravar(db, d, id) {
    const dados = d as Prisma.TipoMovimentoCreateInput;
    return id ? (await db.tipoMovimento.update({ where: { id }, data: dados })).id : (await db.tipoMovimento.create({ data: { ...dados, ordem: (await db.tipoMovimento.count()) + 1 } })).id;
  },
  async impedimentoExclusao(db, id) {
    const [s, d] = await Promise.all([db.saida.count({ where: { tipoMovimentoId: id } }), db.devolucao.count({ where: { tipoMovimentoId: id } })]);
    return s + d ? `O tipo de movimento está em ${s + d} registro(s) de saídas e devoluções: inative-o em vez de excluir.` : null;
  },
  remover: async (db, id) => void (await db.tipoMovimento.delete({ where: { id } })),
};

// ---------------------------------------------------------- tabela de estacas
const estacas: DefinicaoCadastro = {
  entidade: "tabela-estacas",
  titulo: "Preço de estaca",
  auditoria: "tabela_estaca",
  criar: true,
  excluir: true,
  campos: [
    { nome: "secao", rotulo: "Seção", tipo: "texto", obrigatorio: true },
    { nome: "grupo", rotulo: "Grupo", tipo: "texto", obrigatorio: true },
    { nome: "peca", rotulo: "Peça", tipo: "texto", obrigatorio: true },
    { nome: "precoUnitario", rotulo: "Preço bruto (m³)", tipo: "decimal", obrigatorio: true, moeda: true },
    { nome: "precoLiquido", rotulo: "Preço líquido (m³)", tipo: "decimal", obrigatorio: true, moeda: true },
    { nome: "vigenciaInicio", rotulo: "Vigência: início", rotuloColuna: "Início", tipo: "data", obrigatorio: true },
    { nome: "vigenciaFim", rotulo: "Vigência: fim", rotuloColuna: "Fim", tipo: "data" },
  ],
  listar: async (db, busca) => (await db.tabelaEstaca.findMany({ orderBy: [{ ordem: "asc" }, { secao: "asc" }] })).filter((t) => contem(busca, t.secao, t.grupo, t.peca)),
  ler: (db, id) => db.tabelaEstaca.findUnique({ where: { id } }),
  async preparar(db, v, id) {
    const inicio = data(v.vigenciaInicio, "A vigência inicial", true)!;
    const fim = data(v.vigenciaFim, "A vigência final");
    if (fim && fim < inicio) throw new RegraCadastroError(400, "A vigência final é anterior à inicial.");
    const secao = exigir(v.secao, "A seção");
    const grupo = exigir(v.grupo, "O grupo");
    const outro = await db.tabelaEstaca.findUnique({ where: { secao_grupo_vigenciaInicio: { secao, grupo, vigenciaInicio: inicio } }, select: { id: true } });
    if (outro && outro.id !== id) throw new RegraCadastroError(409, "Já existe um preço desta seção e deste grupo com a mesma vigência.");
    return { secao, grupo, peca: exigir(v.peca, "A peça"), precoUnitario: decimal(v.precoUnitario, "O preço bruto"), precoLiquido: decimal(v.precoLiquido, "O preço líquido"), vigenciaInicio: inicio, vigenciaFim: fim };
  },
  async gravar(db, d, id) {
    const dados = d as Prisma.TabelaEstacaCreateInput;
    return id ? (await db.tabelaEstaca.update({ where: { id }, data: dados })).id : (await db.tabelaEstaca.create({ data: { ...dados, ordem: (await db.tabelaEstaca.count()) + 1 } })).id;
  },
  // A receita guarda o preço usado em cada item: a tabela não é referenciada.
  remover: async (db, id) => void (await db.tabelaEstaca.delete({ where: { id } })),
};

export const DEFINICOES: Record<string, DefinicaoCadastro> = Object.fromEntries(
  [centros, contas, reclassificacoes, estrutura, unidades, linhas, estruturaIndicadores, regras, tipos, estacas].map((d) => [d.entidade, d]),
);

/** Para a tela e para o log: Decimal e Date viram texto. */
export function apresentar(v: Valores | null) {
  if (!v) return null;
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x instanceof Date ? dia(x) : Decimal.isDecimal(x) ? (x as Prisma.Decimal).toString() : x]));
}
