import { getPrismaClient } from "../../config/prisma.js";
import type { LinhaEstrutura } from "../dre/apuracaoUnidades.js";

/**
 * Os centros de custo dos cenários analíticos (13/10/2026, etapa 3): os valores mensais de cada centro, por conta da
 * DRE, e a alocação deles às unidades com as regras do fechamento mensal (apuracaoUnidades):
 *
 * - nas contas dos custos de produção (CPP), o balde do centro: MATRIZ e FILIAL vão direto para a unidade; UNIDADE, para
 *   a unidade da filial do centro (a filial em que ele mais lançou no realizado); PRODUCAO e PROJETO se rateiam entre
 *   Matriz e Filial; METALURGIA e ARMADURA, entre Matriz, Filial, Montagem e Complementar (em Serviços, na conta de
 *   mesma atribuição e descrição da CSM ou da CSC);
 * - nas contas dos custos de montagem (CSM), o balde OBRAS vai direto para Serviços; ACOMPANHAMENTO se rateia entre a
 *   Montagem (CSM) e a Complementar (na conta equivalente da CSC);
 * - nas despesas (DL, DT, DC e DA), Despesas e Extra.
 *
 * Os percentuais: Produção pelo m³ produzido do cenário (Matriz × Filial, mês a mês); Projeto, Metalurgia, Armadura e
 * Acompanhamento — sem premissa que diga o destino — pela média do realizado (os volumes dos rateios das competências
 * fechadas do último exercício com competência fechada; depois, o período da referência do cenário). Num mês sem
 * produção no cenário, a Produção também usa a média do realizado.
 *
 * As contas dos centros no cenário são as de mão de obra (direta, indireta e terceirizada) e de gastos gerais diretos,
 * indiretos e comerciais: as Matérias Primas, os Gastos Gerais Variáveis e o Estoque vêm das premissas (R$ por unidade
 * produzida), e a depreciação, dos investimentos.
 */

/** As atribuições das contas dos centros no cenário (o segundo pedaço do código da conta). */
const ATRIBUICOES = new Set(["MOD", "MOI", "MOT", "GGD", "GGI", "GGC"]);
/** O grupo da DRE de cada departamento do centro; os demais (almoxarifado, investimento, requisição) são de produção. */
const GRUPO_DO_DEPARTAMENTO: Record<string, string> = {
  "CUSTOS DE SERVIÇOS: MONTAGEM (CSM)": "CSM",
  "DESPESAS ADMINISTRATIVAS (DA)": "DA",
  "DESPESAS COMERCIAIS (DC)": "DC",
  "DESPESAS DE LOGÍSTICA (DL)": "DL",
  "DESPESAS TÉCNICAS (DT)": "DT",
};
const DESPESAS = new Set(["DL", "DT", "DC", "DA"]);

export type CentroDoCenario = {
  id: string;
  codigo: string | null;
  nome: string;
  grupo: string;
  departamento: string | null;
  balde: string | null;
  /** O grupo da DRE das contas do centro: CPP, CSM, DL, DT, DC ou DA. */
  grupoDRE: string;
  /** A unidade do balde UNIDADE (a filial em que o centro mais lançou); 1 sem lançamentos. */
  unidade: 1 | 2;
  /** Para onde vai o valor, em texto (Matriz, Filial, Serviços, Despesas e Extra, ou o rateio). */
  destino: string;
};

/** Os centros de custo ativos, com o grupo da DRE das contas e o destino do valor. */
export async function centrosDoCadastro(): Promise<CentroDoCenario[]> {
  const prisma = getPrismaClient();
  const [centros, filiais] = await Promise.all([
    prisma.centroCusto.findMany({ where: { ativo: true }, orderBy: [{ nomeControladoria: "asc" }, { codigoRM: "asc" }] }),
    prisma.lancamentoContabil.groupBy({ by: ["centroCustoId", "filial"], _count: { _all: true }, where: { centroCustoId: { not: null } } }),
  ]);
  const filialDe = new Map<string, { filial: number; n: number }>();
  for (const f of filiais) {
    const atual = filialDe.get(f.centroCustoId!);
    if (!atual || f._count._all > atual.n) filialDe.set(f.centroCustoId!, { filial: f.filial, n: f._count._all });
  }
  return centros.map((c) => {
    const grupoDRE = GRUPO_DO_DEPARTAMENTO[(c.departamento ?? "").trim().toUpperCase()] ?? "CPP";
    const unidade = filialDe.get(c.id)?.filial === 2 ? 2 : 1;
    return {
      id: c.id,
      codigo: c.codigoRM,
      nome: c.nomeRM ?? c.nomeControladoria ?? c.codigoRM ?? "Centro",
      grupo: c.nomeControladoria ?? "Sem Grupo",
      departamento: c.departamento,
      balde: c.balde,
      grupoDRE,
      unidade,
      destino: destinoDoCentro(grupoDRE, c.balde, unidade),
    };
  });
}

