-- A correspondência tarefa × linha (14/10/2026), para a referência realizada dos cenários analíticos: a tarefa das
-- requisições e das notas fiscais, numa filial (nula: qualquer), e a linha dos custos dela. Já vem com a correspondência
-- confirmada pelo usuário em 13/10/2026; o resto se cadastra na tela.
-- CreateTable
CREATE TABLE "correspondencias_tarefas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filial" INTEGER,
    "tarefa" TEXT NOT NULL,
    "linha_id" TEXT NOT NULL,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL,
    CONSTRAINT "correspondencias_tarefas_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "correspondencias_tarefas_filial_tarefa_key" ON "correspondencias_tarefas"("filial", "tarefa");

-- A correspondência confirmada (13/10/2026).
INSERT INTO "correspondencias_tarefas" ("id", "filial", "tarefa", "linha_id", "criado_em", "atualizado_em") SELECT lower(hex(randomblob(16))), 1, 'PILAR', "id", strftime('%Y-%m-%dT%H:%M:%f+00:00','now'), strftime('%Y-%m-%dT%H:%M:%f+00:00','now') FROM "linhas" WHERE "tipo" = 'PRODUTO' AND "codigo" = 'ESTRUTURA';
INSERT INTO "correspondencias_tarefas" ("id", "filial", "tarefa", "linha_id", "criado_em", "atualizado_em") SELECT lower(hex(randomblob(16))), 1, 'VIGA', "id", strftime('%Y-%m-%dT%H:%M:%f+00:00','now'), strftime('%Y-%m-%dT%H:%M:%f+00:00','now') FROM "linhas" WHERE "tipo" = 'PRODUTO' AND "codigo" = 'ESTRUTURA';
INSERT INTO "correspondencias_tarefas" ("id", "filial", "tarefa", "linha_id", "criado_em", "atualizado_em") SELECT lower(hex(randomblob(16))), 1, 'PAINEL MACIÇO', "id", strftime('%Y-%m-%dT%H:%M:%f+00:00','now'), strftime('%Y-%m-%dT%H:%M:%f+00:00','now') FROM "linhas" WHERE "tipo" = 'PRODUTO' AND "codigo" = 'ESTRUTURA';
INSERT INTO "correspondencias_tarefas" ("id", "filial", "tarefa", "linha_id", "criado_em", "atualizado_em") SELECT lower(hex(randomblob(16))), 1, 'CORTINA', "id", strftime('%Y-%m-%dT%H:%M:%f+00:00','now'), strftime('%Y-%m-%dT%H:%M:%f+00:00','now') FROM "linhas" WHERE "tipo" = 'PRODUTO' AND "codigo" = 'ESTRUTURA';
INSERT INTO "correspondencias_tarefas" ("id", "filial", "tarefa", "linha_id", "criado_em", "atualizado_em") SELECT lower(hex(randomblob(16))), 1, 'ESCADA', "id", strftime('%Y-%m-%dT%H:%M:%f+00:00','now'), strftime('%Y-%m-%dT%H:%M:%f+00:00','now') FROM "linhas" WHERE "tipo" = 'PRODUTO' AND "codigo" = 'ESTRUTURA';
INSERT INTO "correspondencias_tarefas" ("id", "filial", "tarefa", "linha_id", "criado_em", "atualizado_em") SELECT lower(hex(randomblob(16))), 1, 'BLOCO/SAPATA', "id", strftime('%Y-%m-%dT%H:%M:%f+00:00','now'), strftime('%Y-%m-%dT%H:%M:%f+00:00','now') FROM "linhas" WHERE "tipo" = 'PRODUTO' AND "codigo" = 'ESTRUTURA';
INSERT INTO "correspondencias_tarefas" ("id", "filial", "tarefa", "linha_id", "criado_em", "atualizado_em") SELECT lower(hex(randomblob(16))), 1, 'PAREDE', "id", strftime('%Y-%m-%dT%H:%M:%f+00:00','now'), strftime('%Y-%m-%dT%H:%M:%f+00:00','now') FROM "linhas" WHERE "tipo" = 'PRODUTO' AND "codigo" = 'ESTRUTURA';
INSERT INTO "correspondencias_tarefas" ("id", "filial", "tarefa", "linha_id", "criado_em", "atualizado_em") SELECT lower(hex(randomblob(16))), 1, 'NIVELADORA', "id", strftime('%Y-%m-%dT%H:%M:%f+00:00','now'), strftime('%Y-%m-%dT%H:%M:%f+00:00','now') FROM "linhas" WHERE "tipo" = 'PRODUTO' AND "codigo" = 'ESTRUTURA';
INSERT INTO "correspondencias_tarefas" ("id", "filial", "tarefa", "linha_id", "criado_em", "atualizado_em") SELECT lower(hex(randomblob(16))), 1, 'CALHA', "id", strftime('%Y-%m-%dT%H:%M:%f+00:00','now'), strftime('%Y-%m-%dT%H:%M:%f+00:00','now') FROM "linhas" WHERE "tipo" = 'PRODUTO' AND "codigo" = 'ESTRUTURA';
INSERT INTO "correspondencias_tarefas" ("id", "filial", "tarefa", "linha_id", "criado_em", "atualizado_em") SELECT lower(hex(randomblob(16))), 1, 'LAJE', "id", strftime('%Y-%m-%dT%H:%M:%f+00:00','now'), strftime('%Y-%m-%dT%H:%M:%f+00:00','now') FROM "linhas" WHERE "tipo" = 'PRODUTO' AND "codigo" = 'ESTRUTURA';
INSERT INTO "correspondencias_tarefas" ("id", "filial", "tarefa", "linha_id", "criado_em", "atualizado_em") SELECT lower(hex(randomblob(16))), 1, 'LAJE MACIÇA', "id", strftime('%Y-%m-%dT%H:%M:%f+00:00','now'), strftime('%Y-%m-%dT%H:%M:%f+00:00','now') FROM "linhas" WHERE "tipo" = 'PRODUTO' AND "codigo" = 'ESTRUTURA';
INSERT INTO "correspondencias_tarefas" ("id", "filial", "tarefa", "linha_id", "criado_em", "atualizado_em") SELECT lower(hex(randomblob(16))), 1, 'ESTRUTURA METÁLICA', "id", strftime('%Y-%m-%dT%H:%M:%f+00:00','now'), strftime('%Y-%m-%dT%H:%M:%f+00:00','now') FROM "linhas" WHERE "tipo" = 'PRODUTO' AND "codigo" = 'METALÚRGICA';
INSERT INTO "correspondencias_tarefas" ("id", "filial", "tarefa", "linha_id", "criado_em", "atualizado_em") SELECT lower(hex(randomblob(16))), 1, 'TERÇA METÁLICA', "id", strftime('%Y-%m-%dT%H:%M:%f+00:00','now'), strftime('%Y-%m-%dT%H:%M:%f+00:00','now') FROM "linhas" WHERE "tipo" = 'PRODUTO' AND "codigo" = 'METALÚRGICA';
INSERT INTO "correspondencias_tarefas" ("id", "filial", "tarefa", "linha_id", "criado_em", "atualizado_em") SELECT lower(hex(randomblob(16))), 1, 'CALHA METÁLICA', "id", strftime('%Y-%m-%dT%H:%M:%f+00:00','now'), strftime('%Y-%m-%dT%H:%M:%f+00:00','now') FROM "linhas" WHERE "tipo" = 'PRODUTO' AND "codigo" = 'METALÚRGICA';
INSERT INTO "correspondencias_tarefas" ("id", "filial", "tarefa", "linha_id", "criado_em", "atualizado_em") SELECT lower(hex(randomblob(16))), 1, 'INSERTO METÁLICO', "id", strftime('%Y-%m-%dT%H:%M:%f+00:00','now'), strftime('%Y-%m-%dT%H:%M:%f+00:00','now') FROM "linhas" WHERE "tipo" = 'PRODUTO' AND "codigo" = 'METALÚRGICA';
INSERT INTO "correspondencias_tarefas" ("id", "filial", "tarefa", "linha_id", "criado_em", "atualizado_em") SELECT lower(hex(randomblob(16))), 2, 'LAJE', "id", strftime('%Y-%m-%dT%H:%M:%f+00:00','now'), strftime('%Y-%m-%dT%H:%M:%f+00:00','now') FROM "linhas" WHERE "tipo" = 'PRODUTO' AND "codigo" = 'ALVEOLARES';
INSERT INTO "correspondencias_tarefas" ("id", "filial", "tarefa", "linha_id", "criado_em", "atualizado_em") SELECT lower(hex(randomblob(16))), 2, 'PAINEL', "id", strftime('%Y-%m-%dT%H:%M:%f+00:00','now'), strftime('%Y-%m-%dT%H:%M:%f+00:00','now') FROM "linhas" WHERE "tipo" = 'PRODUTO' AND "codigo" = 'ALVEOLARES';
INSERT INTO "correspondencias_tarefas" ("id", "filial", "tarefa", "linha_id", "criado_em", "atualizado_em") SELECT lower(hex(randomblob(16))), 2, 'ESTACA', "id", strftime('%Y-%m-%dT%H:%M:%f+00:00','now'), strftime('%Y-%m-%dT%H:%M:%f+00:00','now') FROM "linhas" WHERE "tipo" = 'PRODUTO' AND "codigo" = 'ESTACAS';
INSERT INTO "correspondencias_tarefas" ("id", "filial", "tarefa", "linha_id", "criado_em", "atualizado_em") SELECT lower(hex(randomblob(16))), NULL, 'TELHAMENTO', "id", strftime('%Y-%m-%dT%H:%M:%f+00:00','now'), strftime('%Y-%m-%dT%H:%M:%f+00:00','now') FROM "linhas" WHERE "tipo" = 'OBRA' AND "codigo" = 'TELHAMENTO';
INSERT INTO "correspondencias_tarefas" ("id", "filial", "tarefa", "linha_id", "criado_em", "atualizado_em") SELECT lower(hex(randomblob(16))), NULL, 'VEDAÇÃO', "id", strftime('%Y-%m-%dT%H:%M:%f+00:00','now'), strftime('%Y-%m-%dT%H:%M:%f+00:00','now') FROM "linhas" WHERE "tipo" = 'OBRA' AND "codigo" = 'VEDAÇÃO';
INSERT INTO "correspondencias_tarefas" ("id", "filial", "tarefa", "linha_id", "criado_em", "atualizado_em") SELECT lower(hex(randomblob(16))), NULL, 'FUNDAÇÃO', "id", strftime('%Y-%m-%dT%H:%M:%f+00:00','now'), strftime('%Y-%m-%dT%H:%M:%f+00:00','now') FROM "linhas" WHERE "tipo" = 'OBRA' AND "codigo" = 'FUNDAÇÃO';
