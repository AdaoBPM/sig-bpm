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

export async function compararComBanco(p: CadastrosPreparados) {
  const prisma = getPrismaClient();
  const [centros, contas, linhas] = await Promise.all([
    prisma.centroCusto.findMany(),
    prisma.contaResultado.findMany({ include: { linhaDRE: { select: { codigo: true } } } }),
    prisma.linhaDRE.findMany({ include: { unidades: { include: { unidadeNegocio: { select: { tipo: true } } } } } }),
  ]);

  const chaveCentro = (codigoRM: string | null, nomeRM: string) => codigoRM ?? `sem código · ${nomeRM}`;
  const centrosDif = comparar(
    new Map(p.centros.alvos.map((c) => [chaveCentro(c.codigoRM, c.dados.nomeRM), { rotulo: c.dados.nomeRM, valores: c.dados }])),
    new Map(centros.map((c) => [chaveCentro(c.codigoRM, c.nomeRM), { rotulo: c.nomeRM, valores: c }])),
    [["nomeRM", "Nome no RM"], ["nomeControladoria", "Controladoria"], ["departamento", "Departamento"], ["atribuicao", "Atribuição"], ["balde", "Rateio"], ["coligada", "Coligada"]],
    true,
  );

  const contasDif = comparar(
    new Map(p.contas.alvos.map((c) => [c.reduzido, { rotulo: c.dados.descricao, valores: { ...c.dados, linha: p.vinculos.get(c.reduzido) ?? null } }])),
    new Map(contas.map((c) => [c.reduzido, { rotulo: c.descricao, valores: { ...c, linha: c.linhaDRE?.codigo ?? null } }])),
    [["conta", "Conta"], ["descricao", "Descrição"], ["tipoConta", "Tipo"], ["departamento", "Departamento"], ["atribuicao", "Atribuição"], ["balde", "Rateio"], ["linha", "Linha da DRE"]],
    false,
  );

  const dreDif = comparar(
    new Map(p.dre.linhas.map((l) => [l.codigo, { rotulo: l.dados.descricao, valores: { ...l.dados, unidades: l.unidades.join(", ") } }])),
    new Map(linhas.map((l) => [l.codigo, {
      rotulo: l.descricao,
      valores: { ...l, unidades: l.unidades.map((u) => u.unidadeNegocio.tipo).sort().join(", ") },
    }])),
    [["descricao", "Descrição"], ["grupo", "Grupo"], ["atribuicao", "Atribuição"], ["tipo", "Tipo"], ["expressao", "Fórmula"], ["definicao", "Definição"], ["unidades", "Unidades"], ["ordem", "Posição"]],
    true,
  );

  return { centros: centrosDif, contas: contasDif, dre: dreDif };
}

/** Grava a planilha preparada. Tudo numa transação: ou entra inteira, ou nada. */
export async function gravarCadastros(tx: Tx, p: CadastrosPreparados) {
  // Centros sem código no RM não têm chave de conciliação: são recriados.
  await tx.centroCusto.deleteMany({ where: { codigoRM: null } });
  const codigos: string[] = [];
  for (const c of p.centros.alvos) {
    if (c.codigoRM) {
      await tx.centroCusto.upsert({ where: { codigoRM: c.codigoRM }, create: { codigoRM: c.codigoRM, ...c.dados }, update: c.dados });
      codigos.push(c.codigoRM);
    } else {
      await tx.centroCusto.create({ data: { codigoRM: null, ...c.dados } });
    }
  }
  // O que não veio desta vez sai — senão um registro descartado por ajuste sobreviveria.
  const { count: centrosRemovidos } = await tx.centroCusto.deleteMany({ where: { codigoRM: { notIn: codigos, not: null } } });

  for (const c of p.contas.alvos) {
    await tx.contaResultado.upsert({ where: { reduzido: c.reduzido }, create: { reduzido: c.reduzido, ...c.dados }, update: c.dados });
  }

  const unidades = await tx.unidadeNegocio.findMany({ select: { id: true, tipo: true } });
  const unidadePorTipo = new Map(unidades.map((u) => [u.tipo, u.id]));
  const idPorCodigo = new Map<string, string>();
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
