import { ProtectedLayout } from "@/components/layout/ProtectedLayout";

/**
 * Os processos do menu lateral ainda por fazer (14/10/2026): a tela só diz que está em desenvolvimento. No menu, o
 * processo fica em cinza, com o destaque amarelo-claro (NavItem.emDesenvolvimento).
 */
export function TelaEmDesenvolvimento() {
  return (
    <ProtectedLayout>
      <p className="rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white px-4 py-3 text-sm text-gray-700">Tela em desenvolvimento.</p>
    </ProtectedLayout>
  );
}
