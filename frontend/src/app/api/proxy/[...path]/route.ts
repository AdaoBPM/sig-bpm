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
    const body = await request.text();
    if (body) init.body = body;
  }

  try {
    const response = await fetch(backendUrl, init);
    const contentType = response.headers.get("content-type") ?? "application/json";
    const data = await response.text();

    return new NextResponse(data, {
      status: response.status,
      headers: { "Content-Type": contentType },
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível conectar ao backend" },
      { status: 503 },
    );
  }
}
