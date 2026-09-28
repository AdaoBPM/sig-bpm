import type {
  AtribuicaoCusto,
  BaldeAlocacao,
  TipoAlocacao,
  TipoConta,
  ValidacaoLancamento,
} from "../../generated/prisma/enums.js";
import { ehCentroDeObra } from "./centrosObra.js";

/**
 * Classificação de um lançamento do balancete — a versão sistêmica das colunas
 * G a T da aba `Gastos (Contábil)` do BASE REALIZADO (RESULTADOS).
 *
 * Diferenças deliberadas em relação à planilha:
 *  - o centro de custo é localizado pelo CÓDIGO do RM, não pelo nome;
 *  - a troca de conta (CONTA (ALOC.)) vem do cadastro de reclassificação, e não
 *    de um valor digitado ao lado da linha;
 *  - a verificação compara os NOMES de departamento e atribuição. As siglas
 *    (DEP., ATR.) da planilha são só abreviação visual.
 *
 * Função pura: recebe o cadastro já resolvido e devolve os campos derivados.
 */

export type CentroParaClassificar = {
  id: string;
  departamento: string | null;
  atribuicao: AtribuicaoCusto | null;
  balde: BaldeAlocacao | null;
};

export type ContaParaClassificar = {
  id: string;
  tipoConta: TipoConta;
  departamento: string | null;
  atribuicao: string | null;
  balde: BaldeAlocacao | null;
  linhaDREId: string | null;
  /** Rótulo da linha da DRE — a CONTA DRE da planilha, usado na etiqueta. */
  linhaDREDescricao: string | null;
};

export type Classificacao = {
  centroCustoId: string | null;
  contaAdotadaId: string;
  departamento: string | null;
  atribuicao: string | null;
  linhaDREId: string | null;
  balde: BaldeAlocacao | null;
  alocacao: TipoAlocacao;
  etiqueta: string;
  validacao: ValidacaoLancamento;
};

/**
 * Departamentos de custo e despesa: só eles passam pela verificação. São
 * também os únicos que contam como parâmetro do centro — ALMOXARIFADO,
 * INVESTIMENTO e REQUISIÇÃO, que a planilha marca com sigla "-", não são
 * departamento da DRE e deixam o centro sem parâmetro.
 */
export const DEPARTAMENTOS_VERIFICADOS = new Set([
  "CUSTOS DE PRODUÇÃO (CP)",
  "CUSTOS DE SERVIÇOS: MONTAGEM (CSM)",
  "CUSTOS DE SERVIÇOS: COMPLEMENTARES (CSC)",
  "DESPESAS DE LOGÍSTICA (DL)",
  "DESPESAS TÉCNICAS (DT)",
  "DESPESAS COMERCIAIS (DC)",
  "DESPESAS ADMINISTRATIVAS (DA)",
]);

/** Atribuições de conta que não cabem em centro direto, e em centro indireto. */
const PROIBIDAS_EM_DIRETA = new Set(["Mão de Obra Indireta", "Gastos Gerais Indiretos"]);
const PROIBIDAS_EM_INDIRETA = new Set(["Mão de Obra Direta", "Gastos Gerais Diretos"]);

/** Baldes que são chave de rateio; os demais são alocação direta. */
const CHAVES_RATEIO = new Set<BaldeAlocacao>([
  "PROJETO",
  "PRODUCAO",
  "METALURGIA",
  "ARMADURA",
  "ACOMPANHAMENTO",
]);

/** Rótulo do balde como a planilha escreve — é o prefixo da etiqueta. */
const ROTULO_BALDE: Partial<Record<BaldeAlocacao, string>> = {
  PRODUCAO: "PRODUÇÃO",
};

/**
 * A coluna LANÇ. OK?, na ordem da fórmula da planilha:
 *  1. o centro tem departamento ou atribuição e a conta não → <ERRO!>;
 *  2. a conta não é de custo nem de despesa → a verificação para;
 *  3. departamento do centro ≠ da conta → <DEP.!>; atribuição incompatível → <ATR.!>.
 * O caso inverso de 1 (conta com parâmetro, centro sem) NÃO é erro: é o caso
 * dos centros de obra, que por definição não têm parâmetro.
 */
export function verificarLancamento(
  centro: { departamento: string | null; atribuicao: AtribuicaoCusto | null },
  conta: { departamento: string | null; atribuicao: string | null },
): ValidacaoLancamento {
  if (centro.departamento && !conta.departamento) return "ERRO_PARAMETRIZACAO";
  if (centro.atribuicao && !conta.atribuicao) return "ERRO_PARAMETRIZACAO";
  if (!conta.departamento || !DEPARTAMENTOS_VERIFICADOS.has(conta.departamento)) return "OK";
  if (centro.departamento && centro.departamento !== conta.departamento) {
    return "ERRO_DEPARTAMENTO";
  }
  const atr = conta.atribuicao ?? "";
  if (centro.atribuicao === "DIRETA" && PROIBIDAS_EM_DIRETA.has(atr)) return "ERRO_ATRIBUICAO";
  if (centro.atribuicao === "INDIRETA" && PROIBIDAS_EM_INDIRETA.has(atr)) return "ERRO_ATRIBUICAO";
  return "OK";
}

export function classificarLancamento(
  codigoCentroCusto: string | null,
  centro: CentroParaClassificar | null,
  contaAdotada: ContaParaClassificar,
): Classificacao {
  const obra = codigoCentroCusto !== null && ehCentroDeObra(codigoCentroCusto);
  const centroNaoCadastrado = codigoCentroCusto !== null && !obra && !centro;
  const centroValido = obra ? null : centro;

  // Lançamento sem centro não é verificado: na planilha os dois lados viram "-".
  const semCentro = codigoCentroCusto === null;
  let validacao: ValidacaoLancamento = centroNaoCadastrado
    ? "CENTRO_NAO_CADASTRADO"
    : semCentro
      ? "OK"
      : verificarLancamento(
          {
            departamento:
              centroValido?.departamento && DEPARTAMENTOS_VERIFICADOS.has(centroValido.departamento)
                ? centroValido.departamento
                : null,
            atribuicao: centroValido?.atribuicao ?? null,
          },
          {
            departamento: contaAdotada.departamento,
            atribuicao: contaAdotada.atribuicao,
          },
        );

  if (
    validacao === "OK" &&
    contaAdotada.tipoConta === "ANALITICA" &&
    !contaAdotada.linhaDREId
  ) {
    validacao = "SEM_DESTINO";
  }

  // RATEIO: o do centro, quando o centro está no cadastro — mesmo que vazio, e
  // mesmo sendo de obra; senão o da conta. É o IFERROR(centro; conta) da
  // planilha, que ao contrário do departamento não exclui as obras.
  const balde = centro ? centro.balde : contaAdotada.balde;
  const alocacao: TipoAlocacao = balde && CHAVES_RATEIO.has(balde) ? "RATEIO" : "DIRETO";

  const partes = [
    contaAdotada.departamento ?? "-",
    contaAdotada.atribuicao ?? "-",
    contaAdotada.linhaDREDescricao ?? "-",
  ];
  const etiqueta =
    alocacao === "RATEIO"
      ? [ROTULO_BALDE[balde!] ?? balde!, ...partes].join(".")
      : partes.join(".");

  return {
    centroCustoId: centro?.id ?? null,
    contaAdotadaId: contaAdotada.id,
    departamento: contaAdotada.departamento,
    atribuicao: contaAdotada.atribuicao,
    linhaDREId: contaAdotada.linhaDREId,
    balde,
    alocacao,
    etiqueta,
    validacao,
  };
}
