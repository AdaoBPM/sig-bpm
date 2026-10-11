import { Prisma } from "../../../generated/prisma/client.js";
import type { LinhaPlanilha, ValorCelula } from "../../../lib/xlsx.js";
import { localizarCabecalho, normalizar, texto, vazia } from "../listas/leituraListas.js";

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

/**
 * Leitura da aba DRE do CONTROLE DAS VENDAS - COMERCIAL: a DRE de venda de
 * cada obra, por versão, etapa, linha e conta, com valor total e unitário.
 * É dela que a receita prévia tira o preço (V. UNIT. da versão 0).
 *
 * A planilha é colada pelo Comercial ("Colar Apenas Valores"), e às vezes a
 * DRE de uma obra entra duas vezes. Linhas idênticas repetidas são gravadas
 * uma vez e viram aviso — na planilha, o SOMASES da receita as somaria.
 */

export const ABA_DRE_COMERCIAL = "DRE";
export const ABA_PEDIDOS = "Pedidos";

/**
 * Só entram as linhas da DRE que a receita prévia usa (decisão do usuário,
 * 29/09/2026): os preços de pré-fabricado e frete, pela ATRIBUIÇÃO, e, na
 * LINHA MONTAGEM, as de DEPTO. ROB e IRB — delas sai a proporção que dá a
 * receita líquida das medições (Receita (Serviços), coluna M).
 */
const ATRIBUICOES_DE_PRECO = new Set(
  ["Receita Bruta do Pré-Fabricado", "Receita Líquida do Pré-Fabricado", "Receita Bruta de Frete", "Receita Líquida de Frete"].map((a) => a.toUpperCase()),
);

export function usadoNaReceita(p: Pick<PrecoLido, "atribuicao" | "linhaTexto" | "departamento">) {
  if (ATRIBUICOES_DE_PRECO.has((p.atribuicao ?? "").trim().toUpperCase())) return true;
  const depto = (p.departamento ?? "").trim().toUpperCase();
  return p.linhaTexto === "MONTAGEM" && (depto === "ROB" || depto === "IRB");
}

export type PrecoLido = {
  linhaArquivo: number;
  obra: string;
  venda: string | null;
  versao: number;
  chave: string;
  etapa: string | null;
  linhaTexto: string;
  contaResultado: string;
  departamento: string | null;
  atribuicao: string | null;
  unidade: string | null;
  fornecimento: string | null;
  valorUnitario: Decimal | null;
  valorTotal: Decimal | null;
  percentualRL: Decimal | null;
};

export type RejeicaoPreco = { linha: number; codigo: "VALOR_INVALIDO" | "VERSAO_INVALIDA" | "LINHA_DUPLICADA"; mensagem: string };

export type LeituraDreComercial =
  | { ok: false; motivo: string }
  | {
      ok: true;
      linhasLidas: number;
      precos: PrecoLido[];
      rejeicoes: RejeicaoPreco[];
      /** foraDoFiltro: linhas da DRE que a receita prévia não usa. */
      ignoradas: { vazias: number; repetidas: number; foraDoFiltro: number };
      /** Obras com linhas idênticas repetidas: código → quantas linhas sobraram. */
      obrasRepetidas: Map<string, number>;
    };

const OBRIGATORIAS = [
  "CÓD.", "VENDA", "VERSÃO (N)", "CONTA CONTÁBIL", "V. TOTAL", "V. UNIT.",
  "ETAPA", "LINHA", "DEPTO.", "ATRIBUIÇÃO", "UNIDADE",
];
const OPCIONAIS = ["FORNECIMENTO", "%RL"];

/** Valor opcional: "-" e vazio são "não informado" (null); texto não numérico é erro. */
function valor(v: ValorCelula): Decimal | null | undefined {
  if (v === null || v === undefined || v === "" || v === "-") return null;
  if (typeof v === "number") return new Decimal(v);
  const s = String(v).trim().replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(s) ? new Decimal(s) : undefined;
}

export function chaveDoPreco(p: Pick<PrecoLido, "obra" | "versao" | "etapa" | "linhaTexto" | "contaResultado" | "departamento">) {
  return [p.obra, p.versao, p.etapa ?? "", p.linhaTexto, p.contaResultado, p.departamento ?? ""].join(" | ");
}

/**
 * Os campos que, se mudarem numa reimportação, fazem o preço ser substituído.
 * Os valores entram arredondados a 6 casas: a DRE é calculada em ponto
 * flutuante, e a mesma DRE salva de novo pode variar no 16º dígito
 * (3490.00983024315 × 3490.0098302431506) sem que o preço tenha mudado.
 */
export function assinaturaDoPreco(p: {
  atribuicao: string | null;
  unidade: string | null;
  fornecimento: string | null;
  valorUnitario: Decimal | null;
  valorTotal: Decimal | null;
  percentualRL: Decimal | null;
}) {
  const d = (x: Decimal | null) => (x === null ? "" : x.toDecimalPlaces(6).toString());
  return [p.atribuicao, p.unidade, p.fornecimento, d(p.valorUnitario), d(p.valorTotal), d(p.percentualRL)].join(" | ");
}

