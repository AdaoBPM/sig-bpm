"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, FileSpreadsheet, History, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Abas } from "@/components/shared/Abas";
import { usePermissions } from "@/context/PermissionContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { competenciasService } from "@/app/competencias/services/competenciasService";
import { useAlteracoesPendentes } from "@/lib/alteracoesPendentes";

import { mensagemDeErro } from "@/app/relatorios/services/relatoriosService";
import { plural } from "@/lib/texto";

import { cenariosService, rotuloMarcacao, type Cenario, type Visualizacao } from "../services/cenariosService";
import { useTipoDoCenario } from "./tipoDoCenario";
import { AvisoMarcado, estaTravado } from "./AvisoMarcado";
import { botaoPrimario, CampoVisualizacao, classeSelect, Erro, ExcluirCenarioDialog, OpcaoEmLinha } from "./CenarioDialog";
import { ComparativoCenario } from "./ComparativoCenario";
import { MarcarCenarioDialog } from "./MarcarCenarioDialog";
import { ImportarCenarioDialog } from "./ImportarCenarioDialog";
import { ReferenciaAnalitica } from "./ReferenciaAnalitica";
import { descreverFechadas } from "./descreverFechadas";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const dataHora = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null);

/**
 * As configurações do cenário, em duas abas (12/10/2026; antes, dois quadros lado a lado): Cenário (nome, descrição,
 * visualização) e Referência (um arquivo ou o resultado realizado de um ano). Os quadros ocupam a largura da tela, com o
 * destaque amarelo-ouro à esquerda, e as opções ficam uma embaixo da outra, com o texto ao lado (13/10/2026).
 */
export type AbaDasConfiguracoes = "cenario" | "referencia" | "comparativo";

