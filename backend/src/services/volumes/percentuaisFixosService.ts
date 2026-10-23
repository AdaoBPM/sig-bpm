import { getPrismaClient } from "../../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { auditar } from "../auditoriaService.js";
import { CHAVES_DE_RATEIO, NOME_DA_CHAVE, RegraRateioError } from "./rateiosService.js";
import { REGRAS_DOS_PERCENTUAIS_FIXOS } from "./regrasRateio.js";
import { conflitoDeVigencia, descreverVigencia, lacunasDasRegras, type RegraComVigencia } from "./vigenciasRateio.js";
import { peloTexto } from "../../lib/ordemDoSqlite.js";

/**
 * Os percentuais fixos das regras de rateio (14/10/2026, a tela Percentuais Fixos de Cadastros da Controladoria / Regras
 * de Rateio): numa chave e num período, cada destino fica com um percentual digitado, e os destinos somam 100%. Os
 * destinos são sempre os quatro — Matriz, Filial, Montagem e Complementar (14/10/2026; antes, só os que a chave usava
 * por volume) —, cada um com a linha de volume dele (o volume continua apurado, só para a tela). O conjunto (uma regra por destino, com a mesma vigência) se grava e se exclui junto.
 */

const NOME_DO_DESTINO: Record<string, string> = { MATRIZ: "Matriz", FILIAL: "Filial", MONTAGEM: "Montagem", COMPLEMENTAR: "Complementar" };
const nomeDaChave = (c: string) => NOME_DA_CHAVE[c] ?? c;
const dia = (d: Date) => d.toISOString().slice(0, 10);

/** Um conjunto: a chave, a vigência, o percentual de cada destino e o rótulo (a base do rótulo das regras, 14/10/2026). */
type Conjunto = { chave: string; inicio: string; fim: string | null; percentuais: Record<string, number>; usado: boolean; rotulo: string };
/** O rótulo de cada regra do conjunto: "Produção: Matriz (Fixo)", com a base escolhida no lugar do nome da chave. */
const rotuloDaRegra = (base: string, destino: string) => `${base}: ${NOME_DO_DESTINO[destino] ?? destino} (Fixo)`;
const baseDoRotulo = (rotulo: string) => rotulo.replace(/: [^:]+ (Fixo)$/, "");

async function regras() {
  const rs = await getPrismaClient().regraRateio.findMany({
    select: { id: true, chave: true, destino: true, rotulo: true, vigenciaInicio: true, vigenciaFim: true, percentualFixo: true, _count: { select: { volumesOperacionais: true } } },
    orderBy: [{ vigenciaInicio: "asc" }, { id: "asc" }],
  });
  // A chave pelo texto, como no SQLite (23/10/2026: no PostgreSQL, o enum ordena pela declaração).
  return rs.sort(peloTexto((r) => r.chave));
}
const comVigencia = (r: Awaited<ReturnType<typeof regras>>[number]): RegraComVigencia => ({
  id: r.id,
  chave: r.chave,
  destino: r.destino,
  inicio: r.vigenciaInicio,
  fim: r.vigenciaFim,
  fixo: r.percentualFixo !== null,
});

