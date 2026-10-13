"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { podeSair } from "@/lib/alteracoesPendentes";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Lock } from "lucide-react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { etapasDoMes, rotuloDoMes } from "@/lib/etapasDoMes";

import { apuracaoService } from "@/app/competencias/services/apuracaoService";
import { competenciasService } from "@/app/competencias/services/competenciasService";
import { StatusCompetenciaBadge } from "@/app/competencias/components/StatusCompetenciaBadge";
import { SinalDadosNovos } from "@/components/shared/SinalDadosNovos";

type Props = { anoMes: string; chave: string | null; resto: string };

/**
 * A barra de etapas do mês (decisão D1 do levantamento de layout): as telas do
 * fechamento na ordem em que se trabalha, a atual em destaque, com os sinais
 * que pedem atenção (pendências de classificação, entradas alteradas depois da
 * apuração), e a troca de mês sem voltar à lista de competências.
 */
export function EtapasDoMes({ anoMes, chave, resto }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const etapas = etapasDoMes(hasPermission, user?.acesso);
  const veSituacao = ["dre:ler", "classificacao:ler", "apuracao:ler"].some(hasPermission);

  const competencias = useQuery({ queryKey: ["competencias", "todos"], queryFn: () => competenciasService.listar() });
  const situacao = useQuery({ queryKey: ["apuracao", anoMes], queryFn: () => apuracaoService.situacao(anoMes), enabled: veSituacao });
  const atual = competencias.data?.itens.find((c) => `${c.ano}-${String(c.mes).padStart(2, "0")}` === anoMes);
  const s = situacao.data;

  // Trocar de mês mantém a etapa (e a lista aberta).
  const irPara = (outro: string) => podeSair() && router.push(`/competencias/${outro}/${resto || etapas[0]?.caminho || ""}`);

  const sinal = (k: string) => {
    if (!s) return null;
    if (k === "classificacao" && s.pendenciasClassificacao > 0) {
      return <span className="bg-bpm-primary rounded-sm px-1.5 text-xs font-bold text-black" title="Lançamentos com pendência de classificação">{s.pendenciasClassificacao}</span>;
    }
    if (k === "dre" && s.mudancas.length > 0) {
      return <span className="size-2 rounded-full bg-yellow-600" title="Entradas alteradas depois da apuração: reapure" />;
    }
    if (k === "dre" && s.competencia.status === "FECHADA") return <Lock className="size-3 text-gray-500" aria-label="Fechada" />;
    return null;
  };
  // As divergências abertas do mês, no número em amarelo (como as pendências da classificação).
  const abertas = atual?._count.divergencias ?? 0;
  const sinalDe = (k: string) =>
    k === "divergencias" && abertas > 0 ? (
      <span className="bg-bpm-primary rounded-sm px-1.5 text-xs font-bold text-black" title="Divergências abertas">
        {abertas}
      </span>
    ) : (
      sinal(k)
    );

  return (
    <nav aria-label="Etapas do mês" className="flex min-w-0 flex-col gap-1 rounded-sm border border-gray-200 bg-white px-2 py-1.5 xl:flex-row xl:items-center">
      <div className="flex shrink-0 items-center gap-1.5 px-1">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              // A competência em trabalho, em destaque no amarelo-ouro da marca, como no menu.
              <button type="button" className="bg-bpm-primary hover:bg-bpm-primary-hover inline-flex items-center gap-1 rounded-sm px-2.5 py-1 text-sm font-bold text-black">
                {rotuloDoMes(anoMes)}
                <span className="font-medium text-black/70">{atual?.nomeMes}</span>
                {atual?.dadosNovos ? <SinalDadosNovos /> : null}
                <ChevronDown className="size-3.5 text-black/70" />
              </button>
            }
          />
          <DropdownMenuContent align="start" className="max-h-80 w-56 overflow-y-auto">
            {/* O rótulo do menu precisa estar num grupo (base-ui). */}
            <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-gray-500">Ir para outro mês</DropdownMenuLabel>
            {(competencias.data?.itens ?? []).map((c) => {
              const am = `${c.ano}-${String(c.mes).padStart(2, "0")}`;
              return (
                <DropdownMenuItem key={c.id} onClick={() => irPara(am)} className={am === anoMes ? "font-bold" : ""}>
                  <span className="w-16">{rotuloDoMes(am)}</span>
                  <span className="text-xs text-gray-500">{c.nomeMes}</span>
                  {c.dadosNovos ? <SinalDadosNovos /> : null}
                </DropdownMenuItem>
              );
            })}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {atual ? <StatusCompetenciaBadge status={atual.status} /> : null}
      </div>
      {/* Quebra em duas linhas quando falta largura, sem rolar a página. */}
      <ol className="flex min-w-0 flex-wrap items-center gap-y-1">
        {etapas.map((e) => {
          const ativa = e.chave === chave;
          return (
            <li key={e.chave} className="flex shrink-0 items-center">
              <Link
                href={`/competencias/${anoMes}/${e.caminho}`}
                aria-current={ativa ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-sm px-1.5 py-1.5 text-sm whitespace-nowrap ${ativa ? "bg-black font-bold text-white" : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"}`}
              >
                {e.rotulo}
                {sinalDe(e.chave)}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
