import { z } from "zod";

export const registrarAcessoSchema = z.object({
  tela: z
    .string()
    .min(1, "Informe o identificador da tela")
    .max(200, "Identificador de tela longo demais")
    .regex(/^\/[\w\-./%[\]]*$/, "Identificador de tela inválido"),
});

export type RegistrarAcessoInput = z.infer<typeof registrarAcessoSchema>;