export function ConfiguracoesCenario({ cenario, abaInicial = "cenario" }: { cenario: Cenario; abaInicial?: AbaDasConfiguracoes }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [escolhida, setAba] = useState<AbaDasConfiguracoes>(abaInicial);
  // As ações do cenário (13/10/2026; antes, ícones na lista dos cenários): marcar e excluir.
  const [acao, setAcao] = useState<"marcar" | "excluir" | null>(null);
  const t = useTipoDoCenario();
  // As abas que o perfil lê e as que edita (14/10/2026).
  const { hasPermission } = usePermissions();
  const pode = (a: AbaDasConfiguracoes, acao: "ler" | "editar" = "ler") => hasPermission(t.perm("configuracoes", acao, a));
  // Só quem criou o cenário (ou o Administrador) altera as Configurações (14/10/2026): num cenário público, os demais as
  // leem. O servidor recusa do mesmo jeito.
  const dono = cenario.podeMudarVisualizacao;
  const edita = (a: AbaDasConfiguracoes) => dono && pode(a, "editar");
  // O cenário travado (marcado ou com a versão congelada): o nome, a descrição e o comparativo não mudam (14/10/2026).
  const travado = estaTravado(cenario);
  const soLe = (a: AbaDasConfiguracoes, oQue: string) =>
    !pode(a, "editar") ? `Seu perfil só lê ${oQue}.` : `Este cenário é de ${cenario.criadoPor ?? "outro usuário"}: só quem o criou (ou o Administrador) altera ${oQue}.`;
  const abas = (["cenario", "referencia", "comparativo"] as AbaDasConfiguracoes[]).filter((a) => pode(a));
  const aba: AbaDasConfiguracoes | null = abas.includes(escolhida) ? escolhida : (abas[0] ?? null);
  const analitico = t.tipo === "ANALITICO";
  // A marcação vale para os dois tipos (uma só por vez): o diálogo de marcar olha os sintéticos e os analíticos.
  const sinteticos = useQuery({ queryKey: ["cenarios", "SINTETICO"], queryFn: () => cenariosService.listar("SINTETICO") });
  const analiticos = useQuery({ queryKey: ["cenarios", "ANALITICO"], queryFn: () => cenariosService.listar("ANALITICO"), retry: false });
  const [nome, setNome] = useState(cenario.nome);
  const [descricao, setDescricao] = useState(cenario.descricao ?? "");
  const [visualizacao, setVisualizacao] = useState<Visualizacao>(cenario.visualizacao);
  const [referencia, setReferencia] = useState<"arquivo" | "realizado">("arquivo");
  const [importando, setImportando] = useState(false);
  const competencias = useQuery({ queryKey: ["competencias", "todos"], queryFn: () => competenciasService.listar() });
  const fechadas = (competencias.data?.itens ?? []).filter((c) => c.status === "FECHADA");
  const anos = [...new Set(fechadas.map((c) => c.ano))].sort((a, b) => b - a);
  const [anoEscolhido, setAno] = useState<number | null>(null);
  const ano = anoEscolhido ?? anos[0] ?? null;
  const mesesFechados = fechadas.filter((c) => c.ano === ano).map((c) => c.mes).sort((a, b) => a - b);
  const [confirmar, setConfirmar] = useState(false);
  // Mês a mês (os meses fechados, cada um no seu mês) ou a média de um período replicada nos doze meses (12/10/2026).
  const [modo, setModo] = useState<"MES_A_MES" | "MEDIA">("MES_A_MES");
  const [deEscolhido, setDe] = useState<number | null>(null);
  const [ateEscolhido, setAte] = useState<number | null>(null);
  const de = deEscolhido !== null && mesesFechados.includes(deEscolhido) ? deEscolhido : mesesFechados[0];
  const ate = ateEscolhido !== null && mesesFechados.includes(ateEscolhido) ? ateEscolhido : mesesFechados[mesesFechados.length - 1];
  const periodo = de && ate && de <= ate ? Array.from({ length: ate - de + 1 }, (_, k) => de + k) : [];
  const abertasNoPeriodo = periodo.filter((m) => !mesesFechados.includes(m));
  const periodoInvalido = modo === "MEDIA" && (!periodo.length || abertasNoPeriodo.length > 0);
  const abrev = (m: number) => MESES[m - 1].slice(0, 3);

  const salvar = useMutation({
    mutationFn: () => cenariosService.atualizar(cenario.id, { nome: nome.trim(), descricao: descricao.trim() || null, visualizacao }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cenarios"] });
      toast.success("Configurações gravadas.");
    },
  });
  const carregar = useMutation({
    mutationFn: () => cenariosService.referenciaRealizado(cenario.id, ano!, modo === "MEDIA" ? { modo, de, ate } : { modo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cenarios"] });
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
      toast.success(modo === "MEDIA" ? `Média do realizado de ${ano} (${abrev(de)} a ${abrev(ate)}) carregada nos 12 meses.` : `Resultado realizado de ${ano} carregado no cenário.`);
      setConfirmar(false);
    },
  });
  const mudou = nome.trim() !== cenario.nome || (descricao.trim() || null) !== cenario.descricao || visualizacao !== cenario.visualizacao;
  // Sair com o nome, a descrição ou a visualização mudados e não gravados pergunta antes (13/10/2026).
  useAlteracoesPendentes(mudou && !salvar.isPending);

  return (
    <div className="space-y-6">
      <Abas
        rotulo="Configurações do cenário"
        ativa={aba ?? ""}
        onMudar={(a) => setAba(a as AbaDasConfiguracoes)}
        abas={[
          { chave: "cenario", rotulo: "Cenário" },
          { chave: "referencia", rotulo: "Referência" },
          // O comparativo com outro cenário (13/10/2026; antes, a aba Referência da tela Comparativo).
          { chave: "comparativo", rotulo: "Comparativo" },
        ].filter((a) => abas.includes(a.chave as AbaDasConfiguracoes))}
      />
      {aba === null ? (
        <p className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">Seu perfil não tem acesso a nenhuma aba desta tela.</p>
      ) : aba === "cenario" ? (
        <section className="space-y-4 rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <div className="space-y-1.5">
              <Label htmlFor="cfg-nome">Nome</Label>
              <Input
                id="cfg-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                maxLength={120}
                disabled={cenario.nomeTravado || travado || !edita("cenario")}
                className="rounded-sm disabled:bg-gray-50 disabled:text-gray-700 disabled:opacity-100"
              />
              {/* Com revisões, o nome é o mesmo em todas as versões (13/10/2026), para comparar as versões. */}
              {cenario.nomeTravado ? <p className="text-xs text-gray-500">O cenário tem revisões: o nome é o mesmo em todas as versões e não muda.</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cfg-ano">Exercício</Label>
              <Input id="cfg-ano" value={String(cenario.ano)} readOnly className="rounded-sm bg-gray-50 text-gray-700" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cfg-descricao">Descrição (opcional)</Label>
              <Input
                id="cfg-descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                maxLength={500}
                disabled={travado || !edita("cenario")}
                className="rounded-sm disabled:bg-gray-50 disabled:text-gray-700 disabled:opacity-100"
              />
            </div>
            <div className="sm:col-span-2">
              <CampoVisualizacao
                valor={visualizacao}
                onMudar={setVisualizacao}
                bloqueio={!cenario.podeMudarVisualizacao ? "Só quem criou o cenário ou um Administrador muda a visualização." : !edita("cenario") ? "Seu perfil só lê os dados do cenário." : null}
                semParticular={cenario.marcacao ? "Um cenário marcado fica público: tire a marcação antes de torná-lo particular." : null}
                emLinhas
              />
            </div>
          </div>
          {travado && edita("cenario") ? <AvisoMarcado cenario={cenario} oQue="o nome e a descrição" varios /> : null}
          <Erro erro={salvar.isError ? mensagemDeErro(salvar.error, "Não foi possível gravar as configurações.") : null} />
          {!edita("cenario") ? <p className="rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white px-4 py-2 text-sm text-gray-600">{soLe("cenario", "os dados do cenário")}</p> : (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" className="rounded-sm" onClick={() => setAcao("marcar")}>
              <Bookmark className="size-4" />
              Marcar Cenário
            </Button>
            {/* O cenário marcado não se exclui: o botão fica apagado, com o motivo na dica. */}
            <span title={cenario.marcacao ? `Marcado como ${rotuloMarcacao(cenario.marcacao)}: tire a marcação antes de excluir` : undefined}>
              <Button
                type="button"
                variant="outline"
                className="rounded-sm border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
                disabled={!!cenario.marcacao}
                onClick={() => setAcao("excluir")}
              >
                <Trash2 className="size-4" />
                Excluir Cenário
              </Button>
            </span>
            <Button type="button" className={`${botaoPrimario} ml-auto`} disabled={!nome.trim() || !mudou || salvar.isPending} onClick={() => salvar.mutate()}>
              {salvar.isPending ? "Gravando…" : "Gravar Configurações"}
            </Button>
          </div>
          )}
        </section>
      ) : aba === "comparativo" ? (
        <div className="space-y-4">
          {!edita("comparativo") ? (
            <p className="rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white px-4 py-2 text-sm text-gray-600">{soLe("comparativo", "o comparativo")}</p>
          ) : travado ? (
            <AvisoMarcado cenario={cenario} oQue="o comparativo" />
          ) : null}
          <ComparativoCenario id={cenario.id} podeEditar={edita("comparativo") && !travado} />
        </div>
      ) : analitico ? (
        // A referência dos analíticos (14/10/2026): o realizado (com as Médias de Referência e os centros de custo) ou outro analítico.
        <ReferenciaAnalitica cenario={cenario} podeEditar={edita("referencia")} aviso={soLe("referencia", "a referência")} />
      ) : (
        <section className="space-y-4 rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white p-5">
          <p className="text-sm text-gray-600">
            Opcional: uma base para a DRE do cenário, que depois se edita na tela Resultados. A referência substitui a DRE do cenário; os indicadores
            mudam com o resultado realizado (os realizados dos meses fechados) ou com um arquivo que tenha a aba das metas.
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
                ["arquivo", "Arquivo", "Uma planilha como o ORÇAMENTO BPM (abas Consolidado, Matriz, Filial, Serviços, Desp.+Extra, RN e Metas).", FileSpreadsheet],
                ["realizado", "Resultado Realizado", "A DRE e os indicadores das competências fechadas de um exercício: mês a mês ou a média de um período, replicada nos doze meses.", History],
              ] as const
            ).map(([v, rotulo, detalhe, Icone]) => (
              <OpcaoEmLinha key={v} nome="referencia" marcada={referencia === v} onMarcar={() => setReferencia(v)} rotulo={rotulo} detalhe={detalhe} Icone={Icone} />
            ))}
          </fieldset>
          {!edita("referencia") ? (
            <p className="rounded-sm border border-l-4 border-gray-200 border-l-bpm-primary bg-white px-4 py-2 text-sm text-gray-600">{soLe("referencia", "a referência")}</p>
          ) : estaTravado(cenario) ? (
            <AvisoMarcado cenario={cenario} oQue="a referência" />
          ) : referencia === "arquivo" ? (
            <div className="flex justify-end">
              <Button type="button" className={botaoPrimario} onClick={() => setImportando(true)}>
                <Upload className="size-4" />
                Importar Arquivo
              </Button>
            </div>
          ) : anos.length === 0 ? (
            <p className="rounded-sm border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-900">Nenhuma competência fechada ainda.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cfg-realizado">Exercício</Label>
                  <select id="cfg-realizado" value={ano ?? ""} onChange={(e) => setAno(Number(e.target.value))} className={`${classeSelect} w-32`}>
                    {anos.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="min-w-0 flex-1 pb-2 text-xs text-gray-600">{descreverFechadas(mesesFechados)}</p>
              </div>
              <fieldset className="space-y-2">
                <legend className="mb-1.5 text-sm leading-none font-medium">Importação</legend>
                {(
                  [
                    ["MES_A_MES", "Mês a Mês", "Cada competência fechada no mês dela; os demais meses ficam vazios."],
                    ["MEDIA", "Média Replicada", "A média de um período do realizado, replicada em todos os doze meses do cenário."],
                  ] as const
                ).map(([v, rotulo, detalhe]) => (
                  <OpcaoEmLinha key={v} nome="modo-realizado" marcada={modo === v} onMarcar={() => setModo(v)} rotulo={rotulo} detalhe={detalhe} />
                ))}
              </fieldset>
              {modo === "MEDIA" ? (
                <div className="flex flex-wrap items-end gap-3">
                  {(
                    [
                      ["cfg-de", "De", de, setDe],
                      ["cfg-ate", "Até", ate, setAte],
                    ] as const
                  ).map(([idCampo, rotulo, valor, mudar]) => (
                    <div key={idCampo} className="space-y-1.5">
                      <Label htmlFor={idCampo}>{rotulo}</Label>
                      <select id={idCampo} value={valor ?? ""} onChange={(e) => mudar(Number(e.target.value))} className={`${classeSelect} w-36`}>
                        {mesesFechados.map((m) => (
                          <option key={m} value={m}>
                            {MESES[m - 1]}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                  <p className={`min-w-0 flex-1 pb-2 text-xs ${periodoInvalido ? "text-red-700" : "text-gray-600"}`}>
                    {!periodo.length
                      ? "O mês inicial vem depois do final."
                      : abertasNoPeriodo.length
                        ? `O período tem ${plural(abertasNoPeriodo.length, "um mês", "meses")} sem competência fechada: ${abertasNoPeriodo.map((m) => MESES[m - 1]).join(", ")}.`
                        : `A média de ${periodo.length} ${plural(periodo.length, "mês", "meses")}, ${de === ate ? MESES[de - 1] : `de ${MESES[de - 1]} a ${MESES[ate - 1]}`}, em todos os meses do cenário.`}
                  </p>
                </div>
              ) : null}
              <div className="flex justify-end">
                <Button type="button" className={botaoPrimario} disabled={periodoInvalido} onClick={() => setConfirmar(true)}>
                  <History className="size-4" />
                  Carregar Realizado
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {importando ? <ImportarCenarioDialog cenario={cenario} onFechar={() => setImportando(false)} /> : null}
      {acao === "marcar" ? <MarcarCenarioDialog cenario={cenario} cenarios={[...(sinteticos.data ?? []), ...(analiticos.data ?? [])]} onFechar={() => setAcao(null)} /> : null}
      {acao === "excluir" ? <ExcluirCenarioDialog cenario={cenario} onFechar={() => setAcao(null)} aoExcluir={() => router.push(t.base)} /> : null}
      {confirmar && ano ? (
        <Dialog open onOpenChange={(o) => (!o ? setConfirmar(false) : undefined)}>
          <DialogContent className="rounded-sm sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Carregar Resultado Realizado</DialogTitle>
              {/* Uma frase por item, com a bolinha, como nos painéis explicativos (12/10/2026). */}
              <DialogDescription render={<div />}>
                <ul className="list-disc space-y-1.5 pl-5">
                  {modo === "MEDIA" ? (
                    <>
                      <li>
                        A DRE do cenário (todas as abas e os doze meses) é substituída pela média do realizado de {ano}, {de === ate ? `em ${MESES[de - 1]}` : `de ${MESES[de - 1]} a ${MESES[ate - 1]}`} (
                        {periodo.length} {plural(periodo.length, "mês", "meses")}), replicada em todos os meses.
                      </li>
                      <li>Os indicadores do cenário também ficam com as médias realizadas do período em todos os meses (os que saem da DRE se recalculam das contas médias).</li>
                    </>
                  ) : (
                    <>
                      <li>
                        A DRE do cenário (todas as abas e os doze meses) é substituída pela das competências fechadas de {ano} ({mesesFechados.map(abrev).join(", ")}), cada uma
                        no seu mês.
                      </li>
                      <li>Os indicadores do cenário também são substituídos pelos realizados desses meses.</li>
                    </>
                  )}
                  <li>Os valores editados e os lançamentos manuais do cenário se perdem.</li>
                </ul>
              </DialogDescription>
            </DialogHeader>
            <Erro erro={carregar.isError ? mensagemDeErro(carregar.error, "Não foi possível carregar o realizado.") : null} />
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
    </div>
  );
}
