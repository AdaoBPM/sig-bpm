import { connection } from "next/server";
import { NextResponse } from "next/server";

import { getBackendUrl } from "@/lib/backend";

/**
 * O modo de publicação (21/10/2026): a faixa das telas pergunta aqui. Com o sinal ligado no servidor (o /health do
 * backend diz), ou com o backend sem responder (o minuto da troca dos containers no deploy), é publicação em andamento.
 */
export async function GET() {
  await connection();
  try {
    const resposta = await fetch(`${getBackendUrl()}/health`, { cache: "no-store", signal: AbortSignal.timeout(4000) });
    const corpo = (await resposta.json().catch(() => null)) as { data?: { publicacao?: boolean } } | null;
    return NextResponse.json({ publicacao: corpo?.data?.publicacao === true, backend: resposta.ok });
  } catch {
    return NextResponse.json({ publicacao: true, backend: false });
  }
}
