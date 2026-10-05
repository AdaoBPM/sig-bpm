import { api } from "@/lib/api";

export type RegistroAuditoria = {
  id: string;
  acao: string;
  entidade: string | null;
  entidadeId: string | null;
  usuarioId: string | null;
  usuarioNome: string | null;
  ip: string | null;
  dadosAntes: unknown;
  dadosDepois: unknown;
  metadados: Record<string, unknown> | null;
  createdAt: string;
  /** O nome do registro para quem lê (competência, usuário, lançamento…), montado pelo backend. */
  registro: string | null;
};

export type PaginaAuditoria = { itens: RegistroAuditoria[]; total: number; pagina: number; porPagina: number };

export type OpcoesAuditoria = {
  usuarios: Array<{ id: string; nome: string }>;
  acoes: Array<{ acao: string; rotulo: string }>;
  entidades: Array<{ entidade: string; rotulo: string }>;
};

export type FiltroAuditoria = {
  de?: string;
  ate?: string;
  /** Os filtros dos rótulos das colunas: vários valores, como no Excel. */
  usuarioId?: string[];
  entidade?: string[];
  acao?: string[];
  ordem?: "asc" | "desc";
  incluirAcessos: boolean;
  pagina: number;
};

export const auditoriaService = {
  consultar: async (f: FiltroAuditoria): Promise<PaginaAuditoria> => {
    const params = Object.fromEntries(
      Object.entries({
        ...f,
        usuarioId: f.usuarioId?.join(","),
        entidade: f.entidade?.join(","),
        acao: f.acao?.join(","),
        incluirAcessos: f.incluirAcessos ? "1" : "0",
        porPagina: 50,
      }).filter(([, v]) => v !== undefined && v !== ""),
    );
    return (await api.get<{ data: PaginaAuditoria }>("/proxy/auditoria", { params })).data.data;
  },
  opcoes: async (): Promise<OpcoesAuditoria> => (await api.get<{ data: OpcoesAuditoria }>("/proxy/auditoria/opcoes")).data.data,
};
