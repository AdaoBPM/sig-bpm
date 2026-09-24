const ALLOWED_PROXY_HEADERS = new Set([
  "accept",
  "accept-language",
  "content-type",
  "content-length",
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
