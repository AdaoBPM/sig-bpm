import { z } from "zod";

import { TipoImportacao } from "../../generated/prisma/enums.js";

/** Competência na URL: "2026-08", o mesmo formato das rotas da tela. */
export const anoMesSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Competência no formato aaaa-mm")
  .transform((v) => ({ ano: Number(v.slice(0, 4)), mes: Number(v.slice(5, 7)) }))
  .refine((v) => v.mes >= 1 && v.mes <= 12, "Mês inválido");

/**
 * O arquivo vai no corpo da requisição, cru; o resto vai na query. Assim o
 * upload não depende de biblioteca de multipart.
 */
export const receberImportacaoSchema = z.object({
  tipo: z.enum(TipoImportacao),
  nomeArquivo: z.string().trim().min(1).max(255),
  forcar: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => v === "true" || v === "1"),
});
