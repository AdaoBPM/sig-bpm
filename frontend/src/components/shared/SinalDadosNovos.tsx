/**
 * A bola verde: o mês recebeu dados importados a partir de outro mês (a
 * importação em lote leva as mudanças dos meses anteriores ainda abertos) e
 * ainda não foi apurado depois disso.
 */
export function SinalDadosNovos({ titulo = "Recebeu dados importados de outro mês: reapure" }: { titulo?: string }) {
  return <span className="inline-block size-2 shrink-0 rounded-full bg-green-600" title={titulo} aria-label={titulo} role="img" />;
}
