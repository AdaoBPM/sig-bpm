/**
 * Carga da estrutura da DRE, a partir do `Realizado (Consolidado)`.
 *
 * A planilha não tem um código estável por linha — a identidade é a posição.
 * Aqui cada linha ganha um `codigo` derivado de grupo, atribuição e descrição,
 * e as expressões de subtotal passam a referenciar esses códigos em vez das
 * células, para sobreviverem a uma reordenação.
 *
 * Duas traduções acontecem aqui, e vale entender por quê:
 *
 * 1. `SUM(B28:B76)/2` vira a soma dos subtotais de subgrupo contidos no
 *    intervalo. O `/2` existe na planilha porque o intervalo contém tanto os
 *    itens quanto os subtotais que os agrupam, contando cada valor duas vezes.
 *    Somando só os filhos diretos, o artifício desaparece.
 *
 * 2. As unidades de cada linha saem da própria fórmula: uma linha que soma
 *    `'Realizado (Matriz)'!B4 + 'Realizado (Filial)'!B4` se aplica às duas.
 *    Subtotais herdam a união das unidades dos filhos.
 *
 * Uso: npx tsx prisma/carga-dre.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPrismaClient } from "../src/config/prisma.js";
import type { TipoLinhaDRE, TipoUnidade } from "../src/generated/prisma/enums.js";
import { ajusteDaConta, relatarAjustesConta } from "./ajustes-carga.js";

const prisma = getPrismaClient();
const aqui = dirname(fileURLToPath(import.meta.url));

type LinhaBruta = {
  linhaPlanilha: number;
  descricao: string | null;
  formula: string | null;
  grupo: string | null;
  grupoSigla: string | null;
  atribuicao: string | null;
  atribuicaoSigla: string | null;
  definicao: string | null;
};

function texto(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const s = v.trim();
  return s === "" || s === "-" ? null : s;
}

/** Remove acentos, pontuação e espaços — para compor códigos legíveis. */
function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/** Nome da aba de unidade → tipo da unidade de negócio. */
const ABA_PARA_UNIDADE: Record<string, TipoUnidade> = {
  "Realizado (Matriz)": "MATRIZ",
  "Realizado (Filial)": "FILIAL",
  "Realizado (Serviços)": "SERVICOS",
  "Realizado (Desp.+Extra)": "DESPESAS",
  "Realizado (RN)": "RN",
};

const brutas: LinhaBruta[] = JSON.parse(
  readFileSync(join(aqui, "carga-inicial", "dre-estrutura.json"), "utf8"),
);

// A linha 1 é o cabeçalho da planilha, não uma linha da DRE.
const linhas = brutas.filter((l) => l.linhaPlanilha > 1 && texto(l.descricao));

// ---------------------------------------------------------------------------
// 1. Classificar cada linha
// ---------------------------------------------------------------------------

type LinhaClassificada = LinhaBruta & {
  tipo: TipoLinhaDRE;
  codigo: string;
  unidades: Set<TipoUnidade>;
  intervalo: [number, number] | null;
  referencias: number[];
};

const REF_UNIDADE = /'(Realizado \([^)]*\))'!B(\d+)/g;
const SOMA_INTERVALO = /^SUM\(B(\d+):B(\d+)\)(\/2)?$/;
const REF_LOCAL = /\bB(\d+)\b/g;

function classificar(l: LinhaBruta): LinhaClassificada {
  const f = l.formula?.trim() ?? null;
  const unidades = new Set<TipoUnidade>();
  let tipo: TipoLinhaDRE = "SECAO";
  let intervalo: [number, number] | null = null;
  const referencias: number[] = [];

  if (f) {
    const refsUnidade = [...f.matchAll(REF_UNIDADE)];
    if (refsUnidade.length > 0) {
      tipo = "ITEM";
      for (const m of refsUnidade) {
        const u = ABA_PARA_UNIDADE[m[1]];
        if (u) unidades.add(u);
      }
    } else {
      const soma = f.match(SOMA_INTERVALO);
      if (soma) {
        tipo = "SUBTOTAL";
        intervalo = [Number(soma[1]), Number(soma[2])];
      } else if (/\bB\d+\b/.test(f)) {
        tipo = "TOTAL";
        for (const m of f.matchAll(REF_LOCAL)) referencias.push(Number(m[1]));
      }
    }
  }

  return {
    ...l,
    tipo,
    codigo: "",
    unidades,
    intervalo,
    referencias,
  };
}

