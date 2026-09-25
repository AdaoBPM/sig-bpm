import { z } from "zod";

/**
 * Abertura de competência.
 *
 * O intervalo de anos é deliberadamente estreito: a ferramenta começa em 2026,
 * e uma competência digitada errada — 2062 no lugar de 2026 — criaria um mês
 * fantasma que ninguém mais olharia.
 */
export const abrirCompetenciaSchema = z.object({
  ano: z.coerce.number().int().min(2025).max(2100),
  mes: z.coerce.number().int().min(1).max(12),
});

export type AbrirCompetenciaInput = z.infer<typeof abrirCompetenciaSchema>;
