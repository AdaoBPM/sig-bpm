"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CheckCircle2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/context/PermissionContext";
import { useDebounce } from "@/hooks/useDebounce";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { StatusCompetenciaBadge } from "../../components/StatusCompetenciaBadge";
import { dataHora, lerAnoMes, MESES, moeda, rotuloCompetencia } from "../utils/formatacao";
import { conferenciaService, mensagemDeErro, type LinhaConferencia, type VisaoConferencia } from "./services/conferenciaService";

const MESES_CURTOS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
// As linhas de volume (m³, kg…) são as dos grupos PRODUÇÃO e SERVIÇOS, como na tela da DRE.
const GRUPOS_DE_VOLUME = new Set(["PRODUÇÃO (P)", "SERVIÇOS (S)"]);
const volume = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const valor = (l: { grupo: string }, v: string | number | null) => (v === null ? "—" : GRUPOS_DE_VOLUME.has(l.grupo) ? volume(Number(v)) : moeda(v));
const lerLimite = (t: string) => {
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

function EnviarPlanilha({ anoMes, coluna }: { anoMes: string; coluna: string }) {
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
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível ler a planilha.")),
  });
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1 space-y-1.5">
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
        className="bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm"
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
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-bold tracking-wide text-gray-600 uppercase">
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
        <h3 className="text-sm font-bold text-gray-900">Só na planilha ({visao.soNaPlanilha.length})</h3>
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
        <h3 className="text-sm font-bold text-gray-900">Só na ferramenta ({visao.soNoSistema.length})</h3>
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
      <div className="space-y-2">
        <Link href="/competencias" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="size-4" />
          Competências
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Conferência com a planilha · {rotuloCompetencia(periodo.ano, periodo.mes)}</h1>
          <span className="text-sm text-gray-400">{MESES[periodo.mes - 1]}</span>
          {r ? <StatusCompetenciaBadge status={r.competencia.status} /> : null}
        </div>
        <p className="text-sm text-gray-600">
          Compara, linha a linha, a DRE apurada pela ferramenta com as abas Resultados (Consolidado), (Matriz), (Filial), (Serviços), (Desp.+Extra) e (RN) do
          SIG BPM - BASE REALIZADO (RESULTADOS), na coluna {coluna}. As linhas são ligadas pela descrição, na ordem da estrutura. Diferença = ferramenta −
          planilha. Uma reapuração aparece aqui sem reenviar o arquivo.
        </p>
      </div>

      <div className="space-y-4 rounded-sm border border-gray-200 bg-white p-4">
        {r?.conferencia ? (
          <p className="text-sm text-gray-700">
            Planilha em uso: <span className="font-medium text-gray-900">{r.conferencia.nomeArquivo}</span>, enviada em {dataHora(r.conferencia.enviadoEm)} por{" "}
            {r.conferencia.enviadoPor}
            {r.envios > 1 ? ` (${r.envios} envios nesta competência; vale o último)` : ""}.
          </p>
        ) : consulta.isSuccess ? (
          <p className="text-sm text-gray-700">Nenhuma planilha enviada para esta competência.</p>
        ) : null}
        {hasPermission("apuracao:editar") ? <EnviarPlanilha anoMes={anoMes} coluna={coluna} /> : null}
      </div>

      {consulta.isError ? (
        <div className="rounded-sm border border-red-200 bg-red-50 p-4 text-sm text-red-700">{mensagemDeErro(consulta.error, "Erro ao carregar a conferência.")}</div>
      ) : null}
      {r?.conferencia && !r.apuradaEm ? (
        <div className="rounded-sm border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">A competência ainda não foi apurada: apure-a (tela da DRE) para comparar.</div>
      ) : null}

      {r?.resumo && visao ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {r.visoes.map((v) => (
                <button
                  key={v.unidade}
                  type="button"
                  onClick={() => setUnidade(v.unidade)}
                  className={`inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-sm font-medium ${visao.unidade === v.unidade ? "border-black bg-black text-white" : "border-gray-300 text-gray-900 hover:bg-gray-100"}`}
                >
                  {v.diferencas === 0 ? <CheckCircle2 className="size-3.5 text-green-600" /> : <AlertTriangle className="size-3.5 text-red-600" />}
                  {v.nome}
                  {v.diferencas > 0 ? <span className="text-xs">({v.diferencas})</span> : null}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="conferencia-limite" className="text-xs font-medium text-gray-700">
                  Limite de arredondamento
                </Label>
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
                Só as diferenças
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
          <SemPar visao={visao} />
        </>
      ) : consulta.isPending ? (
        <div className="h-64 animate-pulse rounded-sm bg-gray-100" />
      ) : null}
    </div>
  );
}
