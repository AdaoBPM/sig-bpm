"use client";

import { useRef, useState } from "react";
import { useParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/context/PermissionContext";
import { useDebounce } from "@/hooks/useDebounce";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { lerNumero } from "@/lib/numero";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { Abas } from "@/components/shared/Abas";

import { dataHora, lerAnoMes, moeda } from "../utils/formatacao";
import { conferenciaService, mensagemDeErro, type LinhaConferencia, type VisaoConferencia } from "./services/conferenciaService";

const MESES_CURTOS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
// As linhas de volume (m³, kg…) são as dos grupos PRODUÇÃO e SERVIÇOS, como na tela da DRE.
const GRUPOS_DE_VOLUME = new Set(["PRODUÇÃO (P)", "SERVIÇOS (S)"]);
const volume = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const valor = (l: { grupo: string }, v: string | number | null) => (v === null ? "—" : GRUPOS_DE_VOLUME.has(l.grupo) ? volume(Number(v)) : moeda(v));
const lerLimite = (t: string) => {
  const n = lerNumero(t);
  return n !== null && n >= 0 ? n : null;
};

function EnviarPlanilha({ anoMes, coluna, onEnviada }: { anoMes: string; coluna: string; onEnviada: () => void }) {
  const queryClient = useQueryClient();
  const campo = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [envio, setEnvio] = useState(0);
  const enviar = useMutation({
    mutationFn: () => conferenciaService.enviar(anoMes, arquivo!, setEnvio),
    onSuccess: (r) => {
      toast.success(`${arquivo!.name}: ${r.linhas} linhas lidas da coluna ${coluna}.`);
      setArquivo(null);
      if (campo.current) campo.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["conferencia-planilha", anoMes] });
      onEnviada();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível ler a planilha.")),
  });
  return (
    <div className="flex flex-col gap-4">
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor="conferencia-arquivo" className="text-sm font-medium text-gray-900">
          SIG BPM - BASE REALIZADO (RESULTADOS) (.xlsx)
        </Label>
        <Input
          id="conferencia-arquivo"
          ref={campo}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="rounded-sm border-gray-300 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium"
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
        />
      </div>
      <Button
        type="button"
        onClick={() => enviar.mutate()}
        disabled={!arquivo || enviar.isPending}
        className="self-end bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm"
      >
        <Upload className="size-4" />
        {enviar.isPending ? `Enviando… ${envio}%` : "Enviar e conferir"}
      </Button>
    </div>
  );
}

