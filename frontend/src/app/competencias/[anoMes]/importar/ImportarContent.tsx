"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Lock, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Abas } from "@/components/shared/Abas";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { Carregando, ErroCarga, Vazio } from "@/components/shared/Estados";
import { SeletorFiltro } from "@/components/shared/Filtros";
import { Paginacao } from "@/components/shared/Paginacao";
import { QuadroTabela } from "@/components/shared/QuadroTabela";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { EnviarArquivoForm } from "./components/EnviarArquivoForm";
import { ResultadoImportacao } from "./components/ResultadoImportacao";
import { importacoesService, type Importacao, type StatusImportacao } from "./services/importacoesService";
import { dataHora, inteiro, lerAnoMes, ROTULO_TIPO } from "../utils/formatacao";

const botaoPrimario = "bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm";

/** Os arquivos de todo mês, na ordem do fechamento. A DRE do Comercial e o saldo inicial só aparecem quando importados no mês. */
const TIPOS_DO_MES = ["BALANCETE", "PROJETO", "PRODUCAO", "PRODUCAO_PISTA", "PRODUCAO_ARMADURA", "PRODUCAO_METALURGIA", "EXPEDICAO", "MONTAGEM", "ACOMPANHAMENTO", "MEDICAO", "DEVOLUCAO", "SAIDA"];
const TIPOS_EVENTUAIS = ["DRE_COMERCIAL", "ESTOQUE_INICIAL"];

const ESTILO_STATUS: Record<StatusImportacao, { classe: string; rotulo: string }> = {
  PROCESSANDO: { classe: "border-blue-200 bg-blue-50 text-blue-700", rotulo: "Processando" },
  CONCLUIDA: { classe: "border-green-200 bg-green-50 text-green-700", rotulo: "Concluída" },
  REJEITADA: { classe: "border-red-200 bg-red-50 text-red-700", rotulo: "Recusada" },
};

function Selo({ classe, children }: { classe: string; children: React.ReactNode }) {
  return <span className={`inline-block rounded-sm border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${classe}`}>{children}</span>;
}

function StatusImportacaoBadge({ imp }: { imp: Importacao }) {
  if (imp.comparacao && imp.status === "CONCLUIDA") return <Selo classe="border-yellow-200 bg-yellow-50 text-yellow-800">Comparação</Selo>;
  if (imp.substituidaEm) return <Selo classe="border-gray-200 bg-gray-50 text-gray-500">Substituída</Selo>;
  const { classe, rotulo } = ESTILO_STATUS[imp.status];
  return <Selo classe={classe}>{rotulo}</Selo>;
}

/** A importação de cada tipo que vale no mês e, se for mais recente, a última tentativa que não a substituiu (recusada ou comparação). */
type Situacao = { tipo: string; vigente: Importacao | null; ultimaTentativa: Importacao | null };

function situacaoPorTipo(itens: Importacao[], tipos: string[]): Situacao[] {
  return tipos.map((tipo) => {
    const doTipo = itens.filter((i) => i.tipo === tipo); // a lista vem da mais recente para a mais antiga
    const vigente = doTipo.find((i) => !i.comparacao && !i.substituidaEm && i.status !== "REJEITADA") ?? null;
    const ultima = doTipo[0] ?? null;
    return { tipo, vigente, ultimaTentativa: ultima && ultima !== vigente ? ultima : null };
  });
}

