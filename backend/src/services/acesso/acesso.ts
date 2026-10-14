import { getPrismaClient } from "../../config/prisma.js";
import type { AcaoPermissao, DepartamentoAcesso, RecursoSistema, TipoImportacao } from "../../generated/prisma/enums.js";

/**
 * Quem é o usuário e o que ele alcança (Passo 22).
 *
 * As permissões pertencem ao perfil — Ler ou Editar em cada grupo de telas do
 * menu lateral (11/10/2026) — e viram a lista "área:acao" que as rotas
 * verificam (permissoesDasRotas). Os recortes por dado vêm do perfil (se ele
 * recorta) e do usuário (quais setores, quais departamentos).
 *
 * O backend relê isso do banco a cada requisição, e não do token: inativar
 * um usuário ou um perfil, ou mudar uma permissão, vale na hora.
 */

/**
 * O perfil Administrador (14/10/2026): acesso total a todas as telas, sem recortes — as permissões vêm do código do
 * perfil, não da matriz gravada, para as telas novas entrarem sozinhas.
 */
export const CODIGO_ADMINISTRADOR = "ADMINISTRADOR";

export type Acesso = {
  /** Só as listas operacionais dos setores do usuário. */
  recorteSetor: boolean;
  setores: TipoImportacao[];
  /** Só as movimentações e os centros de custo dos departamentos do usuário. */
  recorteDepartamento: boolean;
  departamentos: DepartamentoAcesso[];
  /** Só os centros de custo marcados no usuário (da gestão dele), e as movimentações só dentro deles (11/10/2026). */
  recorteCentro: boolean;
  gestao: DepartamentoAcesso | null;
  /** Os ids dos centros de custo do usuário. */
  centros: string[];
  /** Com recorte por centro de custo: vê os resultados das obras, nas linhas da gestão dele. */
  veObras: boolean;
};

export type UsuarioAutenticado = {
  sub: string;
  email: string;
  nome: string;
  perfil: { codigo: string; nome: string };
  permissions: string[];
  acesso: Acesso;
};

/**
 * As áreas que cada grupo do menu libera nas rotas, no nível do grupo. O Fechamento Mensal libera todas as etapas do
 * mês e o abrir, fechar e reabrir (fechamento:ler é o próprio item do menu). A DRE e os indicadores do mês são os
 * mesmos números dos Resultados Realizados: as rotas deles aceitam qualquer dos dois (dre ou resultados).
 */
const AREAS_DO_GRUPO: Record<RecursoSistema, string[]> = {
  CENARIOS_SINTETICOS: ["cenarios"],
  CENARIOS_ANALITICOS: ["cenarios_analiticos"],
  RESULTADOS_REALIZADOS: ["resultados"],
  FECHAMENTO_MENSAL: ["fechamento", "competencia", "importacao", "listas_operacionais", "lancamentos_manuais", "classificacao", "apuracao", "dre", "divergencia"],
  CADASTROS_APURACAO: ["cadastros_apuracao"],
  CADASTROS_CONTROLADORIA: ["cadastros_controladoria"],
  CONTROLE_USUARIOS: ["usuarios", "auditoria"],
};
/**
 * O recorte por departamento (Gestor) vale na DRE, nos centros de custo e nas divergências. A classificação, os
 * lançamentos manuais, a apuração (receita, rateios, estoque, conferência) e a auditoria mostram lançamentos de todos
 * os departamentos: quem tem o recorte não as alcança, mesmo com o grupo liberado, senão o recorte seria contornado.
 * O mesmo vale para o recorte por centro de custo (Coordenador).
 */
const FORA_DO_RECORTE_DE_DEPARTAMENTO = new Set(["classificacao", "lancamentos_manuais", "apuracao", "auditoria"]);
/** O recorte por setor (Alimentador) é o das listas operacionais: no Fechamento Mensal, só Importações e Listas. */
const DENTRO_DO_RECORTE_DE_SETOR = new Set(["fechamento", "importacao", "listas_operacionais"]);

