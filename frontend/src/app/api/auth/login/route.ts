import { connection } from "next/server";
import { NextRequest, NextResponse } from "next/server";

import { getBackendUrl } from "@/lib/backend";
import { AVISO_SEM_BACKEND, CODIGO_DA_PUBLICACAO } from "@/lib/publicacaoServidor";
import { COOKIE_SESSAO, cookieSeguro } from "@/lib/cookieSessao";
import { loginSchema } from "@/lib/schemas/loginSchema";

export async function POST(request: NextRequest) {
  await connection();

  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const response = await fetch(`${getBackendUrl()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });

    const payload = await response.json();

    if (!response.ok) {
      return NextResponse.json(payload, { status: response.status });
    }

    const nextResponse = NextResponse.json({
      data: payload.data?.user ?? payload.data,
    });
    const token = payload.data?.token as string | undefined;

    if (token) {
      nextResponse.cookies.set(COOKIE_SESSAO, token, {
        httpOnly: true,
        sameSite: "lax",
        // Seguro só no acesso por https (15/10/2026): por http na rede, o navegador não guardaria o cookie.
        secure: cookieSeguro(request),
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    return nextResponse;
  } catch {
    // Sem o backend (21/10/2026): é o minuto da troca dos containers numa publicação; a faixa das telas aparece.
    return NextResponse.json({ error: AVISO_SEM_BACKEND, codigo: CODIGO_DA_PUBLICACAO }, { status: 503 });
  }
}
