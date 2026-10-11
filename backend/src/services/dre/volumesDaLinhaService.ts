import { getPrismaClient } from "../../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { alcancaLista, type Acesso } from "../acesso/acesso.js";
import { LINHAS_TOTAIS, linhaDosTotais, type CodigoTotais, type ItemVolume } from "../volumes/totaisOperacao.js";
import { VOLUMES_DA_DRE } from "./apuracaoUnidades.js";
import { RegraDREError } from "./dreService.js";
import { chaveDaLinha } from "../../lib/linhas.js";

const Decimal = Prisma.Decimal;
const n = (s: string | null | undefined) => (s ?? "").trim().toUpperCase();

/** Uma linha do extrato: os registros da mesma obra, linha e destino somados. */
export type LinhaVolume = {
  obra: string | null;
  obraNome: string | null;
  /** A linha da aba Totais em que os registros entram, ex.: "(P) Pré-Fabricado: Matriz". */
  destino: string;
  linha: string | null;
  quantidade: string;
  registros: number;
};

/**
 * As listas operacionais que formam uma linha de volume da DRE (Produção,
 * Pistas, Metalurgia, Expedição, Montagem, Acompanhamento), somadas por obra.
 * Os registros entram pela mesma regra da aba Totais que a apuração usa
 * (linhaDosTotais), e as linhas dos Totais de cada unidade são as da apuração
 * (VOLUMES_DA_DRE). As listas são as de hoje: se mudaram depois da apuração,
 * o total difere do valor apurado.
 */
export async function volumesDaLinha(ano: number, mes: number, codigoLinha: string, unidade: number | null, acesso: Acesso) {
  const prisma = getPrismaClient();
  const [competencia, linhaDRE] = await Promise.all([
    prisma.competencia.findUnique({ where: { ano_mes: { ano, mes } }, select: { id: true } }),
    prisma.linhaDRE.findUnique({ where: { codigo: codigoLinha }, select: { descricao: true, grupoSigla: true } }),
  ]);
  if (!competencia) throw new RegraDREError(404, "Competência não encontrada.");
  if (!linhaDRE || (linhaDRE.grupoSigla !== "P" && linhaDRE.grupoSigla !== "S")) throw new RegraDREError(400, "A linha não é de volume.");

  const unidades = unidade === null ? Object.keys(VOLUMES_DA_DRE).map(Number) : [unidade];
  const codigos = new Set<CodigoTotais>(unidades.flatMap((u) => VOLUMES_DA_DRE[u]?.[n(linhaDRE.descricao)] ?? []));
  const totais = LINHAS_TOTAIS.filter((t) => codigos.has(t.codigo));
  const tipos = [...new Set(totais.map((t) => t.tipo))];
  for (const t of tipos) {
    if (!alcancaLista(acesso, t)) throw new RegraDREError(403, "Esta lista não é de um setor seu.");
  }

  const where = { competenciaId: competencia.id };
  const base = {
    quantidade: true,
    unidadeNegocio: { select: { codigo: true } },
    obra: { select: { codigo: true, nome: true, tipoVenda: true } },
  } as const;
  const comLinha = { ...base, linha: { select: { nome: true } } } as const;
  type Registro = {
    quantidade: Prisma.Decimal;
    unidadeNegocio: { codigo: number } | null;
    obra: { codigo: string; nome: string; tipoVenda: string | null } | null;
    linha?: { nome: string } | null;
    categoria?: string | null;
    finalidade?: string | null;
    etapa?: string | null;
  };
  const buscar: Record<ItemVolume["tipo"], () => Promise<Registro[]>> = {
    PROJETO: () => prisma.projeto.findMany({ where, select: comLinha }),
    PRODUCAO: () => prisma.producao.findMany({ where, select: comLinha }),
    PRODUCAO_PISTA: () => prisma.producaoPista.findMany({ where, select: comLinha }),
    PRODUCAO_ARMADURA: () => prisma.producaoArmadura.findMany({ where, select: { ...comLinha, categoria: true } }),
    PRODUCAO_METALURGIA: () => prisma.producaoMetalurgia.findMany({ where, select: { ...base, finalidade: true } }),
    EXPEDICAO: () => prisma.expedicao.findMany({ where, select: comLinha }),
    MONTAGEM: () => prisma.montagem.findMany({ where, select: comLinha }),
    ACOMPANHAMENTO: () => prisma.acompanhamento.findMany({ where, select: { ...comLinha, etapa: true } }),
  };
  const porTipo = await Promise.all(tipos.map(async (t) => ({ tipo: t, registros: await buscar[t]() })));

  const rotulo = new Map(LINHAS_TOTAIS.map((t) => [t.codigo, t.rotulo] as const));
  const grupos = new Map<string, LinhaVolume & { soma: Prisma.Decimal }>();
  let total = new Decimal(0);
  for (const { tipo, registros } of porTipo) {
    for (const r of registros) {
      const destino = linhaDosTotais({
        tipo,
        quantidade: r.quantidade,
        unidade: r.unidadeNegocio?.codigo ?? null,
        linha: r.linha ? chaveDaLinha(r.linha.nome) : null,
        obraGlobal: r.obra?.tipoVenda === "GLOBAL",
        categoria: r.categoria ?? null,
        finalidade: r.finalidade ?? null,
        etapa: r.etapa ?? null,
      });
      if (!destino || !codigos.has(destino)) continue;
      const chave = [r.obra?.codigo ?? "", destino, r.linha?.nome ?? ""].join("|");
      const g = grupos.get(chave) ?? {
        obra: r.obra?.codigo ?? null,
        obraNome: r.obra && r.obra.nome !== r.obra.codigo ? r.obra.nome : null,
        destino: rotulo.get(destino) ?? destino,
        linha: r.linha?.nome ?? null,
        quantidade: "0",
        registros: 0,
        soma: new Decimal(0),
      };
      g.soma = g.soma.plus(r.quantidade);
      g.registros++;
      grupos.set(chave, g);
      total = total.plus(r.quantidade);
    }
  }

  const linhas: LinhaVolume[] = [...grupos.values()]
    .map(({ soma, ...g }) => ({ ...g, quantidade: soma.toFixed(6) }))
    .sort((a, b) => (a.obra ?? "").localeCompare(b.obra ?? "") || a.destino.localeCompare(b.destino));
  return {
    linha: linhaDRE.descricao,
    medida: totais[0]?.medida ?? null,
    destinos: totais.map((t) => t.rotulo),
    total: total.toFixed(6),
    linhas,
  };
}
