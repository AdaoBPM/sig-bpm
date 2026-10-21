"use client";

import { Fragment, useState, useSyncExternalStore, type ReactNode, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { SeletorComparaCom, useComparaCom } from "../components/ComparaCom";

import { Abas } from "@/components/shared/Abas";
import { CabecalhoDaTela } from "@/components/shared/CabecalhoDaTela";
import { CampoBusca } from "@/components/shared/Filtros";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { useRegistrarAcessoTela } from "@/hooks/useRegistrarAcessoTela";

import { DetalheDialog } from "../../competencias/[anoMes]/dre/components/DetalheDialog";
import { InfoAgrupamento } from "../../competencias/[anoMes]/dre/components/InfoAgrupamento";
import { Agrupador, fundoDaLinha, fundoDoOrcado, ROTULO_DO_ORCADO, SeletorNivel, useNiveisDRE } from "../../competencias/[anoMes]/dre/components/NiveisDRE";
import { VolumesDialog } from "../../competencias/[anoMes]/dre/components/VolumesDialog";
import type { VisaoDetalhe } from "../../competencias/[anoMes]/dre/services/dreService";
import { ExportarRelatorio, type OpcaoExportar } from "../components/ExportarRelatorio";
import { SeletorPeriodo, useExercicios } from "../components/SeletorPeriodo";
import { TabelaLarga } from "../components/TabelaLarga";
import { formato, mensagemDeErro, relatoriosService, type Celula, type LinhaResultado, type MesRelatorio, type Resultados, type MarcacaoComparavel } from "../services/relatoriosService";

/** As visões da DRE, como as abas Resultados (…) da planilha, e os centros de custo. */
const VISOES = [
  { chave: "0", aba: "consolidado", nome: "Consolidado" },
  { chave: "1", aba: "matriz", nome: "Matriz" },
  { chave: "2", aba: "filial", nome: "Filial" },
  { chave: "3", aba: "servicos", nome: "Serviços" },
  { chave: "4", aba: "despesas", nome: "Despesas e Extra" },
  { chave: "5", aba: "rn", nome: "RN" },
  { chave: "centros", aba: "centros", nome: "Centros de Custo" },
  // Os movimentos que deveriam ter centro de custo e não têm (14/10/2026).
  { chave: "sem_centros", aba: "sem_centros", nome: "Sem Centros de Custo" },
  // As obras (centros 1.98 e 1.99), como a aba Obras da DRE (11/10/2026).
  { chave: "obras", aba: "obras", nome: "Obras" },
];

const Carregando = () => <div className="h-64 animate-pulse rounded-sm bg-gray-100" />;
const Erro = ({ erro, padrao }: { erro: unknown; padrao: string }) => (
  <div className="rounded-sm border border-red-200 bg-red-50 p-4">
    <p className="text-sm text-red-700">{mensagemDeErro(erro, padrao)}</p>
  </div>
);

/** Os valores sem casas decimais; os volumes (m³, kg, pistas, dias) com duas. */
const valorDa = (l: LinhaResultado, c: Celula) => (l.tipo === "SECAO" ? "" : c.valor === null ? "—" : l.volume ? formato.valor(c.valor) : formato.inteiro(c.valor));
/** Sem base (linhas de volume, contas sem R$/m³): em branco; base zerada: traço. */
const fracao = (l: LinhaResultado, v: number | null, temBase: boolean) => (l.tipo === "SECAO" || l.volume || !temBase ? "" : v === null ? "—" : formato.pct(v));
const unitario = (l: LinhaResultado, v: number | null) => (l.tipo === "SECAO" || l.volume || v === null ? "" : formato.valor(v));

/**
 * As linhas que abrem a consulta, como na DRE: os itens e os impostos abrem os
 * lançamentos de origem (se o usuário alcança as movimentações da linha); as
 * linhas de volume, as listas somadas por obra (fora dos centros de custo).
 */
const detalhavel = (l: LinhaResultado) => !l.volume && (l.tipo === "ITEM" || l.descricao === "Impostos Operacionais") && l.podeDetalhar !== false;
const listavel = (l: LinhaResultado, visao: VisaoDetalhe) => l.volume && l.tipo === "ITEM" && !("grupo" in visao);

/**
 * A tabela de uma visão: a descrição presa à esquerda e os rótulos presos no
 * topo, com rolagem própria nos dois sentidos (a tabela é larga). Cada mês tem
 * o valor e o %; o mês de referência (o último), também o R$/m³; no fim, o
 * total do exercício com o % e o R$/m³. Clicar no valor de um mês abre a
 * consulta daquele mês (os lançamentos ou as listas, como na DRE); clicar na
 * descrição, a do mês de referência. Sem `consultas` (os cenários, que não têm
 * lançamentos), nada abre.
 */
/**
 * Os meses anteriores ao de referência recolhidos ou não (12/10/2026): a escolha fica guardada neste navegador e vale
 * em todas as tabelas de Resultados. Começa expandido; sem armazenamento (janela privada), só não é lembrada. Lida por
 * useSyncExternalStore (13/10/2026; antes, um efeito): no servidor, expandido; as tabelas abertas mudam juntas.
 */
const CHAVE_MESES = "sig.resultados.mesesRecolhidos";
const ouvintesDosMeses = new Set<() => void>();
/** A escolha desta visita (vale também sem armazenamento); null: a guardada no navegador. */
let mesesRecolhidosNaMemoria: boolean | null = null;
function lerMesesRecolhidos() {
  if (mesesRecolhidosNaMemoria !== null) return mesesRecolhidosNaMemoria;
  try {
    return window.localStorage.getItem(CHAVE_MESES) === "1";
  } catch {
    return false; // sem armazenamento
  }
}
function useMesesRecolhidos(): [boolean, () => void] {
  const recolhido = useSyncExternalStore(
    (avisar) => {
      ouvintesDosMeses.add(avisar);
      return () => ouvintesDosMeses.delete(avisar);
    },
    lerMesesRecolhidos,
    () => false,
  );
  const alternar = () => {
    mesesRecolhidosNaMemoria = !recolhido;
    try {
      window.localStorage.setItem(CHAVE_MESES, recolhido ? "0" : "1");
    } catch {
      // sem armazenamento
    }
    ouvintesDosMeses.forEach((avisar) => avisar());
  };
  return [recolhido, alternar];
}

/** O botão ao lado dos níveis: a seta para a direita expande os meses anteriores; para a esquerda, recolhe. */
function BotaoMeses({ recolhido, onAlternar }: { recolhido: boolean; onAlternar: () => void }) {
  const rotulo = recolhido ? "Expandir os meses anteriores" : "Recolher os meses anteriores";
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onAlternar}
      aria-label={rotulo}
      aria-pressed={recolhido}
      title={rotulo}
      className="size-8 shrink-0 rounded-sm border-black/30 bg-white p-0"
    >
      {recolhido ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
    </Button>
  );
}

