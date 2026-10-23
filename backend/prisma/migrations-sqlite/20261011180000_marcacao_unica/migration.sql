-- Cada marcação de cenário fica ativa em um cenário só por vez (antes, uma por exercício).
-- DropIndex
DROP INDEX "cenarios_ano_marcacao_key";

-- CreateIndex
CREATE UNIQUE INDEX "cenarios_marcacao_key" ON "cenarios"("marcacao");

