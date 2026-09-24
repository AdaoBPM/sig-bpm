import { api } from "@/lib/api";

export type AuthUser = {
  id: string;
  nome: string;
  email: string;
  permissions: string[];
};

type LoginResponse = {
  data: AuthUser;
};

type MeResponse = {
  data: AuthUser;
};

export const authService = {
  async login(email: string, password: string): Promise<AuthUser> {
    const { data } = await api.post<LoginResponse>("/auth/login", {
      email,
      password,
    });
    return data.data;
  },

  async logout(): Promise<void> {
    try {
      await api.post("/auth/logout");
    } catch {
      // Cookie pode já estar ausente — logout local segue
    }
  },

  async me(): Promise<AuthUser> {
    const { data } = await api.get<MeResponse>("/auth/me");
    return data.data;
  },
};
