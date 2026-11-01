import express, { Router } from "express";

import { paineisDeBordoController as c } from "../../controllers/analisesGerenciais/paineisDeBordoController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { verificarPermissao } from "../../middlewares/verificarPermissao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/**
 * Os Painéis de Bordo (31/10/2026): montado em /paineis-de-bordo, com as rotas dos Relatórios Executivos. Ler a tela vê
 * os seus painéis, os compartilhados com ele e os públicos finalizados (01/11/2026); editar cria painéis e altera, finaliza e
 * reabre os seus e os compartilhados com ele (o serviço confere quem criou e os editores convidados; o Administrador vê e
 * altera todos).
 */
export const paineisDeBordoRoutes = Router();
const ler = verificarPermissao("paineis_de_bordo:ler");
const editar = verificarPermissao("paineis_de_bordo:editar");
paineisDeBordoRoutes.get("/", autenticacao, ler, asyncHandler(c.listar));
paineisDeBordoRoutes.post("/", autenticacao, editar, asyncHandler(c.criar));
paineisDeBordoRoutes.get("/:id", autenticacao, ler, asyncHandler(c.obter));
paineisDeBordoRoutes.get("/:id/dados", autenticacao, ler, asyncHandler(c.dados));
paineisDeBordoRoutes.get("/:id/configuracoes", autenticacao, ler, asyncHandler(c.configuracoes));
paineisDeBordoRoutes.put("/:id/configuracoes", autenticacao, editar, asyncHandler(c.gravarConfiguracoes));
paineisDeBordoRoutes.get("/:id/resultados", autenticacao, ler, asyncHandler(c.resultados));
paineisDeBordoRoutes.delete("/:id", autenticacao, editar, asyncHandler(c.excluir));
// As fotos: o arquivo cru no corpo (até 10 MB).
paineisDeBordoRoutes.post("/:id/fotos", autenticacao, editar, express.raw({ type: () => true, limit: "10mb" }), asyncHandler(c.salvarFoto));
paineisDeBordoRoutes.get("/:id/fotos/:arquivo", autenticacao, ler, asyncHandler(c.lerFoto));
// Os vídeos: o arquivo cru no corpo, gravado enquanto chega (até 200 MB), e a leitura em partes (Range).
paineisDeBordoRoutes.post("/:id/videos", autenticacao, editar, asyncHandler(c.salvarVideo));
paineisDeBordoRoutes.get("/:id/videos/:arquivo", autenticacao, ler, asyncHandler(c.lerVideo));
// A cópia das fotos e dos vídeos de outro painel ou relatório, ao colar blocos copiados dele.
paineisDeBordoRoutes.post("/:id/arquivos/copiar", autenticacao, editar, asyncHandler(c.copiarArquivos));
// As páginas da tela Painel de Bordo (a rota das abas dos relatórios, com a única tela), a finalização e a reabertura
// (01/11/2026; quem criou o painel ou o Administrador, o serviço confere).
paineisDeBordoRoutes.put("/:id/abas/:tela", autenticacao, editar, asyncHandler(c.gravarPaginas));
paineisDeBordoRoutes.post("/:id/abas/:tela/finalizar", autenticacao, editar, asyncHandler(c.finalizar));
paineisDeBordoRoutes.post("/:id/abas/:tela/reabrir", autenticacao, editar, asyncHandler(c.reabrir));
// O Compartilhar (01/11/2026): os editores convidados; convidar e remover, só quem criou o painel (ou o Administrador).
paineisDeBordoRoutes.get("/:id/compartilhamento", autenticacao, ler, asyncHandler(c.compartilhamento));
paineisDeBordoRoutes.post("/:id/compartilhamento", autenticacao, editar, asyncHandler(c.compartilhar));
paineisDeBordoRoutes.delete("/:id/compartilhamento/:usuario", autenticacao, editar, asyncHandler(c.removerEditor));
