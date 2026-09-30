import { getPrismaClient } from "../../config/prisma.js";
import type { DepartamentoAcesso, TipoImportacao } from "../../generated/prisma/enums.js";

/**
 * Quem é o usuário e o que ele alcança (Passo 22).
 *
 * As permissões pertencem ao perfil — a matriz recurso × ação vira a lista
 * "recurso:acao" que as rotas verificam. Os recortes por dado vêm do perfil
 * (se ele recorta) e do usuário (quais setores, quais departamentos).
 *
 * O backend relê isso do banco a cada requisição, e não do token: inativar
 * um usuário ou um perfil, ou mudar uma permissão, vale na hora.
 */

export type Acesso = {
  /** Só as listas operacionais dos setores do usuário. */
  recorteSetor: boolean;
  setores: TipoImportacao[];
  /** Só as movimentações e os centros de custo dos departamentos do usuário. */
  recorteDepartamento: boolean;
  departamentos: DepartamentoAcesso[];
};

export type UsuarioAutenticado = {
  sub: string;
  email: string;
  nome: string;
  perfil: { codigo: string; nome: string };
  permissions: string[];
  acesso: Acesso;
};

/** O usuário com permissões e recortes; nulo se não existe, está inativo ou tem perfil inativo. */
export async function carregarUsuario(filtro: { id: string } | { email: string }): Promise<(UsuarioAutenticado & { senhaHash: string }) | null> {
  const usuario = await getPrismaClient().usuario.findUnique({
    where: filtro,
    select: {
      id: true,
      nome: true,
      email: true,
      senhaHash: true,
      ativo: true,
      setores: { select: { tipoLista: true } },
      departamentos: { select: { departamento: true } },
      perfil: {
        select: {
          codigo: true,
          nome: true,
          ativo: true,
          recorteSetor: true,
          recorteDepartamento: true,
          permissoes: { select: { recurso: true, acao: true } },
        },
      },
    },
  });
  if (!usuario || !usuario.ativo || !usuario.perfil.ativo) return null;
  return {
    sub: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    senhaHash: usuario.senhaHash,
    perfil: { codigo: usuario.perfil.codigo, nome: usuario.perfil.nome },
    permissions: usuario.perfil.permissoes.map((p) => `${p.recurso.toLowerCase()}:${p.acao.toLowerCase()}`),
    acesso: {
      recorteSetor: usuario.perfil.recorteSetor,
      setores: usuario.setores.map((s) => s.tipoLista),
      recorteDepartamento: usuario.perfil.recorteDepartamento,
      departamentos: usuario.departamentos.map((d) => d.departamento),
    },
  };
}

/** Acesso irrestrito: o de quem não tem recorte nenhum (o Contábil). Para scripts e chamadas internas. */
export const ACESSO_TOTAL: Acesso = { recorteSetor: false, setores: [], recorteDepartamento: false, departamentos: [] };

/** O usuário alcança esta lista operacional? */
export const alcancaLista = (acesso: Acesso, tipo: string) => !acesso.recorteSetor || acesso.setores.includes(tipo as TipoImportacao);
