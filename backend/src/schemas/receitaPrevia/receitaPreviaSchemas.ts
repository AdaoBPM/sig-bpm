import { z } from "zod";

export const NATUREZAS = ["PRE_FABRICADO", "FRETE", "DEVOLUCOES_INVENTARIOS", "MONTAGEM", "COMPLEMENTAR"] as const;
export const COMPONENTES = ["BRUTA", "LIQUIDA", "VARIACAO_ESTOQUE"] as const;

/**
 * As linhas da aba Receitas (Prévia) que um lançamento pode ajustar, por
 * unidade: Matriz e Filial têm pré-fabricado, frete e devoluções; Obras,
 * montagem e complementar; a variação do estoque é só da Filial.
 */
export const LINHAS_POR_UNIDADE: Record<number, Array<{ natureza: (typeof NATUREZAS)[number]; componentes: Array<(typeof COMPONENTES)[number]> }>> = {
  1: [
    { natureza: "PRE_FABRICADO", componentes: ["BRUTA", "LIQUIDA"] },
    { natureza: "FRETE", componentes: ["BRUTA", "LIQUIDA"] },
    { natureza: "DEVOLUCOES_INVENTARIOS", componentes: ["BRUTA", "LIQUIDA"] },
  ],
  2: [
    { natureza: "PRE_FABRICADO", componentes: ["BRUTA", "LIQUIDA", "VARIACAO_ESTOQUE"] },
    { natureza: "FRETE", componentes: ["BRUTA", "LIQUIDA"] },
    { natureza: "DEVOLUCOES_INVENTARIOS", componentes: ["BRUTA", "LIQUIDA"] },
  ],
  3: [
    { natureza: "MONTAGEM", componentes: ["BRUTA", "LIQUIDA"] },
    { natureza: "COMPLEMENTAR", componentes: ["BRUTA", "LIQUIDA"] },
  ],
};

export const lancamentoReceitaSchema = z
  .object({
    unidade: z.coerce.number().int().min(1).max(3),
    natureza: z.enum(NATUREZAS),
    componente: z.enum(COMPONENTES),
    /** Texto decimal com ponto, para não perder centavos no caminho. */
    valor: z
      .union([z.number(), z.string()])
      .transform((v) => String(v).trim().replace(",", "."))
      .refine((v) => /^-?\d+(\.\d{1,2})?$/.test(v), "Valor com no máximo duas casas decimais"),
    observacao: z.string().trim().min(1, "Informe a observação").max(300),
  })
  .refine(
    (l) => LINHAS_POR_UNIDADE[l.unidade]?.some((x) => x.natureza === l.natureza && x.componentes.includes(l.componente)),
    { message: "Essa linha de receita não existe nessa unidade.", path: ["natureza"] },
  );

export type LancamentoReceitaInput = z.infer<typeof lancamentoReceitaSchema>;

export const itensReceitaSchema = z.object({
  unidade: z.coerce.number().int().min(1).max(3),
  natureza: z.enum(NATUREZAS),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(200).default(50),
});
