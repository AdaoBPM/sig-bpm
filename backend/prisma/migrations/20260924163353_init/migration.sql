-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "usuario_permissoes" (
    "usuario_id" TEXT NOT NULL,
    "permissao" TEXT NOT NULL,

    PRIMARY KEY ("usuario_id", "permissao"),
    CONSTRAINT "usuario_permissoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "acao" TEXT NOT NULL,
    "entidade" TEXT,
    "entidade_id" TEXT,
    "usuario_id" TEXT,
    "usuario_nome" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "dados_antes" JSONB,
    "dados_depois" JSONB,
    "metadados" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuario_permissoes_permissao_idx" ON "usuario_permissoes"("permissao");

-- CreateIndex
CREATE INDEX "audit_log_usuario_id_created_at_idx" ON "audit_log"("usuario_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_log_entidade_entidade_id_idx" ON "audit_log"("entidade", "entidade_id");
