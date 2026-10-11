import { redirect } from "next/navigation";

/** O cenário abre na tela Resultados. */
export default async function CenarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/cenarios/sinteticos/${id}/resultados`);
}
