import { api } from "@/lib/api";
import type { DepartamentoAcesso } from "@/services/authService";

export type Acao = "VER" | "LER" | "EDITAR";
export type Permissao = { recurso: string; acao: Acao };

export type PerfilResumo = { id: string; codigo: string; nome: string; ativo: boolean; recorteSetor: boolean; recorteDepartamento: boolean };

export type Usuario = {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  ordem: number;
  perfil: PerfilResumo;
  setores: string[];
  departamentos: DepartamentoAcesso[];
};

export type Perfil = PerfilResumo & {
  descricao: string | null;
  sistema: boolean;
  ordem: number;
  permissoes: Permissao[];
  usuarios: number;
};

export type OpcoesUsuarios = {
  perfis: PerfilResumo[];
  recursos: Array<{ recurso: string; rotulo: string }>;
  acoes: Acao[];
  setores: Array<{ tipo: string; rotulo: string }>;
  departamentos: Array<{ departamento: DepartamentoAcesso; rotulo: string }>;
};

export type DadosUsuario = {
  nome: string;
  email: string;
  perfilId: string;
  ativo: boolean;
  setores: string[];
  departamentos: DepartamentoAcesso[];
  senha?: string;
};

export type DadosPerfil = {
  codigo?: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  recorteSetor: boolean;
  recorteDepartamento: boolean;
  permissoes: Permissao[];
};

export const usuariosService = {
  opcoes: async (): Promise<OpcoesUsuarios> => (await api.get<{ data: OpcoesUsuarios }>("/proxy/usuarios/opcoes")).data.data,
  listar: async (): Promise<Usuario[]> => (await api.get<{ data: Usuario[] }>("/proxy/usuarios")).data.data,
  criar: async (d: DadosUsuario): Promise<Usuario> => (await api.post<{ data: Usuario }>("/proxy/usuarios", d)).data.data,
  atualizar: async (id: string, d: DadosUsuario): Promise<Usuario> => (await api.put<{ data: Usuario }>(`/proxy/usuarios/${id}`, d)).data.data,
  redefinirSenha: async (id: string, senha: string): Promise<void> => {
    await api.put(`/proxy/usuarios/${id}/senha`, { senha });
  },

  perfis: async (): Promise<Perfil[]> => (await api.get<{ data: Perfil[] }>("/proxy/perfis")).data.data,
  criarPerfil: async (d: DadosPerfil): Promise<Perfil[]> => (await api.post<{ data: Perfil[] }>("/proxy/perfis", d)).data.data,
  atualizarPerfil: async (id: string, d: DadosPerfil): Promise<Perfil[]> => (await api.put<{ data: Perfil[] }>(`/proxy/perfis/${id}`, d)).data.data,
  excluirPerfil: async (id: string): Promise<Perfil[]> => (await api.delete<{ data: Perfil[] }>(`/proxy/perfis/${id}`)).data.data,
};

export function mensagemDeErro(error: unknown, padrao: string) {
  return (error as { response?: { data?: { error?: string } } }).response?.data?.error ?? padrao;
}

export const classeSelect = "h-9 w-full rounded-sm border border-gray-300 bg-white px-3 text-sm";