export function ImportarContent() {
  const { anoMes } = useParams<{ anoMes: string }>();
  useRegistrarAcessoTela(`/competencias/${anoMes}/importar`);
  const { user } = useAuth();
  const { hasPermission } = usePermissions();

  const periodo = lerAnoMes(anoMes);
  const [aba, setAba] = useState<"vigor" | "historico">("vigor");
  const [aberta, setAberta] = useState<string | null>(null);
  const [envio, setEnvio] = useState<{ tipo?: string } | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string | undefined>();
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);

  const { data, isPending, isError, error } = useQuery({
    queryKey: ["importacoes", anoMes],
    queryFn: () => importacoesService.listar(anoMes),
    enabled: periodo !== null,
  });

  if (!periodo) {
    return <ErroCarga mensagem={`Competência inválida na URL: ${anoMes}. Use o formato aaaa-mm.`} />;
  }

  const itens = data?.itens ?? [];
  const fechada = data?.competencia.status === "FECHADA";
  const podeImportar = hasPermission("importacao:editar");
  // Recorte por setor (Passo 22): o Alimentador só vê as listas dos seus setores.
  const alcanca = (t: string) => !user?.acesso.recorteSetor || user.acesso.setores.includes(t);
  const tipos = [...TIPOS_DO_MES.filter(alcanca), ...TIPOS_EVENTUAIS.filter((t) => itens.some((i) => i.tipo === t))];
  const situacoes = situacaoPorTipo(itens, tipos);
  const mensagemErro = (error as { response?: { data?: { error?: string } } } | null)?.response?.data?.error ?? "Erro ao carregar as importações.";

  const historico = filtroTipo ? itens.filter((i) => i.tipo === filtroTipo) : itens;
  const daPagina = historico.slice((pagina - 1) * porPagina, pagina * porPagina);
  const importados = situacoes.filter((s) => s.vigente).length;

  // Com o mês fechado, só o balancete entra, para comparar (Passo 24).
  const podeEnviar = (tipo: string) => podeImportar && (!fechada || tipo === "BALANCETE");

  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Importações"
        selo={
          fechada ? (
            <span
              className="inline-flex items-center gap-1 rounded-sm border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-600"
              title="Competência fechada: só recebe o balancete, para comparar com o que está gravado. As diferenças viram divergências e a competência não muda. Para substituir dados, ela precisa ser reaberta."
            >
              <Lock className="size-3" />
              Fechada · só comparação do balancete
            </span>
          ) : null
        }
        sobre={
          <>
            <p>
              O balancete, as listas operacionais, a DRE do Comercial e o saldo inicial do estoque entram por aqui. Reimportar um tipo substitui o
              lote anterior por inteiro.
            </p>
            <p>
              &quot;Em vigor&quot; mostra o arquivo que vale para cada tipo neste mês. O histórico guarda toda importação, inclusive as recusadas e
              as substituídas. Clique numa linha para ver o relatório.
            </p>
          </>
        }
        acoes={
          data && podeImportar ? (
            <Button type="button" className={botaoPrimario} onClick={() => setEnvio({})}>
              <Upload className="size-4" />
              {fechada ? "Comparar balancete" : "Importar arquivo"}
            </Button>
          ) : null
        }
      />

      {isError ? <ErroCarga mensagem={mensagemErro} /> : null}

      <Abas
        rotulo="Importações"
        ativa={aba}
        onMudar={(c) => setAba(c as "vigor" | "historico")}
        abas={[
          { chave: "vigor", rotulo: "Em vigor", contagem: data ? importados : undefined },
          { chave: "historico", rotulo: "Histórico", contagem: data ? itens.length : undefined },
        ]}
      />

      {aba === "vigor" ? (
        <QuadroTabela>
          {isPending ? (
            <Carregando linhas={6} />
          ) : (
            <table className="tabela-sig w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-bold tracking-wide text-gray-600 uppercase">
                  <th className="px-4">Tipo</th>
                  <th className="px-4">Arquivo</th>
                  <th className="px-4">Importado em</th>
                  <th className="px-4">Por</th>
                  <th className="px-4 text-right">Aceitas</th>
                  <th className="px-4 text-right">Rejeitadas</th>
                  <th className="px-4">Situação</th>
                  <th className="px-4" />
                </tr>
              </thead>
              <tbody>
                {situacoes.map(({ tipo, vigente, ultimaTentativa }) => (
                  <tr
                    key={tipo}
                    onClick={vigente ? () => setAberta(vigente.id) : undefined}
                    className={`border-b border-gray-100 ${vigente ? "cursor-pointer hover:bg-gray-50" : ""}`}
                  >
                    <td className="px-4 text-sm font-medium whitespace-nowrap text-gray-900">{ROTULO_TIPO[tipo] ?? tipo}</td>
                    <td className="max-w-xs px-4 text-sm text-gray-900">
                      <div className="truncate" title={vigente?.nomeArquivo}>
                        {vigente ? vigente.nomeArquivo : <span className="text-gray-400">—</span>}
                      </div>
                      {ultimaTentativa ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAberta(ultimaTentativa.id);
                          }}
                          className={`mt-0.5 block text-left text-xs hover:underline ${ultimaTentativa.status === "REJEITADA" ? "text-red-700" : "text-yellow-800"}`}
                        >
                          {ultimaTentativa.status === "REJEITADA"
                            ? `Recusada em ${dataHora(ultimaTentativa.importadoEm)}`
                            : ultimaTentativa.comparacao
                              ? `Comparado em ${dataHora(ultimaTentativa.importadoEm)}`
                              : `Enviado em ${dataHora(ultimaTentativa.importadoEm)}`}
                        </button>
                      ) : null}
                    </td>
                    <td className="px-4 text-sm whitespace-nowrap text-gray-600 tabular-nums">{vigente ? dataHora(vigente.importadoEm) : ""}</td>
                    <td className="px-4 text-sm whitespace-nowrap text-gray-600">{vigente?.usuario?.nome ?? ""}</td>
                    <td className="px-4 text-right text-sm tabular-nums">{vigente ? inteiro(vigente.linhasAceitas) : ""}</td>
                    <td className="px-4 text-right text-sm tabular-nums">
                      {vigente ? vigente.linhasRejeitadas > 0 ? <span className="font-medium text-red-700">{inteiro(vigente.linhasRejeitadas)}</span> : <span className="text-gray-400">0</span> : ""}
                    </td>
                    <td className="px-4">{vigente ? <StatusImportacaoBadge imp={vigente} /> : <Selo classe="border-gray-200 bg-white text-gray-500">Não importado</Selo>}</td>
                    <td className="px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      {podeEnviar(tipo) && TIPOS_DO_MES.includes(tipo) ? (
                        <Button type="button" variant="ghost" size="sm" className="h-7 rounded-sm text-gray-700 underline-offset-2 hover:underline" onClick={() => setEnvio({ tipo })}>
                          {fechada ? "Comparar" : vigente ? "Reimportar" : "Importar"}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </QuadroTabela>
      ) : (
        <QuadroTabela
          barra={
            <>
              <SeletorFiltro
                rotulo="Tipo"
                valor={filtroTipo}
                onMudar={(v) => {
                  setFiltroTipo(v);
                  setPagina(1);
                }}
                largura="w-52"
                opcoes={[...new Set(itens.map((i) => i.tipo))].map((t) => ({ valor: t, rotulo: ROTULO_TIPO[t] ?? t }))}
              />
              <span className="text-xs text-gray-600">{data ? `${inteiro(historico.length)} importação(ões)` : ""}</span>
            </>
          }
          rodape={
            historico.length > 0 ? (
              <Paginacao
                total={historico.length}
                pagina={pagina}
                porPagina={porPagina}
                onPagina={setPagina}
                onPorPagina={(n) => {
                  setPorPagina(n);
                  setPagina(1);
                }}
              />
            ) : null
          }
        >
          {isPending ? (
            <Carregando linhas={6} />
          ) : historico.length === 0 ? (
            <Vazio titulo="Nenhuma importação nesta competência" dica={podeImportar ? "Use o botão Importar arquivo." : undefined} />
          ) : (
            <table className="tabela-sig w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-bold tracking-wide text-gray-600 uppercase">
                  <th className="px-4">Quando</th>
                  <th className="px-4">Tipo</th>
                  <th className="px-4">Arquivo</th>
                  <th className="px-4">Situação</th>
                  <th className="px-4 text-right">Aceitas</th>
                  <th className="px-4 text-right">Rejeitadas</th>
                  <th className="px-4">Por</th>
                </tr>
              </thead>
              <tbody>
                {daPagina.map((imp) => (
                  <tr key={imp.id} onClick={() => setAberta(imp.id)} className={`cursor-pointer border-b border-gray-100 hover:bg-gray-50 ${imp.substituidaEm ? "text-gray-500" : ""}`}>
                    <td className="px-4 text-sm whitespace-nowrap tabular-nums">{dataHora(imp.importadoEm)}</td>
                    <td className="px-4 text-sm whitespace-nowrap">{ROTULO_TIPO[imp.tipo] ?? imp.tipo}</td>
                    <td className="max-w-xs truncate px-4 text-sm" title={imp.nomeArquivo}>
                      {imp.nomeArquivo}
                    </td>
                    <td className="px-4">
                      <StatusImportacaoBadge imp={imp} />
                    </td>
                    <td className="px-4 text-right text-sm tabular-nums">{inteiro(imp.linhasAceitas)}</td>
                    <td className="px-4 text-right text-sm tabular-nums">
                      {imp.linhasRejeitadas > 0 ? <span className="font-medium text-red-700">{inteiro(imp.linhasRejeitadas)}</span> : <span className="text-gray-400">0</span>}
                    </td>
                    <td className="px-4 text-sm whitespace-nowrap">{imp.usuario?.nome ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </QuadroTabela>
      )}

      {/* O envio, num diálogo; enviado o arquivo, o relatório abre no painel e acompanha o processamento. */}
      <Dialog open={envio !== null} onOpenChange={(o) => (!o ? setEnvio(null) : undefined)}>
        <DialogContent className="rounded-sm sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{fechada ? "Comparar balancete" : "Importar arquivo"}</DialogTitle>
          </DialogHeader>
          {envio ? (
            <EnviarArquivoForm
              anoMes={anoMes}
              somenteBalancete={fechada}
              tipoInicial={envio.tipo}
              onEnviado={(imp) => {
                setEnvio(null);
                setAberta(imp.id);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Sheet open={aberta !== null} onOpenChange={(o) => (!o ? setAberta(null) : undefined)}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-6 data-[side=right]:sm:max-w-4xl">
          <SheetTitle className="sr-only">Relatório da importação</SheetTitle>
          {aberta ? <ResultadoImportacao key={aberta} id={aberta} anoMes={anoMes} noPainel /> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
