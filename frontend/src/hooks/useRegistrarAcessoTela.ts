"use client";

import { useEffect } from "react";

import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

export function useRegistrarAcessoTela(tela: string) {
  const { user } = useAuth();
  // Pelo id: o objeto do usuário é refeito a cada refresh() (o aviso de
  // divergências), e isso gravaria o mesmo acesso de novo no log.
  const usuarioId = user?.id;

  useEffect(() => {
    if (!usuarioId) return;

    void api
      .post("/proxy/auditoria/acesso", { tela })
      .catch(() => {
        // Auditoria não deve bloquear a experiência do usuário
      });
  }, [tela, usuarioId]);
}
