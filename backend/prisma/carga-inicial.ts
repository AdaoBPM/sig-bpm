/**
 * Carga inicial dos cadastros, a partir das planilhas atuais do SIG.
 *
 * Os arquivos em prisma/carga-inicial/*.json são exportações fiéis das abas do
 * SIG BPM 2026 - UNIDADES E CENTROS DE CUSTO, com uma chave por coluna. Ficam
 * versionados de propósito: é o retrato do cadastro no momento da migração, e
 * é contra ele que a conferência de contagem é feita.
 *
 * A carga é idempotente — rodar de novo atualiza em vez de duplicar.
 *
 * Uso: npx tsx prisma/carga-inicial.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPrismaClient } from "../src/config/prisma.js";
import { ajusteDaConta, relatarAjustesConta } from "./ajustes-carga.js";
import type {
  AcaoPermissao,
  AtribuicaoCusto,
  BaldeAlocacao,
  RecursoSistema,
  SinalBalancete,
  TipoConta,
} from "../src/generated/prisma/enums.js";

const prisma = getPrismaClient();
const aqui = dirname(fileURLToPath(import.meta.url));

function lerJson<T>(arquivo: string): T[] {
  return JSON.parse(readFileSync(join(aqui, "carga-inicial", arquivo), "utf8"));
}

/** "-" e vazio são ausência de valor nas planilhas. */
function texto(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const s = v.trim();
  return s === "" || s === "-" ? null : s;
}

