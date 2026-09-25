import { z } from "zod";

/**
 * Parâmetros comuns às listagens de cadastro.
 *
 * A paginação não é enfeite: são 895 contas de resultado e 277 linhas da DRE,
 * e trazer tudo de uma vez tornaria a tela lenta sem necessidade.
 */
export const listarCadastroSchema = z.object({
  busca: z.string().trim().max(120).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(200).default(50),
});

export type ListarCadastroInput = z.infer<typeof listarCadastroSchema>;