function Tabela({ visao, soDiferencas }: { visao: VisaoConferencia; soDiferencas: boolean }) {
  const linhas = soDiferencas ? visao.linhas.filter((l) => l.destaque) : visao.linhas;
  if (linhas.length === 0) {
    return <div className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">Nenhuma diferença acima do limite nesta visão.</div>;
  }
  const destaque = (l: LinhaConferencia) => l.tipo !== "ITEM";
  return (
    <div className="overflow-x-auto rounded-sm border border-gray-200 bg-white">
      <table className="tabela-sig w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-bold text-gray-600">
            <th className="px-3 py-2 text-right">Linha</th>
            <th className="px-3 py-2">Descrição</th>
            <th className="px-3 py-2 text-right">Ferramenta</th>
            <th className="px-3 py-2 text-right">Planilha</th>
            <th className="px-3 py-2 text-right">Diferença</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={`${l.linha}-${l.codigo}`} className={`border-t border-gray-100 ${l.destaque ? "bg-red-50" : destaque(l) ? "bg-gray-50" : ""}`}>
              <td className="px-3 py-1.5 text-right text-xs text-gray-400 tabular-nums">{l.linha}</td>
              <td className={`px-3 py-1.5 ${destaque(l) ? "font-bold text-gray-900" : "pl-6 text-gray-700"}`}>
                {l.descricao}
                {l.observacao ? <div className="text-xs font-normal text-gray-500">{l.observacao}</div> : null}
              </td>
              <td className={`px-3 py-1.5 text-right tabular-nums ${destaque(l) ? "font-bold" : ""}`}>{valor(l, l.sistema)}</td>
              <td className={`px-3 py-1.5 text-right tabular-nums ${destaque(l) ? "font-bold" : ""}`}>{valor(l, l.planilha)}</td>
              <td className={`px-3 py-1.5 text-right tabular-nums ${l.destaque ? "font-bold text-red-700" : "text-gray-400"}`}>{l.sistema === null && l.planilha === null ? "—" : valor(l, l.diferenca)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SemPar({ visao }: { visao: VisaoConferencia }) {
  if (visao.soNaPlanilha.length === 0 && visao.soNoSistema.length === 0) return null;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-sm border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-bold text-gray-900">Só na Planilha ({visao.soNaPlanilha.length})</h3>
        <p className="mb-2 text-xs text-gray-500">Linhas da aba {visao.aba} sem linha com a mesma descrição na estrutura da DRE. Não entram na comparação.</p>
        {visao.soNaPlanilha.map((l) => (
          <p key={l.linha} className="flex justify-between gap-3 text-sm text-gray-700">
            <span>
              <span className="text-xs text-gray-400">linha {l.linha}</span> {l.descricao}
            </span>
            <span className="tabular-nums">{l.planilha === null ? "—" : moeda(l.planilha)}</span>
          </p>
        ))}
      </div>
      <div className="rounded-sm border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-bold text-gray-900">Só na Ferramenta ({visao.soNoSistema.length})</h3>
        <p className="mb-2 text-xs text-gray-500">Linhas da DRE apurada desta visão que nenhuma linha da aba alcança pela descrição.</p>
        {visao.soNoSistema.map((l) => (
          <p key={l.codigo} className="flex justify-between gap-3 text-sm text-gray-700">
            <span>{l.descricao}</span>
            <span className="tabular-nums">{l.sistema === null ? "—" : moeda(l.sistema)}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

/** Relatório de conferência da DRE apurada contra a planilha (Passo 27, RF013). */
export function ConferenciaPlanilhaContent() {
  const { anoMes } = useParams<{ anoMes: string }>();
  useRegistrarAcessoTela(`/competencias/${anoMes}/conferencia-planilha`);
  const periodo = lerAnoMes(anoMes);
  const { hasPermission } = usePermissions();
  const [limiteTexto, setLimiteTexto] = useState("0,05");
  const limiteDebounced = useDebounce(limiteTexto, 400);
  const limite = lerLimite(limiteDebounced) ?? 0.05;
  const [unidade, setUnidade] = useState(0);
  const [soDiferencas, setSoDiferencas] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const consulta = useQuery({
    queryKey: ["conferencia-planilha", anoMes, limite],
    queryFn: () => conferenciaService.relatorio(anoMes, limite),
    enabled: periodo !== null,
    placeholderData: keepPreviousData,
  });

  if (!periodo) {
    return (
      <div className="rounded-sm border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">Competência inválida na URL: {anoMes}.</p>
      </div>
    );
  }
  const coluna = `${MESES_CURTOS[periodo.mes - 1]}/${String(periodo.ano).slice(2)}`;
  const r = consulta.data;
  const visao = r?.visoes.find((v) => v.unidade === unidade) ?? r?.visoes[0];

  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Conferência com a Planilha"
        comoUsar={
          <ul>
            <li>Clique em “Enviar Planilha” e envie o BASE REALIZADO (RESULTADOS) atualizado.</li>
            <li>Escolha a visão nas abas; marque “Só as Diferenças” e ajuste o “Limite de Arredondamento” para ver só o que importa.</li>
            <li>Diferença positiva: a ferramenta está acima da planilha. Corrija a origem e reapure; a conferência se atualiza sem reenviar o arquivo.</li>
          </ul>
        }
        sobre={
          <p>
            Compara, linha a linha, a DRE apurada pela ferramenta com as abas Resultados (Consolidado), (Matriz), (Filial), (Serviços),
            (Desp.+Extra) e (RN) do SIG BPM - BASE REALIZADO (RESULTADOS), na coluna {coluna}. As linhas são ligadas pela descrição, na ordem
            da estrutura. Diferença = ferramenta − planilha. Uma reapuração aparece aqui sem reenviar o arquivo.
          </p>
        }
        acoes={
          hasPermission("apuracao:editar") && consulta.isSuccess ? (
            <Button
              type="button"
              onClick={() => setEnviando(true)}
              className={r?.conferencia ? "rounded-sm" : "bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm"}
              variant={r?.conferencia ? "outline" : "default"}
            >
              <Upload className="size-4" />
              {r?.conferencia ? "Enviar outra planilha" : "Enviar planilha"}
            </Button>
          ) : null
        }
      />

      {/* O envio recolhido num botão, e o resultado em primeiro plano (E12 do levantamento de layout). */}
      {r?.conferencia ? (
        <p className="text-sm text-gray-600">
          Planilha em uso: <span className="font-medium text-gray-900">{r.conferencia.nomeArquivo}</span>, enviada em {dataHora(r.conferencia.enviadoEm)} por{" "}
          {r.conferencia.enviadoPor}
          {r.envios > 1 ? ` (${r.envios} envios nesta competência; vale o último)` : ""}.
        </p>
      ) : consulta.isSuccess ? (
        <div className="rounded-sm border border-gray-200 bg-white py-12 text-center">
          <p className="text-sm font-medium text-gray-900">Nenhuma planilha enviada para esta competência</p>
          <p className="mt-1 text-sm text-gray-600">Envie o SIG BPM - BASE REALIZADO (RESULTADOS) para comparar com a DRE apurada.</p>
        </div>
      ) : null}

      <Dialog open={enviando} onOpenChange={setEnviando}>
        <DialogContent className="rounded-sm sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{r?.conferencia ? "Enviar outra planilha" : "Enviar planilha"}</DialogTitle>
            <DialogDescription>
              A ferramenta lê a coluna {coluna} das abas Resultados. Vale a última planilha enviada nesta competência.
            </DialogDescription>
          </DialogHeader>
          {enviando ? <EnviarPlanilha anoMes={anoMes} coluna={coluna} onEnviada={() => setEnviando(false)} /> : null}
        </DialogContent>
      </Dialog>

      {consulta.isError ? (
        <div className="rounded-sm border border-red-200 bg-red-50 p-4 text-sm text-red-700">{mensagemDeErro(consulta.error, "Erro ao carregar a conferência.")}</div>
      ) : null}
      {r?.conferencia && !r.apuradaEm ? (
        <div className="rounded-sm border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">A competência ainda não foi apurada: apure-a (tela da DRE) para comparar.</div>
      ) : null}

      {r?.resumo && visao ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0 flex-1">
              <Abas
                rotulo="Visão"
                ativa={String(visao.unidade)}
                onMudar={(c) => setUnidade(Number(c))}
                abas={r.visoes.map((v) => ({
                  chave: String(v.unidade),
                  rotulo: v.nome,
                  sinal: v.diferencas === 0 ? <CheckCircle2 className="size-3.5 text-green-600" /> : <AlertTriangle className="size-3.5 text-red-600" />,
                  contagem: v.diferencas > 0 ? v.diferencas : undefined,
                }))}
              />
            </div>
            <div className="flex items-end gap-4">
              <div className="space-y-1.5">
                <label htmlFor="conferencia-limite" className="block text-xs font-medium text-gray-700">
                  Limite de Arredondamento
                </label>
                <Input
                  id="conferencia-limite"
                  value={limiteTexto}
                  inputMode="decimal"
                  onChange={(e) => setLimiteTexto(e.target.value)}
                  className={`h-9 w-28 rounded-sm text-right ${lerLimite(limiteTexto) === null ? "border-red-400" : ""}`}
                />
              </div>
              <label className="flex h-9 items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={soDiferencas} onChange={(e) => setSoDiferencas(e.target.checked)} className="size-4 accent-black" />
                Só as Diferenças
              </label>
            </div>
          </div>

          <p className="text-sm text-gray-700">
            {r.resumo.diferencas === 0 ? (
              <span className="font-medium text-green-700">
                Nenhuma diferença acima de {moeda(r.limite)} nas {r.resumo.comparadas} linhas comparadas.
              </span>
            ) : (
              <span className="font-medium text-red-700">
                {r.resumo.diferencas} diferença(s) acima de {moeda(r.limite)} em {r.resumo.comparadas} linhas comparadas.
              </span>
            )}{" "}
            {visao.nome} (aba {visao.aba}): {visao.comparadas} linhas, {visao.diferencas} diferença(s).
            {r.resumo.soNaPlanilha + r.resumo.soNoSistema > 0
              ? ` Sem par: ${r.resumo.soNaPlanilha} linha(s) só na planilha e ${r.resumo.soNoSistema} só na ferramenta.`
              : ""}
          </p>

          <Tabela visao={visao} soDiferencas={soDiferencas} />
          {visao.totaisDaPlanilha.length > 0 ? (
            <p className="text-xs text-gray-500">
              Não comparado:{" "}
              {visao.totaisDaPlanilha.map((t) => `${t.descricao} (linha ${t.linha}, ${t.planilha === null ? "—" : moeda(t.planilha)})`).join("; ")}, total que só a
              aba {visao.aba} mostra, para somar os gastos; a DRE da ferramenta não o tem.
            </p>
          ) : null}
          <SemPar visao={visao} />
        </>
      ) : consulta.isPending ? (
        <div className="h-64 animate-pulse rounded-sm bg-gray-100" />
      ) : null}
    </div>
  );
}
