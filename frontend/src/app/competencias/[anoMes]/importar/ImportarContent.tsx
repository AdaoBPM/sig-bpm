"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Lock, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Abas } from "@/components/shared/Abas";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { Carregando, ErroCarga, Vazio } from "@/components/shared/Estados";
import { Paginacao } from "@/components/shared/Paginacao";
import { QuadroTabela } from "@/components/shared/QuadroTabela";
import { SemResultado, useTabelaFiltravel } from "@/components/shared/TabelaFiltravel";
import type { Coluna } from "@/lib/filtrosDeTabela";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { EnviarArquivoForm } from "./components/EnviarArquivoForm";
import { ImportarLoteDialog } from "./components/ImportarLoteDialog";
import { ResultadoImportacao } from "./components/ResultadoImportacao";
import { importacoesService, type Importacao, type StatusImportacao } from "./services/importacoesService";
import { dataHora, inteiro, lerAnoMes, ROTULO_TIPO } from "../utils/formatacao";

const botaoPrimario = "bg-bpm-primary hover:bg-bpm-primary-hover rounded-sm font-bold text-black shadow-sm";

/** Os arquivos de todo mês, na ordem do fechamento. A DRE do Comercial e o saldo inicial só aparecem quando importados no mês. */
const TIPOS_DO_MES = ["BALANCETE", "PROJETO", "PRODUCAO", "PRODUCAO_PISTA", "PRODUCAO_ARMADURA", "PRODUCAO_METALURGIA", "EXPEDICAO", "MONTAGEM", "ACOMPANHAMENTO", "MEDICAO", "DEVOLUCAO", "SAIDA", "INDICADORES_ADMIN", "INDICADORES_COMERCIAL", "METAS_ORCAMENTO"];
const TIPOS_EVENTUAIS = ["DRE_COMERCIAL", "ESTOQUE_INICIAL"];

const ESTILO_STATUS: Record<StatusImportacao, { classe: string; rotulo: string }> = {
  PROCESSANDO: { classe: "border-blue-200 bg-blue-50 text-blue-700", rotulo: "Processando" },
  CONCLUIDA: { classe: "border-green-200 bg-green-50 text-green-700", rotulo: "Concluída" },
  REJEITADA: { classe: "border-red-200 bg-red-50 text-red-700", rotulo: "Recusada" },
};

function Selo({ classe, children }: { classe: string; children: React.ReactNode }) {
  return <span className={`inline-block rounded-sm border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${classe}`}>{children}</span>;
}

/** O selo da importação; o rótulo também é o texto do filtro da coluna Situação. */
function estiloSituacao(imp: Importacao) {
  if (imp.comparacao && imp.status === "CONCLUIDA") return { classe: "border-yellow-200 bg-yellow-50 text-yellow-800", rotulo: "Comparação" };
  if (imp.substituidaEm) return { classe: "border-gray-200 bg-gray-50 text-gray-500", rotulo: "Substituída" };
  return ESTILO_STATUS[imp.status];
}

