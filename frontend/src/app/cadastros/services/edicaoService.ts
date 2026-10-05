import { api } from "@/lib/api";

export type Opcao = { valor: string; rotulo: string };
export type Campo = {
  nome: string;
  rotulo: string;
  /** O rótulo curto no cabeçalho da tabela, quando o do formulário é longo demais. */
  rotuloColuna?: string;
  tipo: "texto" | "inteiro" | "decimal" | "booleano" | "data" | "opcao" | "multipla";
  obrigatorio?: boolean;
  somenteNaCriacao?: boolean;
  derivado?: boolean;
  ajuda?: string;
  opcoes?: Opcao[];
};
export type DefinicaoCadastro = { entidade: string; titulo: string; criar: boolean; excluir: boolean; reclassifica: boolean; campos: Campo[] };
export type Registro = Record<string, unknown> & { id: string };
/** O efeito de uma alteração que classifica: o que foi reclassificado e o que precisa ser reapurado. */
export type Efeito = { reclassificadas: string[]; apuradasPorReapurar: string[] };

const base = (entidade: string) => `/proxy/cadastros/edicao/${entidade}`;

export const edicaoService = {
  definicao: async (entidade: string): Promise<DefinicaoCadastro> => (await api.get<{ data: DefinicaoCadastro }>(`${base(entidade)}/definicao`)).data.data,
  listar: async (entidade: string, busca?: string): Promise<Registro[]> => (await api.get<{ data: Registro[] }>(base(entidade), { params: busca ? { busca } : {} })).data.data,
  ler: async (entidade: string, id: string): Promise<Registro> => (await api.get<{ data: Registro }>(`${base(entidade)}/${id}`)).data.data,
  criar: async (entidade: string, valores: Record<string, unknown>) => (await api.post<{ data: { registro: Registro } & Efeito }>(base(entidade), valores)).data.data,
  atualizar: async (entidade: string, id: string, valores: Record<string, unknown>) =>
    (await api.put<{ data: { registro: Registro } & Efeito }>(`${base(entidade)}/${id}`, valores)).data.data,
  excluir: async (entidade: string, id: string) => (await api.delete<{ data: Efeito }>(`${base(entidade)}/${id}`)).data.data,
};

export function mensagemDeErro(error: unknown, padrao: string) {
  return (error as { response?: { data?: { error?: string } } }).response?.data?.error ?? padrao;
}

/** O aviso depois de gravar um cadastro que classifica. */
export function textoDoEfeito(e: Efeito) {
  const partes = [];
  if (e.reclassificadas.length) partes.push(`Reclassificadas: ${e.reclassificadas.join(", ")}.`);
  if (e.apuradasPorReapurar.length) partes.push(`Apuradas, sem mudança até serem reapuradas: ${e.apuradasPorReapurar.join(", ")}.`);
  return partes.join(" ");
}
