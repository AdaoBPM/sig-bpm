"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { atualizarCompetencia } from "@/lib/atualizarCompetencia";
import { textoParaDecimal } from "@/lib/numero";

import {
  lancamentosManuaisService,
  mensagemDeErro,
  type ContaOpcao,
  type LancamentoManual,
  type OpcoesLancamento,
} from "../services/lancamentosManuaisService";

type Props = {
  anoMes: string;
  opcoes: OpcoesLancamento | undefined;
  /** null: novo lançamento; um lançamento: edição. */
  editando: LancamentoManual | null;
  aberto: boolean;
  onFechar: () => void;
};

const MAX_SUGESTOES = 12;

function rotuloConta(c: ContaOpcao) {
  return `${c.reduzido} — ${c.descricao}`;
}

/**
 * Busca simples por código ou nome. São cerca de 600 contas com destino na
 * DRE: uma lista suspensa inteira não daria para usar.
 */
function BuscaConta({
  contas,
  valor,
  onEscolher,
}: {
  contas: ContaOpcao[];
  valor: ContaOpcao | null;
  onEscolher: (c: ContaOpcao) => void;
}) {
  const [texto, setTexto] = useState(valor ? rotuloConta(valor) : "");
  const [aberta, setAberta] = useState(false);
  const termo = texto.trim().toLowerCase();
  const sugestoes = useMemo(
    () =>
      contas
        .filter((c) => !termo || rotuloConta(c).toLowerCase().includes(termo))
        .slice(0, MAX_SUGESTOES),
    [contas, termo],
  );
  return (
    <div className="relative">
      <Input
        id="lm-conta"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setAberta(true);
        }}
        onFocus={() => setAberta(true)}
        onBlur={() => setTimeout(() => setAberta(false), 150)}
        placeholder="Código ou nome da conta"
        className="rounded-sm border-gray-300"
        autoComplete="off"
      />
      {aberta && sugestoes.length > 0 ? (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-sm border border-gray-200 bg-white shadow-sm">
          {sugestoes.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onEscolher(c);
                  setTexto(rotuloConta(c));
                  setAberta(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
              >
                <span className="font-medium">{c.reduzido}</span> {c.descricao}
                <span className="block text-xs text-gray-500">
                  {c.departamento ?? "-"} · {c.atribuicao ?? "-"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function LancamentoManualDialog({ anoMes, opcoes, editando, aberto, onFechar }: Props) {
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState(editando?.motivo ?? opcoes?.motivos[0] ?? "EXTRA RN");
  const [filial, setFilial] = useState(String(editando?.filial ?? 1));
  const [conta, setConta] = useState<ContaOpcao | null>(editando?.contaResultado ?? null);
  const [centroId, setCentroId] = useState(editando?.centroCusto?.id ?? "");
  const [descricao, setDescricao] = useState(editando?.descricao ?? "");
  const [valor, setValor] = useState(editando ? editando.valor.replace(".", ",") : "");

  const salvar = useMutation({
    mutationFn: () => {
      const entrada = {
        motivo,
        filial: Number(filial),
        centroCustoId: centroId || null,
        contaResultadoId: conta?.id ?? "",
        descricao,
        // "3.832,50", "1.298" ou "3832.5".
        valor: textoParaDecimal(valor),
      };
      return editando
        ? lancamentosManuaisService.atualizar(editando.id, entrada)
        : lancamentosManuaisService.criar(anoMes, entrada);
    },
    onSuccess: () => {
      toast.success(editando ? "Lançamento atualizado." : "Lançamento incluído.");
      atualizarCompetencia(queryClient, anoMes);
      onFechar();
    },
  });

  return (
    <Dialog open={aberto} onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent avisoAoSair className="rounded-sm sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar Lançamento" : "Novo Lançamento Manual"}</DialogTitle>
          <DialogDescription>
            O rateio e o destino na DRE saem da conta (e do centro, quando houver),
            como na aba Gastos (Lanç. Manuais).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="lm-motivo">Motivo</Label>
              <Input
                id="lm-motivo"
                list="lm-motivos"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="rounded-sm border-gray-300"
              />
              <datalist id="lm-motivos">
                {(opcoes?.motivos ?? []).map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lm-filial">Filial</Label>
              <select
                id="lm-filial"
                value={filial}
                onChange={(e) => setFilial(e.target.value)}
                className="h-9 w-full rounded-sm border border-gray-300 bg-white px-2 text-sm"
              >
                <option value="1">1 — Matriz</option>
                <option value="2">2 — Filial</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lm-conta">Conta</Label>
            <BuscaConta
              contas={opcoes?.contas ?? []}
              valor={conta}
              onEscolher={(c) => {
                setConta(c);
                if (!descricao.trim()) setDescricao(c.descricao);
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lm-centro">Centro de custo (opcional)</Label>
            <select
              id="lm-centro"
              value={centroId}
              onChange={(e) => setCentroId(e.target.value)}
              className="h-9 w-full rounded-sm border border-gray-300 bg-white px-2 text-sm"
            >
              <option value="">— sem centro: o rateio vem da conta —</option>
              {(opcoes?.centros ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigoRM} — {c.nomeRM}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lm-descricao">Descrição</Label>
            <Input
              id="lm-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="rounded-sm border-gray-300"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lm-valor">Valor (R$)</Label>
            <Input
              id="lm-valor"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
              className="w-48 rounded-sm border-gray-300"
            />
          </div>

          {salvar.error ? (
            <div className="flex items-center gap-2 rounded-sm border border-red-200 bg-red-50 p-3">
              <AlertCircle className="size-4 shrink-0 text-red-700" />
              <p className="text-sm text-red-700">{mensagemDeErro(salvar.error, "Não foi possível salvar.")}</p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onFechar} className="rounded-sm">
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending || !conta || !valor.trim() || !motivo.trim() || !descricao.trim()}
            className="bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm"
          >
            {salvar.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
