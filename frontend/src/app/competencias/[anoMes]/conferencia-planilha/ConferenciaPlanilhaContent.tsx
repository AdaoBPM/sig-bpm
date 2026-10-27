"use client";

import { useRef, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CampoArquivo } from "@/components/shared/CampoArquivo";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/context/PermissionContext";
import { useDebounce } from "@/hooks/useDebounce";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";
import { lerNumero } from "@/lib/numero";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { Abas } from "@/components/shared/Abas";
import { FaixaIndicadores } from "@/components/shared/FaixaIndicadores";

import { dataHora, lerAnoMes, moeda } from "../utils/formatacao";
import { Agrupador, SeletorNivel, fundoDaLinha, semPrimeiroTotalDaRol, useNiveisDRE } from "../dre/components/NiveisDRE";
import { conferenciaService, mensagemDeErro, type LinhaConferencia, type VisaoConferencia } from "./services/conferenciaService";
import { plural } from "@/lib/texto";

const MESES_CURTOS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
// As linhas de volume (m³, kg…) são as dos grupos PRODUÇÃO e SERVIÇOS, como na tela da DRE.
const GRUPOS_DE_VOLUME = new Set(["PRODUÇÃO (P)", "SERVIÇOS (S)"]);
const volume = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const valor = (l: { grupo: string }, v: string | number | null) => (v === null ? "—" : GRUPOS_DE_VOLUME.has(l.grupo) ? volume(Number(v)) : moeda(v));
const lerLimite = (t: string) => {
  const n = lerNumero(t);
  return n !== null && n >= 0 ? n : null;
};
/** A variação máxima digitada fica guardada no navegador e volta ao recarregar. */
const CHAVE_VARIACAO = "sig.conferencia.variacaoMaxima";
const variacaoGuardada = () => {
  try {
    const v = window.localStorage.getItem(CHAVE_VARIACAO);
    return v !== null && lerLimite(v) !== null ? v : "0,05";
  } catch {
    return "0,05";
  }
};
const guardarVariacao = (t: string) => {
  try {
    if (lerLimite(t) !== null) window.localStorage.setItem(CHAVE_VARIACAO, t);
  } catch {
    // Sem armazenamento (janela privada): o valor só não é lembrado.
  }
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
        <CampoArquivo id="conferencia-arquivo" ref={campo} accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" arquivo={arquivo} onEscolher={setArquivo} />
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

/**
 * A tabela no formato da DRE: rótulos em cinza, presos no topo ao
 * rolar; totais e atribuições em negrito, com as linhas mais escuras; os
 * agrupadores e os níveis (Totais, Atribuições, Contas) da planilha.
 */
function Tabela({ visao, soDiferencas }: { visao: VisaoConferencia; soDiferencas: boolean }) {
  // Sem o primeiro total da ROL, que repete o segundo, como na DRE (22/10/2026).
  const semRolRepetida = useMemo(() => semPrimeiroTotalDaRol(visao.linhas), [visao.linhas]);
  const niveis = useNiveisDRE(semRolRepetida, "sig.conferencia.nivel");
  // Com "Só as Diferenças", todas as linhas com diferença aparecem, sem os grupos fechados escondê-las.
  const linhas = soDiferencas ? niveis.linhas.filter((l) => l.destaque) : niveis.linhas.filter(niveis.visivel);
  const destaque = (l: LinhaConferencia) => l.tipo !== "ITEM";
  const rotulo = "px-3 py-3 text-base font-bold tracking-wide text-gray-900 uppercase";
  return (
    // Destaque amarelo-ouro à esquerda, como na DRE. Sem rolagem própria: os rótulos ficam presos no topo da página.
    <div className="rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white">
      <table className="tabela-sig w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="w-px px-3 py-2">
              <SeletorNivel nivel={niveis.nivelGeral} onEscolher={niveis.escolherNivel} />
            </th>
            <th className={`${rotulo} text-left`}>{visao.nome}</th>
            <th className={`${rotulo} text-right`}>Ferramenta</th>
            <th className={`${rotulo} text-right`}>Planilha</th>
            <th className={`${rotulo} text-right`}>Diferença</th>
          </tr>
        </thead>
        <tbody>
          {linhas.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-sm text-gray-600">
                Nenhuma diferença acima da variação máxima nesta visão.
              </td>
            </tr>
          ) : (
            linhas.map((l) => (
              <tr
                key={`${l.linha}-${l.codigo}`}
                className={`${destaque(l) ? "border-y border-gray-300 font-bold" : "border-t border-gray-100"} ${l.destaque ? "bg-red-50" : fundoDaLinha(l)}`}
              >
                <td className="px-3 py-1.5 text-right text-xs font-normal text-gray-400" title="Linha da planilha">
                  {l.linha}
                </td>
                <td className={`py-1.5 pr-3 ${niveis.recuo(l)} ${destaque(l) ? "text-gray-900" : "text-gray-700"}`}>
                  <span className="inline-flex items-center gap-1">
                    {soDiferencas ? null : <Agrupador grupo={niveis.grupo(l)} fechado={niveis.fechado(l)} onAlternar={() => niveis.alternar(l.codigo)} />}
                    {l.descricao}
                  </span>
                  {l.observacao ? <div className="text-xs font-normal text-gray-500">{l.observacao}</div> : null}
                </td>
                <td className="px-3 py-1.5 text-right">{l.tipo === "SECAO" ? "" : valor(l, l.sistema)}</td>
                <td className="px-3 py-1.5 text-right">{l.tipo === "SECAO" ? "" : valor(l, l.planilha)}</td>
                <td className={`px-3 py-1.5 text-right ${l.destaque ? "font-bold text-red-700" : "font-normal text-gray-400"}`}>
                  {l.tipo === "SECAO" ? "" : l.sistema === null && l.planilha === null ? "—" : valor(l, l.diferenca)}
                </td>
              </tr>
            ))
          )}
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
            <span>{l.planilha === null ? "—" : moeda(l.planilha)}</span>
          </p>
        ))}
      </div>
      <div className="rounded-sm border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-bold text-gray-900">Só na Ferramenta ({visao.soNoSistema.length})</h3>
        <p className="mb-2 text-xs text-gray-500">Linhas da DRE apurada desta visão que nenhuma linha da aba alcança pela descrição.</p>
        {visao.soNoSistema.map((l) => (
          <p key={l.codigo} className="flex justify-between gap-3 text-sm text-gray-700">
            <span>{l.descricao}</span>
            <span>{l.sistema === null ? "—" : moeda(l.sistema)}</span>
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
  const [limiteTexto, setLimiteTexto] = useState(variacaoGuardada);
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
            <li>Clique em “Enviar Planilha” e envie o BASE REALIZADO (RESULTADOS) atualizado. A faixa “Planilha em Uso” mostra o arquivo comparado, quando e por quem foi enviado; a faixa seguinte resume as diferenças.</li>
            <li>Escolha a visão nas abas; marque “Só as Diferenças” e ajuste a “Variação Máx.” (fica guardada neste navegador) para ver só o que importa. Use a seta antes do nome da visão para mostrar só os totais, as atribuições ou todas as contas. Aparecem só as abas que o seu perfil lê (Controle de Usuários / Perfis).</li>
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
          hasPermission("conferencia:editar") && consulta.isSuccess ? (
            <Button
              type="button"
              onClick={() => setEnviando(true)}
              className="bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm"
            >
              <Upload className="size-4" />
              {r?.conferencia ? "Enviar Outra Planilha" : "Enviar Planilha"}
            </Button>
          ) : null
        }
      />

      {/* O envio recolhido num botão, e o resultado em primeiro plano (E12 do levantamento de layout). */}
      {r?.conferencia ? (
        // Em destaque, como os totalizadores das Listas: a planilha em uso, quando e por quem foi enviada.
        <FaixaIndicadores
          itens={[
            { rotulo: "Planilha em Uso", rotuloAntes: true, valor: <span className="text-sm font-bold">{r.conferencia.nomeArquivo}</span> },
            { rotulo: "Enviada em", rotuloAntes: true, valor: <span className="text-sm font-bold">{dataHora(r.conferencia.enviadoEm)}</span> },
            { rotulo: "Por", rotuloAntes: true, valor: <span className="text-sm font-bold">{r.conferencia.enviadoPor}</span> },
            ...(r.envios > 1
              ? [{ rotulo: "envios nesta competência", dica: "Vale a última planilha enviada.", valor: <span className="text-sm font-bold">{r.envios}</span> }]
              : []),
          ]}
        />
      ) : consulta.isSuccess ? (
        <div className="rounded-sm border border-gray-200 bg-white py-12 text-center">
          <p className="text-sm font-medium text-gray-900">Nenhuma planilha enviada para esta competência</p>
          <p className="mt-1 text-sm text-gray-600">Envie o SIG BPM - BASE REALIZADO (RESULTADOS) para comparar com a DRE apurada.</p>
        </div>
      ) : null}

      <Dialog open={enviando} onOpenChange={setEnviando}>
        <DialogContent className="rounded-sm sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{r?.conferencia ? "Enviar Outra Planilha" : "Enviar Planilha"}</DialogTitle>
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
        <div className="rounded-sm border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">A competência ainda não foi apurada: apure-a (tela Resultados) para comparar.</div>
      ) : null}

      {r?.resumo && !r.visoes.length ? <p className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">Seu perfil não tem acesso a nenhuma aba desta tela.</p> : null}
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
                }))}
              />
            </div>
            <div className="flex items-end gap-4">
              <div className="space-y-1.5">
                <label htmlFor="conferencia-limite" className="block text-xs font-medium text-gray-700">
                  Variação Máx.
                </label>
                <Input
                  id="conferencia-limite"
                  value={limiteTexto}
                  inputMode="decimal"
                  onChange={(e) => {
                    setLimiteTexto(e.target.value);
                    guardarVariacao(e.target.value);
                  }}
                  className={`h-9 w-28 rounded-sm text-right ${lerLimite(limiteTexto) === null ? "border-red-400" : ""}`}
                />
              </div>
              <label className="flex h-9 items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={soDiferencas} onChange={(e) => setSoDiferencas(e.target.checked)} className="size-4 accent-black" />
                Só as Diferenças
              </label>
            </div>
          </div>

          {/* O resumo das diferenças em destaque, como os totalizadores das Listas: o geral, a visão aberta e as linhas sem par. */}
          <FaixaIndicadores
            itens={[
              {
                rotulo: `${plural(r.resumo.diferencas, "diferença", "diferenças")} acima de ${moeda(r.limite)}`,
                valor: r.resumo.diferencas === 0 ? <span className="text-green-700">0</span> : r.resumo.diferencas,
                tom: r.resumo.diferencas > 0 ? "atencao" : undefined,
              },
              { rotulo: "linhas comparadas", valor: r.resumo.comparadas },
              {
                rotulo: `em ${visao.nome}, de ${visao.comparadas} linhas`,
                dica: `Aba ${visao.aba} da planilha.`,
                valor: visao.diferencas,
                tom: visao.diferencas > 0 ? "atencao" : undefined,
              },
              ...(r.resumo.soNaPlanilha + r.resumo.soNoSistema > 0
                ? [
                    { rotulo: `${plural(r.resumo.soNaPlanilha, "linha", "linhas")} só na planilha`, valor: r.resumo.soNaPlanilha, tom: "atencao" as const },
                    { rotulo: `${plural(r.resumo.soNoSistema, "linha", "linhas")} só na ferramenta`, valor: r.resumo.soNoSistema, tom: "atencao" as const },
                  ]
                : []),
            ]}
          />

          <Tabela key={visao.unidade} visao={visao} soDiferencas={soDiferencas} />
          <SemPar visao={visao} />
        </>
      ) : consulta.isPending ? (
        <div className="h-64 animate-pulse rounded-sm bg-gray-100" />
      ) : null}
    </div>
  );
}
