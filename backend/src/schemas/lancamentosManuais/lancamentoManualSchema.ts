import { z } from "zod";

/**
 * Lançamento manual: o que a planilha digitava na Gastos (Lanç. Manuais).
 * Rateio e destino na DRE não entram aqui — saem da conta.
 */
export const lancamentoManualSchema = z.object({
  motivo: z.string().trim().min(1, "Informe o motivo").max(60),
  filial: z.coerce.number().int().min(1).max(2),
  centroCustoId: z.string().uuid().nullish(),
  contaResultadoId: z.string().uuid("Escolha a conta"),
  descricao: z.string().trim().min(1, "Informe a descrição").max(200),
  /** Texto decimal com ponto, para não perder centavos no caminho. */
  valor: z
    .union([z.number(), z.string()])
    .transform((v) => String(v).trim().replace(",", "."))
    .refine((v) => /^-?\d+(\.\d{1,2})?$/.test(v), "Valor com no máximo duas casas decimais"),
});

export type LancamentoManualInput = z.infer<typeof lancamentoManualSchema>;
