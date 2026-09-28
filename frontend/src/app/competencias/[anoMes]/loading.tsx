import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";

/**
 * As telas da competência têm o mês na URL, então o Next as renderiza a cada
 * requisição. Este arquivo dá a elas a fronteira de Suspense que o Cache
 * Components exige, com um esqueleto enquanto a página carrega.
 */
export default function CarregandoCompetencia() {
  return (
    <div className="p-4 md:p-6">
      <LoadingSkeleton rows={6} />
    </div>
  );
}
