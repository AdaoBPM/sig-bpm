-- A finalização dos Painéis de Bordo (01/11/2026, pedido do Adão), como a dos grupos dos Relatórios Executivos: em
-- elaboração, só quem criou o painel e o Administrador o veem; finalizado, fica só para leitura, e o público aparece para os
-- demais. Os painéis de antes ficam em elaboração.

-- AlterTable
ALTER TABLE "paineis_de_bordo" ADD COLUMN     "finalizado_em" TIMESTAMP(3),
ADD COLUMN     "finalizado_por" TEXT,
ADD COLUMN     "situacao" "SituacaoRelatorio" NOT NULL DEFAULT 'EM_ELABORACAO';
