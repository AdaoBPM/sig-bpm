import { createHash } from "node:crypto";

import { getPrismaClient } from "../../config/prisma.js";

/**
 * A assinatura dos Cadastros da Controladoria (17/10/2026; antes, só a do Painel de Bordo): uma por cadastro, guardada
 * na apuração da competência (Competencia.cadastrosAssinatura). Se algum cadastro muda com a competência apurada e
 * ainda aberta, a situação pede reapurar e o fechamento fica bloqueado até lá. As datas de criação e de alteração ficam
 * de fora: gravar sem mudar nada não pede reapurar.
 */

const sem = { criadoEm: true, atualizadoEm: true } as const;
const hash = (dados: unknown) => createHash("sha1").update(JSON.stringify(dados)).digest("hex");

/** Os cadastros, na ordem das telas (Contábil, Controladoria e Analítico), com o nome da aba. */
const CADASTROS: Array<{ chave: string; nome: string; dados: () => Promise<unknown> }> = [
  { chave: "unidades", nome: "Unidades", dados: () => getPrismaClient().unidadeNegocio.findMany({ omit: sem, orderBy: { id: "asc" } }) },
  { chave: "centros", nome: "Centros de Custo", dados: () => getPrismaClient().centroCusto.findMany({ omit: sem, orderBy: { id: "asc" } }) },
  { chave: "contas", nome: "Contas de Resultado", dados: () => getPrismaClient().contaResultado.findMany({ omit: sem, orderBy: { id: "asc" } }) },
  {
    chave: "linhas",
    nome: "Linhas",
    // As correspondências das tarefas são gravadas de novo a cada vez (ids novos): entram pelo conteúdo.
    dados: async () => [
      await getPrismaClient().linha.findMany({ omit: sem, orderBy: { id: "asc" } }),
      await getPrismaClient().correspondenciaTarefa.findMany({
        select: { filial: true, tarefa: true, linhaId: true },
        orderBy: [{ filial: "asc" }, { tarefa: "asc" }],
      }),
    ],
  },
  {
    chave: "estruturaDre",
    nome: "Estrutura da DRE",
    dados: async () => [
      await getPrismaClient().linhaDRE.findMany({ omit: sem, orderBy: { id: "asc" } }),
      await getPrismaClient().linhaDREUnidade.findMany({ orderBy: [{ linhaDREId: "asc" }, { unidadeNegocioId: "asc" }] }),
    ],
  },
  { chave: "regras", nome: "Regras de Rateio", dados: () => getPrismaClient().regraRateio.findMany({ omit: sem, orderBy: { id: "asc" } }) },
  { chave: "indicadores", nome: "Indicadores", dados: () => getPrismaClient().indicadorEstrutura.findMany({ omit: sem, orderBy: { id: "asc" } }) },
  { chave: "painel", nome: "Painel de Bordo", dados: () => getPrismaClient().painelItem.findMany({ omit: sem, orderBy: { id: "asc" } }) },
];

export type AssinaturaCadastros = Record<string, string>;

// A lista de competências confere várias de uma vez: a assinatura vale por um instante.
let guardada: { em: number; valor: Promise<AssinaturaCadastros> } | null = null;

/** A assinatura atual de cada cadastro (`fresca`: sem usar a guardada, como na apuração). */
export function assinaturaDosCadastros(fresca = false): Promise<AssinaturaCadastros> {
  if (!fresca && guardada && Date.now() - guardada.em < 2000) return guardada.valor;
  const valor = Promise.all(CADASTROS.map(async (c) => [c.chave, hash(await c.dados())] as const)).then((r) => Object.fromEntries(r));
  guardada = { em: Date.now(), valor };
  valor.catch(() => (guardada = null));
  return valor;
}

/**
 * Os cadastros (pelo nome da aba) que mudaram desde a apuração. Sem a assinatura (apurada antes de 17/10/2026), nada:
 * não há com o que comparar.
 */
export function cadastrosMudados(naApuracao: string | null, atual: AssinaturaCadastros): string[] {
  if (!naApuracao) return [];
  let antes: AssinaturaCadastros;
  try {
    antes = JSON.parse(naApuracao) as AssinaturaCadastros;
  } catch {
    return [];
  }
  if (!antes || typeof antes !== "object") return [];
  return CADASTROS.filter((c) => antes[c.chave] !== undefined && antes[c.chave] !== atual[c.chave]).map((c) => c.nome);
}

/** A frase da situação da competência com os cadastros que mudaram. */
export function fraseDosCadastros(nomes: string[]): string {
  const lista = nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
  return `${nomes.length === 1 ? "O cadastro" : "Os cadastros"} ${lista} (Cadastros da Controladoria) ${nomes.length === 1 ? "mudou" : "mudaram"} depois da apuração.`;
}
