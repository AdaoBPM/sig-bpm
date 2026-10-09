import type { LucideIcon } from "lucide-react";
import { Calculator, FileBarChart, GitCompareArrows, ListChecks, NotebookPen, Percent, Rows3, TriangleAlert, Upload, Warehouse } from "lucide-react";

/** Uma etapa do fechamento do mês: a tela, na ordem em que o Contábil trabalha. */
export type Etapa = {
  /** O trecho da rota depois de /competencias/AAAA-MM/ (as listas abrem numa lista). */
  caminho: string;
  /** O que identifica a etapa na rota atual: o primeiro trecho do caminho. */
  chave: string;
  rotulo: string;
  icone: LucideIcon;
  permissao: string;
};

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
    { caminho: "importar", chave: "importar", rotulo: "Importações", icone: Upload, permissao: "importacao:ver" },
    { caminho: "classificacao", chave: "classificacao", rotulo: "Classificação", icone: ListChecks, permissao: "classificacao:ver" },
    { caminho: "lancamentos-manuais", chave: "lancamentos-manuais", rotulo: "Lançamentos", icone: NotebookPen, permissao: "lancamentos_manuais:ver" },
    ...(primeiraLista
      ? [{ caminho: `listas/${primeiraLista}`, chave: "listas", rotulo: "Listas", icone: Rows3, permissao: "listas_operacionais:ver" }]
      : []),
    { caminho: "receita-previa", chave: "receita-previa", rotulo: "Receita", icone: Calculator, permissao: "apuracao:ver" },
    { caminho: "rateios", chave: "rateios", rotulo: "Rateios", icone: Percent, permissao: "apuracao:ver" },
    { caminho: "estoque", chave: "estoque", rotulo: "Estoque", icone: Warehouse, permissao: "apuracao:ver" },
    { caminho: "dre", chave: "dre", rotulo: "DRE", icone: FileBarChart, permissao: "dre:ver" },
    { caminho: "conferencia-planilha", chave: "conferencia-planilha", rotulo: "Conferência", icone: GitCompareArrows, permissao: "apuracao:ver" },
    { caminho: "divergencias", chave: "divergencias", rotulo: "Divergências", icone: TriangleAlert, permissao: "divergencia:ver" },
  ];
  return todas.filter((e) => hasPermission(e.permissao));
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