function StatusImportacaoBadge({ imp }: { imp: Importacao }) {
  const { classe, rotulo } = estiloSituacao(imp);
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

const instante = (iso: string) => new Date(iso).getTime();

const COLUNAS_VIGOR: Coluna<Situacao>[] = [
  { chave: "tipo", rotulo: "Tipo", valor: (s) => ROTULO_TIPO[s.tipo] ?? s.tipo },
  { chave: "arquivo", rotulo: "Arquivo", valor: (s) => s.vigente?.nomeArquivo },
  {
    chave: "importadoEm",
    rotulo: "Importado em",
    tipo: "data",
    valor: (s) => (s.vigente ? instante(s.vigente.importadoEm) : null),
    texto: (s) => (s.vigente ? dataHora(s.vigente.importadoEm) : null),
  },
  { chave: "por", rotulo: "Por", valor: (s) => s.vigente?.usuario?.nome },
  { chave: "aceitas", rotulo: "Aceitas", tipo: "numero", alinhamento: "direita", valor: (s) => s.vigente?.linhasAceitas, texto: (s) => (s.vigente ? inteiro(s.vigente.linhasAceitas) : null) },
  {
    chave: "rejeitadas",
    rotulo: "Rejeitadas",
    tipo: "numero",
    alinhamento: "direita",
    valor: (s) => s.vigente?.linhasRejeitadas,
    texto: (s) => (s.vigente ? inteiro(s.vigente.linhasRejeitadas) : null),
  },
  { chave: "situacao", rotulo: "Situação", valor: (s) => (s.vigente ? estiloSituacao(s.vigente).rotulo : "Não importado") },
  { chave: "acoes", rotulo: "", semFiltro: true },
];

const COLUNAS_HISTORICO: Coluna<Importacao>[] = [
  { chave: "quando", rotulo: "Quando", tipo: "data", valor: (i) => instante(i.importadoEm), texto: (i) => dataHora(i.importadoEm) },
  { chave: "tipo", rotulo: "Tipo", valor: (i) => ROTULO_TIPO[i.tipo] ?? i.tipo },
  { chave: "arquivo", rotulo: "Arquivo", valor: (i) => i.nomeArquivo },
  { chave: "situacao", rotulo: "Situação", valor: (i) => estiloSituacao(i).rotulo },
  { chave: "aceitas", rotulo: "Aceitas", tipo: "numero", alinhamento: "direita", valor: (i) => i.linhasAceitas, texto: (i) => inteiro(i.linhasAceitas) },
  { chave: "rejeitadas", rotulo: "Rejeitadas", tipo: "numero", alinhamento: "direita", valor: (i) => i.linhasRejeitadas, texto: (i) => inteiro(i.linhasRejeitadas) },
  { chave: "por", rotulo: "Por", valor: (i) => i.usuario?.nome },
];

function LimparFiltros({ onLimpar }: { onLimpar: () => void }) {
  return (
    <button type="button" onClick={onLimpar} className="text-xs font-medium text-gray-900 underline underline-offset-2">
      Limpar Filtros
    </button>
  );
}

export function ImportarContent() {
  const { anoMes } = useParams<{ anoMes: string }>();
  useRegistrarAcessoTela(`/competencias/${anoMes}/importar`);
  const { user } = useAuth();
  const { hasPermission } = usePermissions();

  const periodo = lerAnoMes(anoMes);
  const [aba, setAba] = useState<"vigor" | "historico">("vigor");
  const [aberta, setAberta] = useState<string | null>(null);
  // Reimportar um tipo (da linha da tabela): o formulário de um tipo só.
  const [envio, setEnvio] = useState<{ tipo?: string } | null>(null);
  // "Importar Arquivo": o arquivo inteiro, aba por aba.
  const [lote, setLote] = useState(false);

  const { data, isPending, isError, error } = useQuery({
    queryKey: ["importacoes", anoMes],
    queryFn: () => importacoesService.listar(anoMes),
    enabled: periodo !== null,
    // Enquanto houver importação em andamento (a fila do lote segue com o diálogo fechado), a lista se atualiza sozinha.
    refetchInterval: (q) => (q.state.data?.itens.some((i) => i.status === "PROCESSANDO") ? 2000 : false),
  });

  // Memorizadas porque entram no filtro dos rótulos, que recalcula quando a lista muda.
  const situacoes = useMemo(() => {
    const lista = data?.itens ?? [];
    // Recorte por setor (Passo 22): o Alimentador só vê as listas dos seus setores.
    const alcanca = (t: string) => !user?.acesso.recorteSetor || user.acesso.setores.includes(t);
    const tipos = [...TIPOS_DO_MES.filter(alcanca), ...TIPOS_EVENTUAIS.filter((t) => lista.some((i) => i.tipo === t))];
    return situacaoPorTipo(lista, tipos);
  }, [data, user]);
  const vigor = useTabelaFiltravel(situacoes, COLUNAS_VIGOR);
  const historico = useTabelaFiltravel(data?.itens, COLUNAS_HISTORICO, { porPaginaInicial: 25 });

  if (!periodo) {
    return <ErroCarga mensagem={`Competência inválida na URL: ${anoMes}. Use o formato aaaa-mm.`} />;
  }

  const itens = data?.itens ?? [];
  const fechada = data?.competencia.status === "FECHADA";
  const podeImportar = hasPermission("importacao:editar");
  const mensagemErro = (error as { response?: { data?: { error?: string } } } | null)?.response?.data?.error ?? "Erro ao carregar as importações.";

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
        comoUsar={
          <ul>
            <li>Clique em “Importar Arquivo” e escolha a planilha (.xlsx); o diálogo lista os arquivos e as abas que servem. A ferramenta reconhece as abas pelo nome, confere a estrutura de cada uma e importa as certas, uma por vez, sem pedir mais nada. Uma aba com erro é avisada, e a próxima segue.</li>
            <li>Uma aba sem diferença em relação à importação em vigor fica “Sem mudança” e não se importa de novo, a menos que nada tenha mudado no arquivo: aí “Importar” continua valendo e reimporta o mês atual assim mesmo (os meses anteriores ficam como estão). Um arquivo com vários meses atualiza todos eles; os meses já apurados que mudarem ganham a bola verde e pedem reapuração.</li>
            <li>A lista do arquivo avisa quando a importação muda competências fechadas (o balancete do ano inteiro, os preços da DRE do Comercial); as diferenças vão para Divergências.</li>
            <li>Para trocar só um tipo, use “Reimportar” na linha dele.</li>
            <li>Na aba Em Vigor, clique numa linha para abrir o relatório: linhas aceitas, recusadas e avisos.</li>
            <li>A aba Histórico guarda todas as importações, inclusive as recusadas e as substituídas.</li>
            <li>Em mês fechado, o balancete só é comparado com o gravado; as diferenças vão para Divergências.</li>
            <li>Depois de importar o balancete, confira a Classificação.</li>
          </ul>
        }
        sobre={
          <>
            <p>
              O balancete (LISTAS REALIZADO (RESULTADOS)), as listas operacionais — as abas (Resumo), Produção (Armaduras), Produção
              (Metalúrgica) e as demais do LISTAS REALIZADO (OPERAÇÃO) —, os indicadores do Administrativo e do Comercial, a DRE do Comercial,
              as metas do orçamento (INDICADORES DE RESULTADO) e o saldo inicial do estoque entram por aqui. Reimportar um tipo substitui o
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
            <Button type="button" className={botaoPrimario} onClick={() => setLote(true)}>
              <Upload className="size-4" />
              {fechada ? "Comparar Balancete" : "Importar Arquivo"}
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
        <QuadroTabela
          barra={
            vigor.ativos ? (
              <div className="ml-auto">
                <LimparFiltros onLimpar={vigor.limpar} />
              </div>
            ) : null
          }
        >
          {isPending ? (
            <Carregando linhas={6} />
          ) : (
            <table className="tabela-sig w-full border-collapse">
              {vigor.cabecalho}
              <tbody>
                {vigor.visiveis.length === 0 ? <SemResultado colunas={COLUNAS_VIGOR.length} onLimpar={vigor.limpar} /> : null}
                {vigor.visiveis.map(({ tipo, vigente, ultimaTentativa }) => (
                  <tr
                    key={tipo}
                    onClick={vigente ? () => setAberta(vigente.id) : undefined}
                    className={`border-b border-gray-100 ${vigente ? "cursor-pointer hover:bg-gray-50" : ""}`}
                  >
                    <td className="px-4 text-sm font-medium whitespace-nowrap text-gray-900">{ROTULO_TIPO[tipo] ?? tipo}</td>
                    {/* O nome do arquivo ocupa a largura que sobra e corta o resto, sem alargar a tabela. */}
                    <td className="w-full px-4 text-sm text-gray-900">
                      <div className="relative h-5" title={vigente?.nomeArquivo}>
                        <div className="absolute inset-x-0 truncate">{vigente ? vigente.nomeArquivo : <span className="text-gray-400">—</span>}</div>
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
                    <td className="px-4 text-sm whitespace-nowrap text-gray-600">{vigente ? dataHora(vigente.importadoEm) : ""}</td>
                    <td className="px-4 text-sm whitespace-nowrap text-gray-600">{vigente?.usuario?.nome ?? ""}</td>
                    <td className="px-4 text-right text-sm">{vigente ? inteiro(vigente.linhasAceitas) : ""}</td>
                    <td className="px-4 text-right text-sm">
                      {vigente ? vigente.linhasRejeitadas > 0 ? <span className="font-medium text-red-700">{inteiro(vigente.linhasRejeitadas)}</span> : <span className="text-gray-400">0</span> : ""}
                    </td>
                    <td className="px-4">{vigente ? <StatusImportacaoBadge imp={vigente} /> : <Selo classe="border-gray-200 bg-white text-gray-500">Não importado</Selo>}</td>
                    <td className="px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      {podeEnviar(tipo) && TIPOS_DO_MES.includes(tipo) ? (
                        <Button type="button" variant="outline" size="sm" className="rounded-sm" onClick={() => setEnvio({ tipo })}>
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
            historico.ativos ? (
              <div className="ml-auto">
                <LimparFiltros onLimpar={historico.limpar} />
              </div>
            ) : null
          }
          rodape={
            historico.total > 0 ? (
              <Paginacao
                total={historico.total}
                pagina={historico.pagina}
                porPagina={historico.porPagina}
                onPagina={historico.setPagina}
                onPorPagina={historico.setPorPagina}
              />
            ) : null
          }
        >
          {isPending ? (
            <Carregando linhas={6} />
          ) : itens.length === 0 ? (
            <Vazio titulo="Nenhuma importação nesta competência" dica={podeImportar ? "Use o botão Importar arquivo." : undefined} />
          ) : (
            <table className="tabela-sig w-full border-collapse">
              {historico.cabecalho}
              <tbody>
                {historico.visiveis.length === 0 ? <SemResultado colunas={COLUNAS_HISTORICO.length} onLimpar={historico.limpar} /> : null}
                {historico.visiveis.map((imp) => (
                  <tr key={imp.id} onClick={() => setAberta(imp.id)} className={`cursor-pointer border-b border-gray-100 hover:bg-gray-50 ${imp.substituidaEm ? "text-gray-500" : ""}`}>
                    <td className="px-4 text-sm whitespace-nowrap">{dataHora(imp.importadoEm)}</td>
                    <td className="px-4 text-sm whitespace-nowrap">{ROTULO_TIPO[imp.tipo] ?? imp.tipo}</td>
                    <td className="w-full px-4 text-sm" title={imp.nomeArquivo}>
                      <div className="relative h-5">
                        <div className="absolute inset-x-0 truncate">{imp.nomeArquivo}</div>
                      </div>
                    </td>
                    <td className="px-4">
                      <StatusImportacaoBadge imp={imp} />
                    </td>
                    <td className="px-4 text-right text-sm">{inteiro(imp.linhasAceitas)}</td>
                    <td className="px-4 text-right text-sm">
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

      <ImportarLoteDialog
        anoMes={anoMes}
        aberto={lote}
        fechada={fechada}
        onFechar={() => setLote(false)}
        onAbrirRelatorio={(id) => {
          setLote(false);
          setAberta(id);
        }}
      />

      {/* Reimportar um tipo, num diálogo; enviado o arquivo, o relatório abre no painel e acompanha o processamento. */}
      <Dialog open={envio !== null} onOpenChange={(o) => (!o ? setEnvio(null) : undefined)}>
        <DialogContent className="rounded-sm sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{fechada ? "Comparar Balancete" : "Importar Arquivo"}</DialogTitle>
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
          <SheetTitle className="sr-only">Relatório da Importação</SheetTitle>
          {aberta ? <ResultadoImportacao key={aberta} id={aberta} anoMes={anoMes} noPainel /> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
