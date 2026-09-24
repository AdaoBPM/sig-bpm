import { z } from "zod";

export const leadSchema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome"),
  email: z.string().trim().email("E-mail inválido"),
  empresa: z.string().trim().optional(),
  mensagem: z.string().trim().max(1000).optional(),
});

export type LeadInput = z.infer<typeof leadSchema>;