const classificadas = linhas.map(classificar);
const porLinha = new Map(classificadas.map((c) => [c.linhaPlanilha, c]));

// ---------------------------------------------------------------------------
// 2. Gerar códigos estáveis e únicos
// ---------------------------------------------------------------------------

const usados = new Set<string>();
for (const c of classificadas) {
  const partes = [
    texto(c.grupoSigla),
    texto(c.atribuicaoSigla),
    texto(c.descricao),
  ].filter((p): p is string => p !== null);

  let base = partes.map(slug).join(".");
  if (!base) base = `LINHA_${c.linhaPlanilha}`;

  let codigo = base;
  let n = 2;
  while (usados.has(codigo)) {
    codigo = `${base}.${n}`;
    n++;
  }
  usados.add(codigo);
  c.codigo = codigo;
}

// ---------------------------------------------------------------------------
// 3. Resolver expressões e propagar unidades dos filhos para os pais
// ---------------------------------------------------------------------------

/** Filhos diretos de um subtotal: os subtotais contidos no intervalo; na
 *  ausência deles, os itens. É o que elimina o `/2` da planilha. */
function filhosDiretos(c: LinhaClassificada): LinhaClassificada[] {
  if (!c.intervalo) return [];
  const [ini, fim] = c.intervalo;
  const dentro = classificadas.filter(
    (x) => x.linhaPlanilha >= ini && x.linhaPlanilha <= fim,
  );
  const subtotais = dentro.filter((x) => x.tipo === "SUBTOTAL");
  return subtotais.length > 0 ? subtotais : dentro.filter((x) => x.tipo === "ITEM");
}

// Resolver do fim para o começo garante que os filhos já estão resolvidos.
const ordemResolucao = [...classificadas].sort(
  (a, b) => b.linhaPlanilha - a.linhaPlanilha,
);

const expressoes = new Map<number, string>();
const avisos: string[] = [];

for (const c of ordemResolucao) {
  if (c.tipo === "SUBTOTAL") {
    const filhos = filhosDiretos(c);
    if (filhos.length === 0) {
      avisos.push(`${c.codigo}: subtotal sem filhos no intervalo ${c.intervalo}`);
      continue;
    }
    expressoes.set(c.linhaPlanilha, filhos.map((f) => f.codigo).join(" + "));
    for (const f of filhos) for (const u of f.unidades) c.unidades.add(u);
  } else if (c.tipo === "TOTAL") {
    let expr = c.formula ?? "";
    const refs = [...new Set(c.referencias)].sort((a, b) => b - a);
    for (const r of refs) {
      const alvo = porLinha.get(r);
      if (!alvo) {
        avisos.push(`${c.codigo}: referência B${r} não encontrada`);
        continue;
      }
      expr = expr.replace(new RegExp(`\\bB${r}\\b`, "g"), alvo.codigo);
      for (const u of alvo.unidades) c.unidades.add(u);
    }
    expressoes.set(c.linhaPlanilha, expr);
  }
}

// ---------------------------------------------------------------------------
// 4. Gravar
// ---------------------------------------------------------------------------

const unidades = await prisma.unidadeNegocio.findMany();
const porTipoUnidade = new Map(unidades.map((u) => [u.tipo, u.id]));

const codigosCarregados: string[] = [];
let gravadas = 0;
let vinculosUnidade = 0;