function destinoDoCentro(grupoDRE: string, balde: string | null, unidade: 1 | 2) {
  if (DESPESAS.has(grupoDRE)) return "Despesas e Extra";
  if (grupoDRE === "CSM") return balde === "ACOMPANHAMENTO" ? "Rateio de Acompanhamento (Montagem e Complementar)" : "Serviços";
  switch (balde) {
    case "MATRIZ":
      return "Matriz";
    case "FILIAL":
      return "Filial";
    case "PRODUCAO":
      return "Rateio de Produção (Matriz e Filial)";
    case "PROJETO":
      return "Rateio de Projeto (Matriz e Filial)";
    case "METALURGIA":
      return "Rateio de Metalurgia (Matriz, Filial, Montagem e Complementar)";
    case "ARMADURA":
      return "Rateio de Armadura (Matriz, Filial, Montagem e Complementar)";
    case "OBRAS":
      return "Serviços";
    default:
      return unidade === 2 ? "Filial" : "Matriz";
  }
}

/** As contas de um centro no cenário: as da atribuição do centro, no grupo da DRE dele. */
export function contasDoCentro(est: LinhaEstrutura[], c: Pick<CentroDoCenario, "grupoDRE">) {
  return est.filter((l) => l.tipo === "ITEM" && l.codigo.startsWith(`${c.grupoDRE}.`) && ATRIBUICOES.has(l.codigo.split(".")[1]));
}

/** Os percentuais de um mês: a parte de cada destino em cada chave ("PRODUCAO|MATRIZ" → 0,6). */
export type Percentuais = Map<string, number>;

/**
 * Os percentuais médios do realizado (13/10/2026): por chave, o volume de cada destino sobre o da chave, somados nas
 * competências fechadas do último exercício com competência fechada (a média ponderada pelos volumes dos meses).
 */
export async function percentuaisDoRealizado(): Promise<{ percentuais: Percentuais; periodo: string | null }> {
  const prisma = getPrismaClient();
  const ultima = await prisma.competencia.findFirst({ where: { status: "FECHADA" }, orderBy: [{ ano: "desc" }, { mes: "desc" }], select: { ano: true } });
  if (!ultima) return { percentuais: new Map(), periodo: null };
  const comps = await prisma.competencia.findMany({ where: { status: "FECHADA", ano: ultima.ano }, select: { id: true, mes: true }, orderBy: { mes: "asc" } });
  const volumes = await prisma.volumeOperacional.findMany({ where: { competenciaId: { in: comps.map((c) => c.id) } }, include: { regraRateio: { select: { chave: true, destino: true } } } });
  const porDestino = new Map<string, number>();
  const porChave = new Map<string, number>();
  for (const v of volumes) {
    const q = Number(v.quantidade);
    porDestino.set(`${v.regraRateio.chave}|${v.regraRateio.destino}`, (porDestino.get(`${v.regraRateio.chave}|${v.regraRateio.destino}`) ?? 0) + q);
    porChave.set(v.regraRateio.chave, (porChave.get(v.regraRateio.chave) ?? 0) + q);
  }
  const percentuais: Percentuais = new Map();
  for (const [k, q] of porDestino) {
    const total = porChave.get(k.split("|")[0]) ?? 0;
    percentuais.set(k, total ? q / total : 0);
  }
  const nomes = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  const periodo = comps.length ? `${nomes[comps[0].mes - 1]}–${nomes[comps[comps.length - 1].mes - 1]}/${ultima.ano}` : null;
  return { percentuais, periodo };
}

/** As chaves e os destinos dos rateios, na ordem da aba Rateios. */
export const RATEIOS: Array<{ chave: string; destino: string; rotulo: string }> = [
  { chave: "PRODUCAO", destino: "MATRIZ", rotulo: "Produção: Matriz" },
  { chave: "PRODUCAO", destino: "FILIAL", rotulo: "Produção: Filial" },
  { chave: "PROJETO", destino: "MATRIZ", rotulo: "Projeto: Matriz" },
  { chave: "PROJETO", destino: "FILIAL", rotulo: "Projeto: Filial" },
  { chave: "METALURGIA", destino: "MATRIZ", rotulo: "Metalurgia: Matriz" },
  { chave: "METALURGIA", destino: "FILIAL", rotulo: "Metalurgia: Filial" },
  { chave: "METALURGIA", destino: "MONTAGEM", rotulo: "Metalurgia: Montagem" },
  { chave: "METALURGIA", destino: "COMPLEMENTAR", rotulo: "Metalurgia: Complementar" },
  { chave: "ARMADURA", destino: "MATRIZ", rotulo: "Armadura: Matriz" },
  { chave: "ARMADURA", destino: "FILIAL", rotulo: "Armadura: Filial" },
  { chave: "ARMADURA", destino: "MONTAGEM", rotulo: "Armadura: Montagem" },
  { chave: "ARMADURA", destino: "COMPLEMENTAR", rotulo: "Armadura: Complementar" },
  { chave: "ACOMPANHAMENTO", destino: "MONTAGEM", rotulo: "Acompanhamento: Montagem" },
  { chave: "ACOMPANHAMENTO", destino: "COMPLEMENTAR", rotulo: "Acompanhamento: Complementar" },
];

