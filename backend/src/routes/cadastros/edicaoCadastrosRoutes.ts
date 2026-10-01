import { Router } from "express";

import { edicaoCadastrosController as c } from "../../controllers/cadastros/edicaoCadastrosController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { verificarPermissao } from "../../middlewares/verificarPermissao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const ler = verificarPermissao("cadastros:ler");
const editar = verificarPermissao("cadastros:editar");

/**
 * Edição dos cadastros (Passo 25): montado em /cadastros/edicao. A entidade é
 * centros-custo, contas-resultado, reclassificacoes, estrutura-dre, unidades,
 * regras-rateio, tipos-movimento ou tabela-estacas.
 */
export const edicaoCadastrosRoutes = Router();
edicaoCadastrosRoutes.get("/:entidade/definicao", autenticacao, ler, asyncHandler(c.definicao));
edicaoCadastrosRoutes.get("/:entidade", autenticacao, ler, asyncHandler(c.listar));
edicaoCadastrosRoutes.get("/:entidade/:id", autenticacao, ler, asyncHandler(c.ler));
edicaoCadastrosRoutes.post("/:entidade", autenticacao, editar, asyncHandler(c.criar));
edicaoCadastrosRoutes.put("/:entidade/:id", autenticacao, editar, asyncHandler(c.atualizar));
edicaoCadastrosRoutes.delete("/:entidade/:id", autenticacao, editar, asyncHandler(c.excluir));
