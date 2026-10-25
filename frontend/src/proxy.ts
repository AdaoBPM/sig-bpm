import type { NextRequest } from "next/server";
import { COOKIE_SESSAO } from "@/lib/cookieSessao";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/auth/login",
  "/api/auth/login",
  "/api/auth/logout",
  // O estado do modo de publicação (21/10/2026): a faixa aparece também na tela de login.
  "/api/publicacao",
  // A Biblioteca de APIs (24/10/2026): os aplicativos entram com o token da API (o backend confere), sem a sessão do SIG.
  "/api/v1/",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    // As fontes (22/10/2026: as abertas dos Relatórios Executivos, em public/fontes), como as imagens.
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|woff2)$/)
  ) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_SESSAO)?.value;

  if (!token && pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  if (!token && !pathname.startsWith("/api/")) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
