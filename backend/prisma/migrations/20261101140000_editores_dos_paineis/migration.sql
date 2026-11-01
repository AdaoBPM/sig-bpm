-- O Compartilhar dos Painéis de Bordo (01/11/2026, pedido do Adão): quem criou o painel convida outros usuários do SIG para
-- editá-lo com ele.

-- CreateTable
CREATE TABLE "paineis_de_bordo_editores" (
    "painel_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "convidado_por" TEXT NOT NULL,
    "convidado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paineis_de_bordo_editores_pkey" PRIMARY KEY ("painel_id","usuario_id")
);

-- CreateIndex
CREATE INDEX "paineis_de_bordo_editores_usuario_id_idx" ON "paineis_de_bordo_editores"("usuario_id");

-- AddForeignKey
ALTER TABLE "paineis_de_bordo_editores" ADD CONSTRAINT "paineis_de_bordo_editores_painel_id_fkey" FOREIGN KEY ("painel_id") REFERENCES "paineis_de_bordo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paineis_de_bordo_editores" ADD CONSTRAINT "paineis_de_bordo_editores_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
