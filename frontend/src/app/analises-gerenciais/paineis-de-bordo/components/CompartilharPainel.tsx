"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { ConfirmacaoDialog } from "@/components/shared/ConfirmacaoDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { plural } from "@/lib/texto";

import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";
import { botaoPrimario, Erro } from "@/app/cenarios/components/CenarioDialog";

import { paineisDeBordoService, type Compartilhamento, type UsuarioDoCompartilhamento } from "../services/paineisDeBordoService";

const DESTAQUE = "rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white";
const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
/** Sem diferença de maiúsculas e acentos, na busca. */
const normal = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * O Compartilhar da aba Geral (01/11/2026, pedido do Adão): quem criou o painel (ou o Administrador) convida outros usuários
 * do SIG para editá-lo com ele — as abas, os Comparativos, o Finalizar e o Reabrir; o Geral e a exclusão ficam com o dono.
 * Os convidados veem o painel mesmo privado ou em elaboração. Só os usuários ativos com a permissão de editar os Painéis de
 * Bordo podem ser convidados (os Administradores já editam todos). Os demais veem a lista, só para leitura.
 */
export function CompartilharPainel({ painelId }: { painelId: string }) {
  const queryClient = useQueryClient();
  const chave = ["paineis-de-bordo", "compartilhamento", painelId];
  const consulta = useQuery({ queryKey: chave, queryFn: () => paineisDeBordoService.compartilhamento(painelId) });
  const [convidando, setConvidando] = useState(false);
  const [removendo, setRemovendo] = useState<UsuarioDoCompartilhamento | null>(null);
  const atualizar = (c: Compartilhamento) => {
    queryClient.setQueryData(chave, c);
    // A lista dos painéis mostra os compartilhados.
    queryClient.invalidateQueries({ queryKey: ["paineis-de-bordo"], exact: true });
  };
  const remover = useMutation({
    mutationFn: (u: UsuarioDoCompartilhamento) => paineisDeBordoService.removerEditor(painelId, u.id),
    onSuccess: (c, u) => {
      atualizar(c);
      setRemovendo(null);
      toast.success(`${u.nome} não edita mais o painel.`);
    },
  });
  if (consulta.isError) return <Erro erro={mensagemDeErro(consulta.error, "Erro ao carregar o compartilhamento do painel.")} />;
  if (!consulta.data) return <div className="h-32 animate-pulse rounded-sm bg-gray-100" />;
  const c = consulta.data;
  return (
    <section className={`space-y-4 p-5 ${DESTAQUE}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-gray-900">Compartilhar</h2>
          <p className="mt-1 text-sm text-gray-600">
            Os usuários convidados editam o painel com quem o criou ({c.criadoPor}): as abas, os Comparativos, o Finalizar e o Reabrir; o Geral (o nome, a
            competência, a visualização e o Compartilhar) e a exclusão ficam com quem o criou e com os Administradores. Eles veem o painel mesmo Privado ou em
            elaboração. Só os usuários com a permissão de editar os Painéis de Bordo podem ser convidados.
          </p>
        </div>
        {c.podeCompartilhar ? (
          <Button type="button" className={botaoPrimario} disabled={!c.candidatos.length} title={c.candidatos.length ? undefined : "Nenhum outro usuário com a permissão de editar os Painéis de Bordo"} onClick={() => setConvidando(true)}>
            <UserPlus className="size-4" />
            Convidar
          </Button>
        ) : null}
      </div>
      {c.editores.length ? (
        <div className="overflow-x-auto rounded-sm border border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-bold tracking-wide text-gray-700 uppercase">
                <th className="px-3 py-2">Usuário</th>
                <th className="px-3 py-2">Perfil</th>
                <th className="px-3 py-2">Convidado Por</th>
                {c.podeCompartilhar ? <th className="w-28 px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {c.editores.map((e) => (
                <tr key={e.id} className="border-b border-gray-100 last:border-b-0">
                  <td className="px-3 py-2">
                    <span className="font-medium text-gray-900">{e.nome}</span>
                    <div className="text-xs text-gray-500">{e.email}</div>
                    {/* O convidado que perdeu a permissão (ou ficou inativo) só lê o painel. */}
                    {!e.edita ? <div className="text-xs text-red-700">Sem a permissão de editar os Painéis de Bordo (ou inativo): só lê o painel.</div> : null}
                  </td>
                  <td className="px-3 py-2 text-gray-700">{e.perfil ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                    {e.convidadoPor}
                    <div className="text-xs text-gray-500">em {dataHora(e.convidadoEm)}</div>
                  </td>
                  {c.podeCompartilhar ? (
                    <td className="px-3 py-2 text-right">
                      <Button type="button" variant="outline" size="sm" className="rounded-sm border-red-300 text-red-700 hover:bg-red-50" onClick={() => setRemovendo(e)}>
                        <UserMinus className="size-4" />
                        Remover
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-600">Nenhum usuário convidado: só quem criou o painel e os Administradores o editam.</p>
      )}
      {convidando ? <ConvidarUsuariosDialog painelId={painelId} candidatos={c.candidatos} onFechar={() => setConvidando(false)} onConvidar={atualizar} /> : null}
      {removendo ? (
        <ConfirmacaoDialog
          titulo="Remover Editor"
          descricao={`${removendo.nome} deixa de editar o painel; se ele for Privado ou estiver em elaboração, também deixa de vê-lo.`}
          acao="Remover"
          acaoPendente="Removendo…"
          pendente={remover.isPending}
          onConfirmar={() => remover.mutate(removendo)}
          onFechar={() => setRemovendo(null)}
        >
          <Erro erro={remover.isError ? mensagemDeErro(remover.error, "Não foi possível remover o editor.") : null} />
        </ConfirmacaoDialog>
      ) : null}
    </section>
  );
}

/** O modal Convidar Usuários (01/11/2026): os usuários que podem editar o painel, com a busca; os marcados passam a editá-lo. */
function ConvidarUsuariosDialog({
  painelId,
  candidatos,
  onFechar,
  onConvidar,
}: {
  painelId: string;
  candidatos: UsuarioDoCompartilhamento[];
  onFechar: () => void;
  onConvidar: (c: Compartilhamento) => void;
}) {
  const [busca, setBusca] = useState("");
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const visiveis = useMemo(() => {
    const b = normal(busca.trim());
    return b ? candidatos.filter((u) => normal(`${u.nome} ${u.email} ${u.perfil ?? ""}`).includes(b)) : candidatos;
  }, [busca, candidatos]);
  const convidar = useMutation({
    mutationFn: () => paineisDeBordoService.compartilhar(painelId, [...marcados]),
    onSuccess: (c) => {
      onConvidar(c);
      toast.success(`${plural(marcados.size, "1 usuário convidado", `${marcados.size} usuários convidados`)}: já podem editar o painel.`);
      onFechar();
    },
  });
  const alternar = (id: string) =>
    setMarcados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent avisoAoSair className="flex max-h-[85vh] flex-col rounded-sm sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Convidar Usuários para Editar o Painel</DialogTitle>
          <DialogDescription>
            Marque os usuários que vão editar o painel com você. A lista traz os usuários ativos com a permissão de editar os Painéis de Bordo (os
            Administradores já editam todos).
          </DialogDescription>
        </DialogHeader>
        <div className="relative shrink-0">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-gray-400" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pelo nome, e-mail ou perfil" aria-label="Buscar usuário" className="rounded-sm pl-8" />
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto rounded-sm border border-gray-200">
          {visiveis.map((u) => (
            <li key={u.id}>
              <label className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${marcados.has(u.id) ? "bg-yellow-50" : "hover:bg-gray-50"}`}>
                <input type="checkbox" className="size-4 accent-black" checked={marcados.has(u.id)} onChange={() => alternar(u.id)} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-gray-900">{u.nome}</span>
                  <span className="block truncate text-xs text-gray-500">{u.email}</span>
                </span>
                <span className="shrink-0 text-xs text-gray-600">{u.perfil}</span>
              </label>
            </li>
          ))}
          {!visiveis.length ? <li className="px-3 py-3 text-sm text-gray-500">Nenhum usuário encontrado.</li> : null}
        </ul>
        <Erro erro={convidar.isError ? mensagemDeErro(convidar.error, "Não foi possível convidar os usuários.") : null} />
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" className={botaoPrimario} disabled={!marcados.size || convidar.isPending} onClick={() => convidar.mutate()}>
            {convidar.isPending ? "Convidando…" : marcados.size ? `Convidar (${marcados.size})` : "Convidar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
