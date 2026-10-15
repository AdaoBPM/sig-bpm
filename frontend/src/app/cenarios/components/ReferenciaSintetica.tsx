"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, History, Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import { competenciasService } from "@/app/competencias/services/competenciasService";
import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";
import { plural } from "@/lib/texto";

import { cenariosService, rotuloVersao, type Cenario, type ParteDaReferencia } from "../services/cenariosService";
import { AvisoMarcado, estaTravado } from "./AvisoMarcado";
import { botaoPrimario, classeSelect, Erro, OpcaoEmLinha } from "./CenarioDialog";
import { descreverFechadas } from "./descreverFechadas";
import { ImportarCenarioDialog } from "./ImportarCenarioDialog";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DOZE = Array.from({ length: 12 }, (_, k) => k + 1);
const dataHora = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null);
const faixa = (de: number, ate: number) => (de <= ate ? Array.from({ length: ate - de + 1 }, (_, k) => de + k) : []);
const textoFaixa = (de: number, ate: number) => (de === ate ? MESES[de - 1] : `de ${MESES[de - 1]} a ${MESES[ate - 1]}`);

/** Uma referência na tela: a origem ("REALIZADO" ou o id de um cenário) e os meses do cenário que ela preenche. */
type Parte = { origem: string; ano: number | null; modo: "MES_A_MES" | "MEDIA"; de: number | null; ate: number | null; mesDe: number; mesAte: number };
const REALIZADO = "REALIZADO";

/**
 * A aba Referência de um cenário sintético: um arquivo (como o ORÇAMENTO BPM) ou, desde 15/10/2026, até duas referências
 * de cenários e realizados, cada uma com os meses do cenário que preenche, sem meses em comum (antes, só o resultado
 * realizado de um exercício, nos doze meses). O realizado vai Mês a Mês (as competências fechadas que caem nos meses da
 * referência) ou pela Média Replicada (a média de um período, em todos os meses da referência); outro cenário
 * (sintético ou analítico) leva a DRE e os indicadores dele, mês a mês, para os mesmos meses.
 */
