import { getPrismaClient } from "../../../config/prisma.js";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { CadastrosPreparados } from "./prepararCadastros.js";

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * O que a recarga muda no banco, e a gravação em si. A comparação é o que o
 * Contábil vê antes de confirmar; a gravação é idempotente — rodar de novo com
 * a mesma planilha não muda nada.
 */

export type Mudanca = {
  chave: string;
  rotulo: string;
  campos: Array<{ campo: string; antes: string | null; depois: string | null }>;
};

export type Diferencas = {
  novos: Mudanca[];
  alterados: Mudanca[];
  /** Saem do banco na recarga. */
  removidos: Mudanca[];
  /** Estão no banco e não vieram na planilha, mas ficam (contas nunca são apagadas). */
  mantidos: Mudanca[];
  iguais: number;
};

const txt = (v: unknown): string | null => (v === null || v === undefined || v === "" ? null : String(v));

/** Compara registro a registro, pelos campos listados com o seu rótulo. */
function comparar<T extends Record<string, unknown>>(
  alvos: Map<string, { rotulo: string; valores: T }>,
  atuais: Map<string, { rotulo: string; valores: T }>,
  campos: Array<[keyof T & string, string]>,
  removerAusentes: boolean,
): Diferencas {
  const d: Diferencas = { novos: [], alterados: [], removidos: [], mantidos: [], iguais: 0 };
  for (const [chave, alvo] of alvos) {
    const atual = atuais.get(chave);
    const lista = campos.map(([campo, rotulo]) => ({
      campo: rotulo,
      antes: atual ? txt(atual.valores[campo]) : null,
      depois: txt(alvo.valores[campo]),
    }));
    if (!atual) {
      d.novos.push({ chave, rotulo: alvo.rotulo, campos: lista.filter((c) => c.depois !== null) });
      continue;
    }
    const mudaram = lista.filter((c) => c.antes !== c.depois);
    if (mudaram.length === 0) d.iguais++;
    else d.alterados.push({ chave, rotulo: alvo.rotulo, campos: mudaram });
  }
  for (const [chave, atual] of atuais) {
    if (alvos.has(chave)) continue;
    const m = { chave, rotulo: atual.rotulo, campos: [] };
    (removerAusentes ? d.removidos : d.mantidos).push(m);
  }
  return d;
}

type LinhaNoBanco = { id: string; codigo: string; tipo: string; grupo: string; ordem: number };

/**
 * Linhas da DRE renomeadas na planilha. O código da linha sai da descrição
 * (prepararCadastros), então mudar a descrição na planilha muda o código. Sem
 * isto, a recarga criaria uma linha nova e tentaria apagar a antiga, que tem
 * valores apurados (e o banco recusa). Uma linha da planilha com código novo
 * é a renomeação de uma linha do banco que saiu da planilha quando as duas
 * estão na mesma posição, com o mesmo tipo e grupo (a atribuição não serve:
 * nas linhas de volume ela é a própria descrição e muda junto). A linha do
 * banco fica com o código novo, e os valores apurados continuam ligados a ela.
 * A prévia da recarga mostra a renomeação como alteração, para o Contábil ver.
 * Devolve código novo → linha do banco.
 */
export function renomeacoesDaDre(p: CadastrosPreparados, noBanco: LinhaNoBanco[]) {
  const naPlanilha = new Set(p.dre.linhas.map((l) => l.codigo));
  const existentes = new Set(noBanco.map((l) => l.codigo));
  const sairiam = noBanco.filter((l) => !naPlanilha.has(l.codigo));
  const renomeacoes = new Map<string, LinhaNoBanco>();
  for (const l of p.dre.linhas) {
    if (existentes.has(l.codigo)) continue;
    const antiga = sairiam.find(
      (b) => b.ordem === l.dados.ordem && b.tipo === l.dados.tipo && b.grupo === l.dados.grupo && ![...renomeacoes.values()].includes(b),
    );
    if (antiga) renomeacoes.set(l.codigo, antiga);
  }
  return renomeacoes;
}

