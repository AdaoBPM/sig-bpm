import { getPrismaClient } from "../../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { ACESSO_TOTAL, type Acesso } from "../acesso/acesso.js";
import { podeVerLinhaNaObra } from "../acesso/recorteDepartamento.js";
import type { LinhaEstrutura } from "./apuracaoUnidades.js";
import { avaliarEstrutura, soSoma } from "./consolidacao.js";
import { estrutura, RegraDREError } from "./dreService.js";

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;
const zero = () => new Decimal(0);
const rotulo = (ano: number, mes: number) => `${String(mes).padStart(2, "0")}/${ano}`;

/**
 * A DRE por obra (aba Obras da DRE, pedido de 09/10/2026): os lançamentos do
 * balancete nos centros de custo de obra — 1.98 (obras com montagem) e 1.99
 * (obras de venda da Matriz e da Filial) —, pela linha da DRE em que foram
 * classificados, antes de qualquer rateio. Todos os tipos de movimento entram:
 * receita operacional, impostos, custos, despesas e receitas e despesas
 * financeiras.
 *
 * Os centros de obra não estão no cadastro de centros de custo: a obra é
 * identificada pelo código do centro no RM, como veio no balancete, e o nome
 * é o do balancete. Não há gravação própria na apuração: a classificação dos
 * lançamentos fica congelada com ela (classificacaoService), então a soma dos
 * lançamentos é a da apuração.
 *
 * Como na DRE das unidades, as receitas (ROB e receitas financeiras) aparecem
 * com o sinal trocado — positivas — e os custos e despesas positivos. O
 * balancete não tem a receita líquida por natureza (na DRE das unidades ela
 * sai da receita prévia): na obra, a Receita Operacional Líquida é a ROB menos
 * os impostos (IRB), e dela saem as margens até o Resultado Líquido, que é o
 * resultado da obra no mês — o valor na lista das obras. A tabela da obra não
 * mostra esses totais calculados (pedido de 09/10/2026): a primeira ROL, o CPV,
 * a MB, a MC, o EBITDA, o EBIT, o NOPAT e o RL (CALCULADOS). No recorte do Gestor por departamento, só as
 * linhas dos departamentos dele, com os totais que só somam (como nos centros); no do Coordenador (com a opção de
 * ver as obras, 11/10/2026), as da gestão dele, também com os totais que só somam.
 */

export const CENTRO_DE_OBRA = /^1\.9[89]\./;
const ehCentroDeObra = (codigo: string | null): codigo is string => !!codigo && CENTRO_DE_OBRA.test(codigo);

/** As linhas cuja movimentação entra com o sinal trocado: as receitas. */
const RECEITAS = new Set(["ROB", "RFC", "RFNC"]);
export const sinalDaLinha = (codigo: string) => (RECEITAS.has(codigo.split(".")[0]) ? -1 : 1);

const ROB = "ROB.RECEITA_OPERACIONAL_BRUTA_ROB";
const IRB = "IRB.IMPOSTOS_SOBRE_A_RECEITA_BRUTA_IRB";
const ROL = "ROL.RECEITA_OPERACIONAL_LIQUIDA_ROL";
const RL = "RL.RESULTADO_LIQUIDO_RL";

/** Os totais calculados que a tabela da obra não mostra (a primeira ROL, CPV, margens e resultados). */
const CALCULADOS = new Set([
  "RO.RECEITA_OPERACIONAL_LIQUIDA_ROL",
  "CPV.CUSTO_DE_PRODUTO_VENDIDO_CPV",
  "MB.MARGEM_BRUTA_MB",
  "MC.MARGEM_DE_CONTRIBUICAO_MC",
  "EBITDA.LUCRO_OPERACIONAL_EBITDA",
  "EBIT.MARGEM_LIQUIDA_EBIT",
  "NOPAT.LUCRO_OPERACIONAL_LIQUIDO_NOPAT",
  RL,
]);

type Movimento = { codigoCentroCusto: string | null; nomeCentroCusto: string | null; linhaDREId: string | null; valorMovimento: Decimal };

/** Os itens de uma obra (com o sinal da DRE), e os subtotais e totais pela estrutura. */
export function linhasDaObra(linhas: LinhaEstrutura[], itens: Map<string, { valor: Decimal; n: number }>, completa: boolean) {
  // As contas com soma zero no mês ficam de fora, como nos centros.
  itens = new Map([...itens].filter(([, a]) => !a.valor.isZero()));
  const diretos = new Map([...itens].map(([c, a]) => [c, a.valor]));
  let totais: Map<string, Decimal>;
  if (completa) {
    // A ROL da obra é a ROB menos os impostos; com ela, as margens e o resultado pela estrutura.
    const somas = avaliarEstrutura(linhas, diretos, soSoma);
    const rol = (somas.get(ROB) ?? zero()).minus(somas.get(IRB) ?? zero());
    const comRol = new Map(diretos);
    if (!rol.isZero()) comRol.set(ROL, rol);
    totais = avaliarEstrutura(linhas, comRol, () => true);
    if (!rol.isZero()) totais.set(ROL, rol);
  } else {
    totais = avaliarEstrutura(linhas, diretos, soSoma);
  }
  return linhas
    .filter((l) => l.tipo === "SECAO" || itens.has(l.codigo) || (l.tipo !== "ITEM" && !(totais.get(l.codigo) ?? zero()).isZero()))
    .map((l) => {
      const item = itens.get(l.codigo);
      const valor = item?.valor ?? totais.get(l.codigo) ?? null;
      return {
        codigo: l.codigo,
        tipo: l.tipo,
        grupo: l.grupo,
        grupoSigla: l.grupoSigla,
        descricao: l.descricao,
        valor: l.tipo === "SECAO" ? null : (valor?.toFixed(2) ?? null),
        composicao: null,
        podeDetalhar: true,
      };
    });
}