/**
 * O modo de edição da tabela (os cenários, 12/10/2026): a caixa de cada linha (a de um total marca as contas dele) e
 * a de cada mês; os valores marcados são os das contas e meses marcados. Clicar numa linha abre o reajuste dos
 * marcados; clicar no valor de uma conta, a edição daquele valor.
 */
export type EdicaoDaTabela = {
  editavel: (l: LinhaResultado) => boolean;
  linhasMarcadas: Set<string>;
  mesesMarcados: Set<number>;
  onMarcarLinhas: (codigos: string[], marcar: boolean) => void;
  onMarcarMes: (i: number, marcar: boolean) => void;
  onCelula: (l: LinhaResultado, i: number) => void;
  onConta: (l: LinhaResultado) => void;
};

/** Uma caixa de marcação com o estado "alguns" (traço). */
function Caixa({ marcada, alguns, rotulo, onMudar }: { marcada: boolean; alguns?: boolean; rotulo: string; onMudar: () => void }) {
  return (
    <input
      type="checkbox"
      aria-label={rotulo}
      title={rotulo}
      checked={marcada}
      ref={(el) => {
        if (el) el.indeterminate = !!alguns && !marcada;
      }}
      onChange={onMudar}
      onClick={(e) => e.stopPropagation()}
      className="size-3.5 shrink-0 cursor-pointer accent-black"
    />
  );
}

/** Os dois totais da ROL da estrutura (21/10/2026): o primeiro (no topo) sai da tabela quando o segundo está nela. */
const CODIGO_DO_PRIMEIRO_TOTAL_DA_ROL = "RO.RECEITA_OPERACIONAL_LIQUIDA_ROL";
const CODIGO_DA_ROL = "ROL.RECEITA_OPERACIONAL_LIQUIDA_ROL";