export async function compararComBanco(p: CadastrosPreparados) {
  const prisma = getPrismaClient();
  const [centros, contas, linhas] = await Promise.all([
    prisma.centroCusto.findMany({ include: { _count: { select: { lancamentosContabeis: true, lancamentosManuais: true, resultadosApurados: true } } } }),
    prisma.contaResultado.findMany({ include: { linhaDRE: { select: { codigo: true } } } }),
    prisma.linhaDRE.findMany({
      include: {
        unidades: { include: { unidadeNegocio: { select: { tipo: true } } } },
        _count: { select: { contas: true, lancamentosContabeis: true, lancamentosManuais: true, resultadosApurados: true } },
      },
    }),
  ]);

  const chaveCentro = (codigoRM: string | null, nomeRM: string) => codigoRM ?? `sem código · ${nomeRM}`;
  const centrosDif = comparar(
    new Map(p.centros.alvos.map((c) => [chaveCentro(c.codigoRM, c.dados.nomeRM), { rotulo: c.dados.nomeRM, valores: c.dados }])),
    new Map(centros.map((c) => [chaveCentro(c.codigoRM, c.nomeRM), { rotulo: c.nomeRM, valores: c }])),
    [["nomeRM", "Nome no RM"], ["nomeControladoria", "Controladoria"], ["departamento", "Departamento"], ["atribuicao", "Atribuição"], ["balde", "Rateio"], ["coligada", "Coligada"]],
    true,
  );
  const emUso = new Set(
    centros.filter((c) => c._count.lancamentosContabeis + c._count.lancamentosManuais + c._count.resultadosApurados > 0).map((c) => chaveCentro(c.codigoRM, c.nomeRM)),
  );
  for (const m of centrosDif.removidos.filter((r) => emUso.has(r.chave))) {
    centrosDif.mantidos.push({ ...m, rotulo: `${m.rotulo} (em uso: fica inativado)` });
  }
  centrosDif.removidos = centrosDif.removidos.filter((r) => !emUso.has(r.chave));

  const contasDif = comparar(
    new Map(p.contas.alvos.map((c) => [c.reduzido, { rotulo: c.dados.descricao, valores: { ...c.dados, linha: p.vinculos.get(c.reduzido) ?? null } }])),
    new Map(contas.map((c) => [c.reduzido, { rotulo: c.descricao, valores: { ...c, linha: c.linhaDRE?.codigo ?? null } }])),
    [["conta", "Conta"], ["descricao", "Descrição"], ["tipoConta", "Tipo"], ["departamento", "Departamento"], ["atribuicao", "Atribuição"], ["balde", "Rateio"], ["linha", "Linha da DRE"]],
    false,
  );

  // A linha renomeada aparece como alterada (a descrição), não como nova e removida.
  const codigoNovo = new Map([...renomeacoesDaDre(p, linhas)].map(([novo, antiga]) => [antiga.codigo, novo]));
  const dreDif = comparar(
    new Map(p.dre.linhas.map((l) => [l.codigo, { rotulo: l.dados.descricao, valores: { ...l.dados, unidades: l.unidades.join(", ") } }])),
    new Map(linhas.map((l) => [codigoNovo.get(l.codigo) ?? l.codigo, {
      rotulo: l.descricao,
      valores: { ...l, unidades: l.unidades.map((u) => u.unidadeNegocio.tipo).sort().join(", ") },
    }])),
    [["descricao", "Descrição"], ["grupo", "Grupo"], ["atribuicao", "Atribuição"], ["tipo", "Tipo"], ["expressao", "Fórmula"], ["definicao", "Definição"], ["unidades", "Unidades"], ["ordem", "Posição"]],
    true,
  );

  // Linha da DRE que sairia e está em uso: o banco recusa apagá-la (valores
  // apurados, lançamentos e contas apontam para ela). A recarga é bloqueada.
  const emUsoDre = linhasEmUso(dreDif.removidos.map((r) => r.chave), linhas);
  return { centros: centrosDif, contas: contasDif, dre: dreDif, bloqueios: emUsoDre };
}

type LinhaComUso = { codigo: string; descricao: string; _count: { contas: number; lancamentosContabeis: number; lancamentosManuais: number; resultadosApurados: number } };
function linhasEmUso(codigos: string[], linhas: LinhaComUso[]) {
  return linhas
    .filter((l) => codigos.includes(l.codigo))
    .filter((l) => l._count.contas + l._count.lancamentosContabeis + l._count.lancamentosManuais + l._count.resultadosApurados > 0)
    .map(
      (l) =>
        `A linha da DRE "${l.descricao}" sairia da estrutura, mas está em uso (${l._count.resultadosApurados} valor(es) apurado(s), ${l._count.lancamentosContabeis + l._count.lancamentosManuais} lançamento(s), ${l._count.contas} conta(s)). Mantenha-a na planilha, ou renomeie-a na mesma posição.`,
    );
}