function inteiro(v: string | null | undefined): number | null {
  const s = texto(v);
  if (s === null) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * A coluna RATEIO carrega tanto chaves de rateio quanto baldes diretos.
 * Os acentos e a cedilha da planilha não existem no enum.
 */
const BALDES: Record<string, BaldeAlocacao> = {
  PROJETO: "PROJETO",
  PRODUÇÃO: "PRODUCAO",
  PRODUCAO: "PRODUCAO",
  METALURGIA: "METALURGIA",
  ARMADURA: "ARMADURA",
  ACOMPANHAMENTO: "ACOMPANHAMENTO",
  UNIDADE: "UNIDADE",
  MATRIZ: "MATRIZ",
  FILIAL: "FILIAL",
  OBRAS: "OBRAS",
  COMPLEMENTAR: "COMPLEMENTAR",
  DESPESAS: "DESPESAS",
  EXTRA: "EXTRA",
  RN: "RN",
  LEBEN: "LEBEN",
};

type Aviso = { origem: string; chave: string; motivo: string };
const avisos: Aviso[] = [];

function balde(v: string | null | undefined, origem: string, chave: string) {
  const s = texto(v);
  if (s === null) return null;
  const b = BALDES[s.toUpperCase()];
  if (!b) {
    avisos.push({ origem, chave, motivo: `balde desconhecido: "${s}"` });
    return null;
  }
  return b;
}

// -----------------------------------------------------------------------------
// Centros de custo
// -----------------------------------------------------------------------------

/**
 * Correções acordadas com a controladoria em 24/09/2026, aplicadas na carga.
 *
 * Ficam aqui, e não nos JSON, porque os JSON são exportações fiéis da planilha:
 * misturar correção com origem tornaria impossível saber o que veio de onde.
 * Conforme a planilha for corrigida, cada ajuste vira um no-op e o carregador
 * avisa — é o sinal de que a entrada pode sair daqui.
 *
 * O ERP repete o mesmo código de centro de custo em registros diferentes, o que
 * na planilha passa despercebido porque o ÍNDICE/CORRESP devolve a primeira
 * ocorrência. Aqui a chave é única, então a ambiguidade precisa ser resolvida.
 */
const CENTRO_CUSTO_RENOMEAR: Array<{
  codigo: string;
  nomeRM: string;
  novoCodigo: string;
  motivo: string;
}> = [
  {
    codigo: "1.11.00000006",
    nomeRM: "LABORATORIO",
    novoCodigo: "1.11.00000006.1",
    motivo:
      "setor novo, criado gerencialmente para atender as duas filiais; o código definitivo do ERP ainda será cadastrado",
  },
];

const CENTRO_CUSTO_CONTROLADORIA: Array<{
  codigo: string;
  nomeRM: string;
  nomeControladoria: string;
  motivo: string;
}> = [
  {
    codigo: "1.11.00000006",
    nomeRM: "LABORATORIO (CRI)",
    nomeControladoria: "LABORATÓRIO (CRI)",
    motivo: "diferenciar do LABORATORIO novo, que herdou o nome de grupo",
  },
];

/** Registros descartados: mesmo código, nome que mudou ao longo do tempo. */
const CENTRO_CUSTO_DESCARTAR: Array<{
  codigo: string;
  nomeRM: string;
  motivo: string;
}> = [
  {
    codigo: "1.01.00000004",
    nomeRM: "CONTROLADORIA",
    motivo: "nome antigo; vale CONTABILIDADE E CONTROLADORIA",
  },
  {
    codigo: "1.15.00000008",
    nomeRM: "MANUTENCAO PREDIAL FILIAL (ADMINISTRATIVO / REFEITORIO)",
    motivo: "nome antigo; vale PREDIAL (FOR)",
  },
  {
    codigo: "1.15.00000008",
    nomeRM: "MANUTENCAO PREDIAL/PATIO FILIAL (FABRICA)",
    motivo: "nome antigo; vale PREDIAL (FOR)",
  },
  {
    codigo: "1.96.00000012",
    nomeRM: "BPM",
    motivo:
      "centro de movimentação de insumos de almoxarifado, sem classificação; mantida a primeira ocorrência",
  },
  {
    codigo: "1.96.00000013",
    nomeRM: "ESTOQUE ALMOXARIFADO",
    motivo:
      "centro de movimentação de insumos de almoxarifado, sem classificação; mantida a primeira ocorrência",
  },
];

/**
 * Rateio corrigido pela controladoria em 25/09/2026, ainda não refletido na
 * planilha. Tem precedência sobre a substituição geral abaixo.
 */
const CENTRO_CUSTO_RATEIO: Array<{ codigo: string; rateio: string; motivo: string }> = [
  {
    codigo: "1.15.00000004",
    rateio: "DESPESAS",
    motivo:
      "FATURAMENTO (FOR) é despesa administrativa; a planilha já o tratava assim, por coincidência de nome com 1.01.00000008",
  },
];

/**
 * Rateio de centro de custo que deixa de existir (controladoria, 25/09/2026):
 * MATRIZ e FILIAL passam a UNIDADE. Aplicado a todo centro, e não por registro.
 */
const CENTRO_CUSTO_RATEIO_SUBSTITUIR: Record<string, string> = {
  MATRIZ: "UNIDADE",
  FILIAL: "UNIDADE",
};

const ajustesUsados = new Set<string>();

function rateioDoCentro(codigoRM: string | null, rateio: string | null): string | null {
  const especifico = CENTRO_CUSTO_RATEIO.find((r) => r.codigo === codigoRM);
  if (especifico) {
    ajustesUsados.add(`rateio:${especifico.codigo}`);
    return especifico.rateio;
  }
  const bruto = texto(rateio)?.toUpperCase();
  const novo = bruto ? CENTRO_CUSTO_RATEIO_SUBSTITUIR[bruto] : undefined;
  if (novo) {
    ajustesUsados.add(`substituir:${bruto}`);
    return novo;
  }
  return rateio;
}

type LinhaCentroCusto = {
  COLIGADA: string | null;
  "CÓDIGO RM": string | null;
  "CENTRO DE CUSTO (RM)": string | null;
  "CENTRO DE CUSTO (CONTROLADORIA)": string | null;
  DEPARTAMENTO: string | null;
  "DEP.": string | null;
  "ATRIBUIÇÃO": string | null;
  "ATR.": string | null;
  RATEIO: string | null;
};

async function carregarCentrosCusto() {
  const linhas = lerJson<LinhaCentroCusto>("centros-custo.json");
  let gravados = 0;
  let ignorados = 0;

  // Centros sem código no ERP não podem ser conciliados por chave, então são
  // recriados a cada carga em vez de atualizados — o que mantém a idempotência.
  await prisma.centroCusto.deleteMany({ where: { codigoRM: null } });

  let descartados = 0;
  const codigosCarregados: string[] = [];

  for (const [i, l] of linhas.entries()) {
    let codigoRM = texto(l["CÓDIGO RM"]);
    const nomeRM = texto(l["CENTRO DE CUSTO (RM)"]);
    const coligada = inteiro(l.COLIGADA);

    if (!nomeRM) {
      ignorados++;
      avisos.push({
        origem: "centros-custo",
        chave: codigoRM ?? `linha ${i + 2}`,
        motivo: "sem nome",
      });
      continue;
    }

    const descarte = CENTRO_CUSTO_DESCARTAR.find(
      (d) => d.codigo === codigoRM && d.nomeRM === nomeRM,
    );
    if (descarte) {
      ajustesUsados.add(`descartar:${descarte.codigo}:${descarte.nomeRM}`);
      descartados++;
      continue;
    }

    const renomear = CENTRO_CUSTO_RENOMEAR.find(
      (r) => r.codigo === codigoRM && r.nomeRM === nomeRM,
    );
    if (renomear) {
      ajustesUsados.add(`renomear:${renomear.codigo}:${renomear.nomeRM}`);
      codigoRM = renomear.novoCodigo;
    }

    const ctrlOverride = CENTRO_CUSTO_CONTROLADORIA.find(
      (c) => c.codigo === texto(l["CÓDIGO RM"]) && c.nomeRM === nomeRM,
    );
    if (ctrlOverride) {
      ajustesUsados.add(`controladoria:${ctrlOverride.codigo}:${ctrlOverride.nomeRM}`);
    }

    const atrTexto = texto(l["ATRIBUIÇÃO"])?.toUpperCase();
    const atribuicao: AtribuicaoCusto | null =
      atrTexto === "DIRETA" || atrTexto === "INDIRETA" ? atrTexto : null;
    if (atrTexto && !atribuicao) {
      avisos.push({
        origem: "centros-custo",
        chave: codigoRM,
        motivo: `atribuição desconhecida: "${atrTexto}"`,
      });
    }

    const dados = {
      coligada,
      nomeRM,
      nomeControladoria:
        ctrlOverride?.nomeControladoria ??
        texto(l["CENTRO DE CUSTO (CONTROLADORIA)"]),
      departamento: texto(l.DEPARTAMENTO),
      departamentoSigla: texto(l["DEP."]),
      atribuicao,
      atribuicaoSigla: texto(l["ATR."]),
      balde: balde(rateioDoCentro(codigoRM, l.RATEIO), "centros-custo", codigoRM ?? nomeRM),
      ordem: i + 1,
    };

    if (codigoRM) {
      await prisma.centroCusto.upsert({
        where: { codigoRM },
        create: { codigoRM, ...dados },
        update: dados,
      });
      codigosCarregados.push(codigoRM);
    } else {
      await prisma.centroCusto.create({ data: { codigoRM: null, ...dados } });
    }
    gravados++;
  }

  // Centros que estavam no banco de uma carga anterior e não vieram desta vez
  // são removidos — senão um registro descartado por ajuste sobreviveria.
  const { count: removidos } = await prisma.centroCusto.deleteMany({
    where: { codigoRM: { notIn: codigosCarregados, not: null } },
  });

  return { lidos: linhas.length, gravados, ignorados, descartados, removidos };
}

// -----------------------------------------------------------------------------
// Contas de resultado
// -----------------------------------------------------------------------------

type LinhaContaResultado = {
  CD_REDUZIDO: string | null;
  CONTA: string | null;
  DESCRICAO: string | null;
  TIPO_CONTA: string | null;
  DEPARTAMENTO: string | null;
  "DEP.": string | null;
  "ATRIBUIÇÃO": string | null;
  "ATR.": string | null;
  "CONTA DRE": string | null;
  RATEIO: string | null;
  "SINAL BAL.": string | null;
};

async function carregarContasResultado() {
  const linhas = lerJson<LinhaContaResultado>("contas-resultado.json");
  let gravados = 0;
  let ignorados = 0;

  for (const [i, l] of linhas.entries()) {
    // O reduzido é TEXTO: além dos códigos numéricos do ERP, carrega as contas
    // gerenciais `RN.*` e a família com sufixo `.D`.
    const reduzido = texto(l.CD_REDUZIDO);
    const conta = texto(l.CONTA);
    const descricao = texto(l.DESCRICAO);

    if (!reduzido || !conta || !descricao) {
      ignorados++;
      avisos.push({
        origem: "contas-resultado",
        chave: conta ?? `linha ${i + 2}`,
        motivo: "sem reduzido, conta ou descrição",
      });
      continue;
    }

    const tipoTexto = texto(l.TIPO_CONTA)?.toUpperCase();
    const tipoConta: TipoConta =
      tipoTexto === "ANALITICA" ? "ANALITICA" : "SINTETICA";
    if (tipoTexto && tipoTexto !== "ANALITICA" && tipoTexto !== "SINTETICA") {
      avisos.push({
        origem: "contas-resultado",
        chave: conta,
        motivo: `tipo de conta desconhecido: "${tipoTexto}" — tratado como SINTETICA`,
      });
    }

    // Aqui "-" É um valor: significa negativo. Só vazio é ausência.
    const sinalBruto = (l["SINAL BAL."] ?? "").trim();
    const sinalBalancete: SinalBalancete | null =
      sinalBruto === "+" ? "POSITIVO" : sinalBruto === "-" ? "NEGATIVO" : null;

    const ajuste = ajusteDaConta(reduzido);

    const dados = {
      conta,
      descricao,
      tipoConta,
      departamento: ajuste?.departamento ?? texto(l.DEPARTAMENTO),
      atribuicao: ajuste?.atribuicao ?? texto(l["ATRIBUIÇÃO"]),
      sinalBalancete,
      balde: balde(l.RATEIO, "contas-resultado", conta),
      ordem: i + 1,
      // linhaDREId é preenchido no Passo 7, depois que a estrutura da DRE existir.
    };

    await prisma.contaResultado.upsert({
      where: { reduzido },
      create: { reduzido, ...dados },
      update: dados,
    });
    gravados++;
  }

  return { lidos: linhas.length, gravados, ignorados };
}

// -----------------------------------------------------------------------------
// Unidades de negócio
//
// Não vêm de nenhuma aba: são as visões em que a DRE é apurada, hoje
// representadas pelas abas `Realizado (...)` do arquivo do SIG.
// -----------------------------------------------------------------------------

const UNIDADES = [
  { codigo: 1, nome: "Matriz", tipo: "MATRIZ" as const },
  { codigo: 2, nome: "Filial", tipo: "FILIAL" as const },
  { codigo: 3, nome: "Serviços", tipo: "SERVICOS" as const },
  { codigo: 4, nome: "Despesas e Extra", tipo: "DESPESAS" as const },
  { codigo: 5, nome: "RN", tipo: "RN" as const },
];

async function carregarUnidades() {
  for (const [i, u] of UNIDADES.entries()) {
    const dados = { nome: u.nome, tipo: u.tipo, ordem: i + 1 };
    await prisma.unidadeNegocio.upsert({
      where: { codigo: u.codigo },
      create: { codigo: u.codigo, ...dados },
      update: dados,
    });
  }
  return UNIDADES.length;
}

// -----------------------------------------------------------------------------


// -----------------------------------------------------------------------------
// Perfis e usuário inicial
//
// A partir do Passo 9 as entidades registram autor — quem abriu a competência,
// quem apurou, quem fechou. Sem um usuário real no banco, a chave estrangeira
// não fecha. Estes registros são o mínimo para isso; as telas de gestão de
// usuários e a autenticação real entram no Passo 22.
// -----------------------------------------------------------------------------

const RECURSOS: RecursoSistema[] = [
  "CADASTROS",
  "USUARIOS",
  "COMPETENCIA",
  "IMPORTACAO",
  "LISTAS_OPERACIONAIS",
  "LANCAMENTOS_MANUAIS",
  "CLASSIFICACAO",
  "APURACAO",
  "DRE",
  "DIVERGENCIA",
  "AUDITORIA",
];

const ACOES: AcaoPermissao[] = ["VER", "LER", "EDITAR"];

const PERFIS: Array<{
  codigo: string;
  nome: string;
  descricao: string;
  ordem: number;
  permissoes: Array<{ recurso: RecursoSistema; acao: AcaoPermissao }>;
}> = [
  {
    codigo: "CONTABIL",
    nome: "Contábil",
    descricao: "Opera o fechamento, parametriza os cadastros e confere os resultados",
    ordem: 1,
    permissoes: RECURSOS.flatMap((recurso) => ACOES.map((acao) => ({ recurso, acao }))),
  },
  {
    codigo: "ALIMENTADOR",
    nome: "Alimentador",
    descricao: "Digita e importa as listas operacionais dos seus setores",
    ordem: 2,
    permissoes: (["VER", "LER", "EDITAR"] as AcaoPermissao[]).map((acao) => ({
      recurso: "LISTAS_OPERACIONAIS" as RecursoSistema,
      acao,
    })),
  },
  {
    codigo: "GESTAO",
    nome: "Gestão",
    descricao: "Consulta a DRE apurada, os fechamentos e as divergências",
    ordem: 3,
    permissoes: (["DRE", "DIVERGENCIA"] as RecursoSistema[]).flatMap((recurso) =>
      (["VER", "LER"] as AcaoPermissao[]).map((acao) => ({ recurso, acao })),
    ),
  },
];

/** Mesmo id que o login de desenvolvimento emite no `sub` do token, para que
 *  o usuário autenticado corresponda a uma linha real do banco. */
const USUARIO_INICIAL_ID = "00000000-0000-0000-0000-000000000001";
/** bcrypt de "admin123" — herdado do login de demonstração do molde. */
const USUARIO_INICIAL_SENHA =
  "$2b$10$TfWpTldLcP8P4w0bOlhMw.b5i1v2neNtOCAGdEJjZNZGhF6BPPsQ6";

async function carregarPerfisEUsuario() {
  let perfilContabilId = "";

  for (const p of PERFIS) {
    const perfil = await prisma.perfil.upsert({
      where: { codigo: p.codigo },
      create: {
        codigo: p.codigo,
        nome: p.nome,
        descricao: p.descricao,
        sistema: true,
        ordem: p.ordem,
      },
      update: { nome: p.nome, descricao: p.descricao, sistema: true, ordem: p.ordem },
    });

    // A matriz é reescrita inteira: é pequena, e assim a carga reflete
    // exatamente o que está declarado aqui.
    await prisma.perfilPermissao.deleteMany({ where: { perfilId: perfil.id } });
    for (const perm of p.permissoes) {
      await prisma.perfilPermissao.create({
        data: { perfilId: perfil.id, recurso: perm.recurso, acao: perm.acao },
      });
    }

    if (p.codigo === "CONTABIL") perfilContabilId = perfil.id;
  }

  await prisma.usuario.upsert({
    where: { id: USUARIO_INICIAL_ID },
    create: {
      id: USUARIO_INICIAL_ID,
      nome: "Administrador BPM",
      email: "admin@bpm.com",
      senhaHash: USUARIO_INICIAL_SENHA,
      perfilId: perfilContabilId,
      ordem: 1,
    },
    update: { perfilId: perfilContabilId, ativo: true },
  });

  return { perfis: PERFIS.length };
}

const perfis = await carregarPerfisEUsuario();
const un = await carregarUnidades();
const cc = await carregarCentrosCusto();
const cr = await carregarContasResultado();

console.log("Carga inicial dos cadastros\n");
console.log(`Perfis              : ${perfis.perfis} gravados, com o usuário inicial`);
console.log(`Unidades de negócio : ${un} gravadas`);
console.log(
  `Centros de custo    : ${cc.gravados} gravados, ${cc.descartados} descartados por ajuste, ${cc.ignorados} ignorados (de ${cc.lidos} lidos)`,
);
console.log(`Contas de resultado : ${cr.gravados} gravados, ${cr.ignorados} ignorados (de ${cr.lidos} lidos)`);

// Ajustes previstos que não encontraram correspondência são sinal de que a
// planilha já foi corrigida — e de que a entrada pode sair do carregador.
const previstos = [
  ...CENTRO_CUSTO_RENOMEAR.map((r) => ({ chave: `renomear:${r.codigo}:${r.nomeRM}`, d: `renomear ${r.nomeRM} (${r.codigo})` })),
  ...CENTRO_CUSTO_CONTROLADORIA.map((c) => ({ chave: `controladoria:${c.codigo}:${c.nomeRM}`, d: `controladoria de ${c.nomeRM}` })),
  ...CENTRO_CUSTO_DESCARTAR.map((d2) => ({ chave: `descartar:${d2.codigo}:${d2.nomeRM}`, d: `descartar ${d2.nomeRM} (${d2.codigo})` })),
  ...CENTRO_CUSTO_RATEIO.map((r) => ({ chave: `rateio:${r.codigo}`, d: `rateio ${r.rateio} para ${r.codigo}` })),
  ...Object.entries(CENTRO_CUSTO_RATEIO_SUBSTITUIR).map(([de, para]) => ({ chave: `substituir:${de}`, d: `rateio ${de} → ${para}` })),
];
const obsoletos = previstos.filter((p) => !ajustesUsados.has(p.chave));
relatarAjustesConta();

console.log(`\nAjustes de centro de custo aplicados: ${ajustesUsados.size} de ${previstos.length}`);
if (obsoletos.length > 0) {
  console.log("Ajustes sem correspondência (a planilha já foi corrigida?):");
  for (const o of obsoletos) console.log(`  - ${o.d}`);
}

if (avisos.length > 0) {
  console.log(`\n${avisos.length} aviso(s):`);
  for (const a of avisos.slice(0, 20)) {
    console.log(`  [${a.origem}] ${a.chave}: ${a.motivo}`);
  }
  if (avisos.length > 20) console.log(`  ... e mais ${avisos.length - 20}`);
}

// Conferência: distribuição por balde, para comparar com a planilha.
const porBalde = await prisma.contaResultado.groupBy({
  by: ["balde"],
  _count: true,
  orderBy: { _count: { balde: "desc" } },
});
console.log("\nContas de resultado por balde:");
for (const g of porBalde) {
  console.log(`  ${(g.balde ?? "(sem balde)").padEnd(16)} ${g._count}`);
}

const ccPorBalde = await prisma.centroCusto.groupBy({
  by: ["balde"],
  _count: true,
  orderBy: { _count: { balde: "desc" } },
});
console.log("\nCentros de custo por balde:");
for (const g of ccPorBalde) {
  console.log(`  ${(g.balde ?? "(sem balde)").padEnd(16)} ${g._count}`);
}
