import { z } from "zod";

import { ValidacaoLancamento } from "../../generated/prisma/enums.js";

export const listarClassificacaoSchema = z.object({
  situacao: z
    .union([z.enum(["PENDENCIAS", "TODOS"]), z.enum(ValidacaoLancamento)])
    .default("PENDENCIAS"),
  busca: z.string().trim().max(120).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  // A tela carrega o mês inteiro de uma vez para filtrar pelos rótulos das colunas.
  porPagina: z.coerce.number().int().min(1).max(5000).default(50),
});
