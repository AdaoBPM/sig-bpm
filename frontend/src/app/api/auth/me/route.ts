import { connection } from "next/server";
import { NextRequest, NextResponse } from "next/server";

import { getBackendUrl } from "@/lib/backend";
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
    return NextResponse.json(
      { error: "Não foi possível conectar ao backend" },
      { status: 503 },
    );
  }
}
