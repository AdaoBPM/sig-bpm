const ALLOWED_PROXY_HEADERS = new Set([
  "accept",
  "accept-language",
  "content-type",
  "content-length",
  // O pedido de uma parte do vídeo (20/10/2026, Relatórios Executivos).
  "range",
]);

export function buildProxyHeaders(
  incoming: Headers,
  token?: string,
): Headers {
  const headers = new Headers();

  for (const [key, value] of incoming.entries()) {
    if (ALLOWED_PROXY_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return headers;
}
