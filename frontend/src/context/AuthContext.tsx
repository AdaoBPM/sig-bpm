"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { queryClient } from "@/lib/queryClient";
import { authService, type AuthUser } from "@/services/authService";
import { CODIGO_DA_PUBLICACAO } from "@/lib/publicacao";

/** A resposta da publicação (21/10/2026): 503 com o código, ou o backend sem responder. */
const emPublicacaoOuSemBackend = (e: unknown) => {
  const r = (e as { response?: { status?: number; data?: { codigo?: string } } }).response;
  return r?.status === 503 && r.data?.codigo === CODIGO_DA_PUBLICACAO;
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const currentUser = await authService.me();
      setUser(currentUser);
    } catch (e) {
      // Na publicação (21/10/2026), o backend fora do ar não tira ninguém do sistema: o usuário fica.
      if (!emPublicacaoOuSemBackend(e)) setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // A carga inicial grava o estado só na resposta, e não depois de o provedor sair da tela.
  // Na publicação (21/10/2026), com o backend fora do ar, tenta de novo a cada 5 s (a faixa avisa), em vez de dar a tela
  // como sem acesso.
  useEffect(() => {
    let ativo = true;
    let espera: ReturnType<typeof setTimeout> | undefined;
    const carregar = () =>
      authService.me().then(
        (u) => {
          if (!ativo) return;
          setUser(u);
          setIsLoading(false);
        },
        (e) => {
          if (!ativo) return;
          if (emPublicacaoOuSemBackend(e)) {
            espera = setTimeout(carregar, 5000);
            return;
          }
          setUser(null);
          setIsLoading(false);
        },
      );
    void carregar();
    return () => {
      ativo = false;
      clearTimeout(espera);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const loggedUser = await authService.login(email, password);
    // O cache das consultas é de quem estava logado: começa limpo para o novo usuário.
    queryClient.clear();
    setUser(loggedUser);
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    queryClient.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, logout, refresh }),
    [user, isLoading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
}
