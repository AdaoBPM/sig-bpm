"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/context/PermissionContext";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";
import { botaoPrimario, classeSelect, Erro } from "@/app/cenarios/components/CenarioDialog";

import { EtiquetaSituacao } from "./components/EtiquetaSituacao";
import { relatoriosExecutivosService, type ListaDeRelatorios } from "./services/relatoriosExecutivosService";

const dataHora = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

/**
 * A lista dos Relatórios Executivos (15/10/2026, Análises Gerenciais): as competências fechadas do exercício, a mais
 * recente primeiro, cada uma com os relatórios que o usuário vê (os finalizados de todos e o dele, em elaboração ou
 * finalizado). "Novo Relatório" cria a apresentação do usuário num mês fechado (uma por mês).
 */
export function RelatoriosExecutivosContent() {
  useRegistrarAcessoTela("/analises-gerenciais/relatorios-executivos");
  const { hasPermission } = usePermissions();
  const pode = hasPermission("relatorios_executivos:editar");
  const [anoEscolhido, setAno] = useState<number | null>(null);
  const [criando, setCriando] = useState<number | null | "escolher">(null);
  const consulta = useQuery({ queryKey: ["relatorios-executivos", anoEscolhido], queryFn: () => relatoriosExecutivosService.listar(anoEscolhido) });
  const d = consulta.data;
  const livres = d?.meses.filter((m) => !m.temMeu) ?? [];
  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Relatórios Executivos"
        acoes={
          d ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="rel-ano" className="text-xs text-gray-600">
                  Exercício
                </Label>
                <select id="rel-ano" value={d.ano} onChange={(e) => setAno(Number(e.target.value))} className={`${classeSelect} w-28`}>
                  {(d.anos.length ? d.anos : [d.ano]).map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              {pode ? (
                <Button type="button" className={botaoPrimario} disabled={!livres.length} title={livres.length ? undefined : "Você já tem o relatório de todos os meses fechados do exercício"} onClick={() => setCriando("escolher")}>
                  <Plus className="size-4" />
                  Novo Relatório
                </Button>
              ) : null}
            </div>
          ) : null
        }
        comoUsar={
          <ul>
            <li>Escolha o exercício: a lista mostra as competências fechadas dele, a mais recente primeiro, cada uma com os relatórios do mês.</li>
            <li>
              Em cada mês, aparecem os relatórios finalizados de todos os gestores e o seu, em elaboração ou finalizado. Clique numa linha para abrir o
              relatório.
            </li>
            {pode ? (
              <li>
                “Novo Relatório” cria a sua apresentação num mês fechado (uma por mês). As abas são os departamentos do seu recorte (Controle de Usuários);
                sem recorte, escolha os departamentos no modal.
              </li>
            ) : null}
          </ul>
        }
        sobre={
          <p>
            Os Relatórios Executivos são as apresentações mensais dos gestores: em cada departamento (uma aba), os cards do Painel de Bordo e dos
            Indicadores que o gestor escolhe, com as anotações dos pontos positivos, negativos e de atenção. Os cards trazem só as competências
            fechadas, até o mês do relatório. Em elaboração, o relatório é só do autor; finalizado, todos os que leem esta tela o veem, e o autor (ou o
            Administrador) pode reabri-lo.
          </p>
        }
      />
      {consulta.isError ? (
        <Erro erro={mensagemDeErro(consulta.error, "Erro ao carregar os relatórios.")} />
      ) : !d ? (
        <div className="h-64 animate-pulse rounded-sm bg-gray-100" />
      ) : !d.meses.length ? (
        <p className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">Nenhuma competência fechada em {d.ano}: os relatórios são das competências fechadas.</p>
      ) : (
        <div className="space-y-4">
          {d.meses.map((m) => (
            <section key={m.mes} className="rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white">
              <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                <h2 className="text-sm font-bold tracking-wide text-gray-900 uppercase">{m.rotulo}</h2>
                {pode && !m.temMeu ? (
                  <button type="button" className="text-xs text-gray-600 underline underline-offset-2 hover:text-gray-900" onClick={() => setCriando(m.mes)}>
                    Criar o Meu Relatório
                  </button>
                ) : null}
              </div>
              {m.relatorios.length ? (
                <table className="tabela-sig w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-y border-gray-200">
                      <th className="px-4 py-2 text-left text-xs font-bold">Autor</th>
                      <th className="px-4 py-2 text-left text-xs font-bold">Departamentos</th>
                      <th className="px-4 py-2 text-left text-xs font-bold">Situação</th>
                      <th className="px-4 py-2 text-left text-xs font-bold">Atualizado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.relatorios.map((r) => (
                      <tr key={r.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-900">
                          <Link href={`/analises-gerenciais/relatorios-executivos/${r.id}`} className="hover:underline">
                            {r.autorNome}
                          </Link>
                          {r.meu ? <span className="ml-2 text-xs font-normal text-gray-500">(seu)</span> : null}
                        </td>
                        <td className="px-4 py-2 text-gray-700">{r.departamentos.map((x) => x.nome).join(", ")}</td>
                        <td className="px-4 py-2">
                          <EtiquetaSituacao situacao={r.situacao} />
                        </td>
                        <td className="px-4 py-2 text-gray-600">{dataHora(r.situacao === "FINALIZADO" ? r.finalizadoEm : r.atualizadoEm)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="border-t border-gray-100 px-4 py-3 text-sm text-gray-500">Nenhum relatório finalizado no mês.</p>
              )}
            </section>
          ))}
        </div>
      )}
      {criando !== null && d ? <NovoRelatorioDialog dados={d} mesInicial={criando === "escolher" ? null : criando} onFechar={() => setCriando(null)} /> : null}
    </div>
  );
}

/** O modal Novo Relatório: o mês (fechado, sem relatório seu) e, sem recorte de departamento, os departamentos (as abas). */
function NovoRelatorioDialog({ dados, mesInicial, onFechar }: { dados: ListaDeRelatorios; mesInicial: number | null; onFechar: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const livres = dados.meses.filter((m) => !m.temMeu);
  const [mes, setMes] = useState<number>(mesInicial ?? livres[0]?.mes ?? 0);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const comRecorte = dados.meusDepartamentos !== null;
  const criar = useMutation({
    mutationFn: () => relatoriosExecutivosService.criar(dados.ano, mes, comRecorte ? null : escolhidos),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["relatorios-executivos"] });
      toast.success(`Relatório de ${r.rotuloMes} criado.`);
      router.push(`/analises-gerenciais/relatorios-executivos/${r.id}`);
    },
  });
  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent className="rounded-sm sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Relatório Executivo</DialogTitle>
          <DialogDescription>A sua apresentação do mês: em elaboração, só você a vê; finalizada, fica visível para todos os que leem a tela.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="novo-mes">Mês</Label>
          <select id="novo-mes" value={mes} onChange={(e) => setMes(Number(e.target.value))} className={classeSelect}>
            {livres.map((m) => (
              <option key={m.mes} value={m.mes}>
                {m.rotulo}
              </option>
            ))}
          </select>
        </div>
        {comRecorte ? (
          <p className="text-sm text-gray-700">
            Abas (os departamentos do seu recorte): <span className="font-medium text-gray-900">{dados.meusDepartamentos!.map((x) => x.nome).join(", ") || "nenhum"}</span>.
          </p>
        ) : (
          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-sm leading-none font-medium">Departamentos (as Abas)</legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {dados.departamentos.map((x) => (
                <label key={x.chave} className="flex cursor-pointer items-center gap-2 rounded-sm border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50">
                  <input
                    type="checkbox"
                    className="accent-black"
                    checked={escolhidos.includes(x.chave)}
                    onChange={() => setEscolhidos((e) => (e.includes(x.chave) ? e.filter((y) => y !== x.chave) : dados.departamentos.map((z) => z.chave).filter((z) => z === x.chave || e.includes(z))))}
                  />
                  {x.nome}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <Erro erro={criar.isError ? mensagemDeErro(criar.error, "Não foi possível criar o relatório.") : null} />
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" className={botaoPrimario} disabled={!mes || (!comRecorte && !escolhidos.length) || criar.isPending} onClick={() => criar.mutate()}>
            {criar.isPending ? "Criando…" : "Criar Relatório"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
