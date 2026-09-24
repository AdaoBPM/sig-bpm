import { z } from "zod";

export const registrarAcessoSchema = z.object({
  tela: z.string().min(1, "Informe o identificador da tela"),
});

export type RegistrarAcessoInput = z.infer<typeof registrarAcessoSchema>;
