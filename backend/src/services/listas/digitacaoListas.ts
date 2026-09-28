import type { LinhaPlanilha, ValorCelula } from "../../lib/xlsx.js";
import {
  DEFINICOES_LISTAS,
  type TipoListaRateio,
} from "../importacoes/listas/definicoesListas.js";
import type { RegistroLista } from "../importacoes/listas/leituraListas.js";

/**
 * Digitação das listas operacionais.
 *
 * O formulário devolve os valores com os nomes das colunas da planilha; aqui
 * eles viram uma planilha de uma linha e passam pela MESMA leitura da
 * importação (definicoesListas.ts). Assim digitação e importação têm, por
 * construção, as mesmas regras — linha pelo produto ou pela peça, volume
 * adotado da expedição, destino da armadura e da metalurgia.
 *
 * O período é o mês da competência: a digitação não pede data.
 */

export type CampoDigitacao = {
  /** Nome da coluna na lista da planilha. */
  coluna: string;
  rotulo: string;
  tipo: "texto" | "numero" | "opcoes";
  obrigatorio: boolean;
  opcoes?: Array<{ valor: string; rotulo: string }>;
  ajuda?: string;
};

const UNIDADES = [
  { valor: "Unidade 01", rotulo: "Unidade 01 — Matriz" },
  { valor: "Unidade 02", rotulo: "Unidade 02 — Filial" },
];
const opcoes = (valores: string[]) => valores.map((v) => ({ valor: v, rotulo: v }));

const obra = (coluna: string, rotulo = "Sigla da obra"): CampoDigitacao => ({
  coluna, rotulo, tipo: "texto", obrigatorio: true, ajuda: "Ex.: G3168. Obra nova é cadastrada na hora.",
});
const nomeObra = (coluna: string): CampoDigitacao => ({ coluna, rotulo: "Nome da obra", tipo: "texto", obrigatorio: false });
const numero = (coluna: string, rotulo: string, ajuda?: string): CampoDigitacao => ({ coluna, rotulo, tipo: "numero", obrigatorio: true, ajuda });

export const CAMPOS_DIGITACAO: Record<TipoListaRateio, CampoDigitacao[]> = {
  PROJETO: [
    { coluna: "Unidade", rotulo: "Unidade", tipo: "opcoes", obrigatorio: true, opcoes: UNIDADES },
    obra("Sigla Obra"),
    nomeObra("Obra"),
    { coluna: "Produto", rotulo: "Produto", tipo: "texto", obrigatorio: true, ajuda: "Na Unidade 02, produto com ESTACA é estaca; os demais, alveolar." },
    { coluna: "Nome Peça", rotulo: "Peça", tipo: "texto", obrigatorio: false },
    numero("Volume (m³)", "Volume (m³)"),
  ],
  PRODUCAO: [
    { coluna: "Unidade", rotulo: "Unidade", tipo: "opcoes", obrigatorio: true, opcoes: UNIDADES },
    obra("Obra"),
    nomeObra("Nome da Obra"),
    { coluna: "Produto", rotulo: "Produto", tipo: "texto", obrigatorio: true, ajuda: "Na Unidade 02, produto com ESTACA é estaca; os demais, alveolar." },
    { coluna: "Nome Peça", rotulo: "Peça", tipo: "texto", obrigatorio: false },
    numero("Volume (m³)", "Volume (m³)"),
  ],
  PRODUCAO_PISTA: [
    { coluna: "Linha", rotulo: "Pista de", tipo: "opcoes", obrigatorio: true, opcoes: [{ valor: "ALVEOLARES", rotulo: "Alveolares" }, { valor: "ESTACAS", rotulo: "Estacas" }] },
    numero("Pistas", "Pistas produzidas"),
  ],
  PRODUCAO_ARMADURA: [
    {
      coluna: "Unidade/Linha", rotulo: "Linha", tipo: "opcoes", obrigatorio: true,
      opcoes: opcoes(["Matriz (kg)", "Filial (kg)", "Ferragem (kg)", "Fundação (kg)", "Capeam. (kg)", "Metálica (kg)", "Turn Key (kg)"]),
    },
    numero("Peso", "Peso (kg)"),
  ],
  PRODUCAO_METALURGIA: [
    {
      coluna: "FINALIDADE", rotulo: "Finalidade", tipo: "opcoes", obrigatorio: true,
      opcoes: opcoes(["INSERTO METÁLICO", "ANEL E LUVA", "FERRAGEM", "ESTRUTURA METÁLICA", "MANUTENÇÃO: MATRIZ", "MANUTENÇÃO: FILIAL", "MANUTENÇÃO: OBRAS", "INVESTIMENTO"]),
    },
    numero("Peso", "Peso (kg)"),
  ],
  EXPEDICAO: [
    obra("Obra"),
    nomeObra("Nome da Obra"),
    { coluna: "Nome da Peça", rotulo: "Peça", tipo: "texto", obrigatorio: true, ajuda: "A linha sai da peça: ESC… estrutura, E… estaca, L… ou PA… alveolar." },
    numero("Peso (kg)", "Peso (kg)"),
    numero("Volume (m³)", "Volume (m³)", "Zero: calculado pela seção e comprimento da peça, ou peso ÷ 2.500."),
  ],
  MONTAGEM: [
    obra("Obra"),
    nomeObra("Nome da Obra"),
    { coluna: "Grupo", rotulo: "Grupo da peça", tipo: "texto", obrigatorio: true, ajuda: "A linha sai do grupo: LAB, PA, TB… alveolar; ESC estrutura; E… estaca." },
    numero("Volume (m³)", "Volume (m³)"),
  ],
  ACOMPANHAMENTO: [
    obra("Projeto"),
    nomeObra("Obra"),
    {
      coluna: "Etapa", rotulo: "Etapa", tipo: "opcoes", obrigatorio: true,
      opcoes: opcoes(["MONTAGEM", "SAC", "FUNDAÇÃO", "VEDAÇÃO", "CAPEAMENTO", "METÁLICA", "TELHAMENTO", "OUTROS"]),
      ajuda: "MONTAGEM e SAC contam para a Montagem; as demais, para o Complementar.",
    },
    numero("Dias de Acomp.", "Dias de acompanhamento"),
  ],
};