/** Grava a planilha preparada. Tudo numa transação: ou entra inteira, ou nada. */
export async function gravarCadastros(tx: Tx, p: CadastrosPreparados) {
  // Centros sem código no RM: a chave é o nome (como na prévia). Antes eram
  // apagados e recriados a cada carga, com id novo.
  const semCodigo = await tx.centroCusto.findMany({ where: { codigoRM: null }, select: { id: true, nomeRM: true } });
  const codigos: string[] = [];
  const mantidosSemCodigo: string[] = [];
  for (const c of p.centros.alvos) {
    if (c.codigoRM) {
      await tx.centroCusto.upsert({ where: { codigoRM: c.codigoRM }, create: { codigoRM: c.codigoRM, ...c.dados }, update: c.dados });
      codigos.push(c.codigoRM);
    } else {
      const existente = semCodigo.find((x) => x.nomeRM === c.dados.nomeRM && !mantidosSemCodigo.includes(x.id));
      const id = existente
        ? (await tx.centroCusto.update({ where: { id: existente.id }, data: c.dados })).id
        : (await tx.centroCusto.create({ data: { codigoRM: null, ...c.dados } })).id;
      mantidosSemCodigo.push(id);
    }
  }
  // O que não veio desta vez sai — senão um registro descartado por ajuste
  // sobreviveria. Mas o centro em uso (lançamentos ou valores apurados) fica,
  // inativado: apagá-lo tiraria o centro dos lançamentos e dos valores de meses
  // já apurados.
  const sairiam = await tx.centroCusto.findMany({
    where: { OR: [{ codigoRM: { notIn: codigos, not: null } }, { codigoRM: null, id: { notIn: mantidosSemCodigo } }] },
    select: { id: true, _count: { select: { lancamentosContabeis: true, lancamentosManuais: true, resultadosApurados: true } } },
  });
  const emUso = sairiam.filter((c) => c._count.lancamentosContabeis + c._count.lancamentosManuais + c._count.resultadosApurados > 0).map((c) => c.id);
  await tx.centroCusto.updateMany({ where: { id: { in: emUso } }, data: { ativo: false } });
  const { count: centrosRemovidos } = await tx.centroCusto.deleteMany({ where: { id: { in: sairiam.map((c) => c.id).filter((id) => !emUso.includes(id)) } } });

  for (const c of p.contas.alvos) {
    await tx.contaResultado.upsert({ where: { reduzido: c.reduzido }, create: { reduzido: c.reduzido, ...c.dados }, update: c.dados });
  }

  const unidades = await tx.unidadeNegocio.findMany({ select: { id: true, tipo: true } });
  const unidadePorTipo = new Map(unidades.map((u) => [u.tipo, u.id]));
  const idPorCodigo = new Map<string, string>();
  const noBanco = await tx.linhaDRE.findMany({ select: { id: true, codigo: true, tipo: true, grupo: true, ordem: true } });
  for (const [novo, antiga] of renomeacoesDaDre(p, noBanco)) {
    await tx.linhaDRE.update({ where: { id: antiga.id }, data: { codigo: novo } });
  }
  for (const l of p.dre.linhas) {
    const linha = await tx.linhaDRE.upsert({ where: { codigo: l.codigo }, create: { codigo: l.codigo, ...l.dados }, update: l.dados });
    idPorCodigo.set(l.codigo, linha.id);
    await tx.linhaDREUnidade.deleteMany({ where: { linhaDREId: linha.id } });
    for (const tipo of l.unidades) {
      const unidadeNegocioId = unidadePorTipo.get(tipo);
      if (unidadeNegocioId) await tx.linhaDREUnidade.create({ data: { linhaDREId: linha.id, unidadeNegocioId } });
    }
  }
  const { count: linhasRemovidas } = await tx.linhaDRE.deleteMany({ where: { codigo: { notIn: [...idPorCodigo.keys()] } } });

  let vinculadas = 0;
  for (const [reduzido, codigo] of p.vinculos) {
    const linhaDREId = codigo ? (idPorCodigo.get(codigo) ?? null) : null;
    if (linhaDREId) vinculadas++;
    await tx.contaResultado.update({ where: { reduzido }, data: { linhaDREId } });
  }

  return {
    centros: p.centros.alvos.length,
    centrosRemovidos,
    contas: p.contas.alvos.length,
    linhasDRE: p.dre.linhas.length,
    linhasRemovidas,
    contasVinculadas: vinculadas,
  };
}
