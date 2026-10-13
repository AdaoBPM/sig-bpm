import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";

/**
 * As telas do cenário têm o id na URL, então o Next as renderiza a cada requisição. Este arquivo dá a elas a
 * fronteira de Suspense que o Cache Components exige, com um esqueleto enquanto a página carrega.
 */
export default function CarregandoCenario() {
  return (
    <div className="p-4 md:p-6">
      <LoadingSkeleton rows={6} />
    </div>
  );
}
