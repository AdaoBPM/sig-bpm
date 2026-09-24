"use client";

import { useEffect } from "react";

import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

export function useRegistrarAcessoTela(tela: string) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    void api
      .post("/proxy/auditoria/acesso", { tela })
      .catch(() => {
        // Auditoria não deve bloquear a experiência do usuário
      });
  }, [tela, user]);
}
