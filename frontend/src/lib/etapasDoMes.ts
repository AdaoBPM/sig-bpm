import type { LucideIcon } from "lucide-react";
import { Calculator, ChartColumn, FileBarChart, Gauge, GitCompareArrows, ListChecks, NotebookPen, Rows3, TriangleAlert, Upload } from "lucide-react";

/** Uma etapa do fechamento do mês: a tela, na ordem em que o Contábil trabalha. */
export type Etapa = {
  /** O trecho da rota depois de /competencias/AAAA-MM/ (as listas abrem numa lista). */
  caminho: string;
  /** O que identifica a etapa na rota atual: o primeiro trecho do caminho. */
  chave: string;
  rotulo: string;
  icone: LucideIcon;
  permissao: string;
  /**
   * As abas da etapa (27/10/2026: Totais, com Indicadores e Rateios; Prévias, com Receita e Estoque): cada uma com a rota
   * dela. A etapa abre na primeira aba que o perfil alcança e fica acesa em todas.
   */
  abas?: AbaDaEtapa[];
};

/** Uma aba de uma etapa: o trecho da rota (o primeiro, depois do mês), o nome e a permissão. */
export type AbaDaEtapa = { caminho: string; rotulo: string; permissao: string };

/** As etapas com abas: as abas de cada uma, na ordem da tela. */
const ABAS_DAS_ETAPAS: Record<string, { rotulo: string; icone: LucideIcon; abas: AbaDaEtapa[] }> = {
  // Os Lançamentos com abas (27/10/2026): Controladoria (os digitados) e Contestações (os vindos das contestações).
  lancamentos: {
    rotulo: "Lançamentos",
    icone: NotebookPen,
    abas: [
      { caminho: "lancamentos-manuais", rotulo: "Controladoria", permissao: "lancamentos_manuais.controladoria:ler" },
      { caminho: "lancamentos-contestacoes", rotulo: "Contestações", permissao: "lancamentos_manuais.contestacoes:ler" },
    ],
  },
  totais: {
    rotulo: "Totais",
    icone: Gauge,
    abas: [
      // Os indicadores do exercício até o mês, como a aba Indicadores do Painel de Bordo (Resultados Empresariais).
      { caminho: "indicadores", rotulo: "Indicadores", permissao: "totais.indicadores:ler" },
      { caminho: "rateios", rotulo: "Rateios", permissao: "totais.rateios:ler" },
    ],
  },
  previas: {
    rotulo: "Prévias",
    icone: Calculator,
    abas: [
      { caminho: "receita-previa", rotulo: "Receita", permissao: "previas.receita:ler" },
      { caminho: "estoque", rotulo: "Estoque", permissao: "previas.estoque:ler" },
    ],
  },
};

/** A etapa com abas de um trecho da rota ("rateios" → "totais"), ou o próprio trecho. */
export function chaveDaEtapa(trecho: string | null): string | null {
  if (!trecho) return null;
  return Object.entries(ABAS_DAS_ETAPAS).find(([, e]) => e.abas.some((a) => a.caminho === trecho))?.[0] ?? trecho;
}

/** Uma etapa com abas, com as que o perfil alcança; nula sem nenhuma. */
function etapaComAbas(chave: string, hasPermission: (p: string) => boolean): Etapa | null {
  const e = ABAS_DAS_ETAPAS[chave];
  const abas = e.abas.filter((a) => hasPermission(a.permissao));
  return abas.length ? { caminho: abas[0].caminho, chave, rotulo: e.rotulo, icone: e.icone, permissao: abas[0].permissao, abas } : null;
}

/** As listas operacionais de rateio, na ordem da tela de listas. */
export const LISTAS_RATEIO = ["PROJETO", "PRODUCAO", "PRODUCAO_PISTA", "PRODUCAO_ARMADURA", "PRODUCAO_METALURGIA", "EXPEDICAO", "MONTAGEM", "ACOMPANHAMENTO"];

const slugDaLista = (tipo: string) => tipo.toLowerCase().replace(/_/g, "-");
/** As abas dos indicadores do Comercial e do Administrativo, depois das listas de rateio: o tipo da importação e a aba. */
const LISTAS_INDICADORES: Array<[string, string]> = [["INDICADORES_COMERCIAL", "comercial"], ["INDICADORES_ADMIN", "administrativo"]];

type Acesso = { recorteSetor: boolean; setores: string[] } | undefined;

