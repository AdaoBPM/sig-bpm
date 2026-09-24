"use client";

import { ErrorPageLayout } from "@/components/shared/ErrorPageLayout";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ reset }: GlobalErrorProps) {
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased">
        <ErrorPageLayout
          title="Erro crítico"
          description="Não foi possível carregar a aplicação. Recarregue a página ou tente novamente."
          actionLabel="Tentar novamente"
          onAction={reset}
        />
      </body>
    </html>
  );
}
