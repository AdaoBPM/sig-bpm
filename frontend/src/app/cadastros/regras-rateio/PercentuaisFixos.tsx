"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/context/PermissionContext";
import { api } from "@/lib/api";
import { atualizarCompetencia } from "@/lib/atualizarCompetencia";

import { botaoPrimario, classeSelect, Erro } from "@/app/cenarios/components/CenarioDialog";
import { lerNumero } from "@/app/cenarios/components/EdicaoDialogs";
import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";

type Conjunto = { chave: string; inicio: string; fim: string | null; percentuais: Record<string, number>; usado: boolean; rotulo: string };
type Dados = { chaves: Array<{ chave: string; nome: string; destinos: Array<{ destino: string; nome: string }> }>; conjuntos: Conjunto[] };

/** O serviço dos percentuais fixos (também o Novo Rateio, do tipo Fixo). */
export const servicoDosPercentuaisFixos = {
  listar: async () => (await api.get<{ data: Dados }>("/proxy/cadastros/regras-rateio/percentuais-fixos")).data.data,
  gravar: async (d: { chave: string; inicioAnterior: string | null; inicio: string; fim: string | null; percentuais: Record<string, number>; rotulo?: string | null }) =>
    (await api.put<{ data: Dados }>("/proxy/cadastros/regras-rateio/percentuais-fixos", d)).data.data,
  excluir: async (chave: string, inicio: string) => (await api.delete<{ data: Dados }>("/proxy/cadastros/regras-rateio/percentuais-fixos", { params: { chave, inicio } })).data.data,
  verificacao: async () => (await api.get<{ data: { avisos: string[] } }>("/proxy/cadastros/regras-rateio/verificacao")).data.data,
};
const servico = servicoDosPercentuaisFixos;

const dataBR = (iso: string) => iso.split("-").reverse().join("/");
const pct = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

/**
 * O aviso das regras de rateio (14/10/2026): as chaves com meses sem regra (até dezembro do ano que vem) e os conjuntos
 * de percentuais fixos que não somam 100%, no quadro com o destaque vermelho. Some quando não há.
 */