export const percentuaisFixosService = {
  /** As chaves com os destinos delas e os conjuntos de percentuais fixos já cadastrados. */
  async listar() {
    const todas = await regras();
    const conjuntos = new Map<string, Conjunto>();
    for (const r of todas.filter((x) => x.percentualFixo !== null)) {
      const k = `${r.chave}|${dia(r.vigenciaInicio)}`;
      const c = conjuntos.get(k) ?? { chave: r.chave, inicio: dia(r.vigenciaInicio), fim: r.vigenciaFim ? dia(r.vigenciaFim) : null, percentuais: {}, usado: false, rotulo: baseDoRotulo(r.rotulo) };
      c.percentuais[r.destino] = Number(r.percentualFixo) * 100;
      c.usado ||= r._count.volumesOperacionais > 0;
      conjuntos.set(k, c);
    }
    return {
      chaves: CHAVES_DE_RATEIO.map((chave) => ({
        chave,
        nome: nomeDaChave(chave),
        destinos: REGRAS_DOS_PERCENTUAIS_FIXOS.filter((r) => r.chave === chave).map((r) => ({ destino: r.destino, nome: NOME_DO_DESTINO[r.destino] })),
      })),
      conjuntos: [...conjuntos.values()],
    };
  },

  /**
   * Grava um conjunto (novo, ou o de `inicioAnterior`): os percentuais de cada destino da chave (em %, somando 100), com a
   * mesma vigência. Recusa a vigência que se sobrepõe a outras regras da chave (as por volume têm de ser encerradas antes).
   */
  async gravar(
    dados: { chave: string; inicioAnterior: string | null; inicio: string; fim: string | null; percentuais: Record<string, number>; rotulo?: string | null },
    usuarioId: string,
  ) {
    const prisma = getPrismaClient();
    const catalogo = REGRAS_DOS_PERCENTUAIS_FIXOS.filter((r) => r.chave === dados.chave);
    if (!catalogo.length) throw new RegraRateioError(400, "Chave de rateio inválida.");
    const inicio = new Date(`${dados.inicio}T00:00:00.000Z`);
    const fim = dados.fim ? new Date(`${dados.fim}T00:00:00.000Z`) : null;
    if (Number.isNaN(inicio.getTime()) || (fim && Number.isNaN(fim.getTime()))) throw new RegraRateioError(400, "Data de vigência inválida.");
    if (fim && fim < inicio) throw new RegraRateioError(400, "A vigência final é anterior à inicial.");
    const pcts = catalogo.map((r) => ({ regra: r, valor: Number(dados.percentuais[r.destino] ?? 0) }));
    if (pcts.some((p) => !Number.isFinite(p.valor) || p.valor < 0 || p.valor > 100)) throw new RegraRateioError(400, "Cada percentual vai de 0% a 100%.");
    const soma = pcts.reduce((s, p) => s + p.valor, 0);
    if (Math.abs(soma - 100) > 0.005) throw new RegraRateioError(400, `Os percentuais de ${nomeDaChave(dados.chave)} somam ${soma.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%: precisam somar 100%.`);

    const todas = await regras();
    const anteriores = dados.inicioAnterior
      ? todas.filter((r) => r.chave === dados.chave && r.percentualFixo !== null && dia(r.vigenciaInicio) === dados.inicioAnterior)
      : [];
    if (dados.inicioAnterior && !anteriores.length) throw new RegraRateioError(404, "O conjunto de percentuais fixos não foi encontrado.");
    const ids = new Set(anteriores.map((r) => r.id));
    const outras = todas.filter((r) => !ids.has(r.id)).map(comVigencia);
    for (const p of pcts) {
      const conflito = conflitoDeVigencia({ chave: dados.chave, destino: p.regra.destino, inicio, fim, fixo: true }, outras, nomeDaChave);
      if (conflito) throw new RegraRateioError(409, conflito);
    }

    // O rótulo do conjunto (14/10/2026): a base dos rótulos das regras; sem ele, o nome da chave.
    const base = dados.rotulo?.trim() || nomeDaChave(dados.chave);
    const unidades = new Map((await prisma.unidadeNegocio.findMany({ select: { id: true, codigo: true } })).map((u) => [u.codigo, u.id]));
    const ordem = await prisma.regraRateio.count();
    await prisma.$transaction(async (tx) => {
      for (const [k, p] of pcts.entries()) {
        const anterior = anteriores.find((r) => r.destino === p.regra.destino);
        const dadosDaRegra = { vigenciaInicio: inicio, vigenciaFim: fim, percentualFixo: new Prisma.Decimal((p.valor / 100).toFixed(6)), rotulo: rotuloDaRegra(base, p.regra.destino) };
        if (anterior) await tx.regraRateio.update({ where: { id: anterior.id }, data: dadosDaRegra });
        else
          await tx.regraRateio.create({
            data: {
              ...dadosDaRegra,
              chave: p.regra.chave,
              destino: p.regra.destino,
              unidadeDestinoId: unidades.get(p.regra.unidade)!,
              baseFisica: p.regra.baseFisica,
              origemDoVolume: p.regra.origem,
              ordem: ordem + k + 1,
            },
          });
      }
    });
    await auditar({
      usuarioId,
      acao: dados.inicioAnterior ? "ALTERACAO" : "CRIACAO",
      entidade: "regra_rateio",
      entidadeId: `${dados.chave}|${dados.inicio}`,
      antes: anteriores.length ? anteriores.map((r) => ({ destino: r.destino, inicio: r.vigenciaInicio, fim: r.vigenciaFim, percentual: Number(r.percentualFixo) })) : undefined,
      depois: { chave: dados.chave, inicio: dados.inicio, fim: dados.fim, percentuais: Object.fromEntries(pcts.map((p) => [p.regra.destino, p.valor])) },
      metadados: { percentuaisFixos: true },
    });
    return this.listar();
  },

  /** Exclui um conjunto ainda não usado em apurações (o usado se encerra pela vigência). */
  async excluir(chave: string, inicioTexto: string, usuarioId: string) {
    const prisma = getPrismaClient();
    const doConjunto = (await regras()).filter((r) => r.chave === chave && r.percentualFixo !== null && dia(r.vigenciaInicio) === inicioTexto);
    if (!doConjunto.length) throw new RegraRateioError(404, "O conjunto de percentuais fixos não foi encontrado.");
    if (doConjunto.some((r) => r._count.volumesOperacionais > 0))
      throw new RegraRateioError(409, `Os percentuais fixos de ${nomeDaChave(chave)} ${descreverVigencia({ inicio: doConjunto[0].vigenciaInicio, fim: doConjunto[0].vigenciaFim })} já foram usados em apurações: encerre a vigência em vez de excluir.`);
    await prisma.regraRateio.deleteMany({ where: { id: { in: doConjunto.map((r) => r.id) } } });
    await auditar({ usuarioId, acao: "EXCLUSAO", entidade: "regra_rateio", entidadeId: `${chave}|${inicioTexto}`, antes: doConjunto.map((r) => ({ destino: r.destino, percentual: Number(r.percentualFixo) })), metadados: { percentuaisFixos: true } });
    return this.listar();
  },

  /**
   * Os avisos das regras (14/10/2026): as chaves com meses sem regra, até dezembro do ano que vem, e os conjuntos de
   * percentuais fixos que não somam 100%.
   */
  async verificacao(hoje = new Date()) {
    const todas = await regras();
    const ate = (hoje.getUTCFullYear() + 1) * 12 + 11;
    const avisos = lacunasDasRegras(todas.map(comVigencia), [...CHAVES_DE_RATEIO], ate, nomeDaChave);
    const somas = new Map<string, number>();
    for (const r of todas.filter((x) => x.percentualFixo !== null)) {
      const k = `${r.chave}|${dia(r.vigenciaInicio)}`;
      somas.set(k, (somas.get(k) ?? 0) + Number(r.percentualFixo));
    }
    for (const [k, s] of somas)
      if (Math.abs(s - 1) > 0.00005) {
        const [chave, inicio] = k.split("|");
        avisos.push(`${nomeDaChave(chave)}: os percentuais fixos a partir de ${inicio.split("-").reverse().join("/")} somam ${(s * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%, e não 100%.`);
      }
    return { avisos };
  },
};