/**
 * Os percentuais de cada mês do cenário: a Produção pelo m³ produzido do cenário na Matriz e na Filial (sem produção no
 * mês, a média do realizado); as demais chaves, a média do realizado.
 */
export function percentuaisDoCenario(realizado: Percentuais, m3Matriz: number[], m3Filial: number[]): Percentuais[] {
  return Array.from({ length: 12 }, (_, k) => {
    const p = new Map(realizado);
    const total = (m3Matriz[k] ?? 0) + (m3Filial[k] ?? 0);
    if (total > 0) {
      p.set("PRODUCAO|MATRIZ", (m3Matriz[k] ?? 0) / total);
      p.set("PRODUCAO|FILIAL", (m3Filial[k] ?? 0) / total);
    }
    return p;
  });
}

/**
 * Aloca os valores dos centros às unidades (13/10/2026): devolve, por unidade e conta da DRE, os doze meses. `valores`:
 * por centro, conta (código) e mês (1 a 12).
 */
export function alocarCentros(est: LinhaEstrutura[], centros: CentroDoCenario[], valores: Array<{ centroId: string; codigo: string; mes: number; valor: number }>, percentuais: Percentuais[]) {
  const porCodigo = new Map(est.map((l) => [l.codigo, l]));
  const porTripla = new Map(est.filter((l) => l.tipo === "ITEM").map((l) => [`${l.grupoSigla}|${(l.atribuicao ?? "").toUpperCase()}|${l.descricao.toUpperCase()}`, l]));
  const equivalente = (l: LinhaEstrutura, grupo: string) => porTripla.get(`${grupo}|${(l.atribuicao ?? "").toUpperCase()}|${l.descricao.toUpperCase()}`);
  const porCentro = new Map(centros.map((c) => [c.id, c]));
  const r = new Map<string, number[]>();
  const somar = (u: number, codigo: string | undefined, mes: number, v: number) => {
    if (!codigo || !v) return;
    const k = `${u}|${codigo}`;
    const lista = r.get(k) ?? Array<number>(12).fill(0);
    lista[mes - 1] += v;
    r.set(k, lista);
  };
  for (const x of valores) {
    const c = porCentro.get(x.centroId);
    const l = porCodigo.get(x.codigo);
    if (!c || !l) continue;
    const pct = (chave: string, destino: string) => percentuais[x.mes - 1]?.get(`${chave}|${destino}`) ?? 0;
    const grupo = l.codigo.split(".")[0];
    if (DESPESAS.has(grupo)) {
      somar(4, l.codigo, x.mes, x.valor);
    } else if (grupo === "CSM") {
      if (c.balde === "ACOMPANHAMENTO") {
        somar(3, l.codigo, x.mes, x.valor * pct("ACOMPANHAMENTO", "MONTAGEM"));
        somar(3, equivalente(l, "CSC")?.codigo, x.mes, x.valor * pct("ACOMPANHAMENTO", "COMPLEMENTAR"));
      } else somar(3, l.codigo, x.mes, x.valor);
    } else if (grupo === "CPP") {
      switch (c.balde) {
        case "MATRIZ":
          somar(1, l.codigo, x.mes, x.valor);
          break;
        case "FILIAL":
          somar(2, l.codigo, x.mes, x.valor);
          break;
        case "PRODUCAO":
        case "PROJETO":
          somar(1, l.codigo, x.mes, x.valor * pct(c.balde, "MATRIZ"));
          somar(2, l.codigo, x.mes, x.valor * pct(c.balde, "FILIAL"));
          break;
        case "METALURGIA":
        case "ARMADURA":
          somar(1, l.codigo, x.mes, x.valor * pct(c.balde, "MATRIZ"));
          somar(2, l.codigo, x.mes, x.valor * pct(c.balde, "FILIAL"));
          // Em Serviços, na conta de mesma atribuição e descrição (sem ela, como no fechamento, a parte não entra).
          somar(3, equivalente(l, "CSM")?.codigo, x.mes, x.valor * pct(c.balde, "MONTAGEM"));
          somar(3, equivalente(l, "CSC")?.codigo, x.mes, x.valor * pct(c.balde, "COMPLEMENTAR"));
          break;
        case "OBRAS":
          somar(3, equivalente(l, "CSM")?.codigo, x.mes, x.valor);
          break;
        default:
          somar(c.unidade, l.codigo, x.mes, x.valor);
      }
    }
  }
  return r;
}
