import { connection } from "next/server";
import { COOKIE_SESSAO } from "@/lib/cookieSessao";
import { NextResponse } from "next/server";

export async function POST() {
  await connection();

  const response = NextResponse.json({ data: { ok: true } });
  response.cookies.delete(COOKIE_SESSAO);
  return response;
}
