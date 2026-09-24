const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export function getBackendUrl(): string {
  return BACKEND_URL.replace(/\/$/, "");
}
