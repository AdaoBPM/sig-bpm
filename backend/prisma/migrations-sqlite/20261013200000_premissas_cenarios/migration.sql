-- As premissas dos cenários analíticos (13/10/2026): as tabelas Matriz, Filial e Serviços da tela Premissas.
-- CreateTable
CREATE TABLE "cenarios_premissas" (
    "cenario_id" TEXT NOT NULL,
    "unidade" INTEGER NOT NULL,
    "venda" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "valor" DECIMAL NOT NULL,

    PRIMARY KEY ("cenario_id", "unidade", "venda", "chave", "mes"),
    CONSTRAINT "cenarios_premissas_cenario_id_fkey" FOREIGN KEY ("cenario_id") REFERENCES "cenarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
