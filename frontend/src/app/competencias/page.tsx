import { ProtectedLayout } from "@/components/layout/ProtectedLayout";

import { CompetenciasContent } from "./CompetenciasContent";

/** A lista de competências é de todos os perfis (SPEC: "Quem visualiza: todos"); cada botão respeita a permissão da sua tela. */
export default function CompetenciasPage() {
  return (
    <ProtectedLayout>
      <CompetenciasContent />
    </ProtectedLayout>
  );
}