for (const [i, c] of classificadas.entries()) {
  const dados = {
    ordem: i + 1,
    grupo: texto(c.grupo) ?? texto(c.grupoSigla) ?? "—",
    grupoSigla: texto(c.grupoSigla) ?? "—",
    atribuicao: texto(c.atribuicao),
    atribuicaoSigla: texto(c.atribuicaoSigla),
    descricao: c.descricao as string,
    tipo: c.tipo,
    expressao: expressoes.get(c.linhaPlanilha) ?? null,
    definicao: texto(c.definicao),
  };

  const linha = await prisma.linhaDRE.upsert({
    where: { codigo: c.codigo },
    create: { codigo: c.codigo, ...dados },
    update: dados,
  });
  codigosCarregados.push(c.codigo);
  gravadas++;

  await prisma.linhaDREUnidade.deleteMany({ where: { linhaDREId: linha.id } });
  for (const tipoU of c.unidades) {
    const unidadeId = porTipoUnidade.get(tipoU);
    if (!unidadeId) continue;
    await prisma.linhaDREUnidade.create({
      data: { linhaDREId: linha.id, unidadeNegocioId: unidadeId },
    });
    vinculosUnidade++;
  }
}

const { count: removidas } = await prisma.linhaDRE.deleteMany({
  where: { codigo: { notIn: codigosCarregados } },
});

// ---------------------------------------------------------------------------
// 5. Vincular as contas de resultado às linhas da DRE
// ---------------------------------------------------------------------------

type LinhaConta = {
  CD_REDUZIDO: string | null;
  DEPARTAMENTO: string | null;
  "DEP.": string | null;
  "ATRIBUIÇÃO": string | null;
  "ATR.": string | null;
  "CONTA DRE": string | null;
};

const contas: LinhaConta[] = JSON.parse(
  readFileSync(join(aqui, "carga-inicial", "contas-resultado.json"), "utf8"),
);


// A conta aponta para a linha pela tripla (departamento, atribuição, conta DRE),
// que é exatamente a chave que a planilha usa nos SOMASES.
const porTripla = new Map<string, string>();
function triplaDe(c: LinhaClassificada): string {
  return [texto(c.grupo), texto(c.atribuicao), texto(c.descricao)]
    .map((x) => x ?? "")
    .join("|");
}

// Itens primeiro: são o destino natural de um lançamento.
for (const c of classificadas) {
  if (c.tipo !== "ITEM") continue;
  const chave = triplaDe(c);
  if (!porTripla.has(chave)) porTripla.set(chave, c.codigo);
}

// Depois as calculadas. Há linhas que no Consolidado são derivadas mas que nas
// abas de unidade somam lançamentos — "Impostos Operacionais" é o caso: no
// consolidado vem de ROB menos ROL, e em cada unidade vem do balancete.
for (const c of classificadas) {
  if (c.tipo === "ITEM" || c.tipo === "SECAO") continue;
  const chave = triplaDe(c);
  if (!porTripla.has(chave)) porTripla.set(chave, c.codigo);
}

const porCodigo = new Map(
  (await prisma.linhaDRE.findMany({ select: { id: true, codigo: true } })).map(
    (l) => [l.codigo, l.id],
  ),
);

/**
 * A planilha guarda o departamento duas vezes: por extenso e por sigla. A
 * apuração casa pelo nome por extenso; a coluna de checagem `DRE?` casa pela
 * sigla. Quando os dois discordam, a checagem aprova e a apuração descarta o
 * lançamento sem avisar. Aqui os pares vistos na DRE servem de referência.
 */
const siglaPorGrupo = new Map<string, Set<string>>();
for (const c of classificadas) {
  const g = texto(c.grupo);
  const s = texto(c.grupoSigla);
  if (!g || !s) continue;
  if (!siglaPorGrupo.has(g)) siglaPorGrupo.set(g, new Set());
  siglaPorGrupo.get(g)!.add(s);
}

const incoerentes: string[] = [];