export function TabelaResultados({
  dados,
  titulo,
  visao,
  nomeVisao,
  aoLadoDoTitulo,
  consultas = true,
  edicao,
  doCenario = false,
}: {
  dados: Resultados;
  titulo: string;
  visao: VisaoDetalhe;
  nomeVisao: string;
  /** Conteúdo logo depois do título (o botão de informação do centro de custo), como na DRE. */
  aoLadoDoTitulo?: ReactNode;
  consultas?: boolean;
  /** O modo de edição (os cenários). */
  edicao?: EdicaoDaTabela;
  /**
   * Os Resultados de um cenário (13/10/2026): sem o R$/m³ do último mês (dezembro; o total do exercício o tem), e
   * recolhidos, sem nenhum mês (dezembro também), só a descrição e os totais — a tabela se estica e enche a tela.
   */
  doCenario?: boolean;
}) {
  // Sem o primeiro total da ROL (21/10/2026): ele repete o segundo (depois da receita bruta e dos impostos). Nas visões
  // com um só (Despesas e Extra e RN, a ROL do Consolidado no topo), ele fica.
  const linhasDaTabela = useMemo(
    () => (dados.linhas.some((l) => l.codigo === CODIGO_DA_ROL) ? dados.linhas.filter((l) => l.codigo !== CODIGO_DO_PRIMEIRO_TOTAL_DA_ROL) : dados.linhas),
    [dados.linhas],
  );
  const niveis = useNiveisDRE(linhasDaTabela, "sig.resultados.nivel");
  // Sem o R$/m³ em Despesas e Extra e no RN (21/10/2026).
  const comUnitario = !("unidade" in visao && (visao.unidade === 4 || visao.unidade === 5));
  // Na edição, as contas da linha que a caixa dela marca: ela mesma (se se edita) e as editáveis abaixo dela.
  const contasDaLinha = (l: LinhaResultado) => (edicao ? [l, ...niveis.abaixo(l)].filter(edicao.editavel).map((x) => x.codigo) : []);
  const [consulta, setConsulta] = useState<{ linha: LinhaResultado; mes: MesRelatorio } | null>(null);
  const temPct = (l: LinhaResultado) => !l.volume && (l.meses.some((c) => c.pct !== null) || l.total.pct !== null);
  const ano = String(dados.ano).slice(2);
  const referencia = dados.meses.length - 1;
  // Recolhidos, só o mês de referência fica (com o orçado dele), antes dos totais. Na edição dos cenários também
  // (13/10/2026): os meses marcados e escondidos continuam marcados (a barra de marcação mostra quantos).
  const [recolhido, alternarMeses] = useMesesRecolhidos();
  const mostra = (i: number) => !recolhido || (i === referencia && !doCenario);
  // O R$/m³ do mês de referência (Resultados Empresariais); nos cenários, só no total.
  const unitarioNoMes = !doCenario && comUnitario;
  // O mês de referência da descrição: o último apurado.
  const ultimoApurado = [...dados.meses].reverse().find((m) => m.apurado) ?? null;
  const abre = (l: LinhaResultado) => consultas && (detalhavel(l) || listavel(l, visao));
  // O orçado (só nas visões de Resultados Empresariais): depois do mês de referência e depois do total, o orçado (valor, % e
  // R$/m³, em cinza); só depois do total, a variação (em amarelo): a diferença, o atingimento e a eficiência.
  const comOrcado = dados.linhas.some((l) => l.orcado !== undefined);
  // Nos cenários (13/10/2026), o cenário comparado no lugar do orçado: só depois do total (os 12 meses se olham inteiros).
  const comOrcadoNoMes = comOrcado && !dados.comparado;
  // O nome do comparado (21/10/2026): "ORÇADO" no Orçamento Empresarial; nos outros cenários do Compara Com, o nome da marcação.
  const ROTULO = (dados.rotuloComparado ?? "Orçado").toUpperCase();
  const rotuloDoOrcadoTotal = dados.comparado ? `COMPARADO TOTAL/${String(dados.comparado.ano).slice(2)}` : `${ROTULO} TOTAL/${ano}`;
  const orcadoDa = (l: LinhaResultado, v: number | undefined) => (l.tipo === "SECAO" || v === undefined ? "" : l.volume ? formato.valor(v) : formato.inteiro(v));
  /** O texto com o sinal: + nos positivos (o − dos negativos vem do formato); o que arredonda para zero fica sem sinal. */
  const comSinal = (v: number, texto: string) => (v > 0 && /[1-9]/.test(texto) ? `+${texto}` : texto);
  /** Diferença: o realizado menos o orçado, com o sinal. */
  const diferenca = (l: LinhaResultado, r: Celula, o: Celula | undefined) => {
    if (l.tipo === "SECAO" || !o) return "";
    if (r.valor === null || o.valor === null) return "—";
    const d = r.valor - o.valor;
    return comSinal(d, l.volume ? formato.valor(d) : formato.inteiro(d));
  };
  /** Atingimento: o realizado sobre o orçado, em percentual (orçado zero: traço). */
  const atingimento = (l: LinhaResultado, r: Celula, o: Celula | undefined) =>
    l.tipo === "SECAO" || !o ? "" : r.valor === null || !o.valor ? "—" : formato.pct(r.valor / o.valor);
  /** Eficiência: o % realizado menos o % orçado, em pontos percentuais, com o sinal (só nas linhas com %). */
  const eficiencia = (l: LinhaResultado, r: Celula, o: Celula | undefined) => {
    if (l.tipo === "SECAO" || l.volume || !o || !temPct(l)) return "";
    if (r.pct === null || o.pct === null) return "—";
    const pp = (r.pct - o.pct) * 100;
    return `${comSinal(pp, formato.umaCasa(pp))} p.p.`;
  };
  // Colunas estreitas (12/10/2026): numa tela de 1920 px, o mês de referência, o orçado dele, os totais, o orçado
  // total e as variações cabem juntos; os rótulos do orçado quebram em duas linhas (ORÇADO / MAR/26).
  const LARGURAS_DO_ORCADO = comUnitario ? [100, 52, 64] : [100, 52];
  const LARGURAS_DA_VARIACAO = [96, 96, 84];
  const th = "px-1.5 py-2 text-right text-xs font-bold whitespace-nowrap text-gray-900";
  const anoMes = (m: MesRelatorio) => `${dados.ano}-${String(m.mes).padStart(2, "0")}`;
  // Descrição; em cada mês, o valor e o % (e o R$/m³ no de referência); o total com o % e o R$/m³.
  // A descrição sem quebra de linha, em 420 px: com os meses anteriores recolhidos, a descrição, o mês, o orçado dele,
  // os totais, o orçado total e as variações enchem uma tela de 1920 px. As poucas mais longas (RECEITAS FINANCERIAS
  // NÃO CORRENTES (RFNC) (+)) terminam em reticências, com o nome inteiro na dica.
  const larguras = [
    420,
    ...dados.meses.flatMap((_, i) => (!mostra(i) ? [] : i === referencia ? [96, 52, ...(unitarioNoMes ? [64] : []), ...(comOrcadoNoMes ? LARGURAS_DO_ORCADO : [])] : [96, 52])),
    104,
    52,
    ...(comUnitario ? [64] : []),
    ...(comOrcado ? [104, ...LARGURAS_DO_ORCADO.slice(1), ...LARGURAS_DA_VARIACAO] : []),
  ];
  /** Os rótulos do orçado (pretos) e, nos totais, da variação (amarelo-ouro, como os demais). */
  const rotulosDoOrcado = (rotulo: string, variacao: boolean) => (
    <>
      <th className={`${th} ${ROTULO_DO_ORCADO} !whitespace-normal leading-tight`} title={dados.comparado && variacao ? `O total de ${dados.comparado.nome}` : undefined}>
        {rotulo}
      </th>
      <th className={`${th} ${ROTULO_DO_ORCADO}`}>%</th>
      {comUnitario ? <th className={`${th} ${ROTULO_DO_ORCADO}`}>R$/m³</th> : null}
      {variacao ? (
        <>
          <th className={`${th} border-l border-gray-300`}>DIFERENÇA</th>
          <th className={th}>ATINGIMENTO</th>
          <th className={th}>EFICIÊNCIA</th>
        </>
      ) : null}
    </>
  );
  return (
    <div>
      <TabelaLarga
        larguras={larguras}
        cabecalho={
          <tr className="border-b border-gray-300">
            <th className="left-0 !z-20 px-3 py-2 text-left">
              <span className="flex items-center gap-3">
                <span className="flex shrink-0 items-center gap-1.5">
                  <SeletorNivel nivel={niveis.nivelGeral} onEscolher={niveis.escolherNivel} />
                  {dados.meses.length > 1 ? <BotaoMeses recolhido={recolhido} onAlternar={alternarMeses} /> : null}
                </span>
                <span className="truncate text-sm font-bold tracking-wide whitespace-nowrap text-gray-900 uppercase" title={titulo}>
                  {titulo}
                </span>
                {aoLadoDoTitulo}
              </span>
            </th>
            {dados.meses.map((m, i) =>
              !mostra(i) ? null : (
              <Fragment key={m.mes}>
                <th className={`${th} border-l border-gray-300`}>
                  {edicao ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Caixa
                        marcada={edicao.mesesMarcados.has(i)}
                        rotulo={`Marcar ${m.rotulo}`}
                        onMudar={() => edicao.onMarcarMes(i, !edicao.mesesMarcados.has(i))}
                      />
                      {m.rotulo}
                    </span>
                  ) : (
                    m.rotulo
                  )}
                </th>
                <th className={th}>%</th>
                {i === referencia && unitarioNoMes ? <th className={th}>R$/m³</th> : null}
                {i === referencia && comOrcadoNoMes ? rotulosDoOrcado(`${ROTULO} ${m.rotulo}`, false) : null}
              </Fragment>
              ),
            )}
            <th className={`${th} border-l border-gray-300`}>TOTAL/{ano}</th>
            <th className={th}>%</th>
            {comUnitario ? <th className={th}>R$/m³</th> : null}
            {comOrcado ? rotulosDoOrcado(rotuloDoOrcadoTotal, true) : null}
          </tr>
        }
        corpo={niveis.linhas.filter(niveis.visivel).map((l) => {
            const destaque = l.tipo !== "ITEM";
            const fundo = fundoDaLinha(l);
            const td = "px-1.5 py-1.5 text-right whitespace-nowrap";
            const pct = `${td} text-xs ${destaque ? "text-gray-700" : "text-gray-500"}`;
            const clicavel = abre(l);
            const contas = contasDaLinha(l);
            const marcadas = contas.filter((c) => edicao?.linhasMarcadas.has(c)).length;
            const pctOrcado = `${td} text-xs ${destaque ? "text-gray-700" : "text-gray-500"}`;
            // O orçado (valor, % e R$/m³, no cinza) e, nos totais, a variação contra o realizado (no amarelo da linha).
            const celulasDoOrcado = (l: LinhaResultado, r: Celula, o: Celula | undefined, variacao: boolean) => (
              <>
                <td className={`${td} ${fundoDoOrcado(l)}`}>{orcadoDa(l, o?.valor ?? undefined)}</td>
                <td className={`${pctOrcado} ${fundoDoOrcado(l)}`}>{o ? fracao(l, o.pct, temPct(l)) : ""}</td>
                {comUnitario ? <td className={`${pctOrcado} ${fundoDoOrcado(l)}`}>{o ? unitario(l, o.unitario) : ""}</td> : null}
                {variacao ? (
                  <>
                    <td className={`${td} border-l border-gray-100 ${fundo}`}>{diferenca(l, r, o)}</td>
                    <td className={`${td} ${fundo}`}>{atingimento(l, r, o)}</td>
                    <td className={`${td} ${fundo}`}>{eficiencia(l, r, o)}</td>
                  </>
                ) : null}
              </>
            );
            const dica = (m: MesRelatorio) => (detalhavel(l) ? `Ver os lançamentos de origem de ${m.rotulo}` : `Ver as listas por obra de ${m.rotulo}`);
            return (
              <tr key={l.codigo} className={destaque ? "border-y border-gray-300 font-bold" : "border-t border-gray-100"}>
                <td
                  className={`sticky left-0 z-10 overflow-hidden py-1.5 pr-3 whitespace-nowrap ${fundo} ${niveis.recuo(l)} ${destaque ? "text-gray-900" : "text-gray-700"} ${(edicao ? contas.length > 0 : clicavel && ultimoApurado) ? "cursor-pointer hover:bg-gray-100" : ""}`}
                  onClick={
                    edicao ? (contas.length ? () => edicao.onConta(l) : undefined) : clicavel && ultimoApurado ? () => setConsulta({ linha: l, mes: ultimoApurado }) : undefined
                  }
                  title={edicao ? (contas.length ? "Reajustar os valores marcados" : undefined) : clicavel && ultimoApurado ? dica(ultimoApurado) : undefined}
                >
                  <span className="flex min-w-0 items-center gap-1">
                    {edicao ? (
                      contas.length ? (
                        <Caixa
                          marcada={marcadas === contas.length}
                          alguns={marcadas > 0}
                          rotulo={`Marcar ${l.descricao}`}
                          onMudar={() => edicao.onMarcarLinhas(contas, marcadas < contas.length)}
                        />
                      ) : (
                        <span aria-hidden className="inline-block size-3.5 shrink-0" />
                      )
                    ) : null}
                    <Agrupador grupo={niveis.grupo(l)} fechado={niveis.fechado(l)} onAlternar={() => niveis.alternar(l.codigo)} />
                    {clicavel ? <Search className="size-3.5 shrink-0 text-gray-400" /> : null}
                    <span className="truncate" title={l.descricao}>
                      {l.descricao}
                    </span>
                  </span>
                </td>
                {l.meses.map((c, i) => {
                  if (!mostra(i)) return null;
                  const m = dados.meses[i];
                  const abreMes = clicavel && m.apurado && c.valor !== null;
                  // Na edição, o valor de uma conta abre a edição dele; o marcado (conta e mês) fica contornado.
                  const editaMes = !!edicao && edicao.editavel(l);
                  const marcado = editaMes && edicao!.linhasMarcadas.has(l.codigo) && edicao!.mesesMarcados.has(i);
                  return (
                    <Fragment key={i}>
                      <td
                        className={`${td} border-l border-gray-100 ${fundo} ${abreMes || editaMes ? "cursor-pointer hover:bg-gray-100" : ""} ${marcado ? "shadow-[inset_0_0_0_2px_rgba(0,0,0,0.55)]" : ""}`}
                        onClick={editaMes ? () => edicao!.onCelula(l, i) : abreMes ? () => setConsulta({ linha: l, mes: m }) : undefined}
                        title={editaMes ? `Editar ${m.rotulo}` : abreMes ? dica(m) : undefined}
                      >
                        {valorDa(l, c)}
                      </td>
                      <td className={`${pct} ${fundo}`}>{fracao(l, c.pct, temPct(l))}</td>
                      {i === referencia && unitarioNoMes ? <td className={`${pct} ${fundo}`}>{unitario(l, c.unitario)}</td> : null}
                      {i === referencia && comOrcadoNoMes ? celulasDoOrcado(l, c, l.orcado?.mes, false) : null}
                    </Fragment>
                  );
                })}
                <td className={`${td} border-l border-gray-300 ${fundo}`}>{valorDa(l, l.total)}</td>
                <td className={`${pct} ${fundo}`}>{fracao(l, l.total.pct, temPct(l))}</td>
                {comUnitario ? <td className={`${pct} ${fundo}`}>{unitario(l, l.total.unitario)}</td> : null}
                {comOrcado ? celulasDoOrcado(l, l.total, l.orcado?.total, true) : null}
              </tr>
            );
          })}
      />
      {consulta && detalhavel(consulta.linha) ? (
        <DetalheDialog anoMes={anoMes(consulta.mes)} linha={consulta.linha.codigo} visao={visao} rotuloMes={consulta.mes.rotulo} onFechar={() => setConsulta(null)} />
      ) : null}
      {consulta && listavel(consulta.linha, visao) ? (
        <VolumesDialog
          anoMes={anoMes(consulta.mes)}
          linha={consulta.linha.codigo}
          unidade={"unidade" in visao ? visao.unidade : undefined}
          nomeVisao={nomeVisao}
          rotuloMes={consulta.mes.rotulo}
          valorApurado={(() => {
            const v = consulta.linha.meses[dados.meses.indexOf(consulta.mes)]?.valor;
            return v === null || v === undefined ? null : String(v);
          })()}
          onFechar={() => setConsulta(null)}
        />
      ) : null}
    </div>
  );
}