/**
 * As etapas do mês que o perfil alcança, na ordem do fechamento. As listas
 * abrem na primeira lista que o usuário pode ver (o Alimentador, nas do setor).
 */
export function etapasDoMes(hasPermission: (p: string) => boolean, acesso: Acesso): Etapa[] {
  const rateio = acesso?.recorteSetor ? LISTAS_RATEIO.find((t) => acesso.setores.includes(t)) : "PROJETO";
  const primeiraLista = rateio ? slugDaLista(rateio) : LISTAS_INDICADORES.find(([t]) => acesso?.setores.includes(t))?.[1];
  const todas: Etapa[] = [
    { caminho: "importar", chave: "importar", rotulo: "Importações", icone: Upload, permissao: "importacao:ler" },
    { caminho: "classificacao", chave: "classificacao", rotulo: "Classificação", icone: ListChecks, permissao: "classificacao:ler" },
    ...[etapaComAbas("lancamentos", hasPermission)].filter((e): e is Etapa => e !== null),
    ...(primeiraLista
      ? [{ caminho: `listas/${primeiraLista}`, chave: "listas", rotulo: "Listas", icone: Rows3, permissao: "listas_operacionais:ler" }]
      : []),
    ...[etapaComAbas("totais", hasPermission), etapaComAbas("previas", hasPermission)].filter((e): e is Etapa => e !== null),
    // A DRE apurada do mês, por unidade (a tela Resultados; a rota e a permissão continuam as da DRE).
    { caminho: "dre", chave: "dre", rotulo: "Resultados", icone: FileBarChart, permissao: "dre:ler" },
    // A DRE de cada unidade dividida entre as linhas, gravada na apuração (26/10/2026).
    { caminho: "linhas", chave: "linhas", rotulo: "Linhas", icone: ChartColumn, permissao: "linhas_mes:ler" },
    { caminho: "conferencia-planilha", chave: "conferencia-planilha", rotulo: "Conferência", icone: GitCompareArrows, permissao: "conferencia:ler" },
    { caminho: "divergencias", chave: "divergencias", rotulo: "Divergências", icone: TriangleAlert, permissao: "divergencia:ler" },
  ];
  return todas.filter((e) => hasPermission(e.permissao));
}

/**
 * As abas da etapa aberta (Totais ou Prévias) que o perfil alcança, para o cabeçalho da tela: o nome da etapa no título e
 * as abas logo abaixo, como nas telas com abas do menu (AbasDaTela). Nula fora das etapas com abas.
 */
export function abasDoMes(pathname: string, hasPermission: (p: string) => boolean): { titulo: string; abas: Array<{ title: string; href: string }>; ativa: string } | null {
  const rota = lerRotaDoMes(pathname);
  const chave = chaveDaEtapa(rota?.chave ?? null);
  const etapa = chave && Object.hasOwn(ABAS_DAS_ETAPAS, chave) ? etapaComAbas(chave, hasPermission) : null;
  if (!rota || !etapa?.abas) return null;
  const href = (a: AbaDaEtapa) => `/competencias/${rota.anoMes}/${a.caminho}`;
  return { titulo: etapa.rotulo, abas: etapa.abas.map((a) => ({ title: a.rotulo, href: href(a) })), ativa: `/competencias/${rota.anoMes}/${rota.chave}` };
}

/** O nome da etapa de um trecho da rota, com o da aba nas etapas com abas ("rateios" → ["Totais", "Rateios"]). */
export function rotulosDaEtapa(etapas: Etapa[], trecho: string): string[] | null {
  const e = etapas.find((x) => x.chave === chaveDaEtapa(trecho));
  if (!e) return null;
  const aba = e.abas?.find((a) => a.caminho === trecho);
  return aba ? [e.rotulo, aba.rotulo] : [e.rotulo];
}

/** "/competencias/2026-08/listas/producao" → { anoMes: "2026-08", chave: "listas", resto: "listas/producao" }. */
export function lerRotaDoMes(pathname: string) {
  const m = pathname.match(/^\/competencias\/(\d{4}-\d{2})(?:\/(.*))?$/);
  if (!m) return null;
  const resto = m[2] ?? "";
  return { anoMes: m[1], chave: resto.split("/")[0] || null, resto };
}

/** "2026-08" → "08/2026". */
export function rotuloDoMes(anoMes: string) {
  const [ano, mes] = anoMes.split("-");
  return `${mes}/${ano}`;
}
