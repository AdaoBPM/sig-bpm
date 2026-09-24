import axios from "axios";

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
