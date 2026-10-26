import { redirect } from "next/navigation";

/** O endereço do processo (26/10/2026) leva à tela Resultados; o menu abre a primeira tela que o perfil alcança. */
export default function ResultadosPorLinhaPage() {
  redirect("/resultados-por-linha/resultados");
}
