import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";

/**
 * A tela do painel de bordo (31/10/2026) tem o id na URL, como a do relatório executivo: este arquivo dá a ela a fronteira
 * de Suspense que o Cache Components exige, com um esqueleto enquanto a página carrega.
 */
export default function CarregandoPainel() {
  return (
    <div className="p-4 md:p-6">
      <LoadingSkeleton rows={6} />
    </div>
  );
}