async function competencia(ano: number, mes: number) {
  const c = await getPrismaClient().competencia.findUnique({ where: { ano_mes: { ano, mes } }, select: { id: true, status: true } });
  if (!c) throw new RegraDREError(404, `A competência ${rotulo(ano, mes)} não existe.`);
  return c;
}

/** A apuração da DRE do mês (a data e se está congelada), ou null se ainda não foi apurada. */
async function apuracao(competenciaId: string) {
  const r = await getPrismaClient().resultadoApurado.findFirst({ where: { competenciaId, unidadeNegocioId: null, centroCustoId: null }, select: { apuradoEm: true, congelado: true } });
  return r;
}

/** Os lançamentos dos centros de obra no mês, nas linhas que o usuário alcança, agrupados por obra e linha. */
async function movimentos(competenciaId: string, linhas: LinhaEstrutura[], acesso: Acesso, obra?: string) {
  const ls: Movimento[] = await getPrismaClient().lancamentoContabil.findMany({
    where: { competenciaId, linhaDREId: { not: null }, ...(obra ? { codigoCentroCusto: obra } : { OR: [{ codigoCentroCusto: { startsWith: "1.98." } }, { codigoCentroCusto: { startsWith: "1.99." } }] }) },
    select: { codigoCentroCusto: true, nomeCentroCusto: true, linhaDREId: true, valorMovimento: true },
  });
  const porId = new Map(linhas.filter((l) => podeVerLinhaNaObra(acesso, l)).map((l) => [l.id, l]));
  const obras = new Map<string, { nomes: Map<string, number>; itens: Map<string, { valor: Decimal; n: number }> }>();
  for (const m of ls) {
    if (!ehCentroDeObra(m.codigoCentroCusto)) continue;
    const l = porId.get(m.linhaDREId!);
    if (!l) continue;
    const o = obras.get(m.codigoCentroCusto) ?? { nomes: new Map<string, number>(), itens: new Map<string, { valor: Decimal; n: number }>() };
    const nome = m.nomeCentroCusto?.trim();
    if (nome) o.nomes.set(nome, (o.nomes.get(nome) ?? 0) + 1);
    const a = o.itens.get(l.codigo) ?? { valor: zero(), n: 0 };
    o.itens.set(l.codigo, { valor: a.valor.plus(m.valorMovimento.times(sinalDaLinha(l.codigo))), n: a.n + 1 });
    obras.set(m.codigoCentroCusto, o);
  }
  // O nome mais frequente no mês (o balancete repete o nome em cada lançamento).
  const nomeDe = (o: { nomes: Map<string, number> }, codigo: string) => [...o.nomes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? codigo;
  return [...obras].map(([codigo, o]) => ({ codigo, nome: nomeDe(o, codigo), itens: o.itens }));
}

/** O total da obra na lista: o Resultado Líquido; no recorte, a soma das linhas que o usuário vê. */
function totalDa(linhas: Array<{ codigo: string; tipo: string; valor: string | null }>) {
  const rl = linhas.find((l) => l.codigo === RL);
  if (rl?.valor) return rl.valor;
  return linhas.filter((l) => l.tipo === "ITEM").reduce((s, l) => s.plus(l.valor ?? 0), zero()).toFixed(2);
}

export const obrasService = {
  /** As obras com lançamento no mês, em ordem de nome, com o total de cada uma. */
  async listar(ano: number, mes: number, acesso: Acesso = ACESSO_TOTAL) {
    const c = await competencia(ano, mes);
    const ap = await apuracao(c.id);
    const linhas = await estrutura();
    // Desde a importação do balancete (15/10/2026; antes, só depois da apuração): os lançamentos dos centros de obra.
    const obras = await movimentos(c.id, linhas, acesso);
    const completa = !acesso.recorteDepartamento && !acesso.recorteCentro;
    return {
      competencia: { ano, mes, status: c.status },
      apuradoEm: ap?.apuradoEm ?? null,
      obras: obras
        .map((o) => ({ codigo: o.codigo, nome: o.nome, total: totalDa(linhasDaObra(linhas, o.itens, completa)) }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || a.codigo.localeCompare(b.codigo)),
    };
  },

  /** A DRE de uma obra (o código do centro no RM). */
  async consultar(ano: number, mes: number, obra: string, acesso: Acesso = ACESSO_TOTAL) {
    if (!CENTRO_DE_OBRA.test(obra)) throw new RegraDREError(400, `${obra} não é um centro de custo de obra (1.98 ou 1.99).`);
    const c = await competencia(ano, mes);
    const ap = await apuracao(c.id);
    const linhas = await estrutura();
    const [o] = await movimentos(c.id, linhas, acesso, obra);
    if (!o) throw new RegraDREError(404, `Nenhum lançamento da obra ${obra} em ${rotulo(ano, mes)}.`);
    return {
      competencia: { ano, mes, status: c.status },
      obra: { codigo: o.codigo, nome: o.nome },
      apuradoEm: ap?.apuradoEm ?? null,
      congelado: ap?.congelado ?? false,
      linhas: linhasDaObra(linhas, o.itens, !acesso.recorteDepartamento && !acesso.recorteCentro).filter((l) => !CALCULADOS.has(l.codigo)),
    };
  },
};
