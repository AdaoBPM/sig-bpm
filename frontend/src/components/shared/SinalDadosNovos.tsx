/**
 * A bola verde: o mês pede reapuração — as entradas mudaram depois da
 * apuração (a bola da etapa DRE), o mês anterior foi reapurado depois dele,
 * ou ele recebeu dados importados a partir de outro mês e ainda não foi
 * apurado depois disso.
 */
export function SinalDadosNovos({ titulo = "Entradas alteradas depois da apuração: reapure" }: { titulo?: string }) {
  return <span className="inline-block size-2 shrink-0 rounded-full bg-green-600" title={titulo} aria-label={titulo} role="img" />;
}
