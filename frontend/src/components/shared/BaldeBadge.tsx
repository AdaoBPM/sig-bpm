const CHAVES_RATEIO = new Set([
  "PROJETO",
  "PRODUCAO",
  "METALURGIA",
  "ARMADURA",
  "ACOMPANHAMENTO",
]);

/**
 * O balde diz para onde o valor vai. As cinco chaves de rateio são
 * distribuídas por percentual; as demais vão inteiras para um destino.
 * A distinção visual existe porque é ela que explica a apuração.
 */
export function BaldeBadge({ balde, titulo }: { balde: string | null; /** O título no lugar do padrão (ex.: a competência dos percentuais). */ titulo?: string }) {
  if (!balde) {
    return <span className="text-gray-400">—</span>;
  }

  const eRateio = CHAVES_RATEIO.has(balde);

  return (
    <span
      title={titulo ?? (eRateio ? "Chave de rateio — distribuída por percentual" : "Balde direto")}
      className={
        eRateio
          ? "inline-block rounded-sm border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-800"
          : "inline-block rounded-sm border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600"
      }
    >
      {balde}
    </span>
  );
}
