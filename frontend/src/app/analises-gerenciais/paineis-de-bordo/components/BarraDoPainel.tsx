"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Globe, Lock } from "lucide-react";

import { EtiquetasDaBarra } from "@/components/layout/EtiquetasDaBarra";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { podeSair } from "@/lib/alteracoesPendentes";

import { CONFIGURACOES } from "@/app/analises-gerenciais/relatorios-executivos/components/ConfiguracoesDoRelatorio";
import { EtiquetaSituacao } from "@/app/analises-gerenciais/relatorios-executivos/components/EtiquetaSituacao";
import type { Relatorio } from "@/app/analises-gerenciais/relatorios-executivos/services/relatoriosExecutivosService";

import { paineisDeBordoService, ROTULO_DA_VISUALIZACAO, rotuloDaCompetencia } from "../services/paineisDeBordoService";

/**
 * A barra do painel de bordo (31/10/2026), como a dos Relatórios Executivos: o nome do painel e a competência em
 * amarelo-ouro (na competência automática, 03/11/2026, “Automática · Outubro/2026”; o menu leva aos outros painéis que o usuário vê), as Configurações (sem a engrenagem, 01/11/2026) e a única tela, Painel de Bordo (com o
 * check verde quando o painel está finalizado, 01/11/2026); à direita, a situação e a visualização (Privado ou Público) em
 * etiquetas.
 */
export function BarraDoPainel({ painel, chave, onMudar }: { painel: Relatorio; chave: string; onMudar: (chave: string) => void }) {
  const router = useRouter();
  const lista = useQuery({ queryKey: ["paineis-de-bordo"], queryFn: () => paineisDeBordoService.listar() });
  const telas = [
    { chave: CONFIGURACOES, nome: "Configurações", dica: "Configurações do painel (o nome, a competência, a visualização, o compartilhamento e os comparativos)", finalizado: null },
    ...painel.abas.map((a) => ({ chave: a.chave, nome: a.nome, dica: a.nome, finalizado: a.situacao === "FINALIZADO" ? a : null })),
  ];
  const privado = painel.visualizacao === "PRIVADO";
  return (
    <nav aria-label="Telas do painel" data-tour="barra-de-atividades" className="flex min-w-0 flex-col gap-1 rounded-sm border border-gray-200 bg-white px-2 py-1.5 xl:flex-row xl:items-center">
      <div className="flex min-w-0 shrink-0 items-center gap-1.5 px-1">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button type="button" title={`${painel.nome} · ${rotuloDaCompetencia(painel)}`} className="bg-bpm-primary hover:bg-bpm-primary-hover inline-flex max-w-full min-w-0 items-center gap-1 rounded-sm px-2.5 py-1 text-sm font-bold text-black xl:max-w-md">
                <span className="truncate">
                  {painel.nome} · {rotuloDaCompetencia(painel)}
                </span>
                <ChevronDown className="size-3.5 shrink-0 text-black/70" />
              </button>
            }
          />
          <DropdownMenuContent align="start" className="max-h-80 w-72 overflow-y-auto">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-gray-500">Ir para outro painel</DropdownMenuLabel>
              {(lista.data?.paineis ?? []).map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => p.id !== painel.id && podeSair() && router.push(`/analises-gerenciais/paineis-de-bordo/${p.id}`)}
                  className={`flex justify-between gap-3 ${p.id === painel.id ? "font-bold" : ""}`}
                >
                  <span className="truncate">{p.nome}</span>
                  <span className="shrink-0 text-xs text-gray-500">{rotuloDaCompetencia(p)}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ol className="flex min-w-0 flex-wrap items-center gap-y-1 xl:ml-2">
        {telas.map((t) => {
          const ativa = t.chave === chave;
          return (
            <li key={t.chave} className="flex shrink-0 items-center">
              <button
                type="button"
                aria-current={ativa ? "page" : undefined}
                title={t.dica}
                onClick={() => onMudar(t.chave)}
                className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-sm whitespace-nowrap ${ativa ? "bg-black font-bold text-white" : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"}`}
              >
                {t.nome}
                {t.finalizado ? (
                  // O check das etapas feitas do Fechamento Mensal, como nos grupos dos relatórios (01/11/2026).
                  <span title={`Finalizado${t.finalizado.finalizadoPor ? ` por ${t.finalizado.finalizadoPor}` : ""}${t.finalizado.finalizadoEm ? ` em ${new Date(t.finalizado.finalizadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}` : ""}`}>
                    <Check className={`size-4 ${ativa ? "text-green-400" : "text-green-700"}`} aria-label="Finalizado" />
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
      {/* A situação e a visualização à direita da barra, como as etiquetas das outras barras (27/10/2026). */}
      <EtiquetasDaBarra>
        <EtiquetaSituacao situacao={painel.situacao} />
        <span
          title={
            privado
              ? "Só quem criou o painel, os editores convidados e os Administradores o veem."
              : painel.situacao === "FINALIZADO"
                ? "Todos os usuários com permissão em Painéis e Apresentações o veem."
                : "Aparece para todos os usuários com permissão em Painéis e Apresentações quando for finalizado."
          }
          className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-px text-xs font-medium whitespace-nowrap ${privado ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-white text-gray-700"}`}
        >
          {privado ? <Lock className="size-3" /> : <Globe className="size-3" />}
          {painel.visualizacao ? ROTULO_DA_VISUALIZACAO[painel.visualizacao] : null}
        </span>
      </EtiquetasDaBarra>
    </nav>
  );
}