/** Grupo × ação do perfil → a lista "área:acao" das rotas, com Editar implicando Ler e os recortes aplicados. */
export function permissoesDasRotas(
  permissoes: Array<{ recurso: RecursoSistema; acao: AcaoPermissao }>,
  recortes: { recorteSetor: boolean; recorteDepartamento: boolean; recorteCentro?: boolean },
): string[] {
  const lista = new Set<string>();
  for (const p of permissoes) {
    for (const area of AREAS_DO_GRUPO[p.recurso] ?? []) {
      if ((recortes.recorteDepartamento || recortes.recorteCentro) && FORA_DO_RECORTE_DE_DEPARTAMENTO.has(area)) continue;
      if (recortes.recorteSetor && p.recurso === "FECHAMENTO_MENSAL" && !DENTRO_DO_RECORTE_DE_SETOR.has(area)) continue;
      lista.add(`${area}:ler`);
      if (p.acao === "EDITAR") lista.add(`${area}:editar`);
    }
  }
  return [...lista];
}

/** O usuário com permissões e recortes; nulo se não existe, está inativo ou tem perfil inativo. */
export async function carregarUsuario(filtro: { id: string } | { email: string }): Promise<(UsuarioAutenticado & { senhaHash: string }) | null> {
  const usuario = await getPrismaClient().usuario.findUnique({
    where: filtro,
    select: {
      id: true,
      nome: true,
      email: true,
      senhaHash: true,
      ativo: true,
      setores: { select: { tipoLista: true } },
      departamentos: { select: { departamento: true } },
      gestao: true,
      veObras: true,
      centros: { select: { centroCustoId: true } },
      perfil: {
        select: {
          codigo: true,
          nome: true,
          ativo: true,
          recorteSetor: true,
          recorteDepartamento: true,
          recorteCentro: true,
          permissoes: { select: { recurso: true, acao: true } },
        },
      },
    },
  });
  if (!usuario || !usuario.ativo || !usuario.perfil.ativo) return null;
  if (usuario.perfil.codigo === CODIGO_ADMINISTRADOR) {
    const todas = (Object.keys(AREAS_DO_GRUPO) as RecursoSistema[]).map((recurso) => ({ recurso, acao: "EDITAR" as AcaoPermissao }));
    return {
      sub: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
      senhaHash: usuario.senhaHash,
      perfil: { codigo: usuario.perfil.codigo, nome: usuario.perfil.nome },
      permissions: permissoesDasRotas(todas, { recorteSetor: false, recorteDepartamento: false, recorteCentro: false }),
      acesso: ACESSO_TOTAL,
    };
  }
  return {
    sub: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    senhaHash: usuario.senhaHash,
    perfil: { codigo: usuario.perfil.codigo, nome: usuario.perfil.nome },
    permissions: permissoesDasRotas(usuario.perfil.permissoes, usuario.perfil),
    acesso: {
      recorteSetor: usuario.perfil.recorteSetor,
      setores: usuario.setores.map((s) => s.tipoLista),
      recorteDepartamento: usuario.perfil.recorteDepartamento,
      departamentos: usuario.departamentos.map((d) => d.departamento),
      recorteCentro: usuario.perfil.recorteCentro,
      gestao: usuario.gestao,
      centros: usuario.centros.map((c) => c.centroCustoId),
      veObras: usuario.veObras,
    },
  };
}

/** Acesso irrestrito: o de quem não tem recorte nenhum (o Contábil). Para scripts e chamadas internas. */
export const ACESSO_TOTAL: Acesso = { recorteSetor: false, setores: [], recorteDepartamento: false, departamentos: [], recorteCentro: false, gestao: null, centros: [], veObras: false };

/** O usuário alcança esta lista operacional? */
export const alcancaLista = (acesso: Acesso, tipo: string) => !acesso.recorteSetor || acesso.setores.includes(tipo as TipoImportacao);
