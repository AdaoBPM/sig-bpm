/**
 * Carga inicial: perfis e usuário inicial, unidades de negócio, linhas, e os
 * cadastros vindos das planilhas (centros de custo, contas de resultado e
 * estrutura da DRE — ver cargaCadastros.ts).
 *
 * Os JSON em prisma/carga-inicial/ são exportações fiéis do SIG BPM 2026 -
 * UNIDADES E CENTROS DE CUSTO (exportar-cadastros.ts). A carga é idempotente.
 *
 * Uso: npx tsx prisma/carga-inicial.ts
 */
import "dotenv/config";
import { getPrismaClient } from "../src/config/prisma.js";
import type { AcaoPermissao, RecursoSistema } from "../src/generated/prisma/enums.js";
import { carregarCadastrosDaPasta } from "./cargaCadastros.js";

const prisma = getPrismaClient();

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

/**
 * Os três vocabulários de "linha" da planilha (ver SPEC, entidade Linha).
 *
 *  - PRODUTO: ESTRUTURA, ALVEOLARES e ESTACAS não estão em nenhuma aba — são o resultado das fórmulas de Linha das
 *    listas operacionais (ESTRUTURA na Unidade 01; ESTACAS ou ALVEOLARES na 02).
 *    METALÚRGICA vem da coluna LINHA da aba DRE do CONTROLE DAS VENDAS - COMERCIAL
 *    (itens metálicos produzidos na Matriz).
 *  - OBRA e FATURAMENTO: colunas LINHAS (OBRAS) e FATURAMENTOS (OBRAS) da aba
 *    Listas do SIG BPM 2026 - LISTAS REALIZADO (OPERAÇÃO).
 *
 * O código é o texto que as listas usam; é por ele que a importação resolve a linha.
 */
const LINHAS: Array<{ tipo: "PRODUTO" | "OBRA" | "FATURAMENTO"; codigo: string; nome: string }> = [
  { tipo: "PRODUTO", codigo: "ESTRUTURA", nome: "Estrutura" },
  { tipo: "PRODUTO", codigo: "ALVEOLARES", nome: "Alveolares" },
  { tipo: "PRODUTO", codigo: "ESTACAS", nome: "Estacas" },
  { tipo: "PRODUTO", codigo: "METALÚRGICA", nome: "Metalúrgica" },
  { tipo: "OBRA", codigo: "FUNDAÇÃO", nome: "Fundação" },
  { tipo: "OBRA", codigo: "MONTAGEM", nome: "Montagem" },
  { tipo: "OBRA", codigo: "VEDAÇÃO", nome: "Vedação" },
  { tipo: "OBRA", codigo: "CAPEAMENTO", nome: "Capeamento" },
  { tipo: "OBRA", codigo: "METÁLICA", nome: "Metálica" },
  { tipo: "OBRA", codigo: "TELHAMENTO", nome: "Telhamento" },
  { tipo: "OBRA", codigo: "OUTROS", nome: "Outros" },
  { tipo: "FATURAMENTO", codigo: "Frete e Descarga", nome: "Frete e Descarga" },
  { tipo: "FATURAMENTO", codigo: "Execução de Serviços", nome: "Execução de Serviços" },
  { tipo: "FATURAMENTO", codigo: "Materiais Aplicados", nome: "Materiais Aplicados" },
  { tipo: "FATURAMENTO", codigo: "Equipamentos Locados", nome: "Equipamentos Locados" },
];

async function carregarLinhas() {
  for (const [i, l] of LINHAS.entries()) {
    await prisma.linha.upsert({
      where: { tipo_codigo: { tipo: l.tipo, codigo: l.codigo } },
      create: { ...l, ordem: i + 1 },
      update: { nome: l.nome, ordem: i + 1 },
    });
  }
  return LINHAS.length;
}

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
const linhas = await carregarLinhas();

console.log("Carga inicial\n");
console.log(`Perfis              : ${perfis.perfis} gravados, com o usuário inicial`);
console.log(`Unidades de negócio : ${un} gravadas`);
console.log(`Linhas              : ${linhas} gravadas (produto, obra e faturamento)`);
await carregarCadastrosDaPasta();