/** Número de série do Excel para o dia 1º do mês. */
function serialDoMes(ano: number, mes: number) {
  return (Date.UTC(ano, mes - 1, 1) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

/**
 * A planilha de uma linha que a leitura da importação espera, para cada lista.
 * Nas listas em matriz (armadura, metalurgia), a coluna do mês é a do valor.
 */
function montarPlanilha(tipo: TipoListaRateio, v: Record<string, ValorCelula>, ano: number, mes: number): LinhaPlanilha[] {
  const dia1 = serialDoMes(ano, mes);
  const planilha = (cabecalho: string[], linha: ValorCelula[]): LinhaPlanilha[] => [
    { numero: 1, celulas: cabecalho },
    { numero: 2, celulas: linha },
  ];
  const campos = CAMPOS_DIGITACAO[tipo].map((c) => c.coluna);
  switch (tipo) {
    case "PRODUCAO_PISTA":
      return planilha(
        ["Data", "Alveolares", "Estacas"],
        [dia1, v.Linha === "ALVEOLARES" ? v.Pistas : 0, v.Linha === "ESTACAS" ? v.Pistas : 0],
      );
    case "PRODUCAO_ARMADURA":
      return [
        { numero: 1, celulas: ["Unidade/Linha", dia1] },
        { numero: 2, celulas: [v["Unidade/Linha"], v.Peso] },
      ];
    case "PRODUCAO_METALURGIA":
      return [
        { numero: 1, celulas: ["FINALIDADE", dia1] },
        { numero: 2, celulas: [v.FINALIDADE, v.Peso] },
      ];
    case "ACOMPANHAMENTO":
      return planilha(["Período", ...campos], [dia1, ...campos.map((c) => v[c] ?? null)]);
    default:
      return planilha(["Data", ...campos], [dia1, ...campos.map((c) => v[c] ?? null)]);
  }
}

export class DigitacaoInvalida extends Error {}

/**
 * Lê um registro digitado. Devolve o registro pronto para gravar, ou lança
 * DigitacaoInvalida com a mensagem que a importação daria para a mesma linha.
 */
export function lerDigitado(
  tipo: TipoListaRateio,
  valores: Record<string, ValorCelula>,
  ano: number,
  mes: number,
): RegistroLista {
  for (const c of CAMPOS_DIGITACAO[tipo]) {
    const v = valores[c.coluna];
    if (c.obrigatorio && (v === null || v === undefined || String(v).trim() === "")) {
      throw new DigitacaoInvalida(`Informe ${c.rotulo.toLowerCase()}.`);
    }
    if (c.tipo === "opcoes" && v !== null && v !== undefined && v !== "" && !c.opcoes!.some((o) => o.valor === v)) {
      throw new DigitacaoInvalida(`${c.rotulo}: "${String(v)}" não é uma opção válida.`);
    }
  }
  const leitura = DEFINICOES_LISTAS[tipo].interpretar(montarPlanilha(tipo, valores, ano, mes), ano, mes);
  if (!leitura.ok) throw new DigitacaoInvalida(leitura.motivo);
  if (leitura.rejeicoes.length > 0) throw new DigitacaoInvalida(leitura.rejeicoes[0].mensagem);
  if (leitura.registros.length === 0) throw new DigitacaoInvalida("Nada a gravar: os valores estão zerados.");
  if (leitura.avisos.length > 0) throw new DigitacaoInvalida(leitura.avisos[0]);
  return leitura.registros[0];
}