/** Os centros de custo: a lista dos agrupamentos à esquerda, como na DRE, e a tabela do escolhido. */
const chaveCentros = (ano: number, ate: number) => ["relatorios", "resultados", ano, ate, "centros"];

/** O centro escolhido vale enquanto existir no período; senão, o primeiro da lista. */
function useCentroEscolhido(ano: number, ate: number, ativo: boolean, escolhido: string | null) {
  const grupos = useQuery({ queryKey: chaveCentros(ano, ate), queryFn: () => relatoriosService.centros(ano, ate), enabled: ativo });
  const lista = grupos.data?.grupos ?? [];
  return { grupos, lista, grupo: (escolhido && lista.some((g) => g.grupo === escolhido) ? escolhido : lista[0]?.grupo) ?? null };
}

function VisaoCentros({ ano, ate, escolhido, onEscolher }: { ano: number; ate: number; escolhido: string | null; onEscolher: (g: string) => void }) {
  const [busca, setBusca] = useState("");
  const { grupos, lista, grupo } = useCentroEscolhido(ano, ate, true, escolhido);
  const centro = useQuery({
    queryKey: ["relatorios", "resultados", ano, ate, "centros", grupo],
    queryFn: () => relatoriosService.centro(ano, ate, grupo!),
    enabled: grupo !== null,
  });
  if (grupos.isError) return <Erro erro={grupos.error} padrao="Erro ao carregar os centros de custo." />;
  if (grupos.isPending) return <Carregando />;
  if (lista.length === 0) return <p className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">Nenhum centro de custo com valor no período.</p>;
  const t = busca.trim().toLowerCase();
  const filtrados = lista.filter((g) => !t || g.grupo.toLowerCase().includes(t));
  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
      <div className="rounded-sm border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-2">
          <CampoBusca rotulo="Buscar centro de custo" valor={busca} onMudar={setBusca} placeholder="Centro de Custo…" largura="w-full" />
        </div>
        <ul className="max-h-[60vh] overflow-y-auto py-1" aria-label="Centros de custo">
          {filtrados.map((g) => (
            <li key={g.grupo}>
              <button
                type="button"
                onClick={() => onEscolher(g.grupo)}
                aria-current={g.grupo === grupo ? "true" : undefined}
                className={`flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left text-sm ${g.grupo === grupo ? "bg-black text-white" : "text-gray-800 hover:bg-gray-100"}`}
              >
                <span className="min-w-0 truncate" title={g.grupo}>
                  {g.grupo}
                </span>
              </button>
            </li>
          ))}
          {filtrados.length === 0 ? <li className="px-3 py-2 text-sm text-gray-500">Nenhum centro com esse nome.</li> : null}
        </ul>
      </div>
      <div className="min-w-0">
        {centro.isError ? (
          <Erro erro={centro.error} padrao="Erro ao carregar o centro de custo." />
        ) : centro.isPending ? (
          <Carregando />
        ) : (
          <TabelaResultados
            key={grupo ?? ""}
            dados={centro.data}
            titulo={grupo ?? ""}
            visao={{ grupo: grupo! }}
            nomeVisao={grupo ?? ""}
            aoLadoDoTitulo={<InfoAgrupamento grupo={grupo ?? ""} centros={centro.data.centros ?? []} periodo="no período" />}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Os movimentos sem centro de custo (14/10/2026): os lançamentos das contas de mão de obra e de gastos gerais (MOD, MOI,
 * GGD, GGI e GGC) sem centro do cadastro, como na referência dos cenários analíticos, por departamento (e filial). A
 * lista à esquerda, como os centros, e a tabela do escolhido.
 */
function VisaoSemCentros({ ano, ate, escolhido, onEscolher: setEscolhido }: { ano: number; ate: number; escolhido: string | null; onEscolher: (g: string) => void }) {
  const { lista, codigo } = useSemCentroEscolhido(ano, ate, true, escolhido);
  const grupos = lista.data?.grupos ?? [];
  const nome = grupos.find((g) => g.codigo === codigo)?.nome ?? "";
  const grupo = useQuery({ queryKey: ["relatorios", "resultados", ano, ate, "sem_centros", codigo], queryFn: () => relatoriosService.semCentro(ano, ate, codigo!), enabled: codigo !== null });
  if (lista.isError) return <Erro erro={lista.error} padrao="Erro ao carregar os movimentos sem centro de custo." />;
  if (lista.isPending) return <Carregando />;
  if (grupos.length === 0) return <p className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">Nenhum movimento sem centro de custo no período.</p>;
  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
      <div className="rounded-sm border border-gray-200 bg-white">
        <ul className="max-h-[60vh] overflow-y-auto py-1" aria-label="Grupos sem centro de custo">
          {grupos.map((g) => (
            <li key={g.codigo}>
              <button
                type="button"
                onClick={() => setEscolhido(g.codigo)}
                aria-current={g.codigo === codigo ? "true" : undefined}
                className={`flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left text-sm ${g.codigo === codigo ? "bg-black text-white" : "text-gray-800 hover:bg-gray-100"}`}
              >
                <span className="min-w-0 truncate" title={g.nome}>
                  {g.nome}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="min-w-0">
        {grupo.isError ? (
          <Erro erro={grupo.error} padrao="Erro ao carregar os movimentos sem centro de custo." />
        ) : grupo.isPending ? (
          <Carregando />
        ) : (
          <TabelaResultados key={codigo ?? ""} dados={grupo.data} titulo={nome} visao={{ semCentro: codigo! }} nomeVisao={nome} />
        )}
      </div>
    </div>
  );
}

/** As obras: a lista à esquerda (nome, código e o total do exercício), como os centros de custo, e a tabela da escolhida. */
/** O grupo sem centro escolhido (o primeiro da lista, sem escolha): a lista e o código, também para o Exportar. */
function useSemCentroEscolhido(ano: number, ate: number, ativo: boolean, escolhido: string | null) {
  const lista = useQuery({ queryKey: ["relatorios", "resultados", ano, ate, "sem_centros"], queryFn: () => relatoriosService.semCentros(ano, ate), enabled: ativo });
  const grupos = lista.data?.grupos ?? [];
  const codigo = (escolhido && grupos.some((g) => g.codigo === escolhido) ? escolhido : grupos[0]?.codigo) ?? null;
  return { lista, codigo };
}

/** A obra escolhida (a primeira da lista, sem escolha): a lista e o código, também para o Exportar. */
function useObraEscolhida(ano: number, ate: number, ativo: boolean, escolhida: string | null) {
  const lista = useQuery({ queryKey: ["relatorios", "resultados", ano, ate, "obras"], queryFn: () => relatoriosService.obras(ano, ate), enabled: ativo });
  const obras = lista.data?.obras ?? [];
  const codigo = (escolhida && obras.some((o) => o.codigo === escolhida) ? escolhida : obras[0]?.codigo) ?? null;
  return { lista, codigo };
}

function VisaoObras({ ano, ate, escolhida, onEscolher: setEscolhida }: { ano: number; ate: number; escolhida: string | null; onEscolher: (o: string) => void }) {
  const [busca, setBusca] = useState("");
  const { lista, codigo } = useObraEscolhida(ano, ate, true, escolhida);
  const obras = lista.data?.obras ?? [];
  const obra = useQuery({ queryKey: ["relatorios", "resultados", ano, ate, "obras", codigo], queryFn: () => relatoriosService.obra(ano, ate, codigo!), enabled: codigo !== null });
  if (lista.isError) return <Erro erro={lista.error} padrao="Erro ao carregar as obras." />;
  if (lista.isPending) return <Carregando />;
  if (obras.length === 0) return <p className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">Nenhuma obra com lançamento no período.</p>;
  const t = busca.trim().toLowerCase();
  const filtradas = obras.filter((o) => !t || o.nome.toLowerCase().includes(t) || o.codigo.includes(t));
  const nome = obras.find((o) => o.codigo === codigo)?.nome ?? codigo ?? "";
  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
      <div className="rounded-sm border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-2">
          <CampoBusca rotulo="Buscar obra" valor={busca} onMudar={setBusca} placeholder="Obra ou código…" largura="w-full" />
        </div>
        <ul className="max-h-[60vh] overflow-y-auto py-1" aria-label="Obras">
          {filtradas.map((o) => (
            <li key={o.codigo}>
              <button
                type="button"
                onClick={() => setEscolhida(o.codigo)}
                aria-current={o.codigo === codigo ? "true" : undefined}
                className={`block w-full px-3 py-1.5 text-left text-sm ${o.codigo === codigo ? "bg-black text-white" : "text-gray-800 hover:bg-gray-100"}`}
              >
                <span className="block truncate" title={o.nome}>
                  {o.nome}
                </span>
                <span className={`block text-xs ${o.codigo === codigo ? "text-white/70" : "text-gray-500"}`}>{o.codigo}</span>
              </button>
            </li>
          ))}
          {filtradas.length === 0 ? <li className="px-3 py-2 text-sm text-gray-500">Nenhuma obra com esse nome.</li> : null}
        </ul>
      </div>
      <div className="min-w-0">
        {obra.isError ? (
          <Erro erro={obra.error} padrao="Erro ao carregar a obra." />
        ) : obra.isPending ? (
          <Carregando />
        ) : (
          <TabelaResultados key={codigo ?? ""} dados={obra.data} titulo={`${nome} (${codigo})`} visao={{ obra: codigo! }} nomeVisao={nome} />
        )}
      </div>
    </div>
  );
}

function VisaoUnidade({ ano, ate, visao, nome, comparaCom }: { ano: number; ate: number; visao: number; nome: string; comparaCom: MarcacaoComparavel }) {
  const consulta = useQuery({ queryKey: ["relatorios", "resultados", ano, ate, "visao", visao, comparaCom], queryFn: () => relatoriosService.resultados(ano, ate, visao, comparaCom) });
  if (consulta.isError) return <Erro erro={consulta.error} padrao="Erro ao carregar os resultados." />;
  if (consulta.isPending) return <Carregando />;
  return <TabelaResultados key={visao} dados={consulta.data} titulo={`Resultados · ${nome}`} visao={visao === 0 ? { consolidado: true } : { unidade: visao }} nomeVisao={nome} />;
}

export function ResultadosContent() {
  useRegistrarAcessoTela("/relatorios/resultados");
  const exercicios = useExercicios();
  // O Coordenador (recorte por centro de custo) vê a aba Obras só com a opção marcada no cadastro dele.
  const { user } = useAuth();
  const comObras = !user?.acesso.recorteCentro || user.acesso.recorteDepartamento || !!user.acesso.veObras;
  // Os movimentos sem centro de custo não aparecem para o Coordenador (só os centros dele).
  const comSemCentros = !user?.acesso.recorteCentro || user.acesso.recorteDepartamento;
  // As abas que o perfil lê (14/10/2026).
  const { hasPermission } = usePermissions();
  const le = (aba: string) => hasPermission(`relatorio_resultados.${aba}:ler`);
  const visoes = VISOES.filter((v) => (v.chave !== "obras" || comObras) && (v.chave !== "sem_centros" || comSemCentros) && le(v.aba));
  const [anoEscolhido, setAno] = useState<number | null>(null);
  const [ateEscolhido, setAte] = useState<number | null>(null);
  const [visaoEscolhida, setVisao] = useState("0");
  const visao = visoes.some((v) => v.chave === visaoEscolhida) ? visaoEscolhida : (visoes[0]?.chave ?? "");
  // O centro escolhido fica aqui: o Exportar dele vai para a linha das abas, como nas demais visões.
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const ano = anoEscolhido ?? exercicios.anos[0];
  const meses = ano ? exercicios.mesesDe(ano) : [];
  // O mês escolhido vale se foi apurado no exercício; senão, o último apurado.
  const ate = ateEscolhido && meses.includes(ateEscolhido) ? ateEscolhido : meses[meses.length - 1];
  const { grupo } = useCentroEscolhido(ano ?? 0, ate ?? 0, visao === "centros" && !!ano && !!ate, escolhido);
  // A obra e o grupo sem centro escolhidos ficam aqui, como o centro: o Exportar deles vai para a linha das abas.
  const [obra, setObra] = useState<string | null>(null);
  const [semCentro, setSemCentro] = useState<string | null>(null);
  const { codigo: obraEscolhida } = useObraEscolhida(ano ?? 0, ate ?? 0, visao === "obras" && !!ano && !!ate, obra);
  const { codigo: semCentroEscolhido } = useSemCentroEscolhido(ano ?? 0, ate ?? 0, visao === "sem_centros" && !!ano && !!ate, semCentro);
  const periodo = { ano, ate };
  // O Exportar (14/10/2026: na altura do título, com as opções de todas as abas): o que está na tela (a visão, o centro,
  // o grupo sem centro ou a obra escolhidos) e os "todos" de cada aba que o perfil lê.
  const veObrasNaAba = comObras && le("obras");
  const veSemCentrosNaAba = comSemCentros && le("sem_centros");
  const atual: OpcaoExportar | null =
    visao === "centros"
      ? grupo
        ? { chave: "atual", excel: "Centro de Custo Atual", pdf: "Centro de Custo Atual", params: { ...periodo, grupo } }
        : null
      : visao === "obras"
        ? obraEscolhida
          ? { chave: "atual", excel: "Obra Atual", pdf: "Obra Atual", params: { ...periodo, visao: "obras", obra: obraEscolhida } }
          : null
        : visao === "sem_centros"
          ? semCentroEscolhido
            ? { chave: "atual", excel: "Sem Centro de Custo Atual", pdf: "Sem Centro de Custo Atual", params: { ...periodo, visao: "sem_centros", grupo: semCentroEscolhido } }
            : null
          : visao
            ? { chave: "atual", excel: "Visão Atual", pdf: "Visão Atual", params: { ...periodo, visao } }
            : null;
  const opcoesExportar: OpcaoExportar[] = [
    ...(atual ? [atual] : []),
    // Todas as unidades pedem as seis abas; os centros, as obras e os sem centro, a deles.
    ...(VISOES.slice(0, 6).every((v) => le(v.aba)) ? [{ chave: "unidades", excel: "Todas as Unidades (uma por aba)", pdf: "Todas as Unidades (uma por página)", params: { ...periodo, escopo: "unidades" } }] : []),
    ...(le("centros")
      ? [
          { chave: "centros", excel: "Todos os Centros de Custo (um por aba)", pdf: "Todos os Centros de Custo (um por página)", params: { ...periodo, escopo: "centros" } },
          { chave: "centros_arquivos", excel: "Todos os Centros de Custo (um arquivo por centro)", pdf: null, params: { ...periodo, escopo: "centros_arquivos" } },
        ]
      : []),
    ...(veSemCentrosNaAba ? [{ chave: "sem_centros", excel: "Todas Sem Centro de Custo (uma por aba)", pdf: "Todas Sem Centro de Custo (uma por página)", params: { ...periodo, escopo: "sem_centros" } }] : []),
    ...(veObrasNaAba ? [{ chave: "obras", excel: "Todas as Obras (uma por aba)", pdf: "Todas as Obras (uma por página)", params: { ...periodo, escopo: "obras" } }] : []),
  ];

  const comparacao = useComparaCom(ano ?? null);
  return (
    <div className="space-y-6">
      <CabecalhoDaTela
        titulo="Resultados"
        comoUsar={
          <ul>
            <li>Escolha o exercício e o mês até onde ver; só as competências fechadas aparecem (os meses abertos ou em conferência ficam de fora).</li>
            <li>Escolha a visão nas abas: Consolidado, cada unidade, Centros de Custo (com a lista dos centros à esquerda), Sem Centros de Custo ou Obras (com a lista das obras à esquerda, com o código e a busca por nome ou código). Aparecem só as abas que o seu perfil lê (Controle de Usuários / Perfis).</li>
            <li>
              Em Sem Centros de Custo, os lançamentos do balancete que deveriam ter um centro de custo e não têm um do cadastro, pela regra da
              referência dos cenários analíticos: os das contas de mão de obra direta e indireta e de gastos gerais diretos, indiretos e comerciais
              (os de obra, nos centros 1.98 e 1.99, também entram). A lista à esquerda traz Produção (Matriz e Filial), Despesas Variáveis de Venda
              (Matriz e Filial), Serviços, Logística, Técnico, Comercial e Administrativo — só os que têm lançamento no período —, pelo departamento
              da conta na DRE e, na Produção e na DVV, pela filial do lançamento. Clique no valor de um mês para ver os lançamentos. Os Gastos Gerais
              Variáveis ficam de fora (nos cenários, vêm das premissas). “Exportar” baixa o grupo na tela ou todos (um por aba no Excel, um por página no PDF); o Coordenador não vê a aba.
            </li>
            <li>Em Obras, cada obra mostra a DRE dos lançamentos dos centros de obra (1.98 e 1.99) mês a mês, como a aba Obras da DRE, com o % sobre a receita da própria obra (a ROB nas receitas e nos impostos, a ROL no resto). No recorte por departamento ou por centro de custo, só as linhas que o usuário alcança (o Coordenador, com a opção de ver as obras no cadastro, as da gestão dele). “Exportar” baixa a obra na tela ou todas (uma por aba no Excel, uma por página no PDF).</li>
            <li>O botão de seta ao lado do menu de níveis recolhe (seta para a esquerda) ou expande (seta para a direita) os meses anteriores ao escolhido. Recolhidos, a tabela mostra só as contas, o mês (realizado e orçado), os totais (realizado e orçado) e as variações; a escolha fica guardada neste navegador.</li>
            <li>A barra de rolagem lateral (a do navegador, como na tabela de Indicadores) fica presa no pé da janela enquanto a tabela está na tela; também dá para rolar com Shift + roda do mouse.</li>
            <li>Expandida, role a tabela para os lados até o mês escolhido: dele em diante, o orçado do mês, os totais, o orçado total e as variações cabem na tela. As descrições mais longas terminam em reticências; passe o mouse para lê-las inteiras.</li>
            <li>No menu de níveis (a seta antes do título da tabela), escolha Totais, Atribuições ou Contas; a seta de cada total ou atribuição abre e fecha só aquele grupo.</li>
            <li>A tabela rola para os lados: a descrição e os rótulos ficam presos. O mês de referência (o último) e o total do exercício trazem também o valor por m³.</li>
            <li>
              Nas unidades e no Consolidado, as colunas de rótulo preto trazem o orçado (valor, % e R$/m³): depois do mês de referência, o do mês;
              depois do total, o acumulado de janeiro até ele. Depois do orçado acumulado, a variação: Diferença (realizado − orçado), Atingimento (realizado ÷
              orçado) e Eficiência (% realizado − % orçado, em pontos percentuais). O orçado é o do cenário escolhido em “Compara Com”, ao lado do
              período, entre os cenários marcados do exercício (Orçamento Empresarial, o padrão, Resultados Anteriores, Resultados Vendidos e Previsão, em
              Criação de Cenários); fora do Orçamento Empresarial, as colunas trazem o nome da marcação (PREVISÃO AGO/26…). Sem cenário, zero. A escolha vale
              também no Painel de Bordo. Os centros de custo não têm orçado.
            </li>
            <li>Clique no valor de um mês, numa linha com lupa, para ver os lançamentos de origem daquele mês (ou, nas linhas de volume, as listas somadas por obra); clicar na descrição abre o mês de referência.</li>
            <li>
              No extrato, clique na conta de um lançamento contábil para ver o balancete dela no mês (o modal Balancete): os movimentos da aba
              Balancete (Lista) do LISTAS REALIZADO (RESULTADOS), com a emissão, o cliente ou fornecedor e o histórico de cada um. Abre no centro
              de custo e na filial do lançamento, com a soma ao lado do valor dele; desmarque a caixa para ver a conta inteira.
            </li>
            <li>
              No extrato, o lançamento reclassificado (Cadastros da Apuração / Reclassificações) mostra a conta corrigida, a que vale na DRE, com
              “(Corrigida de: …)” e a conta do balancete em vermelho.
            </li>
            <li>
              “Exportar”, ao lado do período, baixa em Excel (todas as colunas) ou PDF (A4 deitada: cada mês com a participação embaixo, e o total com o %
              e o R$/m³) o que está na tela (a Visão, o Centro de Custo, o Sem Centro de Custo ou a Obra Atual) e, de qualquer aba, todas as unidades,
              todos os centros de custo, todas sem centro de custo e todas as obras (uma por aba ou por página). Em Excel, também um arquivo por centro de
              custo, num ZIP, com o departamento e o centro no nome de cada arquivo.
            </li>
          </ul>
        }
        sobre={
          <>
            <p>
              As visões da DRE mês a mês no exercício, como as abas Resultados do BASE REALIZADO (RESULTADOS): o valor e a participação (%) de
              cada mês e o total do exercício; o mês de referência e o total trazem também o valor unitário (R$/m³). Os valores são os apurados (congelados) de cada
              competência fechada: as abertas e em conferência não entram em Resultados Empresariais.
            </p>
            <p>
              A participação é sobre a ROB nas receitas e nos impostos; sobre a Receita Líquida do Pré-Fabricado nos custos de produção
              (também na Filial); sobre a Receita Líquida de Montagem e a Complementar nos custos de serviços; sobre a Receita Líquida de Frete
              no Frete e Descarga; e sobre a ROL no resto. O valor unitário divide a receita e os custos do pré-fabricado pela produção (m³) e os
              de montagem pela montagem (m³). Em Despesas e Extra, no RN e nos centros de custo, as bases são as do Consolidado.
            </p>
            <p>Nos centros de custo, cada mês mostra o mesmo recorte da DRE: os custos e despesas de mão de obra, gastos gerais e depreciação.</p>
          </>
        }
        acoes={
          ano && ate ? (
            <div className="flex flex-wrap items-center justify-end gap-3">
            <SeletorPeriodo
              ano={ano}
              ate={ate}
              anos={exercicios.anos}
              meses={meses}
              onAno={(a) => {
                setAno(a);
                setAte(null);
              }}
              onAte={setAte}
            />
            {/* O cenário comparado (21/10/2026), entre os marcados do exercício. */}
            <SeletorComparaCom valor={comparacao.comparaCom} opcoes={comparacao.opcoes} onMudar={comparacao.mudar} />
            {opcoesExportar.length && visoes.length ? <ExportarRelatorio caminho="resultados" opcoes={opcoesExportar} padrao={`Resultados ${ano}`} /> : null}
            </div>
          ) : null
        }
      />

      {exercicios.carregando ? (
        <Carregando />
      ) : !ano || !ate ? (
        <p className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">Nenhuma competência fechada ainda.</p>
      ) : (
        <>
          {!visoes.length ? (
            <p className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">Seu perfil não tem acesso a nenhuma aba desta tela.</p>
          ) : null}
          <div className="flex items-end gap-3" hidden={!visoes.length}>
            <div className="min-w-0 flex-1">
              <Abas rotulo="Visão dos resultados" ativa={visao} onMudar={setVisao} abas={visoes.map((v) => ({ chave: v.chave, rotulo: v.nome }))} />
            </div>
          </div>
          {!visao ? null : visao === "centros" ? (
            <VisaoCentros ano={ano} ate={ate} escolhido={escolhido} onEscolher={setEscolhido} />
          ) : visao === "sem_centros" ? (
            <VisaoSemCentros ano={ano} ate={ate} escolhido={semCentro} onEscolher={setSemCentro} />
          ) : visao === "obras" ? (
            <VisaoObras ano={ano} ate={ate} escolhida={obra} onEscolher={setObra} />
          ) : (
            <VisaoUnidade ano={ano} ate={ate} visao={Number(visao)} nome={VISOES.find((v) => v.chave === visao)!.nome} comparaCom={comparacao.comparaCom} />
          )}
        </>
      )}
    </div>
  );
}
