"use client";

import { useMemo, useSyncExternalStore } from "react";
import { Bell, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { assinarVistas, iconeDoProcesso, marcarVistas, novidadesDoUsuario, ordemDoProcesso, vistasAte, type Novidade } from "@/lib/novidades";
import { plural } from "@/lib/texto";

import { botaoPrimario } from "@/app/cenarios/components/CenarioDialog";

/**
 * As Novidades do usuário (24/10/2026): as das telas que ele alcança e as que ainda não viu (publicadas depois da última
 * vez que abriu o modal, guardada no navegador). Sem nenhuma novidade das telas dele, o menu não mostra Novidades.
 */
export function useNovidades() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const lista = useMemo(() => (user ? novidadesDoUsuario(hasPermission, user.perfil.codigo === "ADMINISTRADOR") : []), [user, hasPermission]);
  // undefined: ainda sem ler o navegador (no servidor), para o sino não piscar.
  const vistas = useSyncExternalStore(
    assinarVistas,
    () => (user ? vistasAte(user.id) : undefined),
    () => undefined,
  );
  const novas = vistas === undefined ? [] : lista.filter((n) => !vistas || n.publicada > vistas);
  return { lista, novas, marcar: () => user && marcarVistas(user.id) };
}

/** Em quantas telas (os processos e as telas) há novidades. */
export const telasCom = (novas: Novidade[]) => new Set(novas.map((n) => `${n.processo}|${n.tela ?? ""}`)).size;

/** O sino ao lado do nome (24/10/2026), com as novidades ainda não vistas: balança de leve; o clique abre as Novidades. */
export function SinoDasNovidades({ novas, onAbrir }: { novas: Novidade[]; onAbrir: () => void }) {
  if (!novas.length) return null;
  const n = telasCom(novas);
  const dica = `Novidades no SIG, em ${plural(n, "uma tela", `${n} telas`)}: clique para ver`;
  return (
    <button type="button" onClick={onAbrir} title={dica} aria-label={dica} className="relative inline-flex size-8 items-center justify-center rounded-sm text-foreground hover:bg-accent">
      <Bell className="size-4 origin-top motion-safe:animate-[sino_5s_ease-in-out_infinite]" />
      <span aria-hidden className="absolute top-1.5 right-1.5 size-2 rounded-full bg-bpm-primary ring-2 ring-background" />
    </button>
  );
}

type Tela = { tela: string | null; itens: string[]; nova: boolean };
type Processo = { processo: string; telas: Tela[] };
type Dia = { data: string; processos: Processo[] };

/** Os registros por dia (do mais recente), processo (na ordem do menu lateral) e tela, com os itens juntos. */
function porDia(lista: Novidade[], novas: Set<Novidade>): Dia[] {
  const dias = new Map<string, Map<string, Map<string, Tela>>>();
  for (const n of [...lista].sort((a, b) => b.publicada.localeCompare(a.publicada))) {
    const data = n.publicada.slice(0, 10);
    const processos = dias.get(data) ?? new Map<string, Map<string, Tela>>();
    dias.set(data, processos);
    const telas = processos.get(n.processo) ?? new Map<string, Tela>();
    processos.set(n.processo, telas);
    const tela = telas.get(n.tela ?? "") ?? { tela: n.tela ?? null, itens: [], nova: false };
    telas.set(n.tela ?? "", tela);
    tela.itens.push(...n.itens.filter((i) => !tela.itens.includes(i)));
    tela.nova ||= novas.has(n);
  }
  return [...dias].map(([data, processos]) => ({
    data,
    processos: [...processos]
      .sort(([a], [b]) => ordemDoProcesso(a) - ordemDoProcesso(b))
      .map(([processo, telas]) => ({ processo, telas: [...telas.values()] })),
  }));
}

/** A etiqueta das novidades ainda não vistas, em amarelo-ouro. */
function EtiquetaNova() {
  return <span className="rounded-sm bg-bpm-primary px-1.5 py-px text-[10px] font-bold tracking-normal text-black normal-case">Nova</span>;
}

/** "Sábado, 24/10/2026". */
function rotuloDoDia(data: string) {
  const [a, m, d] = data.split("-").map(Number);
  const semana = new Date(a, m - 1, d).toLocaleDateString("pt-BR", { weekday: "long" });
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${a}`;
}

/**
 * O modal Novidades (24/10/2026, pedido do Adão): as atualizações do SIG nas telas que o usuário alcança, por dia (do
 * mais recente), processo e tela; as que ele ainda não tinha visto, com a etiqueta Nova. As vistas continuam na lista.
 */
export function NovidadesDialog({ lista, novas, onFechar }: { lista: Novidade[]; novas: Novidade[]; onFechar: () => void }) {
  const { user } = useAuth();
  const dias = useMemo(() => porDia(lista, new Set(novas)), [lista, novas]);
  const primeiroNome = user?.nome.split(" ")[0] ?? "";
  return (
    <Dialog open onOpenChange={(a) => (!a ? onFechar() : undefined)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-sm sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-bpm-primary" />
            Novidades
          </DialogTitle>
          <DialogDescription>
            {primeiroNome ? `Olá, ${primeiroNome}. ` : ""}
            {novas.length ? `Desde a sua última visita, há novidades em ${plural(telasCom(novas), "uma tela", `${telasCom(novas)} telas`)}, com a etiqueta Nova. ` : ""}
            Estas são as atualizações do SIG nas telas que você acessa, das mais recentes para as mais antigas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {dias.map((d) => (
            <section key={d.data} className="space-y-3">
              <h3 className="border-b border-gray-200 pb-1 text-sm font-bold text-gray-900">{rotuloDoDia(d.data)}</h3>
              {d.processos.map((p) => {
                const Icone = iconeDoProcesso(p.processo) ?? Sparkles;
                // O processo sem telas separadas (os cenários): a etiqueta ao lado do nome dele.
                const novaSemTela = p.telas.some((t) => !t.tela && t.nova);
                return (
                  <div key={p.processo} className="space-y-2">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                      <Icone className="size-4 shrink-0 text-gray-600" />
                      {p.processo}
                      {novaSemTela ? <EtiquetaNova /> : null}
                    </p>
                    {p.telas.map((t) => (
                      <div key={t.tela ?? ""} className="pl-6">
                        {t.tela ? (
                          <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-gray-600 uppercase">
                            {t.tela}
                            {t.nova ? <EtiquetaNova /> : null}
                          </p>
                        ) : null}
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-700">
                          {t.itens.map((i) => (
                            <li key={i}>{i}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                );
              })}
            </section>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" className={botaoPrimario} onClick={onFechar}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
