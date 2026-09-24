"use client";

import { ErrorPageLayout } from "@/components/shared/ErrorPageLayout";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ reset }: ErrorProps) {
  return (
    <ErrorPageLayout
      title="Algo deu errado"
      description="Ocorreu um erro inesperado. Tente novamente ou volte ao início."
      actionLabel="Tentar novamente"
      onAction={reset}
    />
  );
}
