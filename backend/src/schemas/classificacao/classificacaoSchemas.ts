import { z } from "zod";

import { ValidacaoLancamento } from "../../generated/prisma/enums.js";

export const listarClassificacaoSchema = z.object({
  situacao: z
    .union([z.enum(["PENDENCIAS", "TODOS"]), z.enum(ValidacaoLancamento)])
    .default("PENDENCIAS"),
  busca: z.string().trim().max(120).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(200).default(50),
});