export function AvisoRegrasRateio() {
  const consulta = useQuery({ queryKey: ["edicao", "regras-rateio", "verificacao"], queryFn: servico.verificacao });
  const avisos = consulta.data?.avisos ?? [];
  if (!avisos.length) return null;
  return (
    <div className="mb-4 rounded-sm border border-l-4 border-gray-200 border-l-red-600 bg-white px-4 py-3 text-sm text-gray-700">
      <p className="font-medium text-gray-900">Verificação das Vigências</p>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {avisos.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Os percentuais fixos de uma chave num período (14/10/2026): cada um dos quatro destinos (Matriz, Filial, Montagem e
 * Complementar, em qualquer chave) com um
 * percentual, somando 100%, no lugar dos percentuais dos volumes. Escolha a chave e o conjunto (um já cadastrado, para
 * editar, ou Novo), a vigência e os percentuais. As regras por volume da chave precisam estar encerradas antes do início.
 */
export function PercentuaisFixosDialog({ onFechar, inicial }: { onFechar: () => void; inicial?: { chave: string; inicio: string } }) {
  const consulta = useQuery({ queryKey: ["edicao", "regras-rateio", "percentuais-fixos"], queryFn: servico.listar });
  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent avisoAoSair className="max-h-[90vh] overflow-y-auto rounded-sm sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Percentuais Fixos</DialogTitle>
          <DialogDescription>
            Rateios com a mesma chave não podem ter vigências sobrepostas. Os percentuais de cada destino da chave, no lugar dos percentuais dos
            volumes, somando 100%; as regras por volume da chave precisam ter a vigência encerrada antes do início.
          </DialogDescription>
        </DialogHeader>
        {consulta.isError ? (
          <Erro erro={mensagemDeErro(consulta.error, "Erro ao carregar os percentuais fixos.")} />
        ) : consulta.isPending ? (
          <div className="h-48 animate-pulse rounded-sm bg-gray-100" />
        ) : (
          <Formulario dados={consulta.data} onFechar={onFechar} inicial={inicial} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Formulario({ dados, onFechar, inicial }: { dados: Dados; onFechar: () => void; inicial?: { chave: string; inicio: string } }) {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const pode = hasPermission("cadastro_regras_rateio:editar");
  // Aberto pelo lápis de uma regra fixa (14/10/2026): já na chave e no conjunto dela.
  const doInicial = inicial ? (dados.conjuntos.find((x) => x.chave === inicial.chave && x.inicio === inicial.inicio) ?? null) : null;
  const [chave, setChave] = useState(doInicial?.chave ?? dados.chaves[0]?.chave ?? "");
  const [conjunto, setConjunto] = useState(doInicial?.inicio ?? "");
  const [inicio, setInicio] = useState(doInicial?.inicio ?? "");
  const [fim, setFim] = useState(doInicial?.fim ?? "");
  const [rotulo, setRotulo] = useState(doInicial?.rotulo ?? "");
  const [textos, setTextos] = useState<Record<string, string>>(() =>
    doInicial ? Object.fromEntries(Object.entries(doInicial.percentuais).map(([d, v]) => [d, v.toLocaleString("pt-BR", { maximumFractionDigits: 4 })])) : {},
  );
  const [excluir, setExcluir] = useState(false);
  const daChave = dados.chaves.find((c) => c.chave === chave);
  const conjuntos = dados.conjuntos.filter((c) => c.chave === chave);
  const atual = conjuntos.find((c) => c.inicio === conjunto) ?? null;
  // Escolher a chave ou o conjunto carrega a vigência e os percentuais dele (Novo: vazio).
  const carregar = (novaChave: string, inicioDoConjunto: string) => {
    const c = dados.conjuntos.find((x) => x.chave === novaChave && x.inicio === inicioDoConjunto) ?? null;
    setChave(novaChave);
    setConjunto(c ? c.inicio : "");
    setInicio(c?.inicio ?? "");
    setFim(c?.fim ?? "");
    setRotulo(c?.rotulo ?? "");
    setTextos(c ? Object.fromEntries(Object.entries(c.percentuais).map(([d, v]) => [d, v.toLocaleString("pt-BR", { maximumFractionDigits: 4 })])) : {});
    setExcluir(false);
  };
  const valores = (daChave?.destinos ?? []).map((d) => ({ ...d, valor: lerNumero(textos[d.destino] ?? "") }));
  const soma = valores.reduce((s, v) => s + (typeof v.valor === "number" ? v.valor : 0), 0);
  const invalido = valores.some((v) => v.valor === undefined || (typeof v.valor === "number" && (v.valor < 0 || v.valor > 100)));
  const somaCerta = Math.abs(soma - 100) <= 0.005;
  const pronto = pode && !!inicio && (!fim || fim >= inicio) && !invalido && somaCerta;
  const concluir = (msg: string) => {
    queryClient.invalidateQueries({ queryKey: ["edicao", "regras-rateio"] });
    atualizarCompetencia(queryClient);
    toast.success(msg);
    onFechar();
  };
  const gravar = useMutation({
    mutationFn: () =>
      servico.gravar({
        chave,
        inicioAnterior: atual?.inicio ?? null,
        inicio,
        fim: fim || null,
        rotulo: rotulo.trim() || null,
        percentuais: Object.fromEntries(valores.map((v) => [v.destino, typeof v.valor === "number" ? v.valor : 0])),
      }),
    onSuccess: () => concluir(`Percentuais fixos de ${daChave?.nome} gravados.`),
  });
  const apagar = useMutation({ mutationFn: () => servico.excluir(chave, atual!.inicio), onSuccess: () => concluir(`Percentuais fixos de ${daChave?.nome} excluídos.`) });
  const erro = gravar.isError ? mensagemDeErro(gravar.error, "Não foi possível gravar.") : apagar.isError ? mensagemDeErro(apagar.error, "Não foi possível excluir.") : null;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {/* O rótulo do conjunto (14/10/2026): a base do rótulo de cada destino ("Produção: Matriz (Fixo)"). */}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="pf-rotulo">Rótulo (opcional)</Label>
          <Input id="pf-rotulo" value={rotulo} onChange={(e) => setRotulo(e.target.value)} maxLength={120} disabled={!pode} placeholder={daChave?.nome} className="rounded-sm" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-chave">Chave</Label>
          <select id="pf-chave" value={chave} onChange={(e) => carregar(e.target.value, "")} className={classeSelect}>
            {dados.chaves.map((c) => (
              <option key={c.chave} value={c.chave}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-conjunto">Conjunto</Label>
          <select id="pf-conjunto" value={conjunto} onChange={(e) => carregar(chave, e.target.value)} className={classeSelect}>
            {pode ? <option value="">Novo</option> : null}
            {conjuntos.map((c) => (
              <option key={c.inicio} value={c.inicio}>
                {c.fim ? `${dataBR(c.inicio)} a ${dataBR(c.fim)}` : `${dataBR(c.inicio)} em diante`}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-inicio">Vigência: Início</Label>
          <Input id="pf-inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} disabled={!pode} className="rounded-sm" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-fim">Vigência: Fim (opcional)</Label>
          <Input id="pf-fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} disabled={!pode} className={`rounded-sm ${fim && inicio && fim < inicio ? "border-red-400" : ""}`} />
        </div>
      </div>
      <div className="rounded-sm border border-gray-200 bg-white">
        {valores.map((v) => (
          <div key={v.destino} className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 last:border-b-0">
            <Label htmlFor={`pf-${v.destino}`} className="text-sm text-gray-800">
              {v.nome}
            </Label>
            <div className="flex items-center gap-1.5">
              <Input
                id={`pf-${v.destino}`}
                inputMode="decimal"
                value={textos[v.destino] ?? ""}
                placeholder="0"
                disabled={!pode}
                onChange={(e) => setTextos((t) => ({ ...t, [v.destino]: e.target.value }))}
                className={`h-8 w-28 rounded-sm text-right ${v.valor === undefined || (typeof v.valor === "number" && (v.valor < 0 || v.valor > 100)) ? "border-red-400" : ""}`}
              />
              <span className="text-sm text-gray-600">%</span>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 bg-gray-50 px-3 py-2 text-sm">
          <span className="font-bold text-gray-900">Soma</span>
          <span className={`font-bold ${somaCerta ? "text-gray-900" : "text-red-700"}`}>{pct(soma)}</span>
        </div>
      </div>
      {!somaCerta && !invalido ? <p className="text-xs text-red-700">Os percentuais precisam somar 100% (faltam {pct(100 - soma)}).</p> : null}
      <Erro erro={erro} />
      {/* Sem a edição, o rodapé teria só o Fechar: sai, e o X do canto fecha (15/10/2026). */}
      {pode ? (
        <DialogFooter>
          {atual ? (
            atual.usado ? (
              <span className="text-xs text-gray-500 sm:mr-auto" title="Já usado em apurações">
                Já usado em apurações: encerre a vigência em vez de excluir.
              </span>
            ) : excluir ? (
              <span className="flex items-center gap-2 text-sm text-gray-700 sm:mr-auto">
                Excluir o conjunto?
                <Button type="button" variant="outline" className="rounded-sm border-red-300 text-red-700 hover:bg-red-50" disabled={apagar.isPending} onClick={() => apagar.mutate()}>
                  Sim, Excluir
                </Button>
              </span>
            ) : (
              <Button type="button" variant="outline" className="rounded-sm border-red-300 text-red-700 hover:bg-red-50 sm:mr-auto" onClick={() => setExcluir(true)}>
                <Trash2 className="size-4" />
                Excluir Conjunto
              </Button>
            )
          ) : null}
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" className={botaoPrimario} disabled={!pronto || gravar.isPending} onClick={() => gravar.mutate()}>
            {gravar.isPending ? "Gravando…" : "Gravar"}
          </Button>
        </DialogFooter>
      ) : null}
    </>
  );
}
