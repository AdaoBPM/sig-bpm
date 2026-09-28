import { getPrismaClient } from "../../config/prisma.js";

/**
 * Atualizações de estado comuns a todo processamento de importação: o
 * progresso que a tela acompanha e a recusa do arquivo inteiro.
 */

export async function registrarProgresso(id: string, valor: number) {
  await getPrismaClient().importacao.update({
    where: { id },
    data: { progresso: valor },
  });
}

/** Recusa do arquivo inteiro: nada foi gravado. */
export async function recusarImportacao(
  id: string,
  motivo: string,
  contagem?: { linhasLidas: number; linhasIgnoradas: number },
) {
  await getPrismaClient().importacao.update({
    where: { id },
    data: {
      status: "REJEITADA",
      progresso: 100,
      motivoRejeicao: motivo,
      linhasLidas: contagem?.linhasLidas ?? 0,
      linhasIgnoradas: contagem?.linhasIgnoradas ?? 0,
      linhasAceitas: 0,
      linhasRejeitadas: 0,
    },
  });
}

/**
 * Escolhe a aba: a de nome conhecido, se existir; senão a única do arquivo —
 * é o caso de quem copia a aba para uma pasta de trabalho à parte.
 */
export function escolherAba(nomes: string[]) {
  return (abas: string[]): string | null => {
    for (const nome of nomes) {
      const exata = abas.find((a) => a === nome);
      if (exata) return exata;
      const parecida = abas.find((a) => a.trim().toLowerCase() === nome.toLowerCase());
      if (parecida) return parecida;
    }
    return abas.length === 1 ? abas[0] : null;
  };
}