export function interpretarDreComercial(linhas: LinhaPlanilha[]): LeituraDreComercial {
  const cab = localizarCabecalho(linhas, OBRIGATORIAS, OPCIONAIS);
  if ("erro" in cab) return { ok: false, motivo: cab.erro };
  const k = cab.col;
  const c = (l: LinhaPlanilha, nome: string) => (k[nome] < 0 ? null : (l.celulas[k[nome]] ?? null));

  const precos: PrecoLido[] = [];
  const rejeicoes: RejeicaoPreco[] = [];
  const ignoradas = { vazias: 0, repetidas: 0, foraDoFiltro: 0 };
  const obrasRepetidas = new Map<string, number>();
  const vistos = new Map<string, { linha: number; assinatura: string }>();
  let linhasLidas = 0;

  for (const l of linhas) {
    if (l.numero <= cab.numero) continue;
    linhasLidas++;
    const obra = texto(c(l, "CÓD."));
    if (!obra) {
      ignoradas.vazias++;
      continue;
    }
    const versaoBruta = c(l, "VERSÃO (N)");
    const versao = vazia(versaoBruta) ? 0 : Number(versaoBruta);
    if (!Number.isInteger(versao) || versao < 0) {
      rejeicoes.push({ linha: l.numero, codigo: "VERSAO_INVALIDA", mensagem: `Versão "${versaoBruta}" inválida.` });
      continue;
    }
    const valores = { valorUnitario: valor(c(l, "V. UNIT.")), valorTotal: valor(c(l, "V. TOTAL")), percentualRL: valor(c(l, "%RL")) };
    const invalido = Object.entries(valores).find(([, v]) => v === undefined);
    if (invalido) {
      rejeicoes.push({ linha: l.numero, codigo: "VALOR_INVALIDO", mensagem: `Valor não numérico na obra ${obra}.` });
      continue;
    }
    const preco: PrecoLido = {
      linhaArquivo: l.numero,
      obra,
      venda: texto(c(l, "VENDA")),
      versao,
      chave: "",
      etapa: texto(c(l, "ETAPA")),
      linhaTexto: normalizar(c(l, "LINHA")),
      contaResultado: texto(c(l, "CONTA CONTÁBIL")) ?? "",
      departamento: texto(c(l, "DEPTO.")),
      atribuicao: texto(c(l, "ATRIBUIÇÃO")),
      unidade: texto(c(l, "UNIDADE")),
      fornecimento: texto(c(l, "FORNECIMENTO")),
      valorUnitario: valores.valorUnitario as Decimal | null,
      valorTotal: valores.valorTotal as Decimal | null,
      percentualRL: valores.percentualRL as Decimal | null,
    };
    if (!usadoNaReceita(preco)) {
      ignoradas.foraDoFiltro++;
      continue;
    }
    preco.chave = chaveDoPreco(preco);

    const assinatura = assinaturaDoPreco(preco);
    const anterior = vistos.get(preco.chave);
    if (anterior) {
      if (anterior.assinatura === assinatura) {
        ignoradas.repetidas++;
        obrasRepetidas.set(obra, (obrasRepetidas.get(obra) ?? 0) + 1);
      } else {
        rejeicoes.push({
          linha: l.numero,
          codigo: "LINHA_DUPLICADA",
          mensagem: `Mesma obra, versão, etapa, linha, conta e departamento da linha ${anterior.linha}, com valores diferentes.`,
        });
      }
      continue;
    }
    vistos.set(preco.chave, { linha: l.numero, assinatura });
    precos.push(preco);
  }
  return { ok: true, linhasLidas, precos, rejeicoes, ignoradas, obrasRepetidas };
}

/**
 * O nome de cada obra pela aba Pedidos do mesmo arquivo (11/10/2026): os itens "Cliente" e "Nome da Obra" da menor
 * versão, como "CLIENTE | NOME DA OBRA" — a forma das listas ("ABIMAR | AMPLIAÇÃO LOJA IÇARA"); só um dos dois quando
 * o outro falta ou é igual. A DRE só traz o código, e a obra que ainda não apareceu numa lista ficava sem nome.
 */
export function nomesDasObras(linhas: LinhaPlanilha[]): Map<string, string> {
  const cab = localizarCabecalho(linhas, ["CÓD.", "ITEM", "DESCRIÇÃO / VALOR"], ["VERSÃO (N)"]);
  if ("erro" in cab) return new Map();
  const c = (l: LinhaPlanilha, n: string) => (cab.col[n] >= 0 ? l.celulas[cab.col[n]] : null);
  const porObra = new Map<string, { versao: number; cliente?: string; nome?: string }>();
  for (const l of linhas) {
    if (l.numero <= cab.numero) continue;
    const obra = texto(c(l, "CÓD."));
    const item = normalizar(c(l, "ITEM"));
    const valor = c(l, "DESCRIÇÃO / VALOR");
    if (!obra || (item !== "CLIENTE" && item !== "NOME DA OBRA") || vazia(valor)) continue;
    const versao = Number(c(l, "VERSÃO (N)") ?? 0) || 0;
    const atual = porObra.get(obra);
    if (atual && atual.versao < versao) continue;
    const dados = atual && atual.versao === versao ? atual : { versao };
    dados[item === "CLIENTE" ? "cliente" : "nome"] = String(valor).trim().replace(/\s+/g, " ");
    porObra.set(obra, dados);
  }
  const nomes = new Map<string, string>();
  for (const [obra, { cliente, nome }] of porObra) {
    const partes = [cliente, nome].filter((p): p is string => !!p);
    const unico = partes.length === 2 && partes[0].toUpperCase() === partes[1].toUpperCase() ? [partes[0]] : partes;
    if (unico.length) nomes.set(obra, unico.join(" | "));
  }
  return nomes;
}
