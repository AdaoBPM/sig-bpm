const DEFAULT_REDIRECT = "/competencias";

/**
 * Permite apenas paths internos relativos (evita open redirect).
 */
export function getSafeInternalPath(path: string | null | undefined): string {
  if (!path) return DEFAULT_REDIRECT;

  if (!path.startsWith("/") || path.startsWith("//")) {
    return DEFAULT_REDIRECT;
  }

  if (path.includes("://") || path.includes("\\")) {
    return DEFAULT_REDIRECT;
  }

  return path;
}
