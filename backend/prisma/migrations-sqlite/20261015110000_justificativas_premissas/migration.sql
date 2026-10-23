-- As justificativas das linhas das premissas dos cenários analíticos (15/10/2026): Exportar Premissas e Importar Valores.
CREATE TABLE "cenarios_premissas_justificativas" (
    "cenario_id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "usuario_nome" TEXT NOT NULL,
    "atualizado_em" DATETIME NOT NULL,

    PRIMARY KEY ("cenario_id", "chave"),
    CONSTRAINT "cenarios_premissas_justificativas_cenario_id_fkey" FOREIGN KEY ("cenario_id") REFERENCES "cenarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
