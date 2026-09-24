import { connection } from "next/server";
import { NextResponse } from "next/server";

import { leadSchema } from "@/lib/schemas/leadSchema";

export async function POST(request: Request) {
  await connection();

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Dados inválidos";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  // Template: apenas confirma recebimento. Destino real (e-mail, webhook, CRM) vem do SPEC.
  if (process.env.NODE_ENV === "development") {
    console.info("[leads] Novo lead (exemplo):", parsed.data);
  }

  return NextResponse.json({ ok: true });
}
