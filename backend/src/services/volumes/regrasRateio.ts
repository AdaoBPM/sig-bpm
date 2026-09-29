import type { BaldeAlocacao, BaseFisica, DestinoRateio } from "../../generated/prisma/enums.js";
import type { CodigoTotais } from "./totaisOperacao.js";

/**
 * As regras de rateio da aba Rateios do SIG BPM 2026 - BASE REALIZADO
 * (OPERAÇÃO): 14 percentuais em 5 chaves. É o cadastro inicial; a edição na
 * tela entra no Passo 25. A unidade é a unidade de negócio que recebe o custo;
 * Montagem e Complementar são as duas visões de Serviços.
 */
export const REGRAS_RATEIO: Array<{
  chave: Extract<BaldeAlocacao, "PROJETO" | "PRODUCAO" | "METALURGIA" | "ARMADURA" | "ACOMPANHAMENTO">;
  destino: DestinoRateio;
  unidade: 1 | 2 | 3;
  baseFisica: BaseFisica;
  origem: CodigoTotais;
  rotulo: string;
}> = [
  { chave: "PROJETO", destino: "MATRIZ", unidade: 1, baseFisica: "M3", origem: "PROJETOS_MATRIZ", rotulo: "(P) Projetos Liberados: Matriz" },
  { chave: "PROJETO", destino: "FILIAL", unidade: 2, baseFisica: "M3", origem: "PROJETOS_FILIAL", rotulo: "(P) Projetos Liberados: Filial" },
  { chave: "PRODUCAO", destino: "MATRIZ", unidade: 1, baseFisica: "M3", origem: "PREFABRICADO_MATRIZ", rotulo: "(P) Pré-Fabricado: Matriz" },
  { chave: "PRODUCAO", destino: "FILIAL", unidade: 2, baseFisica: "M3", origem: "PREFABRICADO_FILIAL", rotulo: "(P) Pré-Fabricado: Filial" },
  { chave: "METALURGIA", destino: "MATRIZ", unidade: 1, baseFisica: "KG", origem: "METALURGIA_MATRIZ", rotulo: "(P) Metalurgia: Matriz" },
  { chave: "METALURGIA", destino: "FILIAL", unidade: 2, baseFisica: "KG", origem: "METALURGIA_FILIAL", rotulo: "(P) Metalurgia: Filial" },
  { chave: "METALURGIA", destino: "MONTAGEM", unidade: 3, baseFisica: "KG", origem: "METALURGIA_MONTAGEM", rotulo: "(P) Metalurgia: Montagem" },
  { chave: "METALURGIA", destino: "COMPLEMENTAR", unidade: 3, baseFisica: "KG", origem: "METALURGIA_COMPLEMENTAR", rotulo: "(P) Metalurgia: Complementar" },
  { chave: "ARMADURA", destino: "MATRIZ", unidade: 1, baseFisica: "KG", origem: "ARMADURA_MATRIZ", rotulo: "(P) Armadura: Matriz" },
  { chave: "ARMADURA", destino: "FILIAL", unidade: 2, baseFisica: "KG", origem: "ARMADURA_FILIAL", rotulo: "(P) Armadura: Filial" },
  { chave: "ARMADURA", destino: "MONTAGEM", unidade: 3, baseFisica: "KG", origem: "ARMADURA_MONTAGEM", rotulo: "(P) Armadura: Montagem" },
  { chave: "ARMADURA", destino: "COMPLEMENTAR", unidade: 3, baseFisica: "KG", origem: "ARMADURA_COMPLEMENTAR", rotulo: "(P) Armadura: Complementar" },
  { chave: "ACOMPANHAMENTO", destino: "MONTAGEM", unidade: 3, baseFisica: "DIA", origem: "ACOMPANHAMENTO_MONTAGEM", rotulo: "(S) Acompanhamento: Montagem" },
  { chave: "ACOMPANHAMENTO", destino: "COMPLEMENTAR", unidade: 3, baseFisica: "DIA", origem: "ACOMPANHAMENTO_COMPLEMENTAR", rotulo: "(S) Acompanhamento: Complementar" },
];

/** Início da vigência das regras da carga inicial. */
export const VIGENCIA_REGRAS = new Date(Date.UTC(2026, 0, 1));
