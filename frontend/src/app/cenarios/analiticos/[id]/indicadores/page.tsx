import { redirect } from "next/navigation";

/** A antiga tela Indicadores de um cenário: desde 19/10/2026, uma aba do Painel de Bordo dele. */
export default async function CenarioIndicadoresPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/cenarios/analiticos/${id}/painel?aba=indicadores`);
}
