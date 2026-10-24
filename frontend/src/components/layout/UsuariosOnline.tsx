"use client";

import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useAcessibilidade } from "@/lib/acessibilidade";
import { plural } from "@/lib/texto";

type Presenca = { total: number; usuarios: string[] } | null;

/** "A, B e C". */
const emLista = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}` : (xs[0] ?? ""));

/**
 * Quantos usuários estão online (24/10/2026), ao lado do nome no alto da tela. Toda aba logada avisa o backend a cada
 * minuto (online é quem avisou nos últimos 3 minutos), também com a aba em segundo plano; só o Administrador recebe a
 * contagem e vê o indicador, com os nomes na dica.
 */
export function UsuariosOnline() {
  const { user } = useAuth();
  const [acessibilidade] = useAcessibilidade();
  const presenca = useQuery({
    queryKey: ["presenca", user?.id],
    queryFn: async () => (await api.get<{ data: Presenca }>("/proxy/presenca")).data.data,
    enabled: !!user,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
    retry: false,
  });
  const p = presenca.data;
  if (user?.perfil.codigo !== "ADMINISTRADOR" || !p) return null;
  const dica = `${p.total} ${plural(p.total, "usuário online", "usuários online")}: ${emLista(p.usuarios)}`;
  return (
    <span title={dica} aria-label={dica} className="flex h-7 items-center gap-1.5 rounded-sm border border-border px-2 text-xs font-medium text-muted-foreground">
      <span className={`size-2 rounded-full ${acessibilidade === "daltonismo" ? "bg-blue-600" : "bg-green-600"}`} />
      <Users className="size-3.5" />
      {p.total}
    </span>
  );
}
