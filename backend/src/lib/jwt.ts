import jwt, { type SignOptions } from "jsonwebtoken";

import { env } from "../config/env.js";

/**
 * O token leva só quem é o usuário: as permissões vêm do banco a cada pedido (autenticacao). Desde 14/10/2026 elas
 * não vão no token: com a matriz por tela e por aba, o do Administrador passava de 4 KB, o limite de um cookie.
 */
export type JwtPayload = {
  sub: string;
  email: string;
};

export function signToken(payload: JwtPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
