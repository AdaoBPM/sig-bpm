import { connection } from "next/server";
import { NextRequest, NextResponse } from "next/server";

import { getBackendUrl } from "@/lib/backend";
import { buildProxyHeaders } from "@/lib/proxyHeaders";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context, "GET");
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context, "POST");
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context, "PUT");
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context, "PATCH");
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context, "DELETE");
}

async function proxyRequest(
  request: NextRequest,
  context: RouteContext,
  method: string,
) {
  await connection();

  const { path } = await context.params;
  const targetPath = path.join("/");

  if (targetPath.includes("..")) {
    return NextResponse.json({ error: "Path inválido" }, { status: 400 });
  }

  const url = new URL(request.url);
  const backendUrl = `${getBackendUrl()}/${targetPath}${url.search}`;

  const token = request.cookies.get("bpm_token")?.value;
  const headers = buildProxyHeaders(request.headers, token);

  const init: RequestInit = {
    method,
    headers,
    cache: "no-store",
  };

  if (method !== "GET" && method !== "HEAD") {
    // Bytes, não texto: o upload de planilha é binário, e decodificá-lo como
    // UTF-8 corromperia o arquivo. Para JSON o efeito é o mesmo.
    const body = await request.arrayBuffer();
    if (body.byteLength > 0) init.body = body;
  }

  try {
    const response = await fetch(backendUrl, init);
    // 204 e 304 não podem ter corpo, nem vazio: o construtor da resposta lança.
    if (response.status === 204 || response.status === 304) {
      return new NextResponse(null, { status: response.status });
    }
    const contentType = response.headers.get("content-type") ?? "application/json";
    // Bytes, não texto: a exportação da DRE (Excel e PDF) é binária.
    const data = await response.arrayBuffer();
    const headers: Record<string, string> = { "Content-Type": contentType };
    const disposicao = response.headers.get("content-disposition");
    if (disposicao) headers["Content-Disposition"] = disposicao;

    return new NextResponse(data, { status: response.status, headers });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível conectar ao backend" },
      { status: 503 },
    );
  }
}
