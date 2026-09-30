import type { UsuarioAutenticado } from "../services/acesso/acesso.js";

declare global {
  namespace Express {
    interface Request {
      /** O usuário da requisição, relido do banco pelo middleware de autenticação. */
      user?: UsuarioAutenticado;
    }
  }
}

export {};
