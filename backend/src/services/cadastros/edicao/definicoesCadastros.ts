import { getPrismaClient } from "../../../config/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { avaliarExpressao, codigosDaExpressao } from "../../dre/expressao.js";

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

export type Opcao = { valor: string; rotulo: string };
export type Campo = {
  nome: string;
  rotulo: string;
  tipo: "texto" | "inteiro" | "decimal" | "booleano" | "data" | "opcao" | "multipla";
  obrigatorio?: boolean;
  /** Só na criação: a chave natural não muda depois (código RM, reduzido, código da linha). */
  somenteNaCriacao?: boolean;
  /** Calculado pelo sistema; a tela mostra, não edita. */
  derivado?: boolean;
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
    { nome: "codigoRM", rotulo: "Código RM", tipo: "texto", ajuda: "A chave do balancete. Vazio só para centros mantidos fora do RM." },
    { nome: "coligada", rotulo: "Coligada", tipo: "inteiro" },
    { nome: "nomeRM", rotulo: "Nome no RM", tipo: "texto", obrigatorio: true },
    { nome: "nomeControladoria", rotulo: "Centro de custo (controladoria)", tipo: "texto", ajuda: "Agrupa os centros na visão por centro de custo." },
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
  async impedimentoExclusao(db, id) {
    const [l, m, r] = await Promise.all([
      db.lancamentoContabil.count({ where: { centroCustoId: id } }),
      db.lancamentoManual.count({ where: { centroCustoId: id } }),
      db.resultadoApurado.count({ where: { centroCustoId: id } }),
    ]);
    return l + m + r > 0 ? `O centro tem ${l} lançamento(s) do balancete, ${m} manual(is) e ${r} valor(es) apurado(s): inative-o em vez de excluir.` : null;
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
    { nome: "reduzido", rotulo: "Reduzido", tipo: "texto", obrigatorio: true, somenteNaCriacao: true, ajuda: "A chave do balancete." },
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
    { nome: "tipo", rotulo: "Tipo", tipo: "opcao", obrigatorio: true, opcoes: opcoesFixas([["SECAO", "Seção"], ["ITEM", "Item"], ["SUBTOTAL", "Subtotal"], ["TOTAL", "Total"]]) },
    { nome: "grupo", rotulo: "Grupo", tipo: "texto", obrigatorio: true },
    { nome: "grupoSigla", rotulo: "Sigla do grupo", tipo: "texto", obrigatorio: true },
    { nome: "atribuicao", rotulo: "Atribuição", tipo: "texto" },
    { nome: "atribuicaoSigla", rotulo: "Sigla da atribuição", tipo: "texto" },
    { nome: "descricao", rotulo: "Descrição", tipo: "texto", obrigatorio: true },
    { nome: "expressao", rotulo: "Expressão", tipo: "texto", ajuda: "Subtotal e total: códigos de outras linhas com + e −, parênteses e SUM(a, b)." },
    {
      nome: "unidades",
      rotulo: "Unidades em que aparece",
      tipo: "multipla",
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
  // As cinco unidades são fixas: cada uma é apurada por uma regra própria.
  criar: false,
  excluir: false,
  campos: [
    { nome: "codigo", rotulo: "Código", tipo: "inteiro", derivado: true },
    { nome: "tipo", rotulo: "Tipo", tipo: "texto", derivado: true },
    { nome: "nome", rotulo: "Nome", tipo: "texto", obrigatorio: true },
    { nome: "ordem", rotulo: "Ordem", tipo: "inteiro" },
    { nome: "ativo", rotulo: "Ativa", tipo: "booleano" },
  ],
  listar: async (db) => db.unidadeNegocio.findMany({ orderBy: { codigo: "asc" } }),
  ler: (db, id) => db.unidadeNegocio.findUnique({ where: { id } }),
  async preparar(_db, v) {
    return { nome: exigir(v.nome, "O nome"), ordem: inteiro(v.ordem, "A ordem") ?? 0, ativo: v.ativo === undefined ? true : booleano(v.ativo) };
  },
  gravar: async (db, d, id) => (await db.unidadeNegocio.update({ where: { id: id! }, data: d as Prisma.UnidadeNegocioUpdateInput })).id,
};

// ------------------------------------------------------------ regras de rateio
const regras: DefinicaoCadastro = {
  entidade: "regras-rateio",
  titulo: "Regra de rateio",
  auditoria: "regra_rateio",
  criar: true,
  excluir: true,
  campos: [
    { nome: "chave", rotulo: "Chave", tipo: "opcao", obrigatorio: true, somenteNaCriacao: true, opcoes: opcoesFixas(BALDES.slice(1, 6)) },
    { nome: "destino", rotulo: "Destino", tipo: "opcao", obrigatorio: true, somenteNaCriacao: true, opcoes: opcoesFixas([["MATRIZ", "Matriz"], ["FILIAL", "Filial"], ["MONTAGEM", "Montagem"], ["COMPLEMENTAR", "Complementar"]]) },
    {
      nome: "unidadeDestinoId",
      rotulo: "Unidade que recebe",
      tipo: "opcao",
      obrigatorio: true,
      opcoes: async (db) => (await db.unidadeNegocio.findMany({ orderBy: { codigo: "asc" } })).map((u) => ({ valor: u.id, rotulo: `${u.codigo} · ${u.nome}` })),
    },
    { nome: "rotulo", rotulo: "Rótulo", tipo: "texto", obrigatorio: true },
    { nome: "baseFisica", rotulo: "Base física", tipo: "opcao", obrigatorio: true, opcoes: opcoesFixas([["M3", "m³"], ["KG", "kg"], ["PISTA", "pista"], ["DIA", "dia"]]) },
    { nome: "origemDoVolume", rotulo: "Linha dos Totais que dá o volume", tipo: "texto", obrigatorio: true, ajuda: "Ex.: METALURGIA_MONTAGEM." },
    { nome: "vigenciaInicio", rotulo: "Vigência: início", tipo: "data", obrigatorio: true },
    { nome: "vigenciaFim", rotulo: "Vigência: fim", tipo: "data" },
  ],
  listar: async (db) => db.regraRateio.findMany({ orderBy: [{ ordem: "asc" }, { chave: "asc" }] }),
  ler: (db, id) => db.regraRateio.findUnique({ where: { id } }),
  async preparar(db, v, id) {
    const inicio = data(v.vigenciaInicio, "A vigência inicial", true)!;
    const fim = data(v.vigenciaFim, "A vigência final");
    if (fim && fim < inicio) throw new RegraCadastroError(400, "A vigência final é anterior à inicial.");
    const chave = exigir(v.chave, "A chave");
    const destino = exigir(v.destino, "O destino");
    const outra = await db.regraRateio.findFirst({ where: { chave: chave as never, destino: destino as never, vigenciaInicio: inicio }, select: { id: true } });
    if (outra && outra.id !== id) throw new RegraCadastroError(409, "Já existe uma regra desta chave e deste destino com a mesma vigência.");
    return {
      chave,
      destino,
      unidadeDestinoId: exigir(v.unidadeDestinoId, "A unidade"),
      rotulo: exigir(v.rotulo, "O rótulo"),
      baseFisica: exigir(v.baseFisica, "A base física"),
      origemDoVolume: exigir(v.origemDoVolume, "A linha dos Totais"),
      vigenciaInicio: inicio,
      vigenciaFim: fim,
    };
  },
  async gravar(db, d, id) {
    const dados = d as Prisma.RegraRateioUncheckedCreateInput;
    if (id) {
      const { chave: _c, destino: _d, ...resto } = dados;
      return (await db.regraRateio.update({ where: { id }, data: resto })).id;
    }
    return (await db.regraRateio.create({ data: { ...dados, ordem: (await db.regraRateio.count()) + 1 } })).id;
  },
  async impedimentoExclusao(db, id) {
    const n = await db.volumeOperacional.count({ where: { regraRateioId: id } });
    return n ? `A regra já foi usada em ${n} apuração(ões) de rateio: encerre a vigência em vez de excluir.` : null;
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
    { nome: "precoUnitario", rotulo: "Preço bruto (m³)", tipo: "decimal", obrigatorio: true },
    { nome: "precoLiquido", rotulo: "Preço líquido (m³)", tipo: "decimal", obrigatorio: true },
    { nome: "vigenciaInicio", rotulo: "Vigência: início", tipo: "data", obrigatorio: true },
    { nome: "vigenciaFim", rotulo: "Vigência: fim", tipo: "data" },
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
  [centros, contas, reclassificacoes, estrutura, unidades, regras, tipos, estacas].map((d) => [d.entidade, d]),
);

/** Para a tela e para o log: Decimal e Date viram texto. */
export function apresentar(v: Valores | null) {
  if (!v) return null;
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x instanceof Date ? dia(x) : Decimal.isDecimal(x) ? (x as Prisma.Decimal).toString() : x]));
}