export function ReferenciaSintetica({ cenario, podeEditar, aviso }: { cenario: Cenario; podeEditar: boolean; aviso: string }) {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState<"arquivo" | "composta">("composta");
  const [importando, setImportando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const competencias = useQuery({ queryKey: ["competencias", "todos"], queryFn: () => competenciasService.listar() });
  const fechadas = (competencias.data?.itens ?? []).filter((c) => c.status === "FECHADA");
  const anos = [...new Set(fechadas.map((c) => c.ano))].sort((a, b) => b - a);
  const fechadasDoAno = (ano: number | null) => fechadas.filter((c) => c.ano === ano).map((c) => c.mes).sort((a, b) => a - b);
  const sinteticos = useQuery({ queryKey: ["cenarios", "SINTETICO"], queryFn: () => cenariosService.listar("SINTETICO") });
  const analiticos = useQuery({ queryKey: ["cenarios", "ANALITICO"], queryFn: () => cenariosService.listar("ANALITICO"), retry: false });
  const outros = (lista?: Cenario[]) => (lista ?? []).filter((c) => c.id !== cenario.id);
  const cenarios = [...outros(sinteticos.data), ...outros(analiticos.data)];
  const nomeDoCenario = (c: Cenario) => `${c.nome} ${rotuloVersao(c.versao)}${c.ano !== cenario.ano ? ` (${c.ano})` : ""}`;

  const [partes, setPartes] = useState<Parte[]>([{ origem: REALIZADO, ano: null, modo: "MES_A_MES", de: null, ate: null, mesDe: 1, mesAte: 12 }]);
  const mudar = (i: number, m: Partial<Parte>) => setPartes((ps) => ps.map((p, k) => (k === i ? { ...p, ...m } : p)));
  // O que cada referência carrega, com o ano, o período e o erro dela (sem competência fechada, período inválido…).
  const resolvidas = partes.map((p) => {
    const alvo = faixa(p.mesDe, p.mesAte);
    if (p.origem !== REALIZADO) {
      const c = cenarios.find((x) => x.id === p.origem);
      return {
        p,
        alvo,
        erro: !c ? "Escolha o cenário." : !alvo.length ? "O mês inicial vem depois do final." : null,
        texto: c ? `a DRE e os indicadores de ${/^cen[aá]rio/i.test(c.nome) ? "" : "Cenário "}${nomeDoCenario(c)}, ${textoFaixa(p.mesDe, p.mesAte)}, cada mês no seu mês` : "",
      };
    }
    const ano = p.ano ?? anos[0] ?? null;
    const doAno = fechadasDoAno(ano);
    const de = p.de !== null && doAno.includes(p.de) ? p.de : doAno[0];
    const ate = p.ate !== null && doAno.includes(p.ate) ? p.ate : doAno[doAno.length - 1];
    if (p.modo === "MEDIA") {
      const periodo = de && ate ? faixa(de, ate) : [];
      const abertas = periodo.filter((m) => !doAno.includes(m));
      return {
        p: { ...p, ano, de, ate },
        alvo,
        doAno,
        erro: !alvo.length
          ? "O mês inicial do cenário vem depois do final."
          : !periodo.length
            ? "O mês inicial do período vem depois do final."
            : abertas.length
              ? `O período tem ${plural(abertas.length, "um mês", "meses")} sem competência fechada: ${abertas.map((m) => MESES[m - 1]).join(", ")}.`
              : null,
        texto: periodo.length ? `a média do realizado de ${ano}, ${textoFaixa(de, ate)} (${periodo.length} ${plural(periodo.length, "mês", "meses")}), replicada ${alvo.length === 12 ? "nos doze meses" : textoFaixa(p.mesDe, p.mesAte)}` : "",
      };
    }
    const noAlvo = doAno.filter((m) => alvo.includes(m));
    return {
      p: { ...p, ano, de, ate },
      alvo,
      doAno,
      erro: !alvo.length ? "O mês inicial do cenário vem depois do final." : !noAlvo.length ? `Nenhuma competência de ${ano} fechada nesses meses.` : null,
      texto: noAlvo.length ? `o resultado realizado de ${ano}, mês a mês: ${noAlvo.map((m) => MESES[m - 1]).join(", ")}` : "",
    };
  });
  const comuns = resolvidas.length === 2 ? resolvidas[0].alvo.filter((m) => resolvidas[1].alvo.includes(m)) : [];
  const vazios = DOZE.filter((m) => !resolvidas.some((r) => r.alvo.includes(m)));
  const invalida = resolvidas.some((r) => r.erro) || comuns.length > 0 || (resolvidas.some((r) => r.p.origem === REALIZADO) && anos.length === 0);

  const carregar = useMutation({
    mutationFn: () =>
      cenariosService.referenciaComposta(
        cenario.id,
        resolvidas.map(({ p }): ParteDaReferencia =>
          p.origem === REALIZADO
            ? { tipo: "REALIZADO", ano: p.ano!, modo: p.modo, ...(p.modo === "MEDIA" ? { de: p.de!, ate: p.ate! } : {}), mesDe: p.mesDe, mesAte: p.mesAte }
            : { tipo: "CENARIO", origemId: p.origem, mesDe: p.mesDe, mesAte: p.mesAte },
        ),
      ),
    onSuccess: (c) => {
      queryClient.invalidateQueries({ queryKey: ["cenarios"] });
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
      toast.success(`Referência carregada: ${c.nomeArquivo}.`);
      setConfirmar(false);
    },
  });

  const seletorDeMes = (idCampo: string, rotulo: string, valor: number, meses: number[], onMudar: (m: number) => void) => (
    <div className="space-y-1.5">
      <Label htmlFor={idCampo}>{rotulo}</Label>
      <select id={idCampo} value={valor} onChange={(e) => onMudar(Number(e.target.value))} className={`${classeSelect} w-36`}>
        {meses.map((m) => (
          <option key={m} value={m}>
            {MESES[m - 1]}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <section className="space-y-4 rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white p-5">
      <p className="text-sm text-gray-600">
        Opcional: uma base para a DRE do cenário, que depois se edita na tela Resultados. A referência substitui a DRE do cenário; os indicadores mudam
        com os das referências (os realizados dos meses fechados ou os de outro cenário) ou com um arquivo que tenha a aba das metas.
      </p>
      <p className="text-sm text-gray-700">
        Referência atual:{" "}
        {cenario.nomeArquivo ? (
          <span className="font-medium text-gray-900">
            {cenario.nomeArquivo}
            {cenario.importadoEm ? <span className="font-normal text-gray-500"> · em {dataHora(cenario.importadoEm)}</span> : null}
          </span>
        ) : (
          <span className="text-gray-500">nenhuma (a DRE é a digitada na ferramenta)</span>
        )}
      </p>
      <fieldset className="space-y-2">
        <legend className="sr-only">Tipo da referência</legend>
        {(
          [
            ["composta", "Cenários e Realizados", "Até duas referências, em meses distintos: o resultado realizado de um exercício (mês a mês ou a média de um período) ou outro cenário.", History],
            ["arquivo", "Arquivo", "Uma planilha como o ORÇAMENTO BPM (abas Consolidado, Matriz, Filial, Serviços, Desp.+Extra, RN e Metas).", FileSpreadsheet],
          ] as const
        ).map(([v, rotulo, detalhe, Icone]) => (
          <OpcaoEmLinha key={v} nome="referencia" marcada={tipo === v} onMarcar={() => setTipo(v)} rotulo={rotulo} detalhe={detalhe} Icone={Icone} />
        ))}
      </fieldset>
      {!podeEditar ? (
        <p className="rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white px-4 py-2 text-sm text-gray-600">{aviso}</p>
      ) : estaTravado(cenario) ? (
        <AvisoMarcado cenario={cenario} oQue="a referência" />
      ) : tipo === "arquivo" ? (
        <div className="flex justify-end">
          <Button type="button" className={botaoPrimario} onClick={() => setImportando(true)}>
            <Upload className="size-4" />
            Importar Arquivo
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {resolvidas.map((r, i) => {
            const p = r.p;
            const realizado = p.origem === REALIZADO;
            return (
              <div key={i} className="space-y-3 rounded-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-gray-900">{partes.length > 1 ? `${i + 1}ª Referência` : "Referência"}</p>
                  {i > 0 ? (
                    <Button type="button" variant="outline" size="sm" className="rounded-sm" onClick={() => setPartes((ps) => ps.filter((_, k) => k !== i))}>
                      <X className="size-4" />
                      Remover
                    </Button>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-64 flex-1 space-y-1.5">
                    <Label htmlFor={`ref-origem-${i}`}>Origem</Label>
                    <select id={`ref-origem-${i}`} value={p.origem} onChange={(e) => mudar(i, { origem: e.target.value })} className={classeSelect}>
                      <option value={REALIZADO}>Resultado Realizado</option>
                      {(
                        [
                          ["Cenários Sintéticos", outros(sinteticos.data)],
                          ["Cenários Analíticos", outros(analiticos.data)],
                        ] as const
                      ).map(([grupo, lista]) =>
                        lista.length ? (
                          <optgroup key={grupo} label={grupo}>
                            {lista.map((c) => (
                              <option key={c.id} value={c.id}>
                                {nomeDoCenario(c)}
                              </option>
                            ))}
                          </optgroup>
                        ) : null,
                      )}
                    </select>
                  </div>
                  {seletorDeMes(`ref-mes-de-${i}`, "Meses do Cenário: De", p.mesDe, DOZE, (m) => mudar(i, { mesDe: m }))}
                  {seletorDeMes(`ref-mes-ate-${i}`, "Até", p.mesAte, DOZE, (m) => mudar(i, { mesAte: m }))}
                </div>
                {realizado ? (
                  anos.length === 0 ? (
                    <p className="rounded-sm border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-900">Nenhuma competência fechada ainda.</p>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor={`ref-ano-${i}`}>Exercício</Label>
                          <select id={`ref-ano-${i}`} value={p.ano ?? ""} onChange={(e) => mudar(i, { ano: Number(e.target.value), de: null, ate: null })} className={`${classeSelect} w-32`}>
                            {anos.map((a) => (
                              <option key={a} value={a}>
                                {a}
                              </option>
                            ))}
                          </select>
                        </div>
                        <p className="min-w-0 flex-1 pb-2 text-xs text-gray-600">{descreverFechadas(r.doAno ?? [])}</p>
                      </div>
                      <fieldset className="space-y-2">
                        <legend className="mb-1.5 text-sm leading-none font-medium">Importação</legend>
                        {(
                          [
                            ["MES_A_MES", "Mês a Mês", "Cada competência fechada no mês dela, nos meses desta referência; os meses sem competência fechada ficam vazios."],
                            ["MEDIA", "Média Replicada", "A média de um período do realizado, replicada em todos os meses desta referência."],
                          ] as const
                        ).map(([v, rotulo, detalhe]) => (
                          <OpcaoEmLinha key={v} nome={`modo-realizado-${i}`} marcada={p.modo === v} onMarcar={() => mudar(i, { modo: v })} rotulo={rotulo} detalhe={detalhe} />
                        ))}
                      </fieldset>
                      {p.modo === "MEDIA" && r.doAno?.length ? (
                        <div className="flex flex-wrap items-end gap-3">
                          {seletorDeMes(`ref-de-${i}`, "Período: De", p.de!, r.doAno, (m) => mudar(i, { de: m }))}
                          {seletorDeMes(`ref-ate-${i}`, "Até", p.ate!, r.doAno, (m) => mudar(i, { ate: m }))}
                        </div>
                      ) : null}
                    </>
                  )
                ) : null}
                <p className={`text-xs ${r.erro ? "text-red-700" : "text-gray-600"}`}>{r.erro ?? `Carrega ${r.texto}.`}</p>
              </div>
            );
          })}
          {comuns.length ? (
            <p className="rounded-sm border border-l-4 border-gray-200 border-l-red-600 bg-white px-4 py-2 text-sm text-gray-700">
              As duas referências têm {plural(comuns.length, "um mês", "meses")} em comum ({comuns.map((m) => MESES[m - 1]).join(", ")}): escolha meses distintos.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {partes.length < 2 ? (
              <Button
                type="button"
                variant="outline"
                className="mr-auto rounded-sm"
                onClick={() => {
                  // A segunda começa no mês seguinte ao da primeira (ou no último, se a primeira vai até dezembro).
                  const de = Math.min(12, partes[0].mesAte + 1);
                  setPartes((ps) => [...ps, { origem: cenarios[0]?.id ?? REALIZADO, ano: null, modo: "MES_A_MES", de: null, ate: null, mesDe: de, mesAte: 12 }]);
                }}
              >
                <Plus className="size-4" />
                Incluir Referência
              </Button>
            ) : null}
            <Button type="button" className={botaoPrimario} disabled={invalida} onClick={() => setConfirmar(true)}>
              <History className="size-4" />
              Carregar Referência
            </Button>
          </div>
        </div>
      )}

      {importando ? <ImportarCenarioDialog cenario={cenario} onFechar={() => setImportando(false)} /> : null}
      {confirmar ? (
        <Dialog open onOpenChange={(o) => (!o ? setConfirmar(false) : undefined)}>
          <DialogContent className="rounded-sm sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Carregar Referência</DialogTitle>
              {/* Uma frase por item, com a bolinha, como nos painéis explicativos (12/10/2026). */}
              <DialogDescription render={<div />}>
                <ul className="list-disc space-y-1.5 pl-5">
                  <li>A DRE do cenário (todas as abas e os doze meses) e os indicadores são substituídos.</li>
                  {resolvidas.map((r, i) => (
                    <li key={i}>
                      {textoFaixa(r.p.mesDe, r.p.mesAte).replace(/^d/, "D")}: {r.texto}.
                    </li>
                  ))}
                  {vazios.length ? <li>{plural(vazios.length, "O mês", "Os meses")} fora das referências ({vazios.map((m) => MESES[m - 1]).join(", ")}) {plural(vazios.length, "fica vazio", "ficam vazios")}.</li> : null}
                  <li>Os valores editados e os lançamentos manuais do cenário se perdem.</li>
                </ul>
              </DialogDescription>
            </DialogHeader>
            <Erro erro={carregar.isError ? mensagemDeErro(carregar.error, "Não foi possível carregar a referência.") : null} />
            <DialogFooter>
              <Button type="button" variant="outline" className="rounded-sm" onClick={() => setConfirmar(false)}>
                Cancelar
              </Button>
              <Button type="button" className={botaoPrimario} disabled={carregar.isPending} onClick={() => carregar.mutate()}>
                {carregar.isPending ? "Carregando…" : "Carregar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  );
}
