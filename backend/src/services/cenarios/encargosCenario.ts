import type { GrupoDoCenario } from "./centrosCenario.js";

/**
 * Os Encargos e Benefícios dos centros de custo dos cenários analíticos (19/10/2026; o "Exemplo de Cálculo dos Encargos e
 * Benefícios" do Quadro de Lotação): na aba Centros de Custo das Premissas, embaixo do Quadro de Lotação, os percentuais
 * de cada grupo e mês — Previdência Social (INSS), Fundo de Garantia (FGTS), Férias (+1/3) e Décimo Terceiro, com o padrão
 * abaixo em todos os cenários, editáveis — e os Benefícios Adicionais (R$, digitados). A conta Encargos e Benefícios da
 * mão de obra (direta e indireta) é calculada, mês a mês:
 *
 *   (Remunerações CLT + Horas Extras) × (INSS + FGTS + Férias + Décimo Terceiro) + Benefícios Adicionais
 *
 * As Remunerações PJ não têm encargos. Os Benefícios Adicionais entram na mão de obra da atribuição do grupo (Direta: a
 * MOD; Indireta ou sem atribuição: a MOI; a outra, quando o grupo da DRE só tem uma). A Média de Referência da conta fica a
 * do realizado. Gravados nas premissas com a unidade 0, a venda de cada item e a chave o grupo; os percentuais, em fração.
 */

export type ItemDosEncargos = "INSS" | "FGTS" | "FERIAS" | "DECIMO_TERCEIRO" | "BENEFICIOS";
export const ITENS_DOS_ENCARGOS: Array<{ item: ItemDosEncargos; venda: string; rotulo: string; und: "%" | "R$"; padrao: number | null }> = [
  { item: "INSS", venda: "ENCARGOS_INSS", rotulo: "Previdência Social (INSS)", und: "%", padrao: 0.29 },
  { item: "FGTS", venda: "ENCARGOS_FGTS", rotulo: "Fundo de Garantia (FGTS)", und: "%", padrao: 0.08 },
  // 1/12 de férias por mês trabalhado, com o terço constitucional: 1/12 × 4/3.
  { item: "FERIAS", venda: "ENCARGOS_FERIAS", rotulo: "Férias (+1/3)", und: "%", padrao: 1 / 9 },
  { item: "DECIMO_TERCEIRO", venda: "ENCARGOS_13", rotulo: "Décimo Terceiro", und: "%", padrao: 1 / 12 },
  { item: "BENEFICIOS", venda: "BENEFICIOS", rotulo: "Benefícios Adicionais", und: "R$", padrao: null },
];
export const VENDAS_DOS_ENCARGOS = new Set(ITENS_DOS_ENCARGOS.map((i) => i.venda));
export const itemDosEncargos = (item: string) => ITENS_DOS_ENCARGOS.find((i) => i.item === item);
const PERCENTUAIS = ITENS_DOS_ENCARGOS.filter((i) => i.und === "%");

/** O sufixo das contas da mão de obra. */
const REMUNERACOES_CLT = "REMUNERACOES_CLT";
const HORAS_EXTRAS = "HORAS_EXTRAS";
const ENCARGOS = "ENCARGOS_E_BENEFICIOS";
/** A conta é a Encargos e Benefícios (calculada nos analíticos)? */
export const ehContaDeEncargos = (codigo: string) => codigo.endsWith(`.${ENCARGOS}`);

/**
 * As contas de encargos de um grupo: para cada mão de obra (o prefixo "CPP.MOD"…) que o grupo tem, a conta de encargos,
 * as de base e se é a dos Benefícios Adicionais.
 */
export function maosDeObraDoGrupo(codigos: string[], atribuicao: GrupoDoCenario["atribuicao"]) {
  const prefixos = [...new Set(codigos.filter(ehContaDeEncargos).map((c) => c.slice(0, -ENCARGOS.length - 1)))];
  const direta = prefixos.find((p) => p.endsWith(".MOD"));
  const indireta = prefixos.find((p) => p.endsWith(".MOI"));
  const principal = atribuicao === "DIRETA" ? (direta ?? indireta) : (indireta ?? direta);
  return prefixos.map((p) => ({ encargos: `${p}.${ENCARGOS}`, remuneracoes: `${p}.${REMUNERACOES_CLT}`, horasExtras: `${p}.${HORAS_EXTRAS}`, beneficios: p === principal }));
}

/**
 * O valor de um item dos encargos de um grupo num mês: o gravado; sem ele, o padrão (nos Benefícios Adicionais, zero).
 * `gravado` lê a premissa (venda, grupo, mês).
 */
export function valorDoItem(item: (typeof ITENS_DOS_ENCARGOS)[number], gravado: (venda: string, mes: number) => number | undefined, mes: number) {
  return gravado(item.venda, mes) ?? item.padrao ?? 0;
}

/**
 * Os Encargos e Benefícios de um grupo nos doze meses (conta → os doze meses): `conta(codigo, mes)` lê o valor das contas
 * do grupo; `gravado(venda, mes)`, as premissas dos encargos.
 */
export function encargosDoGrupo(
  codigos: string[],
  atribuicao: GrupoDoCenario["atribuicao"],
  conta: (codigo: string, mes: number) => number,
  gravado: (venda: string, mes: number) => number | undefined,
) {
  const r = new Map<string, number[]>();
  const beneficios = ITENS_DOS_ENCARGOS.find((i) => i.item === "BENEFICIOS")!;
  for (const mo of maosDeObraDoGrupo(codigos, atribuicao)) {
    r.set(
      mo.encargos,
      Array.from({ length: 12 }, (_, k) => {
        const mes = k + 1;
        const percentual = PERCENTUAIS.reduce((s, i) => s + valorDoItem(i, gravado, mes), 0);
        const base = conta(mo.remuneracoes, mes) + conta(mo.horasExtras, mes);
        return base * percentual + (mo.beneficios ? valorDoItem(beneficios, gravado, mes) : 0);
      }),
    );
  }
  return r;
}
