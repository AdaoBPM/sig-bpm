import { api } from "@/lib/api";

/**
 * Leitura dos cadastros. Passa pelo BFF do Next (`/api/proxy/...`), nunca
 * direto no Express — regra de ouro do CONVENTIONS.md.
 */

export type PaginaCadastro<T> = {
  itens: T[];
  total: number;
  pagina: number;
  porPagina: number;
};

export type CentroCusto = {
  id: string;
  codigoRM: string | null;
  nomeRM: string;
  nomeControladoria: string | null;
  departamento: string | null;
  departamentoSigla: string | null;
  atribuicao: "DIRETA" | "INDIRETA" | null;
  atribuicaoSigla: string | null;
  balde: string | null;
  ativo: boolean;
};

export type ContaResultado = {
  id: string;
  reduzido: string;
  conta: string;
  descricao: string;
  tipoConta: "SINTETICA" | "ANALITICA";
  departamento: string | null;
  atribuicao: string | null;
  balde: string | null;
  ativo: boolean;
  linhaDRE: { codigo: string; descricao: string } | null;
};

export type LinhaDRE = {
  id: string;
  codigo: string;
  ordem: number;
  grupo: string;
  grupoSigla: string;
  atribuicao: string | null;
  atribuicaoSigla: string | null;
  descricao: string;
  tipo: "SECAO" | "ITEM" | "SUBTOTAL" | "TOTAL";
  expressao: string | null;
  definicao: string | null;
  unidades: { unidadeNegocio: { nome: string; tipo: string } }[];
  _count: { contas: number };
};

/** Conta vista pela verificação do lançamento: código, nome e parâmetros. */
export type ContaResumida = {
  reduzido: string;
  descricao: string;
  departamento: string | null;
  atribuicao: string | null;
};

export type Reclassificacao = {
  id: string;
  codigoCentroCusto: string;
  motivo: string | null;
  ativo: boolean;
  contaOrigem: ContaResumida;
  contaDestino: ContaResumida;
  centro: {
    nomeRM: string;
    departamento: string | null;
    atribuicao: "DIRETA" | "INDIRETA" | null;
  } | null;
};

export type ResumoCadastros = {
  unidades: number;
  centrosCusto: number;
  contas: number;
  contasVinculadas: number;
  linhas: number;
};

export type ParametrosListagem = {
  busca?: string;
  pagina?: number;
  porPagina?: number;
};

async function listar<T>(
  recurso: string,
  parametros: ParametrosListagem,
): Promise<PaginaCadastro<T>> {
  const { data } = await api.get<{ data: PaginaCadastro<T> }>(
    `/proxy/cadastros/${recurso}`,
    { params: parametros },
  );
  return data.data;
}

export const cadastrosService = {
  resumo: async (): Promise<ResumoCadastros> => {
    const { data } = await api.get<{ data: ResumoCadastros }>(
      "/proxy/cadastros/resumo",
    );
    return data.data;
  },
  centrosCusto: (p: ParametrosListagem) => listar<CentroCusto>("centros-custo", p),
  contasResultado: (p: ParametrosListagem) =>
    listar<ContaResultado>("contas-resultado", p),
  linhasDRE: (p: ParametrosListagem) => listar<LinhaDRE>("linhas-dre", p),
  reclassificacoes: (p: ParametrosListagem) =>
    listar<Reclassificacao>("reclassificacoes", p),
};
