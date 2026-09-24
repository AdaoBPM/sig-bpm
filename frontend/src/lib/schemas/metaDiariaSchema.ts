import { z } from "zod";

export const metaDiariaSchema = z.object({
  data: z.string().min(1, "Informe a data"),
  turno: z.enum(["manha", "tarde", "noite"], {
    message: "Selecione o turno",
  }),
  quantidade: z
    .number({ message: "Informe a quantidade produzida" })
    .min(1, "Quantidade deve ser maior que zero")
    .max(10000, "Valor muito alto para o exemplo"),
  observacao: z.string().max(500, "Máximo 500 caracteres").optional(),
});

export type MetaDiariaInput = z.infer<typeof metaDiariaSchema>;
