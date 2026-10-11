"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { atualizarCompetencia } from "@/lib/atualizarCompetencia";
import { iniciaisMaiusculas } from "@/lib/texto";

import { edicaoService, mensagemDeErro, textoDoEfeito, type Campo, type DefinicaoCadastro, type Registro } from "../services/edicaoService";
import { EditorFormula } from "./EditorFormula";

type Props = { entidade: string; id: string | null; onFechar: () => void };

/** "A, B e C". */
const emLista = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}` : (xs[0] ?? ""));

/** "Linha da DRE" vira "linha da DRE": só a inicial, para não perder as siglas. */
const minuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

const classeSelect = "h-9 w-full rounded-sm border border-gray-300 bg-white px-3 text-sm";

/** O valor do campo como a tela o edita. */
const paraTela = (c: Campo, v: unknown) => {
  if (c.tipo === "booleano") return v !== false;
  if (c.tipo === "multipla") return Array.isArray(v) ? v.map(String) : [];
  if (v === null || v === undefined) return "";
  // O decimal com vírgula, sem o resíduo de ponto flutuante da planilha (1298,1919999999998).
  return c.tipo === "decimal" ? String(Number(Number(v).toFixed(6))).replace(".", ",") : String(v);
};

/** As opções do campo: as do valor escolhido no campo que o filtra, quando há um (11/10/2026). */
const opcoesVisiveis = (c: Campo, valores: Record<string, unknown>) =>
  c.filtradoPor ? (c.opcoes ?? []).filter((o) => !o.grupos || o.grupos.includes(String(valores[c.filtradoPor!] ?? ""))) : (c.opcoes ?? []);

function CampoForm({
  c,
  valor,
  onMuda,
  editando,
  comMovimento,
  opcoes,
  semFiltro,
}: {
  c: Campo;
  valor: unknown;
  onMuda: (v: unknown) => void;
  editando: boolean;
  comMovimento: boolean;
  /** As opções a mostrar (já filtradas). */
  opcoes: Campo["opcoes"];
  /** O rótulo do campo que filtra a lista, ainda sem valor. */
  semFiltro?: string;
}) {
  // Travado: calculado, só na criação, ou campo-chave de um registro com movimentos (11/10/2026).
  const travado = c.derivado || (editando && c.somenteNaCriacao) || comMovimento;
  const id = `campo-${c.nome}`;
  if (c.tipo === "booleano") {
    return (
      <label className="flex items-center gap-2 text-sm text-gray-900">
        <input type="checkbox" checked={valor === true} disabled={travado} onChange={(e) => onMuda(e.target.checked)} className="size-4 accent-black" />
        {iniciaisMaiusculas(c.rotulo)}
      </label>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {c.rotulo}
        {c.obrigatorio && !travado ? <span className="text-red-700"> *</span> : null}
      </Label>
      {c.tipo === "formula" ? (
        <EditorFormula id={id} valor={String(valor ?? "")} onMuda={onMuda} opcoes={c.opcoes ?? []} travado={travado} />
      ) : c.tipo === "opcao" && !travado ? (
        <select id={id} value={String(valor ?? "")} onChange={(e) => onMuda(e.target.value)} className={classeSelect}>
          <option value="">{semFiltro ? `Escolha antes: ${semFiltro}` : c.obrigatorio ? "Escolha…" : "—"}</option>
          {opcoes?.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
      ) : c.tipo === "multipla" ? (
        <div className="flex flex-wrap gap-3">
          {c.opcoes?.map((o) => {
            const lista = (valor as string[]) ?? [];
            return (
              <label key={o.valor} className="flex items-center gap-1.5 text-sm text-gray-700">
                <input
                  type="checkbox"
                  disabled={travado}
                  checked={lista.includes(o.valor)}
                  onChange={(e) => onMuda(e.target.checked ? [...lista, o.valor] : lista.filter((x) => x !== o.valor))}
                  className="size-4 accent-black"
                />
                {o.rotulo}
              </label>
            );
          })}
        </div>
      ) : (
        <Input
          id={id}
          value={c.tipo === "opcao" ? (c.opcoes?.find((o) => o.valor === valor)?.rotulo ?? String(valor ?? "")) : String(valor ?? "")}
          disabled={travado}
          type={c.tipo === "data" ? "date" : "text"}
          inputMode={c.tipo === "inteiro" || c.tipo === "decimal" ? "decimal" : undefined}
          onChange={(e) => onMuda(e.target.value)}
          className="rounded-sm"
        />
      )}
      {c.ajuda ? <p className="text-xs text-gray-500">{c.ajuda}</p> : null}
    </div>
  );
}

function Formulario({ def, registro, entidade, onFechar }: { def: DefinicaoCadastro; registro: Registro | null; entidade: string; onFechar: () => void }) {
  const queryClient = useQueryClient();
  const [valores, setValores] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(def.campos.map((c) => [c.nome, paraTela(c, registro ? registro[c.nome] : c.tipo === "booleano" ? true : undefined)])),
  );
  const [confirmaExclusao, setConfirmaExclusao] = useState(false);
  const travas = registro?.__travas;
  const concluir = (msg: string, efeito?: { reclassificadas: string[]; apuradasPorReapurar: string[] }) => {
    const extra = efeito ? textoDoEfeito(efeito) : "";
    toast.success(`${msg}${extra ? ` ${extra}` : ""}`);
    atualizarCompetencia(queryClient);
    onFechar();
  };
  const salvar = useMutation({
    mutationFn: () => {
      const enviar = Object.fromEntries(
        def.campos.filter((c) => !c.derivado && c.noFormulario !== false && !registro?.__travas?.campos.includes(c.nome)).map((c) => [c.nome, valores[c.nome]]),
      );
      return registro ? edicaoService.atualizar(entidade, registro.id, enviar) : edicaoService.criar(entidade, enviar);
    },
    onSuccess: (r) => concluir(registro ? `${def.titulo} atualizado.` : `${def.titulo} criado.`, r),
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível gravar.")),
  });
  const excluir = useMutation({
    mutationFn: () => edicaoService.excluir(entidade, registro!.id),
    onSuccess: (r) => concluir(`${def.titulo} excluído.`, r),
    onError: (e) => {
      setConfirmaExclusao(false);
      toast.error(mensagemDeErro(e, "Não foi possível excluir."));
    },
  });

  return (
    <>
      {travas?.movimentos ? (
        <div className="rounded-sm border border-l-4 border-gray-200 border-l-yellow-600 bg-white px-4 py-2.5 text-sm text-gray-700">
          <p className="font-medium text-gray-900">Registro com movimentos.</p>
          <p>
            {travas.movimentos}{" "}
            {travas.campos.length
              ? `Por isso, ${emLista(def.campos.filter((c) => travas.campos.includes(c.nome)).map((c) => c.rotulo))} ${travas.campos.length > 1 ? "não mudam" : "não muda"}${def.excluir ? " e o registro não se exclui" : ""}: ${travas.campos.length > 1 ? "essas informações ligam" : "essa informação liga"} o cadastro a outras telas.`
              : ""}
          </p>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {def.campos.filter((c) => c.noFormulario !== false && (!c.visivelSe || c.visivelSe.valores.includes(String(valores[c.visivelSe.campo] ?? "")))).map((c) => (
          <div key={c.nome} className={c.larguraInteira || c.tipo === "multipla" || c.tipo === "formula" || c.nome === "expressao" || c.nome === "definicao" ? "sm:col-span-2" : ""}>
            <CampoForm
              c={c}
              valor={valores[c.nome]}
              editando={!!registro}
              comMovimento={!!travas?.campos.includes(c.nome)}
              opcoes={opcoesVisiveis(c, valores)}
              semFiltro={c.filtradoPor && !valores[c.filtradoPor] ? def.campos.find((x) => x.nome === c.filtradoPor)?.rotulo : undefined}
              onMuda={(v) =>
                setValores((x) => {
                  const novo = { ...x, [c.nome]: v };
                  // A lista que depende deste campo perde a escolha que não é mais dele.
                  for (const d of def.campos.filter((y) => y.filtradoPor === c.nome)) {
                    if (novo[d.nome] && !opcoesVisiveis(d, novo).some((o) => o.valor === novo[d.nome])) novo[d.nome] = "";
                  }
                  return novo;
                })
              }
            />
          </div>
        ))}
      </div>
      {def.reclassifica ? (
        <p className="text-xs text-gray-500">
          Este cadastro classifica os lançamentos: ao gravar, as competências ainda não apuradas são reclassificadas; as apuradas só mudam se forem
          reapuradas.
        </p>
      ) : null}
      <DialogFooter className="sm:justify-between">
        <div>
          {registro && def.excluir && travas?.exclusao ? (
            // Com movimentos, a exclusão fica bloqueada; o motivo, na dica do botão.
            <Button type="button" variant="ghost" className="rounded-sm text-gray-400" disabled title={travas.exclusao}>
              <Trash2 className="size-4" />
              Excluir
            </Button>
          ) : registro && def.excluir ? (
            confirmaExclusao ? (
              <Button type="button" variant="destructive" className="rounded-sm" disabled={excluir.isPending} onClick={() => excluir.mutate()}>
                Confirmar exclusão
              </Button>
            ) : (
              <Button type="button" variant="ghost" className="rounded-sm text-red-700" onClick={() => setConfirmaExclusao(true)}>
                <Trash2 className="size-4" />
                Excluir
              </Button>
            )
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="rounded-sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={salvar.isPending}
            onClick={() => salvar.mutate()}
            className="bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm"
          >
            {salvar.isPending ? "Gravando…" : "Gravar"}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

/** Edição de um registro de qualquer cadastro, pelo que a definição dele declara (Passo 25). */
export function EditarRegistroDialog({ entidade, id, onFechar }: Props) {
  const def = useQuery({ queryKey: ["edicao", entidade, "definicao"], queryFn: () => edicaoService.definicao(entidade) });
  const reg = useQuery({ queryKey: ["edicao", entidade, "registro", id], queryFn: () => edicaoService.ler(entidade, id!), enabled: id !== null });
  const pronto = def.data && (id === null || reg.data);
  return (
    <Dialog open onOpenChange={(o) => (!o ? onFechar() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-sm sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{def.data ? `${id ? "Editar" : "Novo registro:"} ${minuscula(def.data.titulo)}` : "Carregando…"}</DialogTitle>
          <DialogDescription>A alteração fica no log de auditoria, com o antes e o depois.</DialogDescription>
        </DialogHeader>
        {def.isError || reg.isError ? <p className="text-sm text-red-700">{mensagemDeErro(def.error ?? reg.error, "Erro ao carregar o cadastro.")}</p> : null}
        {pronto ? <Formulario def={def.data!} registro={id ? reg.data! : null} entidade={entidade} onFechar={onFechar} /> : <div className="h-40 animate-pulse rounded-sm bg-gray-100" />}
      </DialogContent>
    </Dialog>
  );
}
