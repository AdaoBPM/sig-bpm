import { signToken } from "../lib/jwt.js";
import { compararSenha, hashSenha } from "../lib/senha.js";
import { getPrismaClient } from "../config/prisma.js";
import type { LoginInput } from "../schemas/auth/loginSchema.js";
import { carregarUsuario, type UsuarioAutenticado } from "./acesso/acesso.js";

/**
 * Autenticação por e-mail corporativo e senha, contra os usuários do banco
 * (Passo 22). O login de demonstração herdado do molde saiu: a instalação
 * começa com o usuário inicial da carga (perfil Contábil).
 */

export class RegraAuthError extends Error {
  constructor(
    readonly status: 400 | 401,
    message: string,
  ) {
    super(message);
  }
}

/** O que o frontend recebe do usuário: sem o hash da senha. */
function publico(u: UsuarioAutenticado) {
  return { id: u.sub, nome: u.nome, email: u.email, perfil: u.perfil, permissions: u.permissions, acesso: u.acesso };
}

export const authService = {
  async login(input: LoginInput) {
    const usuario = await carregarUsuario({ email: input.email.trim().toLowerCase() });
    if (!usuario || !(await compararSenha(input.password, usuario.senhaHash))) throw new RegraAuthError(401, "E-mail ou senha inválidos");
    const token = signToken({ sub: usuario.sub, email: usuario.email, permissions: usuario.permissions });
    return { user: publico(usuario), token };
  },

  me(usuario: UsuarioAutenticado) {
    return publico(usuario);
  },

  /** Troca da própria senha: exige a senha atual. */
  async trocarSenha(usuarioId: string, atual: string, nova: string) {
    const prisma = getPrismaClient();
    const u = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { senhaHash: true } });
    if (!(await compararSenha(atual, u.senhaHash))) throw new RegraAuthError(400, "A senha atual não confere.");
    await prisma.usuario.update({ where: { id: usuarioId }, data: { senhaHash: await hashSenha(nova) } });
  },
};
