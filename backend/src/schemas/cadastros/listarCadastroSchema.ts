import { z } from "zod";

/**
 * Parâmetros comuns às listagens de cadastro.
 *
 * As telas com filtro nos rótulos das colunas (como no Excel) trazem o
 * cadastro inteiro de uma vez e paginam na tela, porque o filtro e a ordem
 * valem para todos os registros; o maior cadastro, o de preços com histórico,
 * tem cerca de 1.500.
 */
export const listarCadastroSchema = z.object({
  busca: z.string().trim().max(120).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(5000).default(50),
});

export type ListarCadastroInput = z.infer<typeof listarCadastroSchema>;

/** Preços do contrato: por padrão só os vigentes; com histórico, também os substituídos. */
export const listarPrecosSchema = listarCadastroSchema.extend({
  historico: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type ListarPrecosInput = z.infer<typeof listarPrecosSchema>;
