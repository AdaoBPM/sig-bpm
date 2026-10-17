"use client";

import Link from "next/link";

import { usePermissions } from "@/context/PermissionContext";
import { itemPermitido, type NavItem } from "@/lib/navigation-config";

type Props = { grupo: NavItem; atual: string };

/**
 * A barra de um grupo de telas (Cadastros da Apuração, Cadastros da
 * Controladoria, Controle de Usuários), no formato da barra de etapas do mês:
 * o nome do grupo em amarelo-ouro no início e as telas que o perfil alcança,
 * com a atual em destaque.
 */
export function BarraDeTelas({ grupo, atual }: Props) {
  const { hasPermission } = usePermissions();
  const permitido = itemPermitido(grupo, hasPermission);
  if (!permitido?.telas) return null;
  return (
    <nav aria-label={grupo.title} className="flex min-w-0 flex-col gap-1 rounded-sm border border-gray-200 bg-white px-2 py-1.5 xl:flex-row xl:items-center">
      <div className="flex shrink-0 items-center px-1">
        <span className="bg-bpm-primary inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-sm font-bold whitespace-nowrap text-black">
          <grupo.icon className="size-4" />
          {grupo.title}
        </span>
      </div>
      {/* Quebra em duas linhas quando falta largura, sem rolar a página. */}
      <ol className="flex min-w-0 flex-wrap items-center gap-y-1 xl:ml-2">
        {permitido.telas.map((t) => {
          const ativa = t.title === atual;
          return (
            <li key={t.href} className="flex shrink-0 items-center">
              <Link
                href={t.href}
                aria-current={ativa ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-sm whitespace-nowrap ${ativa ? "bg-black font-bold text-white" : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"}`}
              >
                {t.title}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
