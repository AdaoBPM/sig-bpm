import { connection } from "next/server";
import { NextResponse } from "next/server";

export async function POST() {
  await connection();

  const response = NextResponse.json({ data: { ok: true } });
  response.cookies.delete("bpm_token");
  return response;
}
