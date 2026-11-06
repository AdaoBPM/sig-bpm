-- Os Arquivos Gerais (05/11/2026, pedido do Adão): o processo da Controladoria com as telas Treinamentos e Informativos, em
-- que se adicionam, visualizam, baixam e excluem arquivos, cada um com a descrição. O grupo entra na matriz dos perfis (o
-- Administrador alcança tudo pelo código; os demais perfis, só depois de liberados na tela Perfis: Ler visualiza e baixa;
-- Editar também adiciona e exclui). O conteúdo fica no disco (UPLOAD_DIR/arquivos-gerais); a tabela guarda a descrição, o
-- nome, o tipo, o tamanho e quem enviou.

-- CreateEnum
CREATE TYPE "CategoriaArquivoGeral" AS ENUM ('TREINAMENTOS', 'INFORMATIVOS');

-- AlterEnum
ALTER TYPE "RecursoSistema" ADD VALUE 'ARQUIVOS_GERAIS';

-- CreateTable
CREATE TABLE "arquivos_gerais" (
    "id" TEXT NOT NULL,
    "categoria" "CategoriaArquivoGeral" NOT NULL,
    "descricao" TEXT NOT NULL,
    "nome_original" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "arquivo" TEXT NOT NULL,
    "enviado_por" TEXT,
    "enviado_por_nome" TEXT,
    "enviado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arquivos_gerais_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "arquivos_gerais_arquivo_key" ON "arquivos_gerais"("arquivo");

-- CreateIndex
CREATE INDEX "arquivos_gerais_categoria_enviado_em_idx" ON "arquivos_gerais"("categoria", "enviado_em");

