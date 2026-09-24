import { ErrorPageLayout } from "@/components/shared/ErrorPageLayout";

export default function NotFound() {
  return (
    <ErrorPageLayout
      title="Página não encontrada"
      description="O endereço que você acessou não existe ou foi movido."
      actionLabel="Ir para o início"
      actionHref="/"
    />
  );
}
