"use client";

import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

export function DashboardClientEffects() {
  useRegistrarAcessoTela("/dashboard");
  return null;
}
