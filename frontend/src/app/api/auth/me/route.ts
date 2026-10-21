import { connection } from "next/server";
import { NextRequest, NextResponse } from "next/server";

import { getBackendUrl } from "@/lib/backend";
import { AVISO_SEM_BACKEND, CODIGO_DA_PUBLICACAO } from "@/lib/publicacaoServidor";
import { COOKIE_SESSAO } from "@/lib/cookieSessao";

export async function GET(request: NextRequest) {
  await connection();

  const token = request.cookies.get(COOKIE_SESSAO)?.value;

  if (!token) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const response = await fetch(`${getBackendUrl()}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch {
    // Sem o backend (21/10/2026): é o minuto da troca dos containers numa publicação; a faixa das telas aparece.
    return NextResponse.json({ error: AVISO_SEM_BACKEND, codigo: CODIGO_DA_PUBLICACAO }, { status: 503 });
  }
}
