import { redirect } from "next/navigation";

/** A antiga tela Indicadores de Resultados Empresariais: desde 19/10/2026, uma aba do Painel de Bordo. */
export default function IndicadoresPage() {
  redirect("/relatorios/painel?aba=indicadores");
}