let vinculadas = 0;
let semDestino = 0;
const semDestinoExemplos: string[] = [];

for (const conta of contas) {
  const reduzido = texto(conta.CD_REDUZIDO);
  if (!reduzido) continue;

  const ajuste = ajusteDaConta(reduzido);

  const contaDRE = ajuste?.contaDRE ?? texto(conta["CONTA DRE"]);
  if (!contaDRE) continue;

  const dep = ajuste?.departamento ?? texto(conta.DEPARTAMENTO);
  const depSigla = ajuste?.depSigla ?? texto(conta["DEP."]);
  if (dep && depSigla) {
    const siglasValidas = siglaPorGrupo.get(dep);
    if (siglasValidas && !siglasValidas.has(depSigla)) {
      incoerentes.push(
        `${reduzido} — "${dep}" com sigla "${depSigla}" (esperado: ${[...siglasValidas].join(", ")})`,
      );
    }
  }

  const chave = [dep, ajuste?.atribuicao ?? texto(conta["ATRIBUIÇÃO"]), contaDRE]
    .map((x) => x ?? "")
    .join("|");

  const codigo = porTripla.get(chave);
  if (!codigo) {
    semDestino++;
    if (semDestinoExemplos.length < 8) semDestinoExemplos.push(`${reduzido} → ${chave}`);
    continue;
  }

  await prisma.contaResultado.update({
    where: { reduzido },
    data: { linhaDREId: porCodigo.get(codigo) ?? null },
  });
  vinculadas++;
}

// ---------------------------------------------------------------------------

console.log("Carga da estrutura da DRE\n");
const porTipo = classificadas.reduce<Record<string, number>>((acc, c) => {
  acc[c.tipo] = (acc[c.tipo] ?? 0) + 1;
  return acc;
}, {});
console.log(`Linhas gravadas: ${gravadas} (${removidas} removidas de cargas anteriores)`);
console.log(`  por tipo: ${Object.entries(porTipo).map(([t, n]) => `${t}=${n}`).join(" ")}`);
console.log(`Vínculos linha↔unidade: ${vinculosUnidade}`);
console.log(`\nContas vinculadas a uma linha da DRE: ${vinculadas}`);
console.log(`Contas com destino declarado mas sem linha correspondente: ${semDestino}`);
for (const e of semDestinoExemplos) console.log(`  ${e}`);

relatarAjustesConta();

console.log(
  `\nContas com departamento e sigla incoerentes: ${incoerentes.length}`,
);
for (const i of incoerentes.slice(0, 10)) console.log(`  ${i}`);
if (incoerentes.length > 10) console.log(`  ... e mais ${incoerentes.length - 10}`);

if (avisos.length > 0) {
  console.log(`\n${avisos.length} aviso(s) na resolução de expressões:`);
  for (const a of avisos.slice(0, 10)) console.log(`  ${a}`);
}

const primeiras = await prisma.linhaDRE.findMany({
  orderBy: { ordem: "asc" },
  take: 14,
  select: { ordem: true, tipo: true, descricao: true, unidades: true },
});
console.log("\nA DRE na ordem, como o sistema a devolve:");
for (const l of primeiras) {
  const marca = { SECAO: "§", ITEM: " ", SUBTOTAL: "Σ", TOTAL: "=" }[l.tipo];
  console.log(
    `  ${String(l.ordem).padStart(3)} ${marca} ${l.descricao.padEnd(46)} ${l.unidades.length} un.`,
  );
}

console.log("\nExemplos de expressão traduzida:");
const exemplos = classificadas
  .filter((c) => c.tipo === "SUBTOTAL" || c.tipo === "TOTAL")
  .slice(0, 6);
for (const e of exemplos) {
  console.log(`  [${e.tipo}] ${e.codigo}`);
  console.log(`      planilha: ${e.formula}`);
  console.log(`      sistema : ${expressoes.get(e.linhaPlanilha)}`);
}
