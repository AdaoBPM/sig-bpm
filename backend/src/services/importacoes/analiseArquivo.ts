import type { TipoImportacao } from "../../generated/prisma/enums.js";
import { ArquivoInvalidoError, lerAba, listarAbas, type LinhaPlanilha } from "../../lib/xlsx.js";
import { ABA_BALANCETE, conferirTotal, interpretarBalancete } from "./balancete/leiauteBalancete.js";
import { ABA_DRE_COMERCIAL, interpretarDreComercial } from "./dreComercial/leiauteDreComercial.js";
import { DEFINICOES_LISTAS } from "./listas/definicoesListas.js";
import { DEFINICOES_LISTAS_RECEITA } from "./listas/definicoesListasReceita.js";
import { localizarCabecalho } from "./listas/leituraListas.js";

/**
 * A leitura prévia de um arquivo com várias abas (Passo da importação em
 * lote): associa cada aba ao tipo de arquivo que a ferramenta importa, pelo
 * nome da aba, e confere a estrutura dela com as mesmas regras do
 * processamento — sem gravar nada. As abas prontas seguem para a fila, uma
 * por vez.
 */

export type SituacaoAba = "PRONTA" | "INVALIDA" | "IGNORADA";
export type AbaAnalisada = {
  aba: string;
  tipo: TipoImportacao;
  rotulo: string;
  situacao: SituacaoAba;
  /** Por que a aba é inválida ou fica de fora. */
  mensagem?: string;
  /** Registros do mês (ou lançamentos, ou preços) que a aba traz. */
  registros?: number;
  avisos: string[];
};

type Conferencia = { registros: number; avisos: string[] };
type Tipo = {
  tipo: TipoImportacao;
  rotulo: string;
  abas: string[];
  /** Confere a estrutura; lança AbaInvalida com o motivo. */
  conferir: (linhas: LinhaPlanilha[], ano: number, mes: number) => Conferencia;
};

class AbaInvalida extends Error {}
const rotuloMes = (ano: number, mes: number) => `${String(mes).padStart(2, "0")}/${ano}`;

const listas: Tipo[] = [...Object.values(DEFINICOES_LISTAS), ...Object.values(DEFINICOES_LISTAS_RECEITA)].map((def) => ({
  tipo: def.tipo as TipoImportacao,
  rotulo: def.rotulo,
  abas: def.abas,
  conferir(linhas, ano, mes) {
    const l = def.interpretar(linhas, ano, mes);
    if (!l.ok) throw new AbaInvalida(l.motivo);
    if (l.registros.length === 0 && l.rejeicoes.length === 0) throw new AbaInvalida(`A aba não tem registros de ${rotuloMes(ano, mes)}.`);
    return { registros: l.registros.length, avisos: l.rejeicoes.length ? [`${l.rejeicoes.length} linha(s) com erro, que não serão gravadas.`] : [] };
  },
}));

/** Os tipos que a importação em lote reconhece, na ordem em que entram na fila. */
const TIPOS: Tipo[] = [
  {
    tipo: "BALANCETE",
    rotulo: "Balancete (TOTVS RM)",
    abas: [ABA_BALANCETE],
    conferir(linhas, ano, mes) {
      const l = interpretarBalancete(linhas, ano, mes);
      if (!l.ok) throw new AbaInvalida(l.motivo);
      const total = conferirTotal(l.somaArquivo, l.totalGeral);
      if (total) throw new AbaInvalida(total);
      if (l.lancamentos.length === 0 && l.rejeicoes.length === 0) throw new AbaInvalida(`A aba não tem lançamentos de ${rotuloMes(ano, mes)}.`);
      return { registros: l.lancamentos.length, avisos: l.rejeicoes.length ? [`${l.rejeicoes.length} linha(s) com erro, que não serão gravadas.`] : [] };
    },
  },
  ...listas,
  {
    tipo: "DRE_COMERCIAL",
    rotulo: "DRE do Comercial",
    abas: [ABA_DRE_COMERCIAL],
    conferir(linhas) {
      const l = interpretarDreComercial(linhas);
      if (!l.ok) throw new AbaInvalida(l.motivo);
      if (l.precos.length === 0) throw new AbaInvalida("A aba não tem nenhuma linha de preço.");
      return { registros: l.precos.length, avisos: [] };
    },
  },
  {
    tipo: "ESTOQUE_INICIAL",
    rotulo: "Saldo inicial do estoque",
    abas: ["Estoque (2025)"],
    conferir(linhas) {
      const cab = localizarCabecalho(linhas, ["OBRA", "LINHA", "VOLUME (M³)", "TOTAL FISCAL (R$)"], ["NOME DA OBRA"]);
      if ("erro" in cab) throw new AbaInvalida(cab.erro);
      return { registros: linhas.filter((l) => l.numero > cab.numero).length, avisos: [] };
    },
  },
];

const mesmaAba = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Lê o arquivo e devolve as abas reconhecidas, com a situação de cada uma, e
 * os nomes das demais. `alcanca` diz se o usuário importa o tipo (recorte por
 * setor); `fechada`, se a competência está fechada.
 */
export function analisarArquivo(
  conteudo: Uint8Array,
  competencia: { ano: number; mes: number; fechada: boolean },
  alcanca: (tipo: TipoImportacao) => boolean,
): { abas: AbaAnalisada[]; outras: string[] } {
  let nomes: string[];
  try {
    nomes = listarAbas(conteudo);
  } catch (error) {
    throw new ArquivoInvalidoError(error instanceof Error ? error.message : "O arquivo não é uma planilha .xlsx válida.");
  }
  const { ano, mes, fechada } = competencia;
  const abas: AbaAnalisada[] = [];
  const reconhecidas = new Set<string>();
  for (const t of TIPOS) {
    const aba = nomes.find((n) => t.abas.some((a) => mesmaAba(n, a)));
    if (!aba) continue;
    reconhecidas.add(aba);
    const base = { aba, tipo: t.tipo, rotulo: t.rotulo, avisos: [] as string[] };
    if (!alcanca(t.tipo)) {
      abas.push({ ...base, situacao: "IGNORADA", mensagem: "Tipo de arquivo fora dos seus setores." });
      continue;
    }
    // O saldo inicial é o de 31/12/2025: só entra na competência 12/2025.
    if (t.tipo === "ESTOQUE_INICIAL" && !(ano === 2025 && mes === 12)) {
      abas.push({ ...base, situacao: "IGNORADA", mensagem: "O saldo inicial do estoque só é importado na competência 12/2025." });
      continue;
    }
    if (fechada && t.tipo !== "BALANCETE") {
      abas.push({ ...base, situacao: "IGNORADA", mensagem: "A competência está fechada: importar exige reabri-la." });
      continue;
    }
    try {
      const { linhas } = lerAba(conteudo, () => aba);
      const c = t.conferir(linhas, ano, mes);
      const avisos = [...c.avisos];
      if (fechada) avisos.unshift("Competência fechada: o balancete só é comparado com o gravado; as diferenças viram divergências.");
      abas.push({ ...base, situacao: "PRONTA", registros: c.registros, avisos });
    } catch (error) {
      if (error instanceof AbaInvalida || error instanceof ArquivoInvalidoError) abas.push({ ...base, situacao: "INVALIDA", mensagem: error.message });
      else throw error;
    }
  }
  return { abas, outras: nomes.filter((n) => !reconhecidas.has(n)) };
}
