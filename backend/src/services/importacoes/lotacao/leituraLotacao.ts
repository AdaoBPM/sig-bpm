import type { LinhaPlanilha, ValorCelula } from "../../../lib/xlsx.js";
import { data, localizarCabecalho, mesmoMes, numero, texto, vazia } from "../listas/leituraListas.js";

/**
 * A leitura da aba Quadro de Lotação do SIG BPM 2026 - LISTAS REALIZADO (OPERAÇÃO) (19/10/2026): os colaboradores do mês
 * (a coluna PERÍODO) por centro de custo, CLT e PJ, com a unidade, o departamento e a atribuição da aba. É a referência do
 * quadro de lotação realizado por centro nos cenários analíticos. Não entra na apuração, e os indicadores de quadro de
 * lotação do mês continuam saindo da aba Indicadores (Admin.).
 */

export const ABA_LOTACAO = "Quadro de Lotação";
export const ROTULO_LOTACAO = "Quadro de Lotação";

export type ItemLotacao = {
  linhaArquivo: number;
  centroCusto: string;
  unidade: string | null;
  departamento: string | null;
  atribuicao: string | null;
  clt: number;
  pj: number;
  total: number;
};
export type RejeicaoLotacao = { linha: number; codigo: "SEM_CENTRO" | "QUANTIDADE_INVALIDA" | "TOTAL_DIFERENTE"; mensagem: string };
export type LeituraLotacao =
  | { ok: true; itens: ItemLotacao[]; rejeicoes: RejeicaoLotacao[]; lidas: number; foraDoMes: number; zerados: number }
  | { ok: false; motivo: string };

/** Colaboradores: um inteiro não negativo (vazio conta zero, como na soma da aba); undefined quando não é. */
function colaboradores(v: ValorCelula | undefined): number | undefined {
  const n = numero(v);
  if (n === undefined || !n.isInteger() || n.isNegative()) return undefined;
  return n.toNumber();
}

/** As linhas do mês da aba. */
export function lerLotacao(linhas: LinhaPlanilha[], ano: number, mes: number): LeituraLotacao {
  const cab = localizarCabecalho(linhas, ["PERÍODO", "CENTRO DE CUSTO", "CLT", "PJ"], ["UNIDADE", "DEPARTAMENTO", "ATRIBUIÇÃO", "TOTAL"]);
  if ("erro" in cab) return { ok: false, motivo: cab.erro };
  const c = (l: LinhaPlanilha, n: string) => (cab.col[n] >= 0 ? (l.celulas[cab.col[n]] ?? null) : null);
  const itens: ItemLotacao[] = [];
  const rejeicoes: RejeicaoLotacao[] = [];
  let lidas = 0;
  let foraDoMes = 0;
  let zerados = 0;
  for (const l of linhas) {
    if (l.numero <= cab.numero) continue;
    const periodo = data(c(l, "PERÍODO"));
    if (!periodo) continue; // linha vazia (a aba tem fórmulas até o fim)
    lidas++;
    if (!mesmoMes(periodo, ano, mes)) {
      foraDoMes++;
      continue;
    }
    const centroCusto = texto(c(l, "CENTRO DE CUSTO"));
    const clt = colaboradores(c(l, "CLT"));
    const pj = colaboradores(c(l, "PJ"));
    if (!centroCusto) {
      if (vazia(c(l, "CLT")) && vazia(c(l, "PJ"))) {
        zerados++;
        continue;
      }
      rejeicoes.push({ linha: l.numero, codigo: "SEM_CENTRO", mensagem: "Linha com colaboradores e sem CENTRO DE CUSTO." });
      continue;
    }
    if (clt === undefined || pj === undefined) {
      rejeicoes.push({
        linha: l.numero,
        codigo: "QUANTIDADE_INVALIDA",
        mensagem: `${centroCusto}: CLT e PJ precisam ser números inteiros, sem sinal (CLT ${String(c(l, "CLT"))}, PJ ${String(c(l, "PJ"))}).`,
      });
      continue;
    }
    const total = clt + pj;
    const naAba = c(l, "TOTAL");
    if (naAba !== null && naAba !== "" && colaboradores(naAba) !== total) {
      rejeicoes.push({ linha: l.numero, codigo: "TOTAL_DIFERENTE", mensagem: `${centroCusto}: o TOTAL (${String(naAba)}) não é CLT + PJ (${total}).` });
      continue;
    }
    if (total === 0) {
      zerados++;
      continue;
    }
    itens.push({
      linhaArquivo: l.numero,
      centroCusto,
      unidade: texto(c(l, "UNIDADE")),
      departamento: texto(c(l, "DEPARTAMENTO")),
      atribuicao: texto(c(l, "ATRIBUIÇÃO")),
      clt,
      pj,
      total,
    });
  }
  return { ok: true, itens, rejeicoes, lidas, foraDoMes, zerados };
}
