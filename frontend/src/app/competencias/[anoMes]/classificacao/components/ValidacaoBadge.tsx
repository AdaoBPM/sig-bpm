import type { Validacao } from "../services/classificacaoService";

/**
 * A verificação do lançamento, com o mesmo código que a planilha mostra na
 * coluna LANÇ. OK? — é o vocabulário que o Contábil já conhece.
 */
export const VALIDACOES: Record<
  Validacao,
  { rotulo: string; codigo: string; explicacao: string; classe: string }
> = {
  OK: {
    rotulo: "OK",
    codigo: "-",
    explicacao: "Centro e conta coerentes.",
    classe: "border-green-200 bg-green-50 text-green-700",
  },
  ERRO_PARAMETRIZACAO: {
    rotulo: "Parametrização",
    codigo: "<ERRO!>",
    explicacao: "O centro tem departamento ou atribuição, e a conta não.",
    classe: "border-red-200 bg-red-50 text-red-700",
  },
  ERRO_DEPARTAMENTO: {
    rotulo: "Departamento",
    codigo: "<DEP.!>",
    explicacao: "O departamento do centro é diferente do departamento da conta.",
    classe: "border-red-200 bg-red-50 text-red-700",
  },
  ERRO_ATRIBUICAO: {
    rotulo: "Atribuição",
    codigo: "<ATR.!>",
    explicacao:
      "Centro de atribuição direta com conta de Mão de Obra Indireta ou Gastos Gerais Indiretos, ou centro indireto com Mão de Obra Direta ou Gastos Gerais Diretos.",
    classe: "border-red-200 bg-red-50 text-red-700",
  },
  SEM_DESTINO: {
    rotulo: "Sem destino na DRE",
    codigo: "sem linha",
    explicacao: "A conta analítica não está vinculada a nenhuma linha da DRE.",
    classe: "border-red-200 bg-red-50 text-red-700",
  },
  CENTRO_NAO_CADASTRADO: {
    rotulo: "Centro fora do cadastro",
    codigo: "sem centro",
    explicacao:
      "O código do centro de custo não está no cadastro. Os centros de obra (1.98 e 1.99) não entram aqui.",
    classe: "border-yellow-200 bg-yellow-50 text-yellow-800",
  },
};

export function ValidacaoBadge({ validacao }: { validacao: Validacao }) {
  const v = VALIDACOES[validacao];
  return (
    <span
      title={v.explicacao}
      className={`inline-block whitespace-nowrap rounded-sm border px-2 py-0.5 text-xs font-medium ${v.classe}`}
    >
      {v.codigo === "-" ? v.rotulo : `${v.codigo} ${v.rotulo}`}
    </span>
  );
}
