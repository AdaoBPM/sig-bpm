import { redirect } from "next/navigation";

/** O cenário analítico abre na tela Resultados. */
export default async function CenarioAnaliticoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/cenarios/analiticos/${id}/resultados`);
}
