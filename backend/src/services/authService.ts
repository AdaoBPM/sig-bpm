import { env } from "../config/env.js";
import { compararSenha } from "../lib/senha.js";
import { signToken } from "../lib/jwt.js";
import { getPrismaClient } from "../config/prisma.js";
import type { LoginInput } from "../schemas/auth/loginSchema.js";

export type AuthUser = {
  id: string;
  nome: string;
  email: string;
  permissions: string[];
};

const TEMPLATE_USER: AuthUser = {
  id: "00000000-0000-0000-0000-000000000001",
  nome: "Administrador BPM",
  email: "admin@bpm.com",
  permissions: ["dashboard:view", "pedidos:view", "pedidos:create"],
};

const TEMPLATE_PASSWORD_HASH =
  "$2b$10$TfWpTldLcP8P4w0bOlhMw.b5i1v2neNtOCAGdEJjZNZGhF6BPPsQ6";

/// As permissões vivem no perfil, não no usuário. Aqui a matriz
/// (recurso × ação) vira a lista de strings "recurso:acao" que o token carrega
/// e que os middlewares verificam.
function permissoesDoPerfil(
  permissoes: Array<{ recurso: string; acao: string }>,
): string[] {
  return permissoes.map(
    (p) => `${p.recurso.toLowerCase()}:${p.acao.toLowerCase()}`,
  );
}

async function authenticateTemplateUser(
  input: LoginInput,
): Promise<AuthUser | null> {
  if (!env.enableTemplateAuth) {
    return null;
  }

  if (input.email !== TEMPLATE_USER.email) {
    return null;
  }

  const valid = await compararSenha(input.password, TEMPLATE_PASSWORD_HASH);
  return valid ? TEMPLATE_USER : null;
}

async function authenticateDatabaseUser(
  input: LoginInput,
): Promise<AuthUser | null> {
  const prisma = getPrismaClient();
  const usuario = await prisma.usuario.findUnique({
    where: { email: input.email },
    include: { perfil: { include: { permissoes: true } } },
  });

  if (!usuario || !usuario.ativo || !usuario.perfil.ativo) {
    return null;
  }

  const valid = await compararSenha(input.password, usuario.senhaHash);
  if (!valid) {
    return null;
  }

  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    permissions: permissoesDoPerfil(usuario.perfil.permissoes),
  };
}

export const authService = {
  async login(input: LoginInput) {
    let user: AuthUser | null = null;

    try {
      user = await authenticateDatabaseUser(input);
    } catch {
      user = null;
    }

    if (!user) {
      user = await authenticateTemplateUser(input);
    }

    if (!user) {
      throw new Error("Credenciais inválidas");
    }

    const token = signToken({
      sub: user.id,
      email: user.email,
      permissions: user.permissions,
    });

    return { user, token };
  },

  async me(userId: string, email: string, permissions: string[]) {
    try {
      const prisma = getPrismaClient();
      const usuario = await prisma.usuario.findUnique({
        where: { id: userId },
        include: { perfil: { include: { permissoes: true } } },
      });

      if (usuario) {
        return {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          permissions: permissoesDoPerfil(usuario.perfil.permissoes),
        };
      }
    } catch {
      // fallback controlado abaixo
    }

    if (env.enableTemplateAuth && email === TEMPLATE_USER.email) {
      return TEMPLATE_USER;
    }

    return {
      id: userId,
      nome: "Usuário",
      email,
      permissions,
    };
  },
};
