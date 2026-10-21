import axios from "axios";

import { avisarPublicacao, CODIGO_DA_PUBLICACAO } from "./publicacao";

export const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // O modo de publicação (21/10/2026): a gravação recusada ou o backend sem responder mostram a faixa na hora.
    if (error.response?.status === 503 && error.response.data?.codigo === CODIGO_DA_PUBLICACAO) {
      avisarPublicacao(!String(error.response.data?.error ?? "").includes("volta em instantes"));
    }
    const requestUrl = error.config?.url ?? "";
    const isAuthRoute =
      requestUrl.includes("/auth/login") || requestUrl.includes("/auth/logout");

    if (
      error.response?.status === 401 &&
      typeof window !== "undefined" &&
      !isAuthRoute
    ) {
      const isLoginPage = window.location.pathname.startsWith("/auth/login");
      if (!isLoginPage) {
        window.location.href = "/auth/login";
      }
    }
    return Promise.reject(error);
  },
);
